/**
 * Password hashing with scrypt.
 *
 * Stored format: `scrypt$<N>$<r>$<p>$<salt-hex>$<hash-hex>`
 *
 * Verification reads the parameters from the stored hash, so this module
 * can verify old hashes produced with weaker N — and we can ratchet the
 * default upward without invalidating anyone's credentials.
 *
 * Memory cost of scrypt: 128 * N * r bytes.
 *   N=16384, r=8  →  ~16 MB    (original, accepted on verify)
 *   N=32768, r=8  →  ~33 MB    (current default)
 * Node's default maxmem is 32 MB; we override to 64 MB so future ratchets
 * don't need a code change.
 */

const crypto = require('crypto')

const SCRYPT_N = 32768          // ratcheted up from 16384
const SCRYPT_R = 8
const SCRYPT_P = 1
const KEYLEN = 64
const SCRYPT_MAXMEM = 64 * 1024 * 1024 // 64 MB

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto
    .scryptSync(password, salt, KEYLEN, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
      maxmem: SCRYPT_MAXMEM,
    })
    .toString('hex')
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${hash}`
}

function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string') return false
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const N = Number(parts[1])
  const r = Number(parts[2])
  const p = Number(parts[3])
  const salt = parts[4]
  const hashHex = parts[5]
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) {
    return false
  }
  let derived
  try {
    derived = crypto
      .scryptSync(password, salt, KEYLEN, { N, r, p, maxmem: SCRYPT_MAXMEM })
      .toString('hex')
  } catch {
    return false
  }
  const a = Buffer.from(hashHex, 'hex')
  const b = Buffer.from(derived, 'hex')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

/**
 * Returns true if the stored hash was produced with weaker params than the
 * current default. The caller may choose to re-hash on successful login.
 */
function needsRehash(stored) {
  if (!stored || typeof stored !== 'string') return true
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return true
  return Number(parts[1]) < SCRYPT_N
}

module.exports = { hashPassword, verifyPassword, needsRehash }
