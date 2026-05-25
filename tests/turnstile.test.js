const test = require('node:test')
const assert = require('node:assert')
const { extractToken, verifyTurnstile } = require('../lib/turnstile')

test('extractToken pulls turnstileToken from body', () => {
  assert.equal(extractToken({ turnstileToken: 'abc' }), 'abc')
})

test('extractToken accepts the cf-turnstile-response field name', () => {
  assert.equal(extractToken({ 'cf-turnstile-response': 'xyz' }), 'xyz')
})

test('extractToken accepts captchaToken alias', () => {
  assert.equal(extractToken({ captchaToken: 'qqq' }), 'qqq')
})

test('extractToken returns empty string when missing', () => {
  assert.equal(extractToken({}), '')
  assert.equal(extractToken(null), '')
  assert.equal(extractToken(undefined), '')
})

test('verifyTurnstile is skipped when TURNSTILE_SECRET_KEY is not set', async () => {
  const prev = process.env.TURNSTILE_SECRET_KEY
  delete process.env.TURNSTILE_SECRET_KEY
  try {
    const r = await verifyTurnstile({ token: 'doesnt-matter' })
    assert.equal(r.ok, true)
    assert.equal(r.skipped, true)
  } finally {
    if (prev != null) process.env.TURNSTILE_SECRET_KEY = prev
  }
})

test('verifyTurnstile requires a token when secret is configured', async () => {
  const prev = process.env.TURNSTILE_SECRET_KEY
  process.env.TURNSTILE_SECRET_KEY = 'fake'
  try {
    const r = await verifyTurnstile({ token: '' })
    assert.equal(r.ok, false)
    assert.equal(r.error, 'missing_captcha')
  } finally {
    if (prev != null) process.env.TURNSTILE_SECRET_KEY = prev
    else delete process.env.TURNSTILE_SECRET_KEY
  }
})
