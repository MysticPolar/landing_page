const test = require('node:test')
const assert = require('node:assert')
const { normalizeInvite } = require('../lib/invite-codes')

test('normalizeInvite uppercases and trims', () => {
  assert.equal(normalizeInvite('  owl-abc123  '), 'OWL-ABC123')
})

test('normalizeInvite returns empty for null / empty', () => {
  assert.equal(normalizeInvite(null), '')
  assert.equal(normalizeInvite(''), '')
  assert.equal(normalizeInvite('   '), '')
  assert.equal(normalizeInvite(undefined), '')
})

test('normalizeInvite stringifies non-string input', () => {
  assert.equal(normalizeInvite(123), '123')
})
