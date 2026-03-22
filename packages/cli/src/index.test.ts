import { describe, expect, it } from 'vitest'
import { getWebAssetsDirCandidates } from './web-assets.js'

describe('getWebAssetsDirCandidates', () => {
  it('prefers web/dist in the monorepo and keeps cli/web as the packaged fallback', () => {
    expect(getWebAssetsDirCandidates('/repo/packages/cli/src')).toEqual([
      '/repo/packages/web/dist',
      '/repo/packages/cli/web',
    ])

    expect(getWebAssetsDirCandidates('/repo/packages/cli/dist')).toEqual([
      '/repo/packages/web/dist',
      '/repo/packages/cli/web',
    ])
  })
})
