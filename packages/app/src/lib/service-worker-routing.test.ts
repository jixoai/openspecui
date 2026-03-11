import { describe, expect, it } from 'vitest'
import {
  buildChannelCacheName,
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
      shellPath: '/versions/latest/index.html',
      major: 2,
    },
    'v2.0': {
      id: 'v2.0',
      kind: 'minor' as const,
      selector: '~2.0.0',
      resolvedVersion: '2.0.9',
      rootPath: '/versions/v2.0/',
      shellPath: '/versions/v2.0/index.html',
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
        new URL('https://app.openspecui.com/versions/v2.0/assets/index.js')
      )
    ).toBeNull()
  })
})
