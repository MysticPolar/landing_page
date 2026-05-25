/**
 * Session create / validate / revoke against public.sessions.
 *
 * We never store raw tokens. The cookie carries a 256-bit random token;
 * we store SHA-256(token) in sessions.token_hash. An attacker with full
 * DB access still cannot replay a session.
 */

const crypto = require('crypto')
const { authHeaders } = require('./supabase-rest')
const { SESSION_TTL_DAYS } = require('./cookies')

function newRawToken() {
  return crypto.randomBytes(32).toString('hex') // 64 chars
}

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken)).digest('hex')
}

function pickClientIp(req) {
  const xff = (req && req.headers && req.headers['x-forwarded-for']) || ''
  if (xff) {
    const first = String(xff).split(',')[0].trim()
    if (first) return first
  }
  return (req && req.socket && req.socket.remoteAddress) || null
}

function pickUserAgent(req) {
  const ua = (req && req.headers && req.headers['user-agent']) || ''
  return String(ua).slice(0, 500) || null
}

async function createSession(baseUrl, key, userId, req) {
  const token = newRawToken()
  const tokenHash = hashToken(token)
  const ip = pickClientIp(req)
  const userAgent = pickUserAgent(req)
  const expiresAt = new Date(
    Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
  ).toISOString()

  const res = await fetch(`${baseUrl}/rest/v1/sessions`, {
    method: 'POST',
    headers: {
      ...authHeaders(key),
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      user_id: userId,
      token_hash: tokenHash,
      ip,
      user_agent: userAgent,
      expires_at: expiresAt,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`createSession failed: ${res.status} ${text}`)
  }
  return { token, expiresAt }
}

async function validateSession(baseUrl, key, rawToken) {
  if (!rawToken) return null
  const tokenHash = hashToken(rawToken)
  const nowIso = new Date().toISOString()

  // Look up session + join user fields we need for /auth-me.
  // We use embed via PostgREST: ?select=*,users(*)
  const url =
    `${baseUrl}/rest/v1/sessions?token_hash=eq.${encodeURIComponent(tokenHash)}` +
    `&revoked_at=is.null` +
    `&expires_at=gt.${encodeURIComponent(nowIso)}` +
    `&select=id,user_id,expires_at,users(` +
    'id,email,display_name,tier,free_seat_number,founding_seat_number,' +
    'effective_seat_number,preferred_language,email_verified_at,enrolled_at' +
    `)`
  const res = await fetch(url, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  if (!res.ok) return null
  const rows = await res.json()
  const row = rows[0]
  if (!row || !row.users) return null

  // Touch last_seen_at (best-effort, don't block).
  fetch(
    `${baseUrl}/rest/v1/sessions?id=eq.${encodeURIComponent(row.id)}`,
    {
      method: 'PATCH',
      headers: { ...authHeaders(key), Prefer: 'return=minimal' },
      body: JSON.stringify({ last_seen_at: nowIso }),
    }
  ).catch(() => {})

  return {
    sessionId: row.id,
    user: row.users,
  }
}

async function revokeSession(baseUrl, key, rawToken) {
  if (!rawToken) return false
  const tokenHash = hashToken(rawToken)
  const res = await fetch(
    `${baseUrl}/rest/v1/sessions?token_hash=eq.${encodeURIComponent(tokenHash)}`,
    {
      method: 'PATCH',
      headers: { ...authHeaders(key), Prefer: 'return=minimal' },
      body: JSON.stringify({ revoked_at: new Date().toISOString() }),
    }
  )
  return res.ok
}

module.exports = {
  createSession,
  validateSession,
  revokeSession,
  hashToken,
  pickClientIp,
  pickUserAgent,
}
