/**
 * POST /api/auth-login
 *
 * Body: { email, password }
 *
 * Verifies the password, logs the attempt (success or failure), updates
 * last_login_at, and sets a session cookie. Same error message for
 * unknown-email and wrong-password to avoid leaking account existence.
 */

const { normalizeSupabaseUrl, authHeaders } = require('../lib/supabase-rest')
const { verifyPassword, needsRehash, hashPassword } = require('../lib/password-hash')
const { createSession, pickClientIp } = require('../lib/sessions')
const { setSessionCookie } = require('../lib/cookies')
const { enforceRateLimits, PRESETS } = require('../lib/rate-limit')

function json(res, status, body) {
  return res.status(status).json(body)
}

function formatSeat(tier, n) {
  if (n == null) return null
  if (tier === 'founding') {
    return `Seat #${String(n).padStart(2, '0')}`
  }
  return `Seat #${n}`
}

async function logAttempt(baseUrl, key, { email, ip, succeeded, failureReason }) {
  // Best-effort; never block auth on this.
  fetch(`${baseUrl}/rest/v1/login_attempts`, {
    method: 'POST',
    headers: { ...authHeaders(key), Prefer: 'return=minimal' },
    body: JSON.stringify({
      email: email || null,
      ip: ip || null,
      succeeded,
      failure_reason: failureReason || null,
    }),
  }).catch(() => {})
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(204).end()
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })

  let body
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  } catch {
    return json(res, 400, { error: 'Invalid JSON' })
  }

  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')
  if (!email || !password) return json(res, 400, { error: 'Email and password are required.' })

  const rawUrl = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!rawUrl || !key) return json(res, 500, { error: 'Server is not configured.' })
  const baseUrl = normalizeSupabaseUrl(rawUrl)
  const ip = pickClientIp(req)

  // Rate limit: 5 / 15 min per IP and per email.
  const rl = await enforceRateLimits(baseUrl, key, PRESETS.authLogin(ip, email))
  if (!rl.ok) {
    return json(res, 429, {
      error: 'Too many login attempts. Please try again in a few minutes.',
      retryAfterSeconds: rl.blocked.retryAfterSeconds,
    })
  }

  const sel = await fetch(
    `${baseUrl}/rest/v1/users?email_canonical=eq.${encodeURIComponent(email)}` +
      `&select=id,email,display_name,password_hash,tier,` +
      `free_seat_number,founding_seat_number,effective_seat_number,` +
      `preferred_language,email_verified_at`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  )
  if (!sel.ok) {
    const txt = await sel.text()
    console.error('auth-login select failed', sel.status, txt)
    await logAttempt(baseUrl, key, { email, ip, succeeded: false, failureReason: 'lookup_failed' })
    return json(res, 500, { error: 'Could not log in right now.' })
  }
  const rows = await sel.json()
  const user = rows[0]

  if (!user) {
    await logAttempt(baseUrl, key, { email, ip, succeeded: false, failureReason: 'unknown_email' })
    return json(res, 401, { error: 'Incorrect email or password.' })
  }

  let ok = false
  try {
    ok = verifyPassword(password, user.password_hash)
  } catch (err) {
    console.error('verifyPassword threw', err)
    ok = false
  }
  if (!ok) {
    await logAttempt(baseUrl, key, { email, ip, succeeded: false, failureReason: 'bad_password' })
    return json(res, 401, { error: 'Incorrect email or password.' })
  }

  // Best-effort password-hash upgrade if the stored hash uses weaker params.
  if (needsRehash(user.password_hash)) {
    try {
      const newHash = hashPassword(password)
      fetch(`${baseUrl}/rest/v1/users?id=eq.${encodeURIComponent(user.id)}`, {
        method: 'PATCH',
        headers: { ...authHeaders(key), Prefer: 'return=minimal' },
        body: JSON.stringify({ password_hash: newHash }),
      }).catch(() => {})
    } catch (err) {
      console.error('rehash failed', err)
    }
  }

  // Update last_login_at (best-effort).
  fetch(`${baseUrl}/rest/v1/users?id=eq.${encodeURIComponent(user.id)}`, {
    method: 'PATCH',
    headers: { ...authHeaders(key), Prefer: 'return=minimal' },
    body: JSON.stringify({ last_login_at: new Date().toISOString() }),
  }).catch(() => {})

  let session
  try {
    session = await createSession(baseUrl, key, user.id, req)
  } catch (err) {
    console.error('createSession failed during login', err)
    await logAttempt(baseUrl, key, { email, ip, succeeded: false, failureReason: 'session_failed' })
    return json(res, 500, { error: 'Could not log in right now.' })
  }
  setSessionCookie(res, session.token)

  await logAttempt(baseUrl, key, { email, ip, succeeded: true })

  return json(res, 200, {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.display_name || user.email.split('@')[0],
      tier: user.tier,
      seat: formatSeat(user.tier, user.effective_seat_number),
      freeSeatNumber: user.free_seat_number,
      foundingSeatNumber: user.founding_seat_number,
      effectiveSeatNumber: user.effective_seat_number,
      preferredLanguage: user.preferred_language,
      emailVerified: user.email_verified_at != null,
    },
  })
}
