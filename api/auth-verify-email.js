/**
 * POST /api/auth-verify-email
 *
 * Body: { token }
 *
 * Consumes an email_verify token and sets users.email_verified_at = now().
 * Single-use; safe to call from a frontend page that received the token
 * in a URL query string.
 */

const crypto = require('crypto')
const { normalizeSupabaseUrl, authHeaders } = require('../lib/supabase-rest')

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
  if (!token) return res.status(400).json({ error: 'Token is required.' })

  const rawUrl = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!rawUrl || !key) return res.status(500).json({ error: 'Server is not configured.' })
  const baseUrl = normalizeSupabaseUrl(rawUrl)
  const tokenHash = hashToken(token)
  const nowIso = new Date().toISOString()

  const lookup = await fetch(
    `${baseUrl}/rest/v1/auth_tokens?token_hash=eq.${encodeURIComponent(tokenHash)}` +
      `&purpose=eq.email_verify&select=id,user_id,expires_at,used_at`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  )
  if (!lookup.ok) return res.status(500).json({ error: 'Could not verify right now.' })
  const rows = await lookup.json()
  const tokRow = rows[0]
  if (!tokRow) return res.status(400).json({ error: 'This verification link is invalid.' })
  if (tokRow.used_at) {
    return res.status(410).json({ error: 'This verification link has already been used.' })
  }
  if (Date.parse(tokRow.expires_at) < Date.now()) {
    return res.status(410).json({ error: 'This verification link has expired.' })
  }

  // Atomic claim.
  const claimRes = await fetch(
    `${baseUrl}/rest/v1/auth_tokens?id=eq.${encodeURIComponent(tokRow.id)}&used_at=is.null`,
    {
      method: 'PATCH',
      headers: { ...authHeaders(key), Prefer: 'return=representation' },
      body: JSON.stringify({ used_at: nowIso }),
    }
  )
  if (!claimRes.ok) return res.status(500).json({ error: 'Could not verify right now.' })
  const claimed = await claimRes.json()
  if (!claimed[0]) {
    return res.status(410).json({ error: 'This verification link has already been used.' })
  }

  await fetch(
    `${baseUrl}/rest/v1/users?id=eq.${encodeURIComponent(tokRow.user_id)}`,
    {
      method: 'PATCH',
      headers: { ...authHeaders(key), Prefer: 'return=minimal' },
      body: JSON.stringify({ email_verified_at: nowIso }),
    }
  )

  return res.status(200).json({ ok: true, message: 'Email verified.' })
}
