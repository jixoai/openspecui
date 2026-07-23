/**
 * Orthogonal intents (updated 2026-07-24 Asia/Shanghai):
 * 1. Prove hosted health metadata and embedded-UI protocol classification.
 * 2. Distinguish reachable authentication rejection from transport offline state.
 * 3. Prove locator-scoped credentials are sent only to their matching health endpoint.
 *
 * Original request (2026-07-15): "我们可以在 cli 上新增一个 --auth 或者 --password。"
 * Delivery correction (2026-07-24): protected 401/403 backends are authentication-required, not offline.
 */
import { buildBackendHealthPayload } from '@openspecui/core/hosted-app'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindLaunchCredential, clearLaunchCredential } from './launch-credential'
import { probeHostedBackend } from './reachability'

const API_A = 'http://localhost:3100'
const API_B = 'http://localhost:3200'

afterEach(() => {
  clearLaunchCredential(API_A)
  clearLaunchCredential(API_B)
})

describe('hosted reachability helpers', () => {
  it('returns hosted backend metadata from /api/health', async () => {
    const fetchImpl: typeof fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify(
            buildBackendHealthPayload({
              projectDir: '/tmp/demo',
              projectName: 'demo',
              watcherEnabled: true,
              openspecuiVersion: '2.0.2',
              embeddedUiUrl: 'http://localhost:4100',
            })
          ),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }
        )
    )

    const result = await probeHostedBackend('http://localhost:3100', fetchImpl)

    expect(result.reachability).toBe('online')
    expect(result.health?.projectName).toBe('demo')
    expect(result.health?.openspecuiVersion).toBe('2.0.2')
    expect(result.health?.embeddedUiUrl).toBe('http://localhost:4100')
    expect(result.errorMessage).toBeNull()
  })

  it('reports unsupported embedded UI URLs as unsupported', async () => {
    const fetchImpl: typeof fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify(
            buildBackendHealthPayload({
              projectDir: '/tmp/demo',
              projectName: 'demo',
              watcherEnabled: true,
              openspecuiVersion: '2.0.2',
              embeddedUiUrl: 'http://intranet.example.com',
            })
          ),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }
        )
    )

    const result = await probeHostedBackend('http://localhost:3100', fetchImpl)

    expect(result.reachability).toBe('unsupported')
    expect(result.health).toBeNull()
    expect(result.errorMessage).toContain('not supported')
  })

  it('reports an incompatible protocol version as unsupported', async () => {
    const fetchImpl: typeof fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            status: 'ok',
            projectDir: '/tmp/demo',
            projectName: 'demo',
            watcherEnabled: true,
            openspecuiVersion: '2.0.2',
            // Wrong protocol version must be rejected.
            hostedShellProtocolVersion: 999,
            embeddedUiUrl: 'http://localhost:4100',
            runtimeCapabilities: ['notifications.subscribe', 'config.notifications'],
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }
        )
    )

    const result = await probeHostedBackend('http://localhost:3100', fetchImpl)
    expect(result.reachability).toBe('unsupported')
    expect(result.health).toBeNull()
  })

  it('marks a backend as offline when health fetch fails', async () => {
    const fetchImpl: typeof fetch = vi.fn(async () => {
      throw new Error('offline')
    })

    const result = await probeHostedBackend('http://localhost:3100', fetchImpl)

    expect(result.reachability).toBe('offline')
    expect(result.health).toBeNull()
  })

  it.each([401, 403])('marks a reachable %s backend as authentication-required', async (status) => {
    const fetchImpl: typeof fetch = vi.fn(async () => new Response(null, { status }))

    const result = await probeHostedBackend('http://localhost:3100', fetchImpl)

    expect(result.reachability).toBe('authentication-required')
    expect(result.health).toBeNull()
    expect(result.errorMessage).toContain('credential')
  })

  it('sends each locator only its own credential', async () => {
    bindLaunchCredential(API_A, 'credential-a')
    bindLaunchCredential(API_B, 'credential-b')
    const observed: Array<{ url: string; authorization: string | null }> = []
    const fetchImpl: typeof fetch = vi.fn(async (input, init) => {
      observed.push({
        url: String(input),
        authorization: new Headers(init?.headers).get('authorization'),
      })
      const apiBaseUrl = String(input).replace(/\/api\/health$/, '')
      return new Response(
        JSON.stringify(
          buildBackendHealthPayload({
            projectDir: '/tmp/demo',
            projectName: 'demo',
            watcherEnabled: true,
            openspecuiVersion: '2.0.2',
            embeddedUiUrl: apiBaseUrl,
          })
        ),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    })

    await Promise.all([probeHostedBackend(API_A, fetchImpl), probeHostedBackend(API_B, fetchImpl)])

    expect(observed).toEqual([
      { url: `${API_A}/api/health`, authorization: 'Bearer credential-a' },
      { url: `${API_B}/api/health`, authorization: 'Bearer credential-b' },
    ])
  })
})
