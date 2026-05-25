/**
 * POST /api/checkout-create-session
 *
 * Authenticated. Creates a Stripe Checkout session for a free user to
 * upgrade to founding tier. Returns the Stripe Checkout URL.
 *
 * After payment, Stripe redirects to /postoffice.html?upgraded=1 and
 * fires the webhook (api/stripe-webhook) which actually flips the user
 * to founding tier.
 */

const { normalizeSupabaseUrl } = require('../lib/supabase-rest')
const { validateSession } = require('../lib/sessions')
const { getSessionToken } = require('../lib/cookies')
const { createCheckoutSession } = require('../lib/stripe')

function originOf(req) {
  const proto =
    (req.headers['x-forwarded-proto'] || '').split(',')[0].trim() || 'https'
  const host = req.headers['x-forwarded-host'] || req.headers.host
  return `${proto}://${host}`
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    return res.status(204).end()
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const rawUrl = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const stripeSecret = process.env.STRIPE_SECRET_KEY
  const priceId = process.env.STRIPE_FOUNDING_PRICE_ID
  if (!rawUrl || !key) {
    return res.status(500).json({ error: 'Server is not configured.' })
  }
  if (!stripeSecret || !priceId) {
    return res
      .status(503)
      .json({ error: 'Founding upgrade is not available yet.' })
  }

  const baseUrl = normalizeSupabaseUrl(rawUrl)
  const token = getSessionToken(req)
  if (!token) return res.status(401).json({ error: 'Please log in to upgrade.' })
  const session = await validateSession(baseUrl, key, token)
  if (!session) return res.status(401).json({ error: 'Please log in to upgrade.' })

  const user = session.user
  if (user.tier === 'founding') {
    return res.status(409).json({ error: 'You are already a founding member.' })
  }

  const origin = originOf(req)
  try {
    const checkout = await createCheckoutSession({
      secretKey: stripeSecret,
      priceId,
      successUrl: `${origin}/postoffice.html?upgraded=1`,
      cancelUrl: `${origin}/postoffice.html?upgrade=cancelled`,
      customerEmail: user.email,
      clientReferenceId: user.id,
      metadata: {
        user_id: user.id,
        upgrade_type: 'founding',
      },
    })
    return res.status(200).json({ url: checkout.url })
  } catch (err) {
    console.error('createCheckoutSession failed', err)
    return res
      .status(502)
      .json({ error: 'Could not start checkout. Please try again.' })
  }
}
