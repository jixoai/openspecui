import { describe, expect, it } from 'vitest'
import {
  buildHostedLaunchUrl,
  buildHostedVersionManifestUrl,
  isHostedAppVersionManifest,
  isHostedBackendHealthResponse,
  normalizeHostedAppBaseUrl,
  resolveHostedAppBaseUrl,
  resolveHostedChannelForVersion,
} from './hosted-app.js'

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
    'v2.0': {
      id: 'v2.0',
      kind: 'minor' as const,
      selector: '~2.0',
      resolvedVersion: '2.0.9',
      rootPath: '/versions/v2.0/',
      shellPath: '/versions/v2.0/index.html',
      major: 2,
      minor: 0,
    },
  },
  compatibility: [{ range: '~2.0.0', channel: 'v2.0' }],
}

describe('hosted-app helpers', () => {
  it('normalizes hosted app base URLs', () => {
    expect(normalizeHostedAppBaseUrl('app.example.com/ui/')).toBe('https://app.example.com/ui')
    expect(normalizeHostedAppBaseUrl('https://app.example.com')).toBe('https://app.example.com')
  })

  it('resolves override, config, and default base URLs', () => {
    expect(resolveHostedAppBaseUrl({ override: 'app.example.com' })).toBe('https://app.example.com')
    expect(resolveHostedAppBaseUrl({ configured: 'https://intranet.example.com/osui/' })).toBe(
      'https://intranet.example.com/osui'
    )
    expect(resolveHostedAppBaseUrl({})).toBe('https://app.openspecui.com')
  })

  it('builds manifest and launch URLs from normalized base URLs', () => {
    expect(buildHostedVersionManifestUrl('https://app.example.com/ui/')).toBe(
      'https://app.example.com/ui/version.json'
    )
    expect(
      buildHostedLaunchUrl({
        baseUrl: 'https://app.example.com/ui/',
        apiBaseUrl: 'http://localhost:13000',
      })
    ).toBe('https://app.example.com/ui?api=http%3A%2F%2Flocalhost%3A13000')
  })

  it('validates hosted app manifests and backend health payloads', () => {
    expect(isHostedAppVersionManifest(manifest)).toBe(true)
    expect(
      isHostedBackendHealthResponse({
        status: 'ok',
        projectDir: '/tmp/demo',
        projectName: 'demo',
        watcherEnabled: true,
        openspecuiVersion: '2.0.2',
      })
    ).toBe(true)
  })

  it('resolves the compatible channel from backend version metadata', () => {
    expect(resolveHostedChannelForVersion(manifest, '2.0.4')).toBe('v2.0')
    expect(resolveHostedChannelForVersion(manifest, '2.1.3')).toBe('latest')
    expect(resolveHostedChannelForVersion(manifest, 'invalid')).toBeNull()
  })
})
