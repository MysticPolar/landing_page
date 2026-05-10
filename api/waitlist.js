/**
 * Waitlist signup via Supabase PostgREST.
 * Supports both legacy JWT `service_role` and new `sb_secret_...` keys
 * (supabase-js createClient() does not work with sb_secret keys alone).
 */

function normalizeSupabaseUrl(raw) {
  if (!raw) return ''
  let u = String(raw).trim().replace(/\/$/, '')
  u = u.replace(/\/rest\/v1\/?$/, '')
  return u
}

function authHeaders(key) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  }
}

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

async function countSignups(baseUrl, key) {
  const res = await fetch(
    `${baseUrl}/rest/v1/waitlist_signups?select=id`,
    {
      method: 'HEAD',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: 'count=exact',
      },
    }
  )
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

  const row = { email, tier, source }

  let ins = await insertSignup(baseUrl, key, row)

  if (!ins.ok && (ins.code === '23505' || ins.status === 409)) {
    if (source === 'waitlist') {
      const up = await updateSignup(baseUrl, key, email, {
        tier,
        source: 'waitlist',
      })
      if (!up.ok) {
        console.error('waitlist update after duplicate', up)
        return res
          .status(500)
          .json({ error: 'Could not save your signup. Please try again.' })
      }
    }
    ins = { ok: true }
  }

  if (!ins.ok) {
    console.error('waitlist insert error', ins)
    return res
      .status(500)
      .json({ error: 'Could not save your signup. Please try again.' })
  }

  const totalReaders = await countSignups(baseUrl, key)

  return res.status(200).json({ ok: true, totalReaders })
}
