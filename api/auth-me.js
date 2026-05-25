/**
 * GET /api/auth-me
 *
 * Returns the currently logged-in user, or 401 if no valid session.
 * Used by the frontend to know whether to show "Sign in" vs the
 * Postoffice link on page load.
 */

const { normalizeSupabaseUrl } = require('../lib/supabase-rest')
const { validateSession } = require('../lib/sessions')
const { getSessionToken } = require('../lib/cookies')

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
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    return res.status(204).end()
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const rawUrl = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!rawUrl || !key) {
    return res.status(500).json({ error: 'Server is not configured.' })
  }
  const baseUrl = normalizeSupabaseUrl(rawUrl)
  const token = getSessionToken(req)

  if (!token) return res.status(401).json({ ok: false, user: null })

  const session = await validateSession(baseUrl, key, token)
  if (!session) return res.status(401).json({ ok: false, user: null })

  const u = session.user
  return res.status(200).json({
    ok: true,
    user: {
      id: u.id,
      email: u.email,
      name: u.display_name || u.email.split('@')[0],
      tier: u.tier,
      seat: formatSeat(u.tier, u.effective_seat_number),
      freeSeatNumber: u.free_seat_number,
      foundingSeatNumber: u.founding_seat_number,
      effectiveSeatNumber: u.effective_seat_number,
      preferredLanguage: u.preferred_language,
      emailVerified: u.email_verified_at != null,
      enrolledAt: u.enrolled_at,
    },
  })
}
