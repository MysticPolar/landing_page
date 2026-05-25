/**
 * POST /api/auth-logout
 *
 * Revokes the current session (best-effort) and clears the cookie.
 * Always returns 200 — logout is idempotent from the client's view.
 */

const { normalizeSupabaseUrl } = require('../lib/supabase-rest')
const { revokeSession } = require('../lib/sessions')
const { getSessionToken, clearSessionCookie } = require('../lib/cookies')

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(204).end()
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const rawUrl = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const token = getSessionToken(req)

  if (token && rawUrl && key) {
    try {
      await revokeSession(normalizeSupabaseUrl(rawUrl), key, token)
    } catch (err) {
      console.error('revokeSession failed', err)
    }
  }

  clearSessionCookie(res)
  return res.status(200).json({ ok: true })
}
