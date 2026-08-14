/**
 * Orthogonal intents (created 2026-07-25 Asia/Shanghai):
 * 1. Prove the Server-owned Dashboard Git refresh stamp settles an already-cached reactive input.
 * 2. Preserve real Git metadata directory resolution, including the physical/reactive writer boundary.
 * 3. Hide fixture subprocess console windows (`windowsHide`) for uniform hidden-console execution on Windows.
 *
 * Original request (2026-08-14): "在Windows平台上，执行命令总是会弹出cmd窗口，这个可否统一隐藏，你先调查一下原因"
 * Original request (2026-07-24): "可以归档旧change了，然后我们继续新的change 的开发推进"
 * Derived requirement (2026-07-25): P4.3 requires a cached reactive stamp to be current before refresh returns.
 */
import { clearCache, closeAllWatchers, reactiveReadFile } from '@openspecui/core'
import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
import { touchDashboardGitRefreshStamp } from './dashboard-git-projection.js'

const execFileAsync = promisify(execFile)
const tempDirs: string[] = []
const DASHBOARD_GIT_REFRESH_STAMP_NAME = 'openspecui-dashboard-git-refresh.stamp'

async function createTempGitRepository(): Promise<string> {
  const projectDir = await mkdtemp(join(tmpdir(), 'openspecui-dashboard-git-refresh-'))
  tempDirs.push(projectDir)
  await runGit(projectDir, ['init'])
  await runGit(projectDir, ['config', 'user.name', 'OpenSpecUI Test'])
  await runGit(projectDir, ['config', 'user.email', 'test@openspecui.local'])
  await writeFile(join(projectDir, 'README.md'), 'init\n', 'utf8')
  await runGit(projectDir, ['add', 'README.md'])
  await runGit(projectDir, ['commit', '-m', 'init'])
  return projectDir
}

async function runGit(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd,
    maxBuffer: 1024 * 1024,
    encoding: 'utf8',
    windowsHide: true,
  })
  return stdout.trim()
}

afterEach(async () => {
  clearCache()
  await closeAllWatchers()
  await Promise.all(tempDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

describe('touchDashboardGitRefreshStamp', () => {
  it('settles an already-cached Git metadata stamp before reporting refresh success', async () => {
    const projectDir = await createTempGitRepository()
    const gitMetadataDir = resolve(projectDir, await runGit(projectDir, ['rev-parse', '--git-dir']))
    const stampPath = join(gitMetadataDir, DASHBOARD_GIT_REFRESH_STAMP_NAME)

    // Do not acquire a watcher root: this proves the write owner, rather than a later watcher tick, settles it.
    expect(await reactiveReadFile(stampPath)).toBeNull()

    await expect(
      touchDashboardGitRefreshStamp(projectDir, 'settlement-fixed-point')
    ).resolves.toEqual({
      skipped: false,
    })

    const observedStamp = await reactiveReadFile(stampPath)
    expect(observedStamp).toEqual(expect.stringMatching(/^\d+ settlement-fixed-point\n$/))
  })
})
