/**
 * GET /api/admin-overview
 *
 * Admin-only. Returns headline counts: users by tier, waitlist size,
 * recent boosts, recent email failures.
 */

const { normalizeSupabaseUrl } = require('../lib/supabase-rest')
const { requireAdmin } = require('../lib/admin')

async function countRows(baseUrl, key, table, query = '') {
  const url = `${baseUrl}/rest/v1/${table}?select=id${query ? '&' + query : ''}`
  const res = await fetch(url, {
    method: 'HEAD',
    headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'count=exact' },
  })
  const cr = res.headers.get('content-range') || ''
  const m = cr.match(/\/(\d+|\*)\s*$/)
  return m && m[1] !== '*' ? parseInt(m[1], 10) : null
}

async function fetchJson(baseUrl, key, path) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  if (!res.ok) return null
  return res.json()
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const rawUrl = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!rawUrl || !key) return res.status(500).json({ error: 'Server is not configured.' })
  const baseUrl = normalizeSupabaseUrl(rawUrl)

  const gate = await requireAdmin(req, baseUrl, key)
  if (!gate.ok) return res.status(gate.status).json({ error: gate.error })

  const [
    freeCount, foundingCount, waitlistCount,
    pendingEmails, failedEmails, recentLogins24h,
    failedLogins24h,
  ] = await Promise.all([
    countRows(baseUrl, key, 'users', 'tier=eq.free'),
    countRows(baseUrl, key, 'users', 'tier=eq.founding'),
    countRows(baseUrl, key, 'waitlist_signups'),
    countRows(baseUrl, key, 'email_log', 'status=eq.pending'),
    countRows(baseUrl, key, 'email_log', 'status=eq.failed'),
    countRows(baseUrl, key, 'login_attempts',
      `succeeded=eq.true&attempted_at=gt.${encodeURIComponent(new Date(Date.now() - 86400e3).toISOString())}`),
    countRows(baseUrl, key, 'login_attempts',
      `succeeded=eq.false&attempted_at=gt.${encodeURIComponent(new Date(Date.now() - 86400e3).toISOString())}`),
  ])

  const recentBoosts = await fetchJson(
    baseUrl, key,
    '/rest/v1/seat_boosts?order=created_at.desc&limit=10&select=delta,reason,created_at,user_id'
  )

  return res.status(200).json({
    ok: true,
    counts: {
      usersFree: freeCount,
      usersFounding: foundingCount,
      waitlist: waitlistCount,
      emailsPending: pendingEmails,
      emailsFailed: failedEmails,
      logins24hSuccess: recentLogins24h,
      logins24hFailure: failedLogins24h,
    },
    recentBoosts: recentBoosts || [],
  })
}
