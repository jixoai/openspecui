/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Prove daemon App assets resolve only through the CLI-owned projection.
 * 2. Reject an unprojected workspace App build as runtime authority.
 *
 * Original request (2026-07-30): "app项目自身的构建本身就要有这个copy行为。"
 */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { getAppAssetsDir, resolveAppAssetsDir } from './app-assets'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })))
})

describe('App assets', () => {
  it('uses only the App build projected into the CLI package', async () => {
    const root = await mkdtemp(join(tmpdir(), 'openspecui-cli-app-assets-'))
    tempDirs.push(root)
    const runtimeDir = join(root, 'packages', 'cli', 'src')
    const projectedDir = getAppAssetsDir(runtimeDir)
    await mkdir(projectedDir, { recursive: true })
    await writeFile(join(projectedDir, 'index.html'), '<main>projected</main>')

    await expect(resolveAppAssetsDir(runtimeDir)).resolves.toBe(projectedDir)
  })

  it('rejects a workspace dist that was not projected into the CLI package', async () => {
    const root = await mkdtemp(join(tmpdir(), 'openspecui-cli-app-assets-'))
    tempDirs.push(root)
    const runtimeDir = join(root, 'packages', 'cli', 'src')
    const workspaceDist = join(root, 'packages', 'app', 'dist')
    await mkdir(workspaceDist, { recursive: true })
    await writeFile(join(workspaceDist, 'index.html'), '<main>unprojected</main>')

    await expect(resolveAppAssetsDir(runtimeDir)).rejects.toThrow(
      'Bundled OpenSpecUI App assets are missing.'
    )
  })
})
