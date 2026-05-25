/**
 * POST /api/founding-codes-request-more
 *
 * Authenticated. Only available to founding members whose existing
 * personal_founding codes are all used. Mints 10 new codes per call
 * (capped at 100 lifetime per user, enforced server-side in the RPC).
 */

const { normalizeSupabaseUrl, authHeaders } = require('../lib/supabase-rest')
const { validateSession } = require('../lib/sessions')
const { getSessionToken } = require('../lib/cookies')
const { sendEmail } = require('../lib/emails')

const ERROR_MAP = {
  user_not_found:        'Account not found.',
  not_founding:          'Only founding members can request more codes.',
  codes_remaining:       'Use your remaining codes before requesting more.',
  lifetime_cap_reached:  "You've already minted the maximum of 100 codes.",
}

function publicMessage(text) {
  if (!text) return 'Could not mint more codes right now.'
  const key = Object.keys(ERROR_MAP).find((k) => text.indexOf(k) >= 0)
  return key ? ERROR_MAP[key] : 'Could not mint more codes right now.'
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    return res.status(204).end()
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const rawUrl = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!rawUrl || !key) return res.status(500).json({ error: 'Server is not configured.' })
  const baseUrl = normalizeSupabaseUrl(rawUrl)

  const token = getSessionToken(req)
  if (!token) return res.status(401).json({ error: 'Please log in.' })
  const session = await validateSession(baseUrl, key, token)
  if (!session) return res.status(401).json({ error: 'Please log in.' })
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
    return res.status(400).json({ error: publicMessage(text) })
  }

  const result = await rpcRes.json()

  // Fire-and-forget confirmation email.
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
    } catch (err) {
      console.error('codes_minted email failed', err)
    }
  })()

  return res.status(200).json({
    ok: true,
    codes: result.codes || [],
    newLifetimeTotal: result.new_lifetime_total,
  })
}
