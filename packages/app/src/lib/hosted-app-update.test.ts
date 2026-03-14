import { describe, expect, it, vi } from 'vitest'
import {
  buildAppShellCacheName,
  buildChannelCacheName,
  MANIFEST_CACHE_NAME,
} from './hosted-app-caches'
import {
  buildClaimedHostedCacheNames,
  collectStaleHostedCacheNames,
  collectTargetChannelIds,
  hasHostedDeploymentUpdate,
  refreshHostedManifestCache,
  warmHostedAppShell,
  warmHostedVersionChannels,
} from './hosted-app-update'

class MemoryCache {
  private readonly entries = new Map<string, Response>()

  async match(request: RequestInfo | URL): Promise<Response | undefined> {
    return this.entries.get(resolveRequestUrl(request))?.clone()
  }

  async put(request: RequestInfo | URL, response: Response): Promise<void> {
    this.entries.set(resolveRequestUrl(request), response.clone())
  }
}

class MemoryCacheStorage {
  private readonly caches = new Map<string, MemoryCache>()

  async delete(cacheName: string): Promise<boolean> {
    return this.caches.delete(cacheName)
  }

  async keys(): Promise<string[]> {
    return Array.from(this.caches.keys())
  }

  async open(cacheName: string): Promise<MemoryCache> {
    const existing = this.caches.get(cacheName)
    if (existing) {
      return existing
    }
    const next = new MemoryCache()
    this.caches.set(cacheName, next)
    return next
  }
}

function resolveRequestUrl(request: RequestInfo | URL): string {
  if (typeof request === 'string') {
    return new URL(request, 'https://app.openspecui.com').toString()
  }
  if (request instanceof URL) {
    return request.toString()
  }
  return request.url
}

const currentManifest = {
  packageName: 'openspecui' as const,
  generatedAt: '2026-03-13T00:00:00.000Z',
  defaultChannel: 'latest',
  channels: {
    latest: {
      id: 'latest',
      kind: 'latest' as const,
      selector: 'latest',
      resolvedVersion: '2.1.2',
      rootPath: '/versions/latest/',
      shellPath: '/versions/latest/',
      major: 2,
    },
    'v2.0': {
      id: 'v2.0',
      kind: 'minor' as const,
      selector: '~2.0.0',
      resolvedVersion: '2.0.9',
      rootPath: '/versions/v2.0/',
      shellPath: '/versions/v2.0/',
      major: 2,
      minor: 0,
    },
  },
  compatibility: [{ range: '~2.0.0', channel: 'v2.0' }],
}

const nextManifest = {
  ...currentManifest,
  generatedAt: '2026-03-14T00:00:00.000Z',
  channels: {
    ...currentManifest.channels,
    latest: {
      ...currentManifest.channels.latest,
      resolvedVersion: '2.1.3',
    },
  },
}

function createFetchMock() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = resolveRequestUrl(input)

    if (url.endsWith('/version.json')) {
      return new Response(JSON.stringify(nextManifest), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    if (url === 'https://app.openspecui.com/' || url === 'https://app.openspecui.com/index.html') {
      return new Response(
        '<!doctype html><link rel="stylesheet" href="/assets/app.css"><script type="module" src="/assets/app.js"></script>',
        {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        }
      )
    }

    if (
      url === 'https://app.openspecui.com/versions/latest/' ||
      url === 'https://app.openspecui.com/versions/latest/index.html'
    ) {
      return new Response(
        '<!doctype html><script>window.__OPENSPEC_BASE_PATH__ = \'/versions/latest/\'</script><script type="module" src="/versions/latest/assets/index.js"></script>',
        {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        }
      )
    }

    return new Response('ok', {
      status: 200,
      headers: {
        'content-type': url.endsWith('.json')
          ? 'application/json'
          : url.endsWith('.js')
            ? 'application/javascript; charset=utf-8'
            : url.endsWith('.css')
              ? 'text/css; charset=utf-8'
              : 'text/plain; charset=utf-8',
      },
    })
  }) as typeof fetch
}

describe('hosted app update helpers', () => {
  it('refreshes version.json into the shared manifest cache', async () => {
    const cacheStorage = new MemoryCacheStorage()
    const fetchImpl = createFetchMock()

    const manifest = await refreshHostedManifestCache(
      { href: 'https://app.openspecui.com/?api=http://localhost:3100' },
      cacheStorage,
      fetchImpl
    )

    expect(manifest.generatedAt).toBe(nextManifest.generatedAt)
    const manifestCache = await cacheStorage.open(MANIFEST_CACHE_NAME)
    expect(await manifestCache.match('https://app.openspecui.com/version.json')).toBeTruthy()
  })

  it('warms the app shell, target channel caches, and identifies stale caches', async () => {
    const cacheStorage = new MemoryCacheStorage()
    const fetchImpl = createFetchMock()

    await (
      await cacheStorage.open(buildAppShellCacheName('2026-03-01T00:00:00.000Z'))
    ).put('https://app.openspecui.com/', new Response('old shell'))
    await (
      await cacheStorage.open('openspecui-app:v1.9:1.9.9')
    ).put('https://app.openspecui.com/versions/v1.9/', new Response('old channel'))

    const appShellCache = await warmHostedAppShell(
      nextManifest,
      { href: 'https://app.openspecui.com/?api=http://localhost:3100' },
      cacheStorage,
      fetchImpl
    )
    const channelCaches = await warmHostedVersionChannels(
      nextManifest,
      collectTargetChannelIds(nextManifest, ['latest']),
      { href: 'https://app.openspecui.com/?api=http://localhost:3100' },
      cacheStorage,
      fetchImpl
    )
    const staleCaches = await collectStaleHostedCacheNames(cacheStorage, nextManifest)

    expect(appShellCache).toBe(buildAppShellCacheName(nextManifest.generatedAt))
    expect(channelCaches).toEqual([buildChannelCacheName(nextManifest.channels.latest)])

    const appCache = await cacheStorage.open(appShellCache)
    expect(await appCache.match('https://app.openspecui.com/')).toBeTruthy()
    expect(await appCache.match('https://app.openspecui.com/index.html')).toBeTruthy()

    const latestCache = await cacheStorage.open(buildChannelCacheName(nextManifest.channels.latest))
    expect(await latestCache.match('https://app.openspecui.com/versions/latest/')).toBeTruthy()
    expect(
      await latestCache.match('https://app.openspecui.com/versions/latest/index.html')
    ).toBeTruthy()
    expect(staleCaches).toContain(buildAppShellCacheName('2026-03-01T00:00:00.000Z'))
    expect(staleCaches).toContain('openspecui-app:v1.9:1.9.9')
  })

  it('detects deployment changes and reports claimed caches for the prepared manifest', () => {
    expect(hasHostedDeploymentUpdate(currentManifest, nextManifest, ['latest'])).toBe(true)
    expect(hasHostedDeploymentUpdate(currentManifest, currentManifest, ['latest'])).toBe(false)
    expect(buildClaimedHostedCacheNames(nextManifest, ['latest'])).toEqual([
      buildAppShellCacheName(nextManifest.generatedAt),
      buildChannelCacheName(nextManifest.channels.latest),
    ])
  })
})
