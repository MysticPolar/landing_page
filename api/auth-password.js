/**
 * /api/auth-password?op=forgot|reset
 *
 * Routes via vercel.json rewrites:
 *   /api/auth-forgot → ?op=forgot
 *   /api/auth-reset  → ?op=reset
 */

const crypto = require('crypto')
const { normalizeSupabaseUrl, authHeaders } = require('../lib/supabase-rest')
const { hashPassword } = require('../lib/password-hash')
const { sendEmail } = require('../lib/emails')
const { pickClientIp } = require('../lib/sessions')
const { enforceRateLimits, PRESETS } = require('../lib/rate-limit')

function originOf(req) {
  const proto = (req.headers['x-forwarded-proto'] || '').split(',')[0].trim() || 'https'
  const host = req.headers['x-forwarded-host'] || req.headers.host
  return `${proto}://${host}`
}
function newToken() {
  return crypto.randomBytes(32).toString('hex')
}
function hashToken(t) {
  return crypto.createHash('sha256').update(String(t)).digest('hex')
}

async function opForgot(req, res, baseUrl, key, body) {
  const email = String(body.email || '').trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' })
  }
  const ip = pickClientIp(req)
  const rl = await enforceRateLimits(baseUrl, key, PRESETS.authForgot(ip, email))
  if (!rl.ok) {
    return res.status(200).json({
      ok: true, message: 'If that email is registered, a reset link is on its way.',
    })
  }

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
  } catch (err) { console.error('auth-forgot lookup failed', err) }

  if (user) {
    const token = newToken()
    const tokenHash = hashToken(token)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    try {
      await fetch(`${baseUrl}/rest/v1/auth_tokens`, {
        method: 'POST',
        headers: { ...authHeaders(key), Prefer: 'return=minimal' },
        body: JSON.stringify({
          user_id: user.id, purpose: 'password_reset',
          token_hash: tokenHash, expires_at: expiresAt,
        }),
      })
      const origin = originOf(req)
      const resetUrl = `${origin}/reset-password.html?token=${encodeURIComponent(token)}`
      await sendEmail({
        baseUrl, key, to: user.email, kind: 'password_reset',
        language: user.preferred_language || 'en', userId: user.id,
        vars: { name: user.display_name || user.email.split('@')[0], resetUrl },
      })
    } catch (err) { console.error('auth-forgot send failed', err) }
  }
  return res.status(200).json({
    ok: true, message: 'If that email is registered, a reset link is on its way.',
  })
}

async function opReset(req, res, baseUrl, key, body) {
  const token = String(body.token || '').trim()
  const newPassword = String(body.newPassword || '')
  if (!token) return res.status(400).json({ error: 'Token is required.' })
  if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' })
  if (newPassword.length > 256) return res.status(400).json({ error: 'Password is too long.' })

  const tokenHash = hashToken(token)
  const nowIso = new Date().toISOString()
  const lookup = await fetch(
    `${baseUrl}/rest/v1/auth_tokens?token_hash=eq.${encodeURIComponent(tokenHash)}` +
      `&purpose=eq.password_reset&select=id,user_id,expires_at,used_at`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  )
  if (!lookup.ok) return res.status(500).json({ error: 'Could not reset password right now.' })
  const rows = await lookup.json()
  const tokRow = rows[0]
  if (!tokRow) return res.status(400).json({ error: 'This reset link is invalid.' })
  if (tokRow.used_at) return res.status(410).json({ error: 'This reset link has already been used.' })
  if (Date.parse(tokRow.expires_at) < Date.now()) return res.status(410).json({ error: 'This reset link has expired.' })

  const claimRes = await fetch(
    `${baseUrl}/rest/v1/auth_tokens?id=eq.${encodeURIComponent(tokRow.id)}&used_at=is.null`,
    {
      method: 'PATCH',
      headers: { ...authHeaders(key), Prefer: 'return=representation' },
      body: JSON.stringify({ used_at: nowIso }),
    }
  )
  if (!claimRes.ok) return res.status(500).json({ error: 'Could not reset password right now.' })
  const claimed = await claimRes.json()
  if (!claimed[0]) return res.status(410).json({ error: 'This reset link has already been used.' })

  const newHash = hashPassword(newPassword)
  const upd = await fetch(
    `${baseUrl}/rest/v1/users?id=eq.${encodeURIComponent(tokRow.user_id)}`,
    {
      method: 'PATCH',
      headers: { ...authHeaders(key), Prefer: 'return=minimal' },
      body: JSON.stringify({ password_hash: newHash }),
    }
  )
  if (!upd.ok) return res.status(500).json({ error: 'Could not reset password right now.' })

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

  let body
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' })
  }

  const url = new URL(req.url || '/', 'http://x')
  const op = url.searchParams.get('op')
  switch (op) {
    case 'forgot': return opForgot(req, res, baseUrl, key, body)
    case 'reset':  return opReset(req, res, baseUrl, key, body)
    default:       return res.status(400).json({ error: 'unknown op' })
  }
}
