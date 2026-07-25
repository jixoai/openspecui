/**
 * Orthogonal intents (updated 2026-07-25 Asia/Shanghai):
 * 1. Prove the Access Gate enforces the shared Bearer through a real Hono HTTP registration.
 * 2. Prove WebSocket connection params and PTY first-message auth reject bad/missing credentials.
 * 3. Prove the gate is absent-by-default (unguarded pass-through) and never leaks the secret.
 *
 * Original request (2026-07-15): "我们可以在 cli 上新增一个 --auth 或者 --password。这样后端接口就必须带上这个 http header。"
 * Delivery correction (2026-07-24): "每项先明确一个生产 owner、一个精准红例、一个绿例。"
 * Section 8.9-8.14 coverage.
 */
import { generateAccessGateCredential } from '@openspecui/core'
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import {
  ACCESS_GATE_NON_LOOPBACK_WARNING,
  type AccessGate,
  checkWebSocketConnectionParams,
  createAccessGate,
  createAccessGateMiddleware,
  extractBearerCredential,
  isLoopbackHostname,
  parsePtyAuthFirstMessage,
} from './access-gate.js'

function createProtectedApp(gate: AccessGate) {
  const app = new Hono()
  let protectedRouteCalls = 0

  app.use('*', createAccessGateMiddleware(gate))
  app.get('/api/protected', (c) => {
    protectedRouteCalls += 1
    return c.json({ protected: true })
  })

  return {
    app,
    protectedRouteCalls: () => protectedRouteCalls,
  }
}

function protectedRequest(authorization?: string) {
  return new Request('http://openspecui.test/api/protected', {
    headers: authorization === undefined ? undefined : { Authorization: authorization },
  })
}

describe('access gate', () => {
  const credential = generateAccessGateCredential()

  it('is a pass-through when no gate is configured', async () => {
    const { app, protectedRouteCalls } = createProtectedApp(null)

    const response = await app.request(protectedRequest())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ protected: true })
    expect(protectedRouteCalls()).toBe(1)
  })

  it('rejects HTTP requests without a credential with 401', async () => {
    const gate = createAccessGate({ credential, loopback: true })
    const { app, protectedRouteCalls } = createProtectedApp(gate)

    const response = await app.request(protectedRequest())

    expect([response.status, protectedRouteCalls()]).toEqual([401, 0])
    expect(await response.json()).toEqual({
      error: 'Unauthorized',
      reason: 'Authorization credential is required.',
    })
  })

  it('accepts HTTP requests with the matching Bearer credential', async () => {
    const gate = createAccessGate({ credential, loopback: true })
    const { app, protectedRouteCalls } = createProtectedApp(gate)

    const response = await app.request(protectedRequest(credential.authorizationHeader))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ protected: true })
    expect(protectedRouteCalls()).toBe(1)
  })

  it('rejects an incorrect credential without echoing it', async () => {
    const gate = createAccessGate({ credential, loopback: true })
    const { app, protectedRouteCalls } = createProtectedApp(gate)

    const response = await app.request(protectedRequest('Bearer wrong-secret'))
    const body = await response.text()

    expect(response.status).toBe(401)
    expect(protectedRouteCalls()).toBe(0)
    // The response must never contain the presented or real secret.
    expect(body).not.toContain('wrong-secret')
    expect(body).not.toContain(credential.credential)
  })

  it('extractBearerCredential accepts only a non-empty Bearer header', () => {
    expect(extractBearerCredential('Bearer abc')).toBe('abc')
    expect(extractBearerCredential('Bearer  ')).toBeNull()
    expect(extractBearerCredential('Basic abc')).toBeNull()
    expect(extractBearerCredential(null)).toBeNull()
    expect(extractBearerCredential(undefined)).toBeNull()
  })

  it('checkWebSocketConnectionParams accepts the matching authorization param and rejects others', () => {
    const gate = createAccessGate({ credential, loopback: true })
    expect(
      checkWebSocketConnectionParams(gate, { authorization: credential.authorizationHeader })
    ).toBeNull()
    expect(checkWebSocketConnectionParams(gate, { authorization: 'Bearer wrong' })).toMatch(
      /rejected/
    )
    expect(checkWebSocketConnectionParams(gate, {})).toMatch(/required/)
    expect(checkWebSocketConnectionParams(gate, null)).toMatch(/required/)
    expect(checkWebSocketConnectionParams(null, {})).toBeNull()
  })

  it('parsePtyAuthFirstMessage only accepts a well-formed auth message', () => {
    expect(parsePtyAuthFirstMessage({ type: 'auth', credential: 'abc' })).toEqual({
      type: 'auth',
      credential: 'abc',
    })
    expect(parsePtyAuthFirstMessage({ type: 'create', command: 'x' })).toBeNull()
    expect(parsePtyAuthFirstMessage({ type: 'auth' })).toBeNull()
    expect(parsePtyAuthFirstMessage(null)).toBeNull()
    expect(parsePtyAuthFirstMessage('not-an-object')).toBeNull()
  })

  it('isLoopbackHostname identifies loopback hosts', () => {
    expect(isLoopbackHostname('localhost')).toBe(true)
    expect(isLoopbackHostname('127.0.0.1')).toBe(true)
    expect(isLoopbackHostname('[::1]')).toBe(true)
    expect(isLoopbackHostname('example.com')).toBe(false)
  })

  it('exposes a non-loopback HTTPS/WSS warning', () => {
    expect(ACCESS_GATE_NON_LOOPBACK_WARNING).toMatch(/HTTPS\/WSS/)
  })
})
