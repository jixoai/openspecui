/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Prove App build projection replaces the CLI runtime asset tree.
 * 2. Prove removed App artifacts cannot survive a later projection.
 *
 * Original request (2026-07-30): "app项目自身的构建本身就要有这个copy行为。"
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { projectAppBuildToCli } from './vite-plugin-hosted-app'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })))
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
