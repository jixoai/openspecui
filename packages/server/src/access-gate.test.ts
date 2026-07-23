/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Prove the Access Gate enforces the shared Bearer across HTTP middleware.
 * 2. Prove WebSocket connection params and PTY first-message auth reject bad/missing credentials.
 * 3. Prove the gate is absent-by-default (unguarded pass-through) and never leaks the secret.
 *
 * Original request (2026-07-15): "我们可以在 cli 上新增一个 --auth 或者 --password。这样后端接口就必须带上这个 http header。"
 * Section 8.9-8.14 coverage.
 */
import { generateAccessGateCredential } from '@openspecui/core'
import { describe, expect, it, vi } from 'vitest'
import {
  ACCESS_GATE_NON_LOOPBACK_WARNING,
  checkWebSocketConnectionParams,
  createAccessGate,
  createAccessGateMiddleware,
  extractBearerCredential,
  isLoopbackHostname,
  parsePtyAuthFirstMessage,
} from './access-gate.js'

function mockContext(authorization: string | undefined) {
  return {
    req: {
      header: vi.fn((name: string) => (name === 'Authorization' ? authorization : undefined)),
    },
    json: vi.fn((body: unknown, status: number) => ({ body, status })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

async function runMiddleware(
  authorization: string | undefined,
  gate: ReturnType<typeof createAccessGate>
) {
  const c = mockContext(authorization)
  const next = vi.fn()
  const handler = createAccessGateMiddleware(gate)
  await handler(c, next)
  return { c, next }
}

describe('access gate', () => {
  const credential = generateAccessGateCredential()

  it('is a pass-through when no gate is configured', async () => {
    const { c, next } = await runMiddleware(undefined, null)
    expect(next).toHaveBeenCalled()
    expect(c.json).not.toHaveBeenCalled()
  })

  it('rejects HTTP requests without a credential with 401', async () => {
    const gate = createAccessGate({ credential, loopback: true })
    const { c, next } = await runMiddleware(undefined, gate)
    expect(next).not.toHaveBeenCalled()
    expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Unauthorized' }), 401)
  })

  it('accepts HTTP requests with the matching Bearer credential', async () => {
    const gate = createAccessGate({ credential, loopback: true })
    const { c, next } = await runMiddleware(credential.authorizationHeader, gate)
    expect(next).toHaveBeenCalled()
    expect(c.json).not.toHaveBeenCalled()
  })

  it('rejects an incorrect credential without echoing it', async () => {
    const gate = createAccessGate({ credential, loopback: true })
    const { c, next } = await runMiddleware('Bearer wrong-secret', gate)
    expect(next).not.toHaveBeenCalled()
    expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Unauthorized' }), 401)
    // The response must never contain the presented or real secret.
    const body = c.json.mock.calls[0]?.[0] as Record<string, unknown>
    expect(JSON.stringify(body)).not.toContain('wrong-secret')
    expect(JSON.stringify(body)).not.toContain(credential.credential)
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
