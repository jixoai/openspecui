import { describe, expect, it } from 'vitest'
import { getWebAssetsDirCandidates } from './index.js'

describe('getWebAssetsDirCandidates', () => {
  it('prefers packaged cli/web and keeps web/dist as the development fallback', () => {
    expect(getWebAssetsDirCandidates('/repo/packages/cli/src')).toEqual([
      '/repo/packages/cli/web',
      '/repo/packages/web/dist',
    ])

    expect(getWebAssetsDirCandidates('/repo/packages/cli/dist')).toEqual([
      '/repo/packages/cli/web',
      '/repo/packages/web/dist',
    ])
  })
})
