/**
 * Public invite request endpoint.
 * POST /api/invite-request
 * Body: { email: string }
 *
 * Generates a one-time invite code in public.invitation_codes and emails it.
 */

const crypto = require('crypto')
const { normalizeSupabaseUrl, authHeaders } = require('../lib/supabase-rest')
const { pickClientIp } = require('../lib/sessions')
const { enforceRateLimits, PRESETS } = require('../lib/rate-limit')
const { verifyTurnstile, extractToken } = require('../lib/turnstile')

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomCode() {
  const buf = crypto.randomBytes(12)
  let out = 'OWL-'
  for (let i = 0; i < 8; i++) out += CHARSET[buf[i] % CHARSET.length]
  return out
}

async function createInvite(baseUrl, key, email) {
  let code = randomCode()
  const expiresAt = new Date(Date.now() + 14 * 864e5).toISOString()
  for (let attempt = 0; attempt < 10; attempt++) {
    const ins = await fetch(`${baseUrl}/rest/v1/invitation_codes`, {
      method: 'POST',
      headers: {
        ...authHeaders(key),
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        code,
        max_uses: 1,
        uses_count: 0,
        expires_at: expiresAt,
        active: true,
        note: `invite-request:${email}`,
      }),
    })
    if (ins.ok) {
      const row = await ins.json()
      const r = Array.isArray(row) ? row[0] : row
      return { code: r.code, expiresAt: r.expires_at }
    }
    const errText = await ins.text()
    if (errText.includes('23505') || ins.status === 409) {
      code = randomCode()
      continue
    }
    throw new Error('Could not create code.')
  }
  throw new Error('Could not create a unique code.')
}

async function sendInviteEmail({ resendApiKey, fromEmail, toEmail, code }) {
  const html = `
    <div style="font-family: Georgia, 'Times New Roman', serif; line-height: 1.55; color: #1c1812;">
      <p>Your Owlpo invitation code:</p>
      <p style="font-size: 22px; letter-spacing: 1px; font-weight: 700;">${code}</p>
      <p>Use this code when creating your account in the Owl's Postoffice.</p>
      <p style="opacity: 0.75;">This code is one-time use.</p>
    </div>
  `
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [toEmail],
      subject: 'Your Owlpo invitation code',
      html,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Email failed: ${text}`)
  }
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
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

  const email = String(body.email || '').trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' })
  }

  const rawUrl = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendApiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.INVITE_FROM_EMAIL
  if (!rawUrl || !key || !resendApiKey || !fromEmail) {
    return res.status(500).json({ error: 'Invite email is not configured.' })
  }
  const baseUrl = normalizeSupabaseUrl(rawUrl)
  const ip = pickClientIp(req)

  // Turnstile (no-op if TURNSTILE_SECRET_KEY is unset).
  const captcha = await verifyTurnstile({
    token: extractToken(body),
    remoteIp: ip,
  })
  if (!captcha.ok) {
    return res.status(400).json({ error: 'Please complete the captcha and try again.' })
  }

  // Rate limit: 5 / hour per IP, 1 / hour per email.
  const rl = await enforceRateLimits(baseUrl, key, PRESETS.inviteRequest(ip, email))
  if (!rl.ok) {
    return res.status(429).json({
      error: 'You have requested too many codes recently. Please try later.',
      retryAfterSeconds: rl.blocked.retryAfterSeconds,
    })
  }

  try {
    const invite = await createInvite(baseUrl, key, email)
    await sendInviteEmail({
      resendApiKey,
      fromEmail,
      toEmail: email,
      code: invite.code,
    })
  } catch (err) {
    console.error('invite-request failed', err)
    return res.status(500).json({ error: 'Could not send invite code right now.' })
  }

  return res.status(200).json({
    ok: true,
    message: 'Invite code sent to your email.',
  })
}

