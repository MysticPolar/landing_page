const test = require('node:test')
const assert = require('node:assert')
const { hashToken } = require('../lib/sessions')

test('hashToken is deterministic SHA-256', () => {
  const t = 'abc123'
  const expected = require('crypto')
    .createHash('sha256')
    .update(t)
    .digest('hex')
  assert.equal(hashToken(t), expected)
})

test('hashToken yields 64-char hex', () => {
  const h = hashToken('whatever')
  assert.ok(/^[0-9a-f]{64}$/.test(h))
})

test('hashToken handles different inputs differently', () => {
  assert.notEqual(hashToken('a'), hashToken('b'))
})
