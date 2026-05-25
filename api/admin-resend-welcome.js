/**
 * POST /api/admin-resend-welcome
 *
 * Admin-only. Re-sends the appropriate welcome email to a user (for
 * cases where the original delivery failed or the user lost the message).
 *
 * Body: { userId }
 */

const { normalizeSupabaseUrl } = require('../lib/supabase-rest')
const { requireAdmin } = require('../lib/admin')
const { sendEmail, formatSeat } = require('../lib/emails')

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const rawUrl = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!rawUrl || !key) return res.status(500).json({ error: 'Server is not configured.' })
  const baseUrl = normalizeSupabaseUrl(rawUrl)

  const gate = await requireAdmin(req, baseUrl, key)
  if (!gate.ok) return res.status(gate.status).json({ error: gate.error })

  let body = {}
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' })
  }
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
