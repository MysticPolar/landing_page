/**
 * /api/admin?op=overview|users|mint|resend
 *
 * Single dispatched admin handler. All operations require an admin session
 * (email in ADMIN_ALLOWED_EMAILS).
 *
 * Routes via vercel.json rewrites:
 *   /api/admin-overview          → ?op=overview         GET
 *   /api/admin-users             → ?op=users            GET
 *   /api/admin-mint-system-code  → ?op=mint             POST
 *   /api/admin-resend-welcome    → ?op=resend           POST
 */

const crypto = require('crypto')
const { normalizeSupabaseUrl, authHeaders } = require('../lib/supabase-rest')
const { requireAdmin } = require('../lib/admin')
const { sendEmail, formatSeat } = require('../lib/emails')

const CHARSET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
function randomSystemCode() {
  const buf = crypto.randomBytes(12)
  let out = 'OWL-'
  for (let i = 0; i < 8; i++) out += CHARSET[buf[i] % CHARSET.length]
  return out
}

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

async function opOverview(req, res, baseUrl, key) {
  const [
    freeCount, foundingCount, waitlistCount,
    pendingEmails, failedEmails, recentLogins24h, failedLogins24h,
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
      usersFree: freeCount, usersFounding: foundingCount, waitlist: waitlistCount,
      emailsPending: pendingEmails, emailsFailed: failedEmails,
      logins24hSuccess: recentLogins24h, logins24hFailure: failedLogins24h,
    },
    recentBoosts: recentBoosts || [],
  })
}

async function opUsers(req, res, baseUrl, key) {
  const url = new URL(req.url || '/', 'http://x')
  const tier = url.searchParams.get('tier')
  const search = url.searchParams.get('search') || ''
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200)
  let qs =
    `select=id,email,display_name,tier,free_seat_number,founding_seat_number,` +
    `effective_seat_number,email_verified_at,enrolled_at,last_login_at` +
    `&order=enrolled_at.desc&limit=${limit}`
  if (tier === 'free' || tier === 'founding') qs += `&tier=eq.${tier}`
  if (search) qs += `&email_canonical=ilike.*${encodeURIComponent(search.toLowerCase())}*`
  const r = await fetch(`${baseUrl}/rest/v1/users?${qs}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  if (!r.ok) return res.status(500).json({ error: 'Could not load users.' })
  return res.status(200).json({ ok: true, users: await r.json() })
}

async function opMint(req, res, baseUrl, key, body) {
  const maxUses = body.maxUses != null ? Number(body.maxUses) : 1
  if (!Number.isFinite(maxUses) || maxUses < 1) {
    return res.status(400).json({ error: 'maxUses must be a positive number' })
  }
  let expiresAt = null
  if (body.expiresInDays != null) {
    const d = Number(body.expiresInDays)
    if (!Number.isFinite(d) || d < 0) return res.status(400).json({ error: 'expiresInDays invalid' })
    if (d > 0) expiresAt = new Date(Date.now() + d * 864e5).toISOString()
  }
  const note = body.note != null ? String(body.note).slice(0, 500) : null
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomSystemCode()
    const insRes = await fetch(`${baseUrl}/rest/v1/invitation_codes`, {
      method: 'POST',
      headers: { ...authHeaders(key), Prefer: 'return=representation' },
      body: JSON.stringify({
        code, code_type: 'system',
        max_uses: maxUses, uses_count: 0, expires_at: expiresAt,
        active: true, note,
      }),
    })
    if (insRes.ok) {
      const rows = await insRes.json()
      const r = Array.isArray(rows) ? rows[0] : rows
      return res.status(201).json({
        ok: true, code: r.code, id: r.id, maxUses: r.max_uses, expiresAt: r.expires_at,
      })
    }
    const text = await insRes.text()
    if (text.includes('23505') || insRes.status === 409) continue
    console.error('admin mint failed', insRes.status, text)
    return res.status(500).json({ error: 'Could not mint code.' })
  }
  return res.status(500).json({ error: 'Could not mint a unique code.' })
}

async function opResend(req, res, baseUrl, key, body) {
  const userId = String(body.userId || '').trim()
  if (!userId) return res.status(400).json({ error: 'userId is required.' })
  const userRes = await fetch(
    `${baseUrl}/rest/v1/users?id=eq.${encodeURIComponent(userId)}` +
      `&select=id,email,display_name,tier,effective_seat_number,preferred_language`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  )
  if (!userRes.ok) return res.status(500).json({ error: 'Could not load user.' })
  const u = (await userRes.json())[0]
  if (!u) return res.status(404).json({ error: 'User not found.' })
  const codesRes = await fetch(
    `${baseUrl}/rest/v1/invitation_codes?owner_user_id=eq.${encodeURIComponent(userId)}` +
      `&code_type=eq.${u.tier === 'founding' ? 'personal_founding' : 'personal_free'}` +
      `&select=code&order=created_at.asc`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  )
  const codeRows = codesRes.ok ? await codesRes.json() : []
  const codes = codeRows.map((r) => r.code)
  const result = await sendEmail({
    baseUrl, key,
    to: u.email,
    kind: u.tier === 'founding' ? 'signup_founding' : 'signup_free',
    language: u.preferred_language || 'en',
    userId: u.id,
    vars: {
      name: u.display_name || u.email.split('@')[0],
      seat: formatSeat(u.tier, u.effective_seat_number),
      codes,
    },
  })
  return res.status(result.ok ? 200 : 502).json({ ok: result.ok, ...(result.ok ? {} : { error: result.error }) })
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    return res.status(204).end()
  }

  const rawUrl = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!rawUrl || !key) return res.status(500).json({ error: 'Server is not configured.' })
  const baseUrl = normalizeSupabaseUrl(rawUrl)

  const gate = await requireAdmin(req, baseUrl, key)
  if (!gate.ok) return res.status(gate.status).json({ error: gate.error })

  const url = new URL(req.url || '/', 'http://x')
  const op = url.searchParams.get('op')

  let body = {}
  if (req.method === 'POST') {
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    } catch {
      return res.status(400).json({ error: 'Invalid JSON' })
    }
  }

  switch (op) {
    case 'overview':
      if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
      return opOverview(req, res, baseUrl, key)
    case 'users':
      if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
      return opUsers(req, res, baseUrl, key)
    case 'mint':
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
      return opMint(req, res, baseUrl, key, body)
    case 'resend':
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
      return opResend(req, res, baseUrl, key, body)
    default:
      return res.status(400).json({ error: 'unknown op' })
  }
}
