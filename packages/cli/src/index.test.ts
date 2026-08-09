/**
 * Orthogonal intents (updated 2026-08-04 Asia/Shanghai):
 * 1. Prove source and packaged runtimes resolve the same host-native Web asset candidates.
 *
 * Original request (2026-08-04): "Make pnpm openspecui start and equivalent package scripts work on Windows."
 */
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getWebAssetsDirCandidates } from './web-assets.js'

describe('getWebAssetsDirCandidates', () => {
  it('prefers web/dist in the monorepo and keeps cli/web as the packaged fallback', () => {
    const cliDir = join('/repo', 'packages', 'cli')
    const expected = [join(cliDir, '..', 'web', 'dist'), join(cliDir, 'web')]

    expect(getWebAssetsDirCandidates(join(cliDir, 'src'))).toEqual(expected)
    expect(getWebAssetsDirCandidates(join(cliDir, 'dist'))).toEqual(expected)
  })
})
