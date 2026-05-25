/**
 * Lightweight cookie helpers for Vercel serverless functions.
 * We never use 3rd-party cookie libs — request.headers.cookie is a simple
 * string, and Set-Cookie is a simple string too.
 */

const SESSION_COOKIE_NAME = 'owlpo_session'
const SESSION_TTL_DAYS = 30

function parseCookies(req) {
  const header = (req && req.headers && req.headers.cookie) || ''
  const out = Object.create(null)
  if (!header) return out
  header.split(';').forEach((piece) => {
    const i = piece.indexOf('=')
    if (i < 0) return
    const k = piece.slice(0, i).trim()
    const v = piece.slice(i + 1).trim()
    if (!k) return
    try {
      out[k] = decodeURIComponent(v)
    } catch {
      out[k] = v
    }
  })
  return out
}

function getSessionToken(req) {
  return parseCookies(req)[SESSION_COOKIE_NAME] || null
}

function serializeSessionCookie(token, { maxAgeSeconds, secure = true } = {}) {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
  ]
  if (secure) parts.push('Secure')
  if (typeof maxAgeSeconds === 'number') {
    parts.push(`Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`)
  }
  return parts.join('; ')
}

function setSessionCookie(res, token, opts = {}) {
  const maxAgeSeconds =
    opts.maxAgeSeconds != null
      ? opts.maxAgeSeconds
      : SESSION_TTL_DAYS * 24 * 60 * 60
  const secure = process.env.NODE_ENV !== 'development'
  res.setHeader(
    'Set-Cookie',
    serializeSessionCookie(token, { maxAgeSeconds, secure })
  )
}

function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV !== 'development'
  res.setHeader(
    'Set-Cookie',
    serializeSessionCookie('', { maxAgeSeconds: 0, secure })
  )
}

module.exports = {
  SESSION_COOKIE_NAME,
  SESSION_TTL_DAYS,
  parseCookies,
  getSessionToken,
  setSessionCookie,
  clearSessionCookie,
}
