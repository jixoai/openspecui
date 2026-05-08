import { describe, expect, it } from 'vitest'
import {
  HOSTED_SHELL_PROTOCOL_VERSION,
  buildEmbeddedUiLaunchUrl,
  buildHostedLaunchUrl,
  isHostedBackendHealthResponse,
  isSupportedEmbeddedUiUrl,
  normalizeEmbeddedUiUrl,
  normalizeHostedAppBaseUrl,
  resolveHostedAppBaseUrl,
} from './hosted-app.js'

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

  it('builds launch URLs from normalized base URLs', () => {
    expect(
      buildHostedLaunchUrl({
        baseUrl: 'https://app.example.com/ui/',
        apiBaseUrl: 'http://localhost:13000',
      })
    ).toBe('https://app.example.com/ui?api=http%3A%2F%2Flocalhost%3A13000')
  })

  it('normalizes and validates embedded UI URLs', () => {
    expect(normalizeEmbeddedUiUrl('http://localhost:3100/dashboard/')).toBe(
      'http://localhost:3100/dashboard'
    )
    expect(isSupportedEmbeddedUiUrl('https://app.example.com/dashboard')).toBe(true)
    expect(isSupportedEmbeddedUiUrl('http://127.0.0.1:3100')).toBe(true)
    expect(isSupportedEmbeddedUiUrl('http://dev.localhost:3100')).toBe(true)
    expect(isSupportedEmbeddedUiUrl('http://intranet.example.com')).toBe(false)
  })

  it('builds embedded UI launch URLs from backend metadata', () => {
    expect(
      buildEmbeddedUiLaunchUrl({
        embeddedUiUrl: 'http://localhost:3100/dashboard',
        apiBaseUrl: 'http://localhost:3200',
        sessionId: 'session-a',
      })
    ).toBe('http://localhost:3100/dashboard?api=http%3A%2F%2Flocalhost%3A3200&session=session-a')
  })

  it('validates backend health payloads', () => {
    expect(
      isHostedBackendHealthResponse({
        status: 'ok',
        projectDir: '/tmp/demo',
        projectName: 'demo',
        watcherEnabled: true,
        openspecuiVersion: '2.0.2',
        hostedShellProtocolVersion: HOSTED_SHELL_PROTOCOL_VERSION,
        embeddedUiUrl: 'http://localhost:3100',
      })
    ).toBe(true)
  })
})
