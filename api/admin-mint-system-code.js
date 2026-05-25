/**
 * POST /api/admin-mint-system-code
 *
 * Admin-only. Generates a system-tier invitation code (multi-use allowed).
 * Body: { maxUses?, expiresInDays?, note? }
 */

const crypto = require('crypto')
const { normalizeSupabaseUrl, authHeaders } = require('../lib/supabase-rest')
const { requireAdmin } = require('../lib/admin')

const CHARSET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
function randomCode() {
  const buf = crypto.randomBytes(12)
  let out = 'OWL-'
  for (let i = 0; i < 8; i++) out += CHARSET[buf[i] % CHARSET.length]
  return out
}

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
  const maxUses = body.maxUses != null ? Number(body.maxUses) : 1
  if (!Number.isFinite(maxUses) || maxUses < 1) {
    return res.status(400).json({ error: 'maxUses must be a positive number' })
  }
  let expiresAt = null
  if (body.expiresInDays != null) {
    const d = Number(body.expiresInDays)
    if (!Number.isFinite(d) || d < 0) {
      return res.status(400).json({ error: 'expiresInDays invalid' })
    }
    if (d > 0) expiresAt = new Date(Date.now() + d * 864e5).toISOString()
  }
  const note = body.note != null ? String(body.note).slice(0, 500) : null

  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomCode()
    const insRes = await fetch(`${baseUrl}/rest/v1/invitation_codes`, {
      method: 'POST',
      headers: { ...authHeaders(key), Prefer: 'return=representation' },
      body: JSON.stringify({
        code,
        code_type: 'system',
        max_uses: maxUses,
        uses_count: 0,
        expires_at: expiresAt,
        active: true,
        note,
      }),
    })
    if (insRes.ok) {
      const rows = await insRes.json()
      const r = Array.isArray(rows) ? rows[0] : rows
      return res.status(201).json({
        ok: true,
        code: r.code,
        id: r.id,
        maxUses: r.max_uses,
        expiresAt: r.expires_at,
      })
    }
    const text = await insRes.text()
    if (text.includes('23505') || insRes.status === 409) continue // collision, retry
    console.error('admin-mint-system-code insert failed', insRes.status, text)
    return res.status(500).json({ error: 'Could not mint code.' })
  }
  return res.status(500).json({ error: 'Could not mint a unique code.' })
}
