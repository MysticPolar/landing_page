const test = require('node:test')
const assert = require('node:assert')
const crypto = require('node:crypto')
const { verifyWebhookSignature } = require('../lib/stripe')

function signedHeader({ body, secret, timestamp }) {
  const ts = timestamp || Math.floor(Date.now() / 1000)
  const sig = crypto.createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex')
  return { header: `t=${ts},v1=${sig}`, ts }
}

test('verifyWebhookSignature accepts a valid signature', () => {
  const body = JSON.stringify({ id: 'evt_1', type: 'test.event' })
  const secret = 'whsec_test_correct'
  const { header } = signedHeader({ body, secret })
  const event = verifyWebhookSignature({
    rawBody: body,
    signatureHeader: header,
    secret,
  })
  assert.equal(event.id, 'evt_1')
  assert.equal(event.type, 'test.event')
})

test('verifyWebhookSignature rejects a tampered body', () => {
  const body = JSON.stringify({ id: 'evt_2', type: 'test.event' })
  const secret = 'whsec_test_correct'
  const { header } = signedHeader({ body, secret })
  assert.throws(
    () =>
      verifyWebhookSignature({
        rawBody: body + 'extra',
        signatureHeader: header,
        secret,
      }),
    /signature mismatch|signature length mismatch/
  )
})

test('verifyWebhookSignature rejects a wrong secret', () => {
  const body = JSON.stringify({ id: 'evt_3', type: 'test.event' })
  const { header } = signedHeader({ body, secret: 'right' })
  assert.throws(
    () =>
      verifyWebhookSignature({
        rawBody: body,
        signatureHeader: header,
        secret: 'wrong',
      }),
    /signature mismatch|signature length mismatch/
  )
})

test('verifyWebhookSignature rejects an old timestamp', () => {
  const body = JSON.stringify({ id: 'evt_4', type: 'test.event' })
  const secret = 'whsec_test'
  const tenMinAgo = Math.floor(Date.now() / 1000) - 10 * 60
  const { header } = signedHeader({ body, secret, timestamp: tenMinAgo })
  assert.throws(
    () =>
      verifyWebhookSignature({
        rawBody: body,
        signatureHeader: header,
        secret,
        toleranceSeconds: 60,
      }),
    /timestamp out of tolerance/
  )
})

test('verifyWebhookSignature rejects a malformed header', () => {
  assert.throws(
    () =>
      verifyWebhookSignature({
        rawBody: '{}',
        signatureHeader: 'not-a-signature',
        secret: 's',
      }),
    /malformed/
  )
})
