/**
 * Orthogonal intents (updated 2026-07-29 Asia/Shanghai):
 * 1. Prove credential-free public hosted URLs for the manually addressable App shell.
 * 2. Characterize private Direct/App URL builders independently of removed CLI shell selection.
 *
 * Original request (2026-07-15): "把 --app 模式提上日程。"
 * Delivery correction (2026-07-24): printed locators must not become another credential log.
 */
import { describe, expect, it } from 'vitest'
import { buildDirectWebLaunchUrl, buildHostedAppLaunchUrl } from './hosted-app'

describe('hosted app CLI helpers', () => {
  it('builds hosted launch URLs with api parameters only', () => {
    expect(
      buildHostedAppLaunchUrl({
        baseUrl: 'https://app.openspecui.com',
        apiBaseUrl: 'http://localhost:13000',
      })
    ).toBe('https://app.openspecui.com/?api=http%3A%2F%2Flocalhost%3A13000')
  })

  it('keeps credentials out of public URLs and carries them only in private fragments', () => {
    const publicUrl = buildHostedAppLaunchUrl({
      baseUrl: 'https://app.openspecui.com',
      apiBaseUrl: 'http://localhost:13000',
    })
    const privateUrl = buildHostedAppLaunchUrl({
      baseUrl: 'https://app.openspecui.com',
      apiBaseUrl: 'http://localhost:13000',
      credential: 'browser-secret',
    })
    const directUrl = buildDirectWebLaunchUrl({
      baseUrl: 'http://localhost:13000',
      credential: 'browser-secret',
    })

    expect(publicUrl).not.toContain('browser-secret')
    expect(new URLSearchParams(new URL(privateUrl).hash.slice(1)).get('credential')).toBe(
      'browser-secret'
    )
    expect(new URLSearchParams(new URL(directUrl).hash.slice(1)).get('credential')).toBe(
      'browser-secret'
    )
    expect(new URL(privateUrl).searchParams.has('credential')).toBe(false)
  })
})
