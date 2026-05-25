const { authHeaders } = require('./supabase-rest')

function normalizeInvite(raw) {
  if (raw == null || String(raw).trim() === '') return ''
  return String(raw).trim().toUpperCase()
}

async function fetchInviteRow(baseUrl, key, codeUpper) {
  const res = await fetch(
    `${baseUrl}/rest/v1/invitation_codes?code=eq.${encodeURIComponent(
      codeUpper
    )}&select=id,code,max_uses,uses_count,expires_at,active`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  )
  if (!res.ok) return null
  const rows = await res.json()
  return rows[0] || null
}

/**
 * Validate an invite code against public.invitation_codes.
 *
 * @param {string} baseUrl
 * @param {string} key      - Supabase service-role key
 * @param {string} rawInvite
 * @param {object} [opts]
 * @param {boolean} [opts.required=true]
 *   When true (default), an empty code returns { ok: false, error: ... }.
 *   When false, an empty code is treated as a no-op and returns
 *   { ok: true, code: '', row: null } — use this for endpoints where the
 *   invite code is optional (e.g. public waitlist signup).
 */
async function validateInvite(baseUrl, key, rawInvite, opts = {}) {
  const required = opts.required !== false
  const code = normalizeInvite(rawInvite)
  if (!code) {
    return required
      ? { ok: false, error: 'Invitation code is required.' }
      : { ok: true, code: '', row: null }
  }

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

module.exports = {
  normalizeInvite,
  validateInvite,
  bumpInviteUses,
  fetchInviteRow,
}
