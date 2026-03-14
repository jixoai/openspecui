import { describe, expect, it } from 'vitest'
import { buildChannelCacheName } from './hosted-app-caches'
import {
  buildVersionedNavigationShellMarker,
  buildVersionedNavigationShellUrl,
  hasHostedLaunchNavigationParams,
  hasVersionedNavigationShellMarker,
  isVersionedNavigationShellResponse,
  resolveChannelIdFromPathname,
  resolveVersionedNavigationShell,
} from './service-worker-routing'

const manifest = {
  packageName: 'openspecui' as const,
  generatedAt: '2026-03-08T00:00:00.000Z',
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
  compatibility: [],
}

describe('service worker routing helpers', () => {
  it('builds stable cache names and channel lookups', () => {
    expect(buildChannelCacheName(manifest.channels['v2.0'])).toBe('openspecui-app:v2.0:2.0.9')
    expect(resolveChannelIdFromPathname('/versions/v2.0/assets/index.js')).toBe('v2.0')
  })

  it('maps versioned SPA navigations back to the channel shell', () => {
    expect(
      resolveVersionedNavigationShell(
        manifest,
        new URL('https://app.openspecui.com/versions/v2.0/dashboard')
      )?.id
    ).toBe('v2.0')
    expect(
      resolveVersionedNavigationShell(
        manifest,
        new URL('https://app.openspecui.com/versions/v2.0/index.html?api=http://localhost:3100')
      )?.id
    ).toBe('v2.0')
    expect(
      resolveVersionedNavigationShell(
        manifest,
        new URL('https://app.openspecui.com/versions/v2.0/assets/index.js')
      )
    ).toBeNull()
  })

  it('normalizes versioned navigation fallback to the channel shell path', () => {
    expect(
      buildVersionedNavigationShellUrl(
        manifest.channels['v2.0'],
        new URL('https://app.openspecui.com/versions/v2.0/settings?api=http://localhost:3100')
      ).toString()
    ).toBe('https://app.openspecui.com/versions/v2.0/')
  })

  it('only accepts versioned shell responses that stay within the expected channel root', () => {
    const requestUrl = new URL('https://app.openspecui.com/versions/v2.0/')

    expect(
      isVersionedNavigationShellResponse(
        manifest.channels['v2.0'],
        requestUrl,
        'https://app.openspecui.com/versions/v2.0/',
        'text/html; charset=utf-8'
      )
    ).toBe(true)

    expect(
      isVersionedNavigationShellResponse(
        manifest.channels['v2.0'],
        requestUrl,
        'https://app.openspecui.com/index.html',
        'text/html; charset=utf-8'
      )
    ).toBe(false)
  })

  it('detects versioned shell HTML markers in rewritten channel documents', () => {
    const marker = buildVersionedNavigationShellMarker('v2.0')
    expect(marker).toBe("window.__OPENSPEC_BASE_PATH__ = '/versions/v2.0/'")
    expect(hasVersionedNavigationShellMarker('v2.0', `<script>${marker}</script>`)).toBe(true)
    expect(
      hasVersionedNavigationShellMarker(
        'v2.0',
        `<script>window.__OPENSPEC_BASE_PATH__ = '/'</script>`
      )
    ).toBe(false)
  })

  it('detects launch-driven navigation params separately from internal route state', () => {
    expect(
      hasHostedLaunchNavigationParams(
        new URL('https://app.openspecui.com/versions/v2.0/?api=http://localhost:3100&session=abc')
      )
    ).toBe(true)
    expect(
      hasHostedLaunchNavigationParams(
        new URL('https://app.openspecui.com/versions/v2.0/settings?_b=%2Fterminal')
      )
    ).toBe(false)
  })
})
