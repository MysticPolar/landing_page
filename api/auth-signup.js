/**
 * POST /api/auth-signup
 *
 * Body: { email, password, name?, inviteCode?, language? }
 *
 * Calls the signup_user() RPC in Postgres which runs the full signup
 * inside one transaction: insert user, claim invite code (if any),
 * apply boosts per business rules, mint personal codes, return summary.
 *
 * On success: writes a session cookie and returns the user shape the
 * frontend expects.
 */

const { normalizeSupabaseUrl, authHeaders } = require('../lib/supabase-rest')
const { hashPassword } = require('../lib/password-hash')
const { createSession, pickClientIp } = require('../lib/sessions')
const { setSessionCookie } = require('../lib/cookies')
const { sendEmail, formatSeat: formatSeatForEmail } = require('../lib/emails')
const { enforceRateLimits, PRESETS } = require('../lib/rate-limit')
const { verifyTurnstile, extractToken } = require('../lib/turnstile')

const ERROR_MAP = {
  invalid_email:   'Please enter a valid email address.',
  email_taken:     'This email is already registered. Please log in.',
  invalid_code:    'That invitation code is not valid.',
  expired_code:    'That invitation code has expired.',
  used_code:       'That invitation code has already been used.',
  self_code:       "You can't redeem your own invitation code.",
}

function publicMessageForError(text) {
  if (!text) return 'Could not create account right now.'
  const key = Object.keys(ERROR_MAP).find((k) => text.indexOf(k) >= 0)
  return key ? ERROR_MAP[key] : 'Could not create account right now.'
}

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

  const email = String(body.email || '').trim()
  const password = String(body.password || '')
  const displayName = String(body.name || '').trim().slice(0, 80) || null
  const inviteCode = body.inviteCode == null ? null : String(body.inviteCode).trim()
  const language = body.language === 'zh' ? 'zh' : 'en'

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(res, 400, { error: 'Please enter a valid email address.' })
  }
  if (password.length < 8) {
    return json(res, 400, { error: 'Password must be at least 8 characters.' })
  }
  if (password.length > 256) {
    return json(res, 400, { error: 'Password is too long.' })
  }

  const rawUrl = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!rawUrl || !key) return json(res, 500, { error: 'Server is not configured.' })
  const baseUrl = normalizeSupabaseUrl(rawUrl)
  const ip = pickClientIp(req)

  // Turnstile captcha (no-op if TURNSTILE_SECRET_KEY is unset).
  const captcha = await verifyTurnstile({
    token: extractToken(body),
    remoteIp: ip,
  })
  if (!captcha.ok) {
    return json(res, 400, { error: 'Please complete the captcha and try again.' })
  }

  // Rate limit: 3 / hour per IP, 1 / hour per email.
  const rl = await enforceRateLimits(baseUrl, key, PRESETS.authSignup(ip, email.toLowerCase()))
  if (!rl.ok) {
    return json(res, 429, {
      error: 'Too many signup attempts. Please try again later.',
      retryAfterSeconds: rl.blocked.retryAfterSeconds,
    })
  }

  let passwordHash
  try {
    passwordHash = hashPassword(password)
  } catch (err) {
    console.error('hashPassword failed', err)
    return json(res, 500, { error: 'Could not create account right now.' })
  }

  // Call the signup_user RPC. PostgREST returns the function's return value
  // directly (jsonb scalar → JSON value).
  const rpcRes = await fetch(`${baseUrl}/rest/v1/rpc/signup_user`, {
    method: 'POST',
    headers: { ...authHeaders(key) },
    body: JSON.stringify({
      p_email: email,
      p_password_hash: passwordHash,
      p_display_name: displayName,
      p_language: language,
      p_invite_code: inviteCode,
    }),
  })

  if (!rpcRes.ok) {
    const text = await rpcRes.text()
    console.error('signup_user RPC failed', rpcRes.status, text)
    const msg = publicMessageForError(text)
    const status =
      msg === ERROR_MAP.email_taken
        ? 409
        : msg === 'Could not create account right now.'
        ? 500
        : 400
    return json(res, status, { error: msg })
  }

  const result = await rpcRes.json()
  // PostgREST returns the jsonb scalar as JSON; result is the object.

  let session
  try {
    session = await createSession(baseUrl, key, result.user_id, req)
  } catch (err) {
    console.error('createSession failed after signup', err)
    return json(res, 500, { error: 'Account created but session failed. Please log in.' })
  }
  setSessionCookie(res, session.token)

  // Fire-and-forget welcome email. Failure logs to email_log but does not
  // block the signup response. The Postoffice page is the receipt of record.
  ;(async () => {
    try {
      const displayName = result.display_name || result.email.split('@')[0]
      const seatLabel = formatSeatForEmail(result.tier, result.effective_seat_number)
      const codes = Array.isArray(result.codes) ? result.codes : []
      await sendEmail({
        baseUrl,
        key,
        to: result.email,
        kind: result.tier === 'founding' ? 'signup_founding' : 'signup_free',
        language: result.preferred_language || 'en',
        userId: result.user_id,
        vars: { name: displayName, seat: seatLabel, codes },
      })
    } catch (err) {
      console.error('signup welcome email failed', err)
    }
  })()

  return json(res, 201, {
    ok: true,
    user: {
      id: result.user_id,
      email: result.email,
      name: result.display_name || result.email.split('@')[0],
      tier: result.tier,
      seat: formatSeat(result.tier, result.effective_seat_number),
      freeSeatNumber: result.free_seat_number,
      foundingSeatNumber: result.founding_seat_number,
      effectiveSeatNumber: result.effective_seat_number,
      preferredLanguage: result.preferred_language,
      codes: result.codes || [],
    },
  })
}
