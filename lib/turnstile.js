/**
 * Cloudflare Turnstile server-side verification.
 *
 * If TURNSTILE_SECRET_KEY is not set, verification is skipped (dev mode).
 * Production deployments MUST set it and TURNSTILE_SITE_KEY on the frontend.
 *
 * Expects the form to submit `turnstileToken` (or the standard
 * `cf-turnstile-response` field) alongside the request body.
 */

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

function extractToken(body) {
  if (!body || typeof body !== 'object') return ''
  return String(
    body.turnstileToken ||
      body['cf-turnstile-response'] ||
      body.captchaToken ||
      ''
  ).trim()
}

async function verifyTurnstile({ token, remoteIp }) {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    // Dev mode: skip verification but log that we did so.
    return { ok: true, skipped: true }
  }
  if (!token) {
    return { ok: false, error: 'missing_captcha' }
  }
  try {
    const params = new URLSearchParams()
    params.set('secret', secret)
    params.set('response', token)
    if (remoteIp) params.set('remoteip', remoteIp)
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      body: params,
    })
    if (!res.ok) return { ok: false, error: 'verify_request_failed' }
    const j = await res.json()
    if (j.success) return { ok: true }
    return { ok: false, error: (j['error-codes'] || ['unknown']).join(',') }
  } catch (err) {
    console.error('verifyTurnstile threw', err)
    return { ok: false, error: 'verify_threw' }
  }
}

module.exports = { verifyTurnstile, extractToken }
