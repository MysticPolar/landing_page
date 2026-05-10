/**
 * Waitlist signup via Supabase PostgREST.
 * Optional invite codes validated against public.invitation_codes.
 */

const { normalizeSupabaseUrl, authHeaders } = require('../lib/supabase-rest')

async function parseErrorBody(res) {
  const text = await res.text()
  let code
  let message
  try {
    const j = JSON.parse(text)
    code = j.code
    message = j.message || j.error_description || j.msg
  } catch {
    message = text
  }
  return { code, message, status: res.status }
}

function normalizeInvite(raw) {
  if (raw == null || String(raw).trim() === '') return ''
  return String(raw).trim().toUpperCase()
}

async function fetchInviteRow(baseUrl, key, codeUpper) {
  const res = await fetch(
    `${baseUrl}/rest/v1/invitation_codes?code=eq.${encodeURIComponent(
      codeUpper
    )}&select=id,max_uses,uses_count,expires_at,active`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  )
  if (!res.ok) return null
  const rows = await res.json()
  return rows[0] || null
}

async function validateInvite(baseUrl, key, rawInvite) {
  const code = normalizeInvite(rawInvite)
  if (!code) return { ok: true, code: '', row: null }

  const row = await fetchInviteRow(baseUrl, key, code)
  if (!row || !row.active) {
    return { ok: false, error: 'That invitation code is not valid.' }
  }
  if (row.expires_at && Date.parse(row.expires_at) < Date.now()) {
    return { ok: false, error: 'That invitation code has expired.' }
  }
  if (row.max_uses != null && row.uses_count >= row.max_uses) {
    return { ok: false, error: 'That invitation code has already been used.' }
  }
  return { ok: true, code, row }
}

async function fetchSignupByEmail(baseUrl, key, email) {
  const res = await fetch(
    `${baseUrl}/rest/v1/waitlist_signups?email=eq.${encodeURIComponent(
      email
    )}&select=invite_code`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  )
  if (!res.ok) return null
  const rows = await res.json()
  return rows[0] || null
}

async function insertSignup(baseUrl, key, row) {
  const res = await fetch(`${baseUrl}/rest/v1/waitlist_signups`, {
    method: 'POST',
    headers: {
      ...authHeaders(key),
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(row),
  })
  if (res.ok) return { ok: true }
  const err = await parseErrorBody(res)
  return { ok: false, ...err }
}

async function updateSignup(baseUrl, key, email, patch) {
  const res = await fetch(
    `${baseUrl}/rest/v1/waitlist_signups?email=eq.${encodeURIComponent(email)}`,
    {
      method: 'PATCH',
      headers: {
        ...authHeaders(key),
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(patch),
    }
  )
  if (res.ok) return { ok: true }
  const err = await parseErrorBody(res)
  return { ok: false, ...err }
}

async function bumpInviteUses(baseUrl, key, row) {
  const next = row.uses_count + 1
  const res = await fetch(
    `${baseUrl}/rest/v1/invitation_codes?id=eq.${encodeURIComponent(row.id)}`,
    {
      method: 'PATCH',
      headers: {
        ...authHeaders(key),
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ uses_count: next }),
    }
  )
  return res.ok
}

async function countSignups(baseUrl, key) {
  const res = await fetch(`${baseUrl}/rest/v1/waitlist_signups?select=id`, {
    method: 'HEAD',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: 'count=exact',
    },
  })
  const cr = res.headers.get('content-range')
  if (!cr) return null
  const m = cr.match(/\/(\d+)\s*$/)
  return m ? parseInt(m[1], 10) : null
}

function badRequest(res, message) {
  res.status(400).json({ error: message })
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(204).end()
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let body
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' })
  }

  const raw = String(body.email || '').trim()
  const email = raw.toLowerCase()
  const tier =
    body.tier === 'founding' || body.tier === 'free' ? body.tier : null
  const source = ['waitlist', 'identity_gate'].includes(body.source)
    ? body.source
    : 'waitlist'

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return badRequest(res, 'Please enter a valid email address.')
  }

  if (source === 'waitlist' && !tier) {
    return badRequest(res, 'Missing tier.')
  }

  const rawUrl = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!rawUrl || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    return res.status(500).json({ error: 'Server is not configured.' })
  }

  const baseUrl = normalizeSupabaseUrl(rawUrl)
  if (!/^https:\/\//i.test(baseUrl)) {
    console.error('SUPABASE_URL must start with https://', baseUrl)
    return res.status(500).json({ error: 'Server is not configured.' })
  }

  const inv = await validateInvite(baseUrl, key, body.inviteCode)
  if (!inv.ok) return badRequest(res, inv.error)

  const inviteStored = inv.code || null
  const row = { email, tier, source, invite_code: inviteStored }

  let ins = await insertSignup(baseUrl, key, row)
  let wasNewSignup = ins.ok

  if (!ins.ok && (ins.code === '23505' || ins.status === 409)) {
    if (source === 'waitlist') {
      const existing = await fetchSignupByEmail(baseUrl, key, email)
      const patch = { tier, source: 'waitlist' }
      if (inviteStored) patch.invite_code = inviteStored
      const up = await updateSignup(baseUrl, key, email, patch)
      if (!up.ok) {
        console.error('waitlist update after duplicate', up)
        return res
          .status(500)
          .json({ error: 'Could not save your signup. Please try again.' })
      }
      ins = { ok: true }
      wasNewSignup = false

      if (inviteStored && existing && !existing.invite_code) {
        const fresh = await fetchInviteRow(baseUrl, key, inviteStored)
        if (fresh) await bumpInviteUses(baseUrl, key, fresh)
      }
    } else if (source === 'identity_gate') {
      ins = { ok: true }
      wasNewSignup = false
    }
  }

  if (!ins.ok) {
    console.error('waitlist insert error', ins)
    return res
      .status(500)
      .json({ error: 'Could not save your signup. Please try again.' })
  }

  if (wasNewSignup && inv.row) {
    await bumpInviteUses(baseUrl, key, inv.row)
  }

  const totalReaders = await countSignups(baseUrl, key)

  return res.status(200).json({ ok: true, totalReaders })
}
