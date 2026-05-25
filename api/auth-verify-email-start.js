/**
 * POST /api/auth-verify-email-start
 *
 * Authenticated. Creates a 24-hour single-use email-verify token and
 * emails the user a link. Idempotent-ish: existing un-used tokens stay
 * usable; a new one is also minted on each call.
 */

const crypto = require('crypto')
const { normalizeSupabaseUrl, authHeaders } = require('../lib/supabase-rest')
const { validateSession } = require('../lib/sessions')
const { getSessionToken } = require('../lib/cookies')
const { sendEmail } = require('../lib/emails')

function originOf(req) {
  const proto =
    (req.headers['x-forwarded-proto'] || '').split(',')[0].trim() || 'https'
  const host = req.headers['x-forwarded-host'] || req.headers.host
  return `${proto}://${host}`
}
function newToken() {
  return crypto.randomBytes(32).toString('hex')
}
function hashToken(t) {
  return crypto.createHash('sha256').update(String(t)).digest('hex')
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

  const cookieTok = getSessionToken(req)
  if (!cookieTok) return res.status(401).json({ error: 'Please log in.' })
  const session = await validateSession(baseUrl, key, cookieTok)
  if (!session) return res.status(401).json({ error: 'Please log in.' })
  const u = session.user

  if (u.email_verified_at) {
    return res.status(200).json({ ok: true, alreadyVerified: true })
  }

  const token = newToken()
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  const insertRes = await fetch(`${baseUrl}/rest/v1/auth_tokens`, {
    method: 'POST',
    headers: { ...authHeaders(key), Prefer: 'return=minimal' },
    body: JSON.stringify({
      user_id: u.id,
      purpose: 'email_verify',
      token_hash: tokenHash,
      expires_at: expiresAt,
    }),
  })
  if (!insertRes.ok) {
    const text = await insertRes.text()
    console.error('auth-verify-email-start insert failed', text)
    return res.status(500).json({ error: 'Could not start verification.' })
  }

  const origin = originOf(req)
  const verifyUrl = `${origin}/verify-email.html?token=${encodeURIComponent(token)}`
  await sendEmail({
    baseUrl, key,
    to: u.email,
    kind: 'email_verify',
    language: u.preferred_language || 'en',
    userId: u.id,
    vars: {
      name: u.display_name || u.email.split('@')[0],
      verifyUrl,
    },
  })

  return res.status(200).json({ ok: true })
}
