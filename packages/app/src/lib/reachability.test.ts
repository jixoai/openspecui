import { buildBackendHealthPayload } from '@openspecui/core/hosted-app'
import { describe, expect, it, vi } from 'vitest'
import { probeHostedBackend } from './reachability'

describe('hosted reachability helpers', () => {
  it('returns hosted backend metadata from /api/health', async () => {
    const fetchImpl = vi.fn(
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
    ) as typeof fetch

    const result = await probeHostedBackend('http://localhost:3100', fetchImpl)

    expect(result.reachability).toBe('online')
    expect(result.health?.projectName).toBe('demo')
    expect(result.health?.openspecuiVersion).toBe('2.0.2')
    expect(result.health?.embeddedUiUrl).toBe('http://localhost:4100')
    expect(result.errorMessage).toBeNull()
  })

  it('reports unsupported embedded UI URLs as online-but-incompatible', async () => {
    const fetchImpl = vi.fn(
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
    ) as typeof fetch

    const result = await probeHostedBackend('http://localhost:3100', fetchImpl)

    expect(result.reachability).toBe('online')
    expect(result.health).toBeNull()
    expect(result.errorMessage).toContain('not supported')
  })

  it('marks a backend as offline when health fetch fails', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('offline')
    }) as typeof fetch

    const result = await probeHostedBackend('http://localhost:3100', fetchImpl)

    expect(result.reachability).toBe('offline')
    expect(result.health).toBeNull()
  })
})
