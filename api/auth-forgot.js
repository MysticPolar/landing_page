/**
 * POST /api/auth-forgot
 *
 * Body: { email }
 *
 * Starts a password-reset flow. Always returns 200 (we never leak whether
 * an email is registered). If the email matches a user, we create a 1-hour
 * single-use token and email a reset link.
 */

const crypto = require('crypto')
const { normalizeSupabaseUrl, authHeaders } = require('../lib/supabase-rest')
const { sendEmail } = require('../lib/emails')
const { pickClientIp } = require('../lib/sessions')
const { enforceRateLimits, PRESETS } = require('../lib/rate-limit')

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

  let body
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' })
  }
  const email = String(body.email || '').trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' })
  }

  const rawUrl = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!rawUrl || !key) return res.status(500).json({ error: 'Server is not configured.' })
  const baseUrl = normalizeSupabaseUrl(rawUrl)
  const ip = pickClientIp(req)

  // Rate limit: 5 / hour per IP, 1 / hour per email.
  const rl = await enforceRateLimits(baseUrl, key, PRESETS.authForgot(ip, email))
  if (!rl.ok) {
    // Even on rate-limit, return the same 200 message — no enumeration.
    return res.status(200).json({
      ok: true,
      message: 'If that email is registered, a reset link is on its way.',
    })
  }

  // Look up the user; if not found, still return success.
  let user = null
  try {
    const lookup = await fetch(
      `${baseUrl}/rest/v1/users?email_canonical=eq.${encodeURIComponent(email)}&select=id,email,display_name,preferred_language`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    )
    if (lookup.ok) {
      const rows = await lookup.json()
      user = rows[0] || null
    }
  } catch (err) {
    console.error('auth-forgot lookup failed', err)
  }

  if (user) {
    const token = newToken()
    const tokenHash = hashToken(token)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    try {
      await fetch(`${baseUrl}/rest/v1/auth_tokens`, {
        method: 'POST',
        headers: { ...authHeaders(key), Prefer: 'return=minimal' },
        body: JSON.stringify({
          user_id: user.id,
          purpose: 'password_reset',
          token_hash: tokenHash,
          expires_at: expiresAt,
        }),
      })
      const origin = originOf(req)
      const resetUrl = `${origin}/reset-password.html?token=${encodeURIComponent(token)}`
      // Fire-and-forget — but we await so on failure the email_log is updated.
      await sendEmail({
        baseUrl, key,
        to: user.email,
        kind: 'password_reset',
        language: user.preferred_language || 'en',
        userId: user.id,
        vars: {
          name: user.display_name || user.email.split('@')[0],
          resetUrl,
        },
      })
    } catch (err) {
      console.error('auth-forgot send failed', err)
    }
  }

  // Always 200 — no enumeration.
  return res.status(200).json({
    ok: true,
    message: 'If that email is registered, a reset link is on its way.',
  })
}
