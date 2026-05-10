const { createClient } = require('@supabase/supabase-js')

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

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    return res.status(500).json({ error: 'Server is not configured.' })
  }

  const supabase = createClient(url, key)

  const row = { email, tier, source }
  let { error } = await supabase.from('waitlist_signups').insert(row)

  if (error?.code === '23505') {
    if (source === 'waitlist') {
      const { error: upErr } = await supabase
        .from('waitlist_signups')
        .update({ tier, source: 'waitlist' })
        .eq('email', email)
      if (upErr) {
        console.error(upErr)
        return res
          .status(500)
          .json({ error: 'Could not save your signup. Please try again.' })
      }
    }
    error = null
  }

  if (error) {
    console.error(error)
    return res
      .status(500)
      .json({ error: 'Could not save your signup. Please try again.' })
  }

  const { count } = await supabase
    .from('waitlist_signups')
    .select('*', { count: 'exact', head: true })

  return res.status(200).json({ ok: true, totalReaders: count })
}
