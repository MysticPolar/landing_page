/**
 * Generate a new invitation code (protected by ADMIN_INVITE_SECRET).
 * POST /api/invite-generate
 * Headers: Authorization: Bearer <ADMIN_INVITE_SECRET>
 * Body (optional): { "maxUses": 1, "expiresInDays": 30, "note": "Jane" }
 */

const crypto = require('crypto')
const { normalizeSupabaseUrl, authHeaders } = require('../lib/supabase-rest')

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomCode() {
  const buf = crypto.randomBytes(12)
  let out = 'OWL-'
  for (let i = 0; i < 8; i++) out += CHARSET[buf[i] % CHARSET.length]
  return out
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization'
    )
    return res.status(204).end()
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const adminSecret = process.env.ADMIN_INVITE_SECRET
  if (!adminSecret) {
    return res.status(503).json({
      error:
        'Invite generation is not configured. Set ADMIN_INVITE_SECRET in Vercel.',
    })
  }

  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (token !== adminSecret) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  let body = {}
  try {
    body =
      typeof req.body === 'string'
        ? JSON.parse(req.body || '{}')
        : req.body || {}
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
    if (d > 0) {
      expiresAt = new Date(Date.now() + d * 864e5).toISOString()
    }
  }

  const note = body.note != null ? String(body.note).slice(0, 500) : null

  const rawUrl = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!rawUrl || !key) {
    return res.status(500).json({ error: 'Server is not configured.' })
  }
  const baseUrl = normalizeSupabaseUrl(rawUrl)

  let code = randomCode()
  for (let attempt = 0; attempt < 10; attempt++) {
    const ins = await fetch(`${baseUrl}/rest/v1/invitation_codes`, {
      method: 'POST',
      headers: {
        ...authHeaders(key),
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        code,
        max_uses: maxUses,
        uses_count: 0,
        expires_at: expiresAt,
        active: true,
        note,
      }),
    })
    if (ins.ok) {
      const row = await ins.json()
      const r = Array.isArray(row) ? row[0] : row
      return res.status(201).json({
        code: r.code,
        id: r.id,
        maxUses: r.max_uses,
        expiresAt: r.expires_at,
        note: r.note,
      })
    }
    const errText = await ins.text()
    if (errText.includes('23505') || ins.status === 409) {
      code = randomCode()
      continue
    }
    console.error('invite-generate insert failed', ins.status, errText)
    return res.status(500).json({ error: 'Could not create code.' })
  }
  return res.status(500).json({ error: 'Could not create a unique code.' })
}
