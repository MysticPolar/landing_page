/**
 * /api/founding?op=checkout|request-more
 *
 * Routes via vercel.json rewrites:
 *   /api/checkout-create-session     → ?op=checkout       POST
 *   /api/founding-codes-request-more → ?op=request-more   POST
 *
 * Both ops require an authenticated session.
 */

const { normalizeSupabaseUrl, authHeaders } = require('../lib/supabase-rest')
const { validateSession } = require('../lib/sessions')
const { getSessionToken } = require('../lib/cookies')
const { createCheckoutSession } = require('../lib/stripe')
const { sendEmail } = require('../lib/emails')

const REQUEST_MORE_ERRORS = {
  user_not_found:        'Account not found.',
  not_founding:          'Only founding members can request more codes.',
  codes_remaining:       'Use your remaining codes before requesting more.',
  lifetime_cap_reached:  "You've already minted the maximum of 100 codes.",
}
function publicReqMoreMsg(text) {
  if (!text) return 'Could not mint more codes right now.'
  const key = Object.keys(REQUEST_MORE_ERRORS).find((k) => text.indexOf(k) >= 0)
  return key ? REQUEST_MORE_ERRORS[key] : 'Could not mint more codes right now.'
}

function originOf(req) {
  const proto = (req.headers['x-forwarded-proto'] || '').split(',')[0].trim() || 'https'
  const host = req.headers['x-forwarded-host'] || req.headers.host
  return `${proto}://${host}`
}

async function opCheckout(req, res, baseUrl, key, session) {
  const stripeSecret = process.env.STRIPE_SECRET_KEY
  const priceId = process.env.STRIPE_FOUNDING_PRICE_ID
  if (!stripeSecret || !priceId) {
    return res.status(503).json({ error: 'Founding upgrade is not available yet.' })
  }
  if (session.user.tier === 'founding') {
    return res.status(409).json({ error: 'You are already a founding member.' })
  }
  const origin = originOf(req)
  try {
    const checkout = await createCheckoutSession({
      secretKey: stripeSecret,
      priceId,
      successUrl: `${origin}/postoffice.html?upgraded=1`,
      cancelUrl: `${origin}/postoffice.html?upgrade=cancelled`,
      customerEmail: session.user.email,
      clientReferenceId: session.user.id,
      metadata: { user_id: session.user.id, upgrade_type: 'founding' },
    })
    return res.status(200).json({ url: checkout.url })
  } catch (err) {
    console.error('createCheckoutSession failed', err)
    return res.status(502).json({ error: 'Could not start checkout. Please try again.' })
  }
}

async function opRequestMore(req, res, baseUrl, key, session) {
  if (session.user.tier !== 'founding') {
    return res.status(403).json({ error: 'Only founding members can request more codes.' })
  }
  const rpcRes = await fetch(`${baseUrl}/rest/v1/rpc/request_more_founding_codes`, {
    method: 'POST',
    headers: { ...authHeaders(key) },
    body: JSON.stringify({ p_user_id: session.user.id }),
  })
  if (!rpcRes.ok) {
    const text = await rpcRes.text()
    console.error('request_more_founding_codes RPC failed', rpcRes.status, text)
    return res.status(400).json({ error: publicReqMoreMsg(text) })
  }
  const result = await rpcRes.json()
  ;(async () => {
    try {
      await sendEmail({
        baseUrl, key,
        to: session.user.email,
        kind: 'codes_minted',
        language: session.user.preferred_language || 'en',
        userId: session.user.id,
        vars: {
          name: session.user.display_name || session.user.email.split('@')[0],
          codes: result.codes || [],
        },
      })
    } catch (err) { console.error('codes_minted email failed', err) }
  })()
  return res.status(200).json({
    ok: true, codes: result.codes || [], newLifetimeTotal: result.new_lifetime_total,
  })
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    return res.status(204).end()
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const rawUrl = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!rawUrl || !key) return res.status(500).json({ error: 'Server is not configured.' })
  const baseUrl = normalizeSupabaseUrl(rawUrl)

  const token = getSessionToken(req)
  if (!token) return res.status(401).json({ error: 'Please log in.' })
  const session = await validateSession(baseUrl, key, token)
  if (!session) return res.status(401).json({ error: 'Please log in.' })

  const url = new URL(req.url || '/', 'http://x')
  const op = url.searchParams.get('op')

  switch (op) {
    case 'checkout':      return opCheckout(req, res, baseUrl, key, session)
    case 'request-more':  return opRequestMore(req, res, baseUrl, key, session)
    default:              return res.status(400).json({ error: 'unknown op' })
  }
}
