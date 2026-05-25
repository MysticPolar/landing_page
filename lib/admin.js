/**
 * Admin gate. Reads ADMIN_ALLOWED_EMAILS (comma-separated) from env.
 *
 * Usage:
 *   const admin = await requireAdmin(req, baseUrl, key)
 *   if (!admin.ok) return res.status(admin.status).json({ error: admin.error })
 *   // admin.user is the logged-in admin
 */

const { validateSession } = require('./sessions')
const { getSessionToken } = require('./cookies')

function adminEmails() {
  const raw = process.env.ADMIN_ALLOWED_EMAILS || ''
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

async function requireAdmin(req, baseUrl, key) {
  const allow = adminEmails()
  if (allow.length === 0) {
    return { ok: false, status: 503, error: 'Admin is not configured.' }
  }
  const token = getSessionToken(req)
  if (!token) return { ok: false, status: 401, error: 'Please log in.' }
  const session = await validateSession(baseUrl, key, token)
  if (!session) return { ok: false, status: 401, error: 'Please log in.' }
  const email = String(session.user.email || '').toLowerCase()
  if (!allow.includes(email)) {
    return { ok: false, status: 403, error: 'Forbidden.' }
  }
  return { ok: true, user: session.user }
}

module.exports = { requireAdmin, adminEmails }
