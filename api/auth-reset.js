/**
 * POST /api/auth-reset
 *
 * Body: { token, newPassword }
 *
 * Consumes a password-reset token and sets a new password.
 * On success, revokes all the user's existing sessions for safety.
 */

const crypto = require('crypto')
const { normalizeSupabaseUrl, authHeaders } = require('../lib/supabase-rest')
const { hashPassword } = require('../lib/password-hash')

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
  const token = String(body.token || '').trim()
  const newPassword = String(body.newPassword || '')

  if (!token) return res.status(400).json({ error: 'Token is required.' })
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' })
  }
  if (newPassword.length > 256) {
    return res.status(400).json({ error: 'Password is too long.' })
  }

  const rawUrl = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!rawUrl || !key) return res.status(500).json({ error: 'Server is not configured.' })
  const baseUrl = normalizeSupabaseUrl(rawUrl)
  const tokenHash = hashToken(token)
  const nowIso = new Date().toISOString()

  // Look up token.
  const lookup = await fetch(
    `${baseUrl}/rest/v1/auth_tokens?token_hash=eq.${encodeURIComponent(tokenHash)}` +
      `&purpose=eq.password_reset&select=id,user_id,expires_at,used_at`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  )
  if (!lookup.ok) {
    return res.status(500).json({ error: 'Could not reset password right now.' })
  }
  const rows = await lookup.json()
  const tokRow = rows[0]
  if (!tokRow) return res.status(400).json({ error: 'This reset link is invalid.' })
  if (tokRow.used_at) {
    return res.status(410).json({ error: 'This reset link has already been used.' })
  }
  if (Date.parse(tokRow.expires_at) < Date.now()) {
    return res.status(410).json({ error: 'This reset link has expired.' })
  }

  // Atomically mark used. If two requests race, only one will succeed.
  const claimRes = await fetch(
    `${baseUrl}/rest/v1/auth_tokens?id=eq.${encodeURIComponent(tokRow.id)}&used_at=is.null`,
    {
      method: 'PATCH',
      headers: { ...authHeaders(key), Prefer: 'return=representation' },
      body: JSON.stringify({ used_at: nowIso }),
    }
  )
  if (!claimRes.ok) {
    return res.status(500).json({ error: 'Could not reset password right now.' })
  }
  const claimed = await claimRes.json()
  if (!claimed[0]) {
    return res.status(410).json({ error: 'This reset link has already been used.' })
  }

  // Update password.
  const newHash = hashPassword(newPassword)
  const upd = await fetch(
    `${baseUrl}/rest/v1/users?id=eq.${encodeURIComponent(tokRow.user_id)}`,
    {
      method: 'PATCH',
      headers: { ...authHeaders(key), Prefer: 'return=minimal' },
      body: JSON.stringify({ password_hash: newHash }),
    }
  )
  if (!upd.ok) {
    return res.status(500).json({ error: 'Could not reset password right now.' })
  }

  // Revoke all the user's sessions for safety.
  fetch(
    `${baseUrl}/rest/v1/sessions?user_id=eq.${encodeURIComponent(tokRow.user_id)}&revoked_at=is.null`,
    {
      method: 'PATCH',
      headers: { ...authHeaders(key), Prefer: 'return=minimal' },
      body: JSON.stringify({ revoked_at: nowIso }),
    }
  ).catch(() => {})

  return res.status(200).json({ ok: true, message: 'Password updated. Please log in.' })
}
