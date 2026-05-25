/**
 * GET /api/my-postoffice
 *
 * Authenticated. Returns everything the Postoffice page needs in one call:
 *   - user (id, email, name, tier, seat info)
 *   - codes (list of this user's personal codes with status)
 *   - boost history (sum + last few entries)
 *   - founding metadata (lifetime codes minted, whether more can be requested)
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

async function fetchJson(baseUrl, key, path) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  if (!res.ok) return null
  return res.json()
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
  if (!rawUrl || !key) return res.status(500).json({ error: 'Server is not configured.' })
  const baseUrl = normalizeSupabaseUrl(rawUrl)

  const token = getSessionToken(req)
  if (!token) return res.status(401).json({ error: 'Not logged in.' })
  const session = await validateSession(baseUrl, key, token)
  if (!session) return res.status(401).json({ error: 'Not logged in.' })
  const u = session.user

  const codeTypeFilter =
    u.tier === 'founding' ? 'personal_founding' : 'personal_free'

  // Codes owned by this user.
  const codes =
    (await fetchJson(
      baseUrl,
      key,
      `/rest/v1/invitation_codes?owner_user_id=eq.${encodeURIComponent(u.id)}` +
        `&code_type=eq.${codeTypeFilter}` +
        `&order=created_at.asc` +
        `&select=id,code,used_at,used_by_user_id,active,created_at`
    )) || []

  // Used-by display names (one extra query — small N).
  const usedByIds = codes
    .map((c) => c.used_by_user_id)
    .filter(Boolean)
  let usedByMap = {}
  if (usedByIds.length > 0) {
    const usedByRows =
      (await fetchJson(
        baseUrl,
        key,
        `/rest/v1/users?id=in.(${usedByIds.map(encodeURIComponent).join(',')})&select=id,display_name,email`
      )) || []
    usedByMap = Object.fromEntries(
      usedByRows.map((r) => [r.id, r.display_name || r.email.split('@')[0]])
    )
  }

  // Boost history.
  const boosts =
    (await fetchJson(
      baseUrl,
      key,
      `/rest/v1/seat_boosts?user_id=eq.${encodeURIComponent(u.id)}` +
        `&order=created_at.desc&limit=20&select=delta,reason,created_at`
    )) || []
  const boostTotal = boosts.reduce((sum, b) => sum + b.delta, 0)

  // Founding lifetime + can-request flags.
  let foundingMeta = null
  if (u.tier === 'founding') {
    const batches =
      (await fetchJson(
        baseUrl,
        key,
        `/rest/v1/founding_code_batches?user_id=eq.${encodeURIComponent(u.id)}&select=batch_size`
      )) || []
    const lifetimeMinted = batches.reduce((s, b) => s + b.batch_size, 0)
    const unused = codes.filter((c) => !c.used_at && c.active).length
    foundingMeta = {
      lifetimeMinted,
      lifetimeCap: 100,
      unused,
      canRequestMore: unused === 0 && lifetimeMinted < 100,
    }
  }

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
    codes: codes.map((c) => ({
      id: c.id,
      code: c.code,
      used: c.used_at != null,
      usedAt: c.used_at,
      usedByDisplay: c.used_by_user_id ? usedByMap[c.used_by_user_id] || 'someone' : null,
      active: c.active,
    })),
    boostTotal,                  // negative number = how many positions you've moved up
    recentBoosts: boosts.slice(0, 5),
    founding: foundingMeta,
  })
}
