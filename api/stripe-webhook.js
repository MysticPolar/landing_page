/**
 * POST /api/stripe-webhook
 *
 * Receives Stripe events. Verifies the signature, then handles:
 *   checkout.session.completed (payment_status=paid) → calls
 *   upgrade_to_founding(user_id, stripe_customer_id) which is idempotent.
 *
 * Idempotency: the RPC itself returns { already_founding: true } if the
 * user is already founding. We also de-dup by checking event.id against
 * email_log (we write a 'stripe_event_processed' row on first handle).
 *
 * IMPORTANT: this endpoint must read the *raw* request body, NOT the
 * parsed JSON, because the signature is computed over the exact bytes.
 * Vercel parses by default — we disable that below.
 */

const { normalizeSupabaseUrl, authHeaders } = require('../lib/supabase-rest')
const { verifyWebhookSignature } = require('../lib/stripe')
const { sendEmail, formatSeat: formatSeatForEmail } = require('../lib/emails')

// Tell Vercel/Next not to parse the body — we need the raw bytes.
module.exports.config = {
  api: { bodyParser: false },
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

async function alreadyProcessed(baseUrl, key, eventId) {
  const res = await fetch(
    `${baseUrl}/rest/v1/email_log?provider_message_id=eq.${encodeURIComponent(eventId)}&kind=eq.stripe_event&select=id&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  )
  if (!res.ok) return false
  const rows = await res.json()
  return rows.length > 0
}

async function markProcessed(baseUrl, key, eventId, note) {
  await fetch(`${baseUrl}/rest/v1/email_log`, {
    method: 'POST',
    headers: { ...authHeaders(key), Prefer: 'return=minimal' },
    body: JSON.stringify({
      to_email: 'stripe@internal',
      kind: 'stripe_event',
      language: 'en',
      subject: note || 'stripe webhook',
      provider_message_id: eventId,
      status: 'sent',
      sent_at: new Date().toISOString(),
    }),
  }).catch(() => {})
}

async function upgradeUser(baseUrl, key, userId, stripeCustomerId) {
  const res = await fetch(`${baseUrl}/rest/v1/rpc/upgrade_to_founding`, {
    method: 'POST',
    headers: { ...authHeaders(key) },
    body: JSON.stringify({
      p_user_id: userId,
      p_stripe_customer_id: stripeCustomerId || null,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`upgrade_to_founding RPC failed: ${res.status} ${text}`)
  }
  return res.json()
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  const rawUrl = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!stripeSecret || !webhookSecret || !rawUrl || !key) {
    console.error('stripe-webhook: missing env')
    return res.status(500).json({ error: 'misconfigured' })
  }
  const baseUrl = normalizeSupabaseUrl(rawUrl)

  let rawBody
  try {
    rawBody = await readRawBody(req)
  } catch (err) {
    console.error('stripe-webhook: read body failed', err)
    return res.status(400).json({ error: 'bad body' })
  }

  let event
  try {
    event = verifyWebhookSignature({
      rawBody,
      signatureHeader: req.headers['stripe-signature'],
      secret: webhookSecret,
    })
  } catch (err) {
    console.error('stripe-webhook: signature verify failed', err.message)
    return res.status(400).json({ error: 'bad signature' })
  }

  // Idempotency: did we already process this event?
  if (await alreadyProcessed(baseUrl, key, event.id)) {
    return res.status(200).json({ ok: true, deduped: true })
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data && event.data.object
      if (session && session.payment_status === 'paid') {
        const userId = (session.metadata && session.metadata.user_id) || session.client_reference_id
        const customerId = session.customer || null
        if (userId) {
          const upgradeResult = await upgradeUser(baseUrl, key, userId, customerId)

          // Send founding welcome email (skip on idempotent re-fire).
          if (upgradeResult && !upgradeResult.already_founding) {
            try {
              const userRes = await fetch(
                `${baseUrl}/rest/v1/users?id=eq.${encodeURIComponent(userId)}&select=email,display_name,preferred_language`,
                { headers: { apikey: key, Authorization: `Bearer ${key}` } }
              )
              const userRows = userRes.ok ? await userRes.json() : []
              const u = userRows[0]
              if (u) {
                await sendEmail({
                  baseUrl, key,
                  to: u.email,
                  kind: 'signup_founding',
                  language: u.preferred_language || 'en',
                  userId,
                  vars: {
                    name: u.display_name || u.email.split('@')[0],
                    seat: formatSeatForEmail('founding', upgradeResult.founding_seat_number),
                    codes: upgradeResult.codes || [],
                  },
                })
              }
            } catch (e) {
              console.error('stripe-webhook: welcome email failed', e)
            }
          }
        } else {
          console.warn('stripe-webhook: completed without user_id', event.id)
        }
      }
    }
    // Other event types: ignore (return 200 so Stripe stops retrying).

    await markProcessed(baseUrl, key, event.id, event.type)
    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('stripe-webhook: handler failed', err)
    // Return 500 so Stripe will retry.
    return res.status(500).json({ error: 'handler failed' })
  }
}
