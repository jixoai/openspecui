/**
 * Orthogonal intents (updated 2026-08-05 Asia/Shanghai):
 * 1. Preserve realpath prefixes through existing symlinked ancestors.
 * 2. Exercise directory-link setup on Windows without requiring file-symlink privileges.
 *
 * Original request (2026-08-05): Continue the Windows adaptation and fix equivalent failures together.
 */
import { mkdtemp, realpath, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanupTempDir } from '../__tests__/test-utils.js'
import { resolveRealPathThroughExistingAncestor } from './path-realpath.js'

describe('resolveRealPathThroughExistingAncestor', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'openspecui-realpath-'))
  })

  afterEach(async () => {
    await cleanupTempDir(tempDir)
  })

  it('keeps the realpath prefix for missing descendants under a symlinked ancestor', async () => {
    const targetRoot = await mkdtemp(join(tempDir, 'target-'))
    const symlinkRoot = join(tempDir, 'link')
    await symlink(targetRoot, symlinkRoot, process.platform === 'win32' ? 'junction' : 'dir')

    const resolved = resolveRealPathThroughExistingAncestor(
      join(symlinkRoot, 'missing', 'child.txt')
    )

    await expect(realpath(targetRoot)).resolves.toBe(dirname(dirname(resolved)))
    expect(resolved).toBe(join(targetRoot, 'missing', 'child.txt'))
  })
})
