/**
 * Orthogonal intents (created 2026-08-09 Asia/Shanghai):
 * 1. Prove atomic directory projection replaces stale assets and removes transaction residue.
 * 2. Prove a transient Windows file handle delays rather than aborts the bounded directory swap.
 *
 * Original request (2026-08-09): "Continue the Windows adaptation and handle similar issues together."
 */
import { mkdir, mkdtemp, open, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { afterEach, describe, expect, it } from 'vitest'
import { projectDirectoryAtomically } from './atomic-directory-projection.js'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((path) => rm(path, { force: true, recursive: true, maxRetries: 20 }))
  )
})

async function createProjectionFixture(): Promise<{
  root: string
  sourceDir: string
  targetDir: string
}> {
  const root = await mkdtemp(join(tmpdir(), 'openspecui-directory-projection-'))
  tempDirs.push(root)
  const sourceDir = join(root, 'source')
  const targetDir = join(root, 'target')
  await Promise.all([mkdir(sourceDir), mkdir(targetDir)])
  await writeFile(join(sourceDir, 'index.html'), 'current')
  await writeFile(join(targetDir, 'index.html'), 'stale')
  await writeFile(join(targetDir, 'stale.js'), 'stale')
  return { root, sourceDir, targetDir }
}

async function expectNoProjectionResidue(root: string): Promise<void> {
  const entries = await readdir(root)
  expect(entries.filter((entry) => /\.(?:next|previous)-/.test(entry))).toEqual([])
}

describe('atomic directory projection', () => {
  it('replaces the target snapshot and removes transaction-owned directories', async () => {
    const { root, sourceDir, targetDir } = await createProjectionFixture()

    await projectDirectoryAtomically(sourceDir, targetDir)

    await expect(readFile(join(targetDir, 'index.html'), 'utf8')).resolves.toBe('current')
    await expect(readFile(join(targetDir, 'stale.js'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    })
    await expectNoProjectionResidue(root)
  })

  it.runIf(process.platform === 'win32')(
    'settles after a transient open-file directory lock is released',
    async () => {
      const { root, sourceDir, targetDir } = await createProjectionFixture()
      const handle = await open(join(targetDir, 'index.html'), 'r')
      let settled = false
      const projection = projectDirectoryAtomically(sourceDir, targetDir).finally(() => {
        settled = true
      })

      await delay(75)
      expect(settled).toBe(false)
      await handle.close()
      await projection

      await expect(readFile(join(targetDir, 'index.html'), 'utf8')).resolves.toBe('current')
      await expectNoProjectionResidue(root)
    }
  )
})
