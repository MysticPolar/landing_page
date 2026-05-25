const test = require('node:test')
const assert = require('node:assert')
const { parseCookies, getSessionToken, SESSION_COOKIE_NAME } = require('../lib/cookies')

test('parseCookies handles empty / missing headers', () => {
  assert.deepEqual(parseCookies({}), {})
  assert.deepEqual(parseCookies({ headers: {} }), {})
  assert.deepEqual(parseCookies({ headers: { cookie: '' } }), {})
})

test('parseCookies parses a single cookie', () => {
  const out = parseCookies({ headers: { cookie: 'foo=bar' } })
  assert.equal(out.foo, 'bar')
})

test('parseCookies parses multiple cookies and trims whitespace', () => {
  const out = parseCookies({
    headers: { cookie: 'a=1; b=hello;  c=world' },
  })
  assert.equal(out.a, '1')
  assert.equal(out.b, 'hello')
  assert.equal(out.c, 'world')
})

test('parseCookies decodes URI-encoded values', () => {
  const out = parseCookies({
    headers: { cookie: 'token=' + encodeURIComponent('a:b/c d') },
  })
  assert.equal(out.token, 'a:b/c d')
})

test('parseCookies handles values containing = signs', () => {
  const out = parseCookies({
    headers: { cookie: 'session=abc=def' },
  })
  assert.equal(out.session, 'abc=def')
})

test('getSessionToken returns the configured cookie value', () => {
  const out = getSessionToken({
    headers: { cookie: SESSION_COOKIE_NAME + '=mytoken123' },
  })
  assert.equal(out, 'mytoken123')
})

test('getSessionToken returns null when not present', () => {
  assert.equal(getSessionToken({ headers: { cookie: 'other=1' } }), null)
  assert.equal(getSessionToken({ headers: {} }), null)
  assert.equal(getSessionToken({}), null)
})
