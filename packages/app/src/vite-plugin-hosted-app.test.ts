/**
 * Orthogonal intents (updated 2026-08-06 Asia/Shanghai):
 * 1. Prove App build projection replaces the CLI runtime asset tree.
 * 2. Prove removed App artifacts cannot survive a later projection.
 * 3. Remove projection fixtures after transient Windows locks settle.
 *
 * Original request (2026-07-30): "app项目自身的构建本身就要有这个copy行为。"
 * Original request (2026-08-06): "Windows compatibility and adaptation, including the core and peripheral scripts."
 */
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { removeAppTestDirectories } from './test-directory-cleanup'
import { projectAppBuildToCli } from './vite-plugin-hosted-app'

const tempDirs: string[] = []

afterEach(async () => {
  await removeAppTestDirectories(tempDirs.splice(0))
})

describe('CLI App build projection', () => {
  it('replaces the complete CLI asset tree with the current App build', async () => {
    const root = await mkdtemp(join(tmpdir(), 'openspecui-app-projection-'))
    tempDirs.push(root)
    const sourceDir = join(root, 'app-dist')
    const targetDir = join(root, 'cli-app')
    await mkdir(join(sourceDir, 'assets'), { recursive: true })
    await mkdir(join(targetDir, 'assets'), { recursive: true })
    await writeFile(join(sourceDir, 'index.html'), '<main>current</main>')
    await writeFile(join(sourceDir, 'assets', 'current.js'), 'current')
    await writeFile(join(targetDir, 'assets', 'stale.js'), 'stale')

    await projectAppBuildToCli(sourceDir, targetDir)

    await expect(readFile(join(targetDir, 'index.html'), 'utf8')).resolves.toBe(
      '<main>current</main>'
    )
    await expect(readFile(join(targetDir, 'assets', 'current.js'), 'utf8')).resolves.toBe('current')
    await expect(readFile(join(targetDir, 'assets', 'stale.js'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    })
  })
})
