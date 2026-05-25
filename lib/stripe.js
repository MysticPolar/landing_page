/**
 * Minimal Stripe REST client + webhook signature verification.
 *
 * We don't pull in the stripe npm package — Stripe's REST API is a thin
 * form-urlencoded thing and the webhook signature is a short HMAC.
 * Keeping it local avoids a `npm install` step and reduces supply-chain
 * surface for what is otherwise a security-critical integration.
 */

const crypto = require('crypto')

const STRIPE_API_BASE = 'https://api.stripe.com'

function stripeEncodeForm(params) {
  const out = []
  function add(prefix, value) {
    if (value === undefined || value === null) return
    if (Array.isArray(value)) {
      value.forEach((v, i) => add(`${prefix}[${i}]`, v))
    } else if (typeof value === 'object') {
      for (const k of Object.keys(value)) add(`${prefix}[${k}]`, value[k])
    } else {
      out.push(
        `${encodeURIComponent(prefix)}=${encodeURIComponent(String(value))}`
      )
    }
  }
  for (const k of Object.keys(params)) add(k, params[k])
  return out.join('&')
}

async function stripeRequest(path, { method = 'POST', secretKey, params } = {}) {
  const body = params ? stripeEncodeForm(params) : undefined
  const res = await fetch(`${STRIPE_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = { _raw: text }
  }
  if (!res.ok) {
    const err = new Error(
      json.error?.message || `Stripe ${method} ${path} failed: ${res.status}`
    )
    err.status = res.status
    err.body = json
    throw err
  }
  return json
}

async function createCheckoutSession({
  secretKey,
  priceId,
  successUrl,
  cancelUrl,
  customerEmail,
  clientReferenceId,
  metadata,
}) {
  const params = {
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    line_items: [{ price: priceId, quantity: 1 }],
  }
  if (customerEmail) params.customer_email = customerEmail
  if (clientReferenceId) params.client_reference_id = clientReferenceId
  if (metadata) params.metadata = metadata
  return stripeRequest('/v1/checkout/sessions', { secretKey, params })
}

/**
 * Verify a Stripe webhook signature.
 * Header format: t=<unix-ts>,v1=<hex-hmac>,v0=<old-hmac>
 *
 * Tolerance defaults to 5 minutes; reject anything older.
 *
 * Returns the parsed event object, or throws on any signature or freshness
 * failure.
 */
function verifyWebhookSignature({ rawBody, signatureHeader, secret, toleranceSeconds = 300 }) {
  if (!rawBody || !signatureHeader || !secret) {
    throw new Error('webhook: missing parts')
  }
  const parts = String(signatureHeader).split(',').reduce((acc, piece) => {
    const i = piece.indexOf('=')
    if (i < 0) return acc
    const k = piece.slice(0, i).trim()
    const v = piece.slice(i + 1).trim()
    acc[k] = acc[k] ? `${acc[k]},${v}` : v
    return acc
  }, {})
  const timestamp = parts.t
  const v1 = (parts.v1 || '').split(',')[0]
  if (!timestamp || !v1) throw new Error('webhook: malformed signature header')

  const ts = parseInt(timestamp, 10)
  if (!Number.isFinite(ts)) throw new Error('webhook: bad timestamp')
  const ageSeconds = Math.abs(Date.now() / 1000 - ts)
  if (ageSeconds > toleranceSeconds) {
    throw new Error('webhook: timestamp out of tolerance')
  }

  const signedPayload = `${timestamp}.${rawBody}`
  const expected = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex')

  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(v1, 'hex')
  if (a.length !== b.length) throw new Error('webhook: signature length mismatch')
  if (!crypto.timingSafeEqual(a, b)) throw new Error('webhook: signature mismatch')

  // Caller parses body to JSON; we just return it verified.
  return JSON.parse(rawBody)
}

module.exports = {
  createCheckoutSession,
  verifyWebhookSignature,
  stripeRequest,
}
