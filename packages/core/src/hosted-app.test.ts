/**
 * Orthogonal intents (created 2026-07-25 Asia/Shanghai):
 * 1. Verify normalized hosted App and embedded Project Web launch URLs.
 * 2. Verify hosted-shell protocol capability and backend-health contracts.
 *
 * Original request (2026-07-15): "把 --app 模式提上日程。因为 app 模式提供了多标签管理。"
 */
import { describe, expect, it } from 'vitest'
import {
  HOSTED_SHELL_PROTOCOL_VERSION,
  OPENSPECUI_RUNTIME_CAPABILITIES,
  buildBackendHealthPayload,
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

  it('inherits the App theme via the theme query param when provided', () => {
    expect(
      buildEmbeddedUiLaunchUrl({
        embeddedUiUrl: 'http://localhost:3100/dashboard',
        apiBaseUrl: 'http://localhost:3200',
        sessionId: 'session-a',
        theme: 'dark',
      })
    ).toBe(
      'http://localhost:3100/dashboard?api=http%3A%2F%2Flocalhost%3A3200&session=session-a&theme=dark'
    )
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
        runtimeCapabilities: OPENSPECUI_RUNTIME_CAPABILITIES,
      })
    ).toBe(true)
  })

  it('rejects health payloads that omit required runtime capabilities', () => {
    expect(
      isHostedBackendHealthResponse({
        status: 'ok',
        projectDir: '/tmp/demo',
        projectName: 'demo',
        watcherEnabled: true,
        openspecuiVersion: '2.0.2',
        hostedShellProtocolVersion: HOSTED_SHELL_PROTOCOL_VERSION,
        embeddedUiUrl: 'http://localhost:3100',
        runtimeCapabilities: OPENSPECUI_RUNTIME_CAPABILITIES.filter(
          (capability) => capability !== 'notifications.subscribe'
        ),
      })
    ).toBe(false)
  })

  it('builds backend health payloads from the shared runtime contract', () => {
    expect(
      buildBackendHealthPayload({
        projectDir: '/tmp/demo',
        projectName: 'demo',
        watcherEnabled: true,
        openspecuiVersion: '3.7.0',
        embeddedUiUrl: 'http://localhost:3100',
        apiBaseUrl: 'http://localhost:3100',
        cliVersion: '1.6.0',
        envUri: 'openspecui-env://1/abc',
        rootSummary: {
          planningRootPath: 'demo',
          rootSource: 'nearest',
          storeId: null,
          ready: true,
        },
        accessGateEnabled: true,
      })
    ).toEqual({
      status: 'ok',
      projectDir: '/tmp/demo',
      projectName: 'demo',
      watcherEnabled: true,
      openspecuiVersion: '3.7.0',
      hostedShellProtocolVersion: HOSTED_SHELL_PROTOCOL_VERSION,
      embeddedUiUrl: 'http://localhost:3100',
      runtimeCapabilities: OPENSPECUI_RUNTIME_CAPABILITIES,
      apiBaseUrl: 'http://localhost:3100',
      cliVersion: '1.6.0',
      envUri: 'openspecui-env://1/abc',
      rootSummary: {
        planningRootPath: 'demo',
        rootSource: 'nearest',
        storeId: null,
        ready: true,
      },
      hostedCapabilities: ['stores.inspect', 'stores.mutate', 'contexts.inspect'],
      accessGateEnabled: true,
    })
  })

  it('emits the 1.6 hosted-protocol additions even when omitted from input', () => {
    const payload = buildBackendHealthPayload({
      projectDir: '/tmp/demo',
      projectName: 'demo',
      watcherEnabled: true,
      openspecuiVersion: '3.7.0',
      embeddedUiUrl: 'http://localhost:3100',
    })
    expect(payload.hostedCapabilities).toEqual([
      'stores.inspect',
      'stores.mutate',
      'contexts.inspect',
    ])
    expect(payload.accessGateEnabled).toBeUndefined()
    expect(payload.envUri).toBeUndefined()
  })
})
