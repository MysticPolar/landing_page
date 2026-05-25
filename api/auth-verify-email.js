/**
 * /api/auth-verify-email
 *
 * Two ops in one file:
 *   ?op=start  (POST, authenticated) — creates token + emails verification link
 *   (default)  (POST, no auth)       — body { token } consumes the token
 *
 * Routes via vercel.json rewrites:
 *   /api/auth-verify-email-start → ?op=start
 *   /api/auth-verify-email       → (default consume)
 */

const crypto = require('crypto')
const { normalizeSupabaseUrl, authHeaders } = require('../lib/supabase-rest')
const { validateSession } = require('../lib/sessions')
const { getSessionToken } = require('../lib/cookies')
const { sendEmail } = require('../lib/emails')

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

async function opStart(req, res, baseUrl, key) {
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
  const ins = await fetch(`${baseUrl}/rest/v1/auth_tokens`, {
    method: 'POST',
    headers: { ...authHeaders(key), Prefer: 'return=minimal' },
    body: JSON.stringify({
      user_id: u.id, purpose: 'email_verify',
      token_hash: tokenHash, expires_at: expiresAt,
    }),
  })
  if (!ins.ok) {
    console.error('verify-email-start insert failed', await ins.text())
    return res.status(500).json({ error: 'Could not start verification.' })
  }
  const origin = originOf(req)
  const verifyUrl = `${origin}/verify-email.html?token=${encodeURIComponent(token)}`
  await sendEmail({
    baseUrl, key, to: u.email, kind: 'email_verify',
    language: u.preferred_language || 'en', userId: u.id,
    vars: { name: u.display_name || u.email.split('@')[0], verifyUrl },
  })
  return res.status(200).json({ ok: true })
}

async function opConsume(req, res, baseUrl, key, body) {
  const token = String(body.token || '').trim()
  if (!token) return res.status(400).json({ error: 'Token is required.' })
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
  if (tokRow.used_at) return res.status(410).json({ error: 'This verification link has already been used.' })
  if (Date.parse(tokRow.expires_at) < Date.now()) return res.status(410).json({ error: 'This verification link has expired.' })

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
  if (!claimed[0]) return res.status(410).json({ error: 'This verification link has already been used.' })

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

  let body = {}
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' })
  }

  const url = new URL(req.url || '/', 'http://x')
  const op = url.searchParams.get('op')
  if (op === 'start') return opStart(req, res, baseUrl, key)
  return opConsume(req, res, baseUrl, key, body)
}
