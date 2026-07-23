/**
 * Orthogonal intents (updated 2026-07-24 Asia/Shanghai):
 * 1. Prove launch credentials bind only to their normalized backend locator in runtime memory.
 * 2. Prove launch parsing binds credentials before visible URL stripping.
 * 3. Reject credential fragments without a valid launch locator using actionable evidence.
 *
 * Original request (2026-07-15): "我们可以在 cli 上新增一个 --auth 或者 --password。"
 * Delivery correction (2026-07-24): credentials are per-locator and never a global session slot.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { consumeHostedLaunchUrl } from './bootstrap'
import {
  clearLaunchCredential,
  consumeLaunchCredential,
  readLaunchCredential,
} from './launch-credential'

const API_A = 'http://localhost:3100'
const API_B = 'http://localhost:3200'

afterEach(() => {
  clearLaunchCredential(API_A)
  clearLaunchCredential(API_B)
})

describe('locator-scoped launch credential registry', () => {
  it('keeps two backend credentials isolated by normalized locator', () => {
    consumeLaunchCredential({
      apiBaseUrl: `${API_A}/`,
      hash: '#credential=credential-a',
    })
    consumeLaunchCredential({
      apiBaseUrl: API_B,
      hash: '#credential=credential-b',
    })

    expect(readLaunchCredential(API_A)).toBe('credential-a')
    expect(readLaunchCredential(`${API_B}/`)).toBe('credential-b')
  })

  it('preserves unrelated fragment state without exposing the consumed credential', () => {
    const result = consumeLaunchCredential({
      apiBaseUrl: API_A,
      hash: '#credential=bearer-secret&session=abc',
    })

    expect(result).toEqual({
      status: 'bound',
      apiBaseUrl: API_A,
      sanitizedHash: '#session=abc',
    })
    expect(readLaunchCredential(API_A)).toBe('bearer-secret')
    expect(JSON.stringify(result)).not.toContain('bearer-secret')
  })

  it('returns an actionable configuration error when a fragment has no launch locator', () => {
    const result = consumeLaunchCredential({
      apiBaseUrl: null,
      hash: '#credential=orphan-secret&session=abc',
    })

    expect(result.status).toBe('configuration-error')
    if (result.status !== 'configuration-error') return
    expect(result.error).toContain('?api=')
    expect(result.sanitizedHash).toBe('#session=abc')
    expect(readLaunchCredential(API_A)).toBeNull()
    expect(JSON.stringify(result)).not.toContain('orphan-secret')
  })
})

describe('hosted launch URL credential boundary', () => {
  it('binds the normalized locator before stripping launch query and credential fragment', () => {
    const replaceState = vi.fn<(url: string) => void>()

    const launch = consumeHostedLaunchUrl(
      'https://app.openspecui.com/?version=v2.1&api=http%3A%2F%2Flocalhost%3A3100%2F#credential=secret-a&session=abc',
      replaceState
    )

    expect(launch.request).toEqual({ apiBaseUrl: API_A })
    expect(launch.error).toBeNull()
    expect(readLaunchCredential(API_A)).toBe('secret-a')
    expect(replaceState).toHaveBeenCalledWith('/#session=abc')
    expect(replaceState.mock.calls.flat().join('')).not.toContain('secret-a')
  })

  it('strips an orphan credential while surfacing its configuration error', () => {
    const replaceState = vi.fn<(url: string) => void>()

    const launch = consumeHostedLaunchUrl(
      'https://app.openspecui.com/sessions#credential=orphan-secret',
      replaceState
    )

    expect(launch.request).toBeNull()
    expect(launch.error).toContain('?api=')
    expect(replaceState).toHaveBeenCalledWith('/sessions')
    expect(replaceState.mock.calls.flat().join('')).not.toContain('orphan-secret')
  })
})
