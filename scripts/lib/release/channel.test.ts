/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Prove stable and prerelease channel derivation.
 * 2. Prove unsafe or malformed versions fail closed.
 * 3. Prove canonical package tag construction.
 *
 * Original request (2026-07-28): "我想先发布一个beta版本"
 */

import { describe, expect, it } from 'vitest'

import { getPackageReleaseTag, resolveReleaseChannel } from './channel'

describe('release channel', () => {
  it('keeps stable versions on latest', () => {
    expect(resolveReleaseChannel('6.0.0')).toEqual({ distTag: 'latest', prerelease: false })
  })

  it.each([
    ['6.0.0-beta.0', 'beta'],
    ['6.0.0-rc.2+build.7', 'rc'],
  ])('routes %s through the %s prerelease channel', (version, distTag) => {
    expect(resolveReleaseChannel(version)).toEqual({ distTag, prerelease: true })
  })

  it.each(['6.0', '6.0.0-01', '6.0.0-latest.0', '6.0.0-0.beta'])(
    'rejects an unsafe release version %s',
    (version) => {
      expect(() => resolveReleaseChannel(version)).toThrow()
    }
  )

  it('builds the Changesets package tag from validated version truth', () => {
    expect(getPackageReleaseTag('openspecui', '6.0.0-beta.0')).toBe('openspecui@6.0.0-beta.0')
  })
})
