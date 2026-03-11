import { describe, expect, it } from 'vitest'
import { buildHostedAppLaunchUrl, resolveEffectiveHostedAppBaseUrl } from './hosted-app'

describe('hosted app CLI helpers', () => {
  it('resolves hosted app base URL from override, config, then official default', () => {
    expect(resolveEffectiveHostedAppBaseUrl({ override: 'app.example.com/ui' })).toBe(
      'https://app.example.com/ui'
    )
    expect(
      resolveEffectiveHostedAppBaseUrl({ configured: 'https://intranet.example.com/osui/' })
    ).toBe('https://intranet.example.com/osui')
    expect(resolveEffectiveHostedAppBaseUrl({})).toBe('https://app.openspecui.com')
  })

  it('builds hosted launch URLs with api parameters only', () => {
    expect(
      buildHostedAppLaunchUrl({
        baseUrl: 'https://app.openspecui.com',
        apiBaseUrl: 'http://localhost:13000',
      })
    ).toBe('https://app.openspecui.com/?api=http%3A%2F%2Flocalhost%3A13000')
  })
})
