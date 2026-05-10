/**
 * Shared PostgREST helpers (works with legacy JWT and sb_secret keys).
 */

function normalizeSupabaseUrl(raw) {
  if (!raw) return ''
  let u = String(raw).trim().replace(/\/$/, '')
  u = u.replace(/\/rest\/v1\/?$/, '')
  return u
}

function authHeaders(key) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  }
}

module.exports = { normalizeSupabaseUrl, authHeaders }
