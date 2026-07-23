/**
 * Orthogonal intents (created 2026-07-24 Asia/Shanghai):
 * 1. Prove launch fragments are consumed into memory and stripped without deleting unrelated state.
 * 2. Prove protected backend fetches receive Authorization while external/public requests never do.
 *
 * Original request (2026-07-24): "Project Web consumes and removes it before rendering."
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('Project Web Access Gate credential owner', () => {
  beforeEach(() => {
    vi.resetModules()
    window.history.replaceState(
      {},
      '',
      '/dashboard?api=http://localhost:3100&session=a#credential=secret-a&section=git'
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    window.history.replaceState({}, '', '/')
  })

  it('consumes the secret before rendering while preserving non-secret fragment state', async () => {
    const { consumeAccessGateLaunchCredential, getAccessGateAuthorization } = await import(
      './access-gate-credential'
    )

    expect(consumeAccessGateLaunchCredential()).toBe('secret-a')
    expect(getAccessGateAuthorization()).toBe('Bearer secret-a')
    expect(window.location.hash).toBe('#section=git')
    expect(window.location.href).not.toContain('secret-a')
  })

  it('adds the credential only to protected requests at the configured backend', async () => {
    const calls: Array<{ url: string; authorization: string | null }> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = input instanceof Request ? input : null
        calls.push({
          url: request?.url ?? String(input),
          authorization: new Headers(init?.headers ?? request?.headers).get('Authorization'),
        })
        return new Response(null, { status: 204 })
      })
    )
    const { accessGateFetch } = await import('./access-gate-credential')

    await accessGateFetch('http://localhost:3100/api/health')
    await accessGateFetch('http://localhost:3100/assets/main.js')
    await accessGateFetch('https://example.com/api/private')

    expect(calls).toEqual([
      { url: 'http://localhost:3100/api/health', authorization: 'Bearer secret-a' },
      { url: 'http://localhost:3100/assets/main.js', authorization: null },
      { url: 'https://example.com/api/private', authorization: null },
    ])
  })
})
