const test = require('node:test')
const assert = require('node:assert')
const { hashPassword, verifyPassword, needsRehash } = require('../lib/password-hash')

test('hashPassword produces the expected format', () => {
  const stored = hashPassword('hunter2!')
  const parts = stored.split('$')
  assert.equal(parts.length, 6)
  assert.equal(parts[0], 'scrypt')
  assert.ok(/^\d+$/.test(parts[1]))   // N
  assert.ok(/^\d+$/.test(parts[2]))   // r
  assert.ok(/^\d+$/.test(parts[3]))   // p
  assert.ok(/^[0-9a-f]+$/.test(parts[4])) // salt hex
  assert.ok(/^[0-9a-f]+$/.test(parts[5])) // hash hex
})

test('verifyPassword accepts the correct password', () => {
  const stored = hashPassword('correct horse battery staple')
  assert.equal(verifyPassword('correct horse battery staple', stored), true)
})

test('verifyPassword rejects the wrong password', () => {
  const stored = hashPassword('correct horse battery staple')
  assert.equal(verifyPassword('correct horse battery stapler', stored), false)
  assert.equal(verifyPassword('', stored), false)
  assert.equal(verifyPassword('CORRECT HORSE BATTERY STAPLE', stored), false)
})

test('verifyPassword tolerates legacy N=16384 hashes', () => {
  // Hand-craft an old-style hash from the old N value.
  const crypto = require('crypto')
  const N = 16384, r = 8, p = 1
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync('legacy', salt, 64, { N, r, p }).toString('hex')
  const stored = `scrypt$${N}$${r}$${p}$${salt}$${hash}`
  assert.equal(verifyPassword('legacy', stored), true)
})

test('needsRehash flags legacy hashes for upgrade', () => {
  const legacy = 'scrypt$16384$8$1$deadbeef$deadbeef'
  assert.equal(needsRehash(legacy), true)

  const fresh = hashPassword('hello-world')
  assert.equal(needsRehash(fresh), false)
})

test('verifyPassword returns false on malformed input', () => {
  assert.equal(verifyPassword('x', ''), false)
  assert.equal(verifyPassword('x', null), false)
  assert.equal(verifyPassword('x', 'bcrypt$10$xyz'), false)
  assert.equal(verifyPassword('x', 'scrypt$NOT$8$1$aa$bb'), false)
})
