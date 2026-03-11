import { describe, expect, it, vi } from 'vitest'
import { fetchHostedAppManifest, probeHostedBackend } from './reachability'

const manifest = {
  packageName: 'openspecui' as const,
  generatedAt: '2026-03-09T00:00:00.000Z',
  defaultChannel: 'latest',
  channels: {
    latest: {
      id: 'latest',
      kind: 'latest' as const,
      selector: 'latest',
      resolvedVersion: '2.1.3',
      rootPath: '/versions/latest/',
      shellPath: '/versions/latest/index.html',
      major: 2,
    },
  },
  compatibility: [],
}

describe('hosted reachability helpers', () => {
  it('loads the hosted manifest from the current app base URL', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify(manifest), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
    ) as typeof fetch

    const result = await fetchHostedAppManifest(
      { href: 'https://app.openspecui.com/workspace?api=http://localhost:3100' },
      fetchImpl
    )

    expect(result.defaultChannel).toBe('latest')
    expect(fetchImpl).toHaveBeenCalledWith('https://app.openspecui.com/workspace/version.json', {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    })
  })

  it('returns hosted backend metadata from /api/health', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            status: 'ok',
            projectDir: '/tmp/demo',
            projectName: 'demo',
            watcherEnabled: true,
            openspecuiVersion: '2.0.2',
          }),
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
    expect(result.errorMessage).toBeNull()
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
