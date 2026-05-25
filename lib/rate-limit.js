/**
 * Postgres-backed rate limiter.
 *
 * Usage:
 *   const { ok, blocked } = await enforceRateLimits(baseUrl, key, [
 *     { key: `ip:${ip}:auth-login`,   limit: 5, windowSeconds: 900 },
 *     { key: `email:${email}:auth-login`, limit: 5, windowSeconds: 900 },
 *   ])
 *   if (!ok) {
 *     return res.status(429).json({
 *       error: 'Too many attempts.',
 *       retryAfterSeconds: blocked.retryAfterSeconds,
 *     })
 *   }
 *
 * Fail-open policy: if the rate-limit RPC itself errors (e.g. Supabase is
 * unreachable), we let the request through rather than 500-ing legit users.
 * Abuse-window during an outage is acceptable; a hard outage is not.
 */

const { authHeaders } = require('./supabase-rest')

async function bumpAndCheck(baseUrl, key, bucketKey, { limit, windowSeconds }) {
  try {
    const res = await fetch(`${baseUrl}/rest/v1/rpc/bump_rate_limit`, {
      method: 'POST',
      headers: { ...authHeaders(key) },
      body: JSON.stringify({ p_key: bucketKey, p_window_seconds: windowSeconds }),
    })
    if (!res.ok) {
      console.error('bump_rate_limit RPC failed', res.status, await res.text().catch(() => ''))
      return { allowed: true, blocked: false, count: 0, limit, windowSeconds }
    }
    const count = await res.json()
    const blocked = count > limit
    return {
      allowed: !blocked,
      blocked,
      count,
      limit,
      windowSeconds,
      retryAfterSeconds: windowSeconds,
    }
  } catch (err) {
    console.error('bump_rate_limit threw', err)
    return { allowed: true, blocked: false, count: 0, limit, windowSeconds }
  }
}

async function enforceRateLimits(baseUrl, key, checks) {
  for (const c of checks) {
    const r = await bumpAndCheck(baseUrl, key, c.key, c)
    if (r.blocked) {
      return { ok: false, blocked: { ...r, key: c.key } }
    }
  }
  return { ok: true, blocked: null }
}

/* ─── Convenient presets ─────────────────────────────────────────────────── */

function ipKey(ip, scope) {
  return `ip:${ip || 'unknown'}:${scope}`
}
function emailKey(email, scope) {
  return `email:${(email || '').toLowerCase()}:${scope}`
}

const PRESETS = {
  authLogin: (ip, email) => [
    { key: ipKey(ip, 'auth-login'), limit: 5, windowSeconds: 900 },       // 5 / 15 min / IP
    { key: emailKey(email, 'auth-login'), limit: 5, windowSeconds: 900 }, // 5 / 15 min / email
  ],
  authSignup: (ip, email) => [
    { key: ipKey(ip, 'auth-signup'), limit: 3, windowSeconds: 3600 },     // 3 / hr / IP
    { key: emailKey(email, 'auth-signup'), limit: 1, windowSeconds: 3600 }, // 1 / hr / email
  ],
  authForgot: (ip, email) => [
    { key: ipKey(ip, 'auth-forgot'), limit: 5, windowSeconds: 3600 },
    { key: emailKey(email, 'auth-forgot'), limit: 1, windowSeconds: 3600 },
  ],
  inviteRequest: (ip, email) => [
    { key: ipKey(ip, 'invite-request'), limit: 5, windowSeconds: 3600 },
    { key: emailKey(email, 'invite-request'), limit: 1, windowSeconds: 3600 },
  ],
  waitlist: (ip) => [
    { key: ipKey(ip, 'waitlist'), limit: 10, windowSeconds: 3600 },
  ],
}

module.exports = {
  bumpAndCheck,
  enforceRateLimits,
  ipKey,
  emailKey,
  PRESETS,
}
