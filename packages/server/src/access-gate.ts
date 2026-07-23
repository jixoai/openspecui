/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Enforce one shared Bearer credential across every backend transport boundary.
 * 2. Authenticate HTTP/tRPC requests via the Authorization header without leaking the secret.
 * 3. Authenticate WebSocket transports via connection params / first message (never query params).
 * 4. Keep the gate absent by default so the unguarded dev workflow is unchanged.
 *
 * Original request (2026-07-15): "我们可以在 cli 上新增一个 --auth 或者 --password。这样后端接口就必须带上这个 http header。"
 * Section 8.9-8.13: --auth/--password, whole-backend Access Gate, credential hygiene, HTTPS/WSS note.
 *
 * Invariants (AGENTS.md):
 *  - The gate is one shared Bearer credential for the whole boundary; not an account/role/ACL system.
 *  - HTTP uses the Authorization header; tRPC WebSocket uses connection params; PTY WebSocket
 *    authenticates in its first message before any command is accepted.
 *  - Credentials must never enter query parameters, persisted tabs, or localStorage.
 *  - The gate provides no transport confidentiality; non-loopback deployments require HTTPS/WSS.
 */
import { constantTimeEqual, type AccessGateCredential } from '@openspecui/core'
import type { MiddlewareHandler } from 'hono'

/** Bearer token prefix expected on the Authorization header. */
export const ACCESS_GATE_BEARER_PREFIX = 'Bearer '

/** Outcome of one access-gate check. */
export type AccessGateCheckOutcome = { ok: true } | { ok: false; reason: string }

/** A configured access gate; `null` means the backend is unguarded (default dev behavior). */
export type AccessGate = {
  credential: AccessGateCredential
  /** True when the bound listener is loopback (HTTP/WSS transport confidentiality is not required). */
  loopback: boolean
  check(presented: string | null | undefined): AccessGateCheckOutcome
} | null

/** Build an Access Gate from an optional credential and loopback flag. */
export function createAccessGate(options: {
  credential?: AccessGateCredential | null
  loopback?: boolean
}): AccessGate {
  if (!options.credential) return null
  const credential = options.credential
  return {
    credential,
    loopback: options.loopback ?? true,
    check(presented) {
      if (presented === null || presented === undefined || presented.length === 0) {
        return { ok: false, reason: 'Authorization credential is required.' }
      }
      if (!constantTimeEqual(presented, credential.credential)) {
        return { ok: false, reason: 'Authorization credential was rejected.' }
      }
      return { ok: true }
    },
  }
}

/** Extract the Bearer credential from an `Authorization` header value, or null if absent/malformed. */
export function extractBearerCredential(authorization: string | null | undefined): string | null {
  if (!authorization) return null
  if (!authorization.startsWith(ACCESS_GATE_BEARER_PREFIX)) return null
  const value = authorization.slice(ACCESS_GATE_BEARER_PREFIX.length).trim()
  return value.length > 0 ? value : null
}

/**
 * Hono middleware enforcing the Access Gate on every HTTP request. When no gate is configured the
 * middleware is a pass-through. A rejected request responds 401 with a neutral message and never
 * echoes the presented credential.
 */
export function createAccessGateMiddleware(gate: AccessGate): MiddlewareHandler {
  return async (c, next) => {
    if (!gate) {
      await next()
      return
    }
    const presented = extractBearerCredential(c.req.header('Authorization'))
    const outcome = gate.check(presented)
    if (!outcome.ok) {
      return c.json({ error: 'Unauthorized', reason: outcome.reason }, 401)
    }
    await next()
  }
}

/**
 * Validate a tRPC WebSocket connection from its connection params. tRPC WS clients pass auth via
 * `connectionParams`; the gate reads the `authorization` param (header-shaped) so credentials never
 * enter the URL. Returns null when accepted (or unguarded), or a rejection reason string.
 */
export function checkWebSocketConnectionParams(
  gate: AccessGate,
  params: Record<string, unknown> | null | undefined
): string | null {
  if (!gate) return null
  const raw = typeof params?.authorization === 'string' ? params.authorization : null
  const presented = extractBearerCredential(raw)
  const outcome = gate.check(presented)
  return outcome.ok ? null : outcome.reason
}

/**
 * First-message authentication for the PTY WebSocket. The client must send one JSON message of shape
 * `{ type: 'auth', credential: '<bearer>' }` before any command. Returns the parsed credential on
 * success, a rejection reason on failure, or `null` when the message is not an auth attempt (the
 * caller then treats an unauthenticated gate as a hard rejection).
 */
export interface PtyAuthFirstMessage {
  type: 'auth'
  credential: string
}

export function parsePtyAuthFirstMessage(raw: unknown): PtyAuthFirstMessage | null {
  if (typeof raw !== 'object' || raw === null) return null
  const value = raw as Record<string, unknown>
  if (value.type !== 'auth') return null
  if (typeof value.credential !== 'string') return null
  return { type: 'auth', credential: value.credential }
}

/** True when `hostname` is loopback (transport confidentiality not required for the Access Gate). */
export function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase()
  return (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '[::1]' ||
    normalized === '::1' ||
    normalized.endsWith('.localhost')
  )
}

/** Human-readable HTTPS/WSS requirement for non-loopback gated deployments. */
export const ACCESS_GATE_NON_LOOPBACK_WARNING =
  'Access Gate is enabled on a non-loopback address. Non-loopback deployments require HTTPS/WSS; ' +
  'the Bearer credential provides no transport confidentiality over plaintext.'
