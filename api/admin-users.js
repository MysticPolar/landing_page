/**
 * GET /api/admin-users?tier=free|founding&search=foo&limit=50
 *
 * Admin-only. Paginated user list with filters.
 */

const { normalizeSupabaseUrl } = require('../lib/supabase-rest')
const { requireAdmin } = require('../lib/admin')

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const rawUrl = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!rawUrl || !key) return res.status(500).json({ error: 'Server is not configured.' })
  const baseUrl = normalizeSupabaseUrl(rawUrl)

  const gate = await requireAdmin(req, baseUrl, key)
  if (!gate.ok) return res.status(gate.status).json({ error: gate.error })

  const url = new URL(req.url || '/', 'http://x')
  const tier = url.searchParams.get('tier')
  const search = url.searchParams.get('search') || ''
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200)

  let qs =
    `select=id,email,display_name,tier,free_seat_number,founding_seat_number,` +
    `effective_seat_number,email_verified_at,enrolled_at,last_login_at` +
    `&order=enrolled_at.desc&limit=${limit}`
  if (tier === 'free' || tier === 'founding') {
    qs += `&tier=eq.${tier}`
  }
  if (search) {
    qs += `&email_canonical=ilike.*${encodeURIComponent(search.toLowerCase())}*`
  }

  const r = await fetch(`${baseUrl}/rest/v1/users?${qs}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  if (!r.ok) {
    return res.status(500).json({ error: 'Could not load users.' })
  }
  const users = await r.json()
  return res.status(200).json({ ok: true, users })
}
