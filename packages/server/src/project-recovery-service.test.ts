import type { WatcherRuntimeStatus } from '@openspecui/core'
import { execFile } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProjectRecoveryService } from './project-recovery-service.js'

const execFileAsync = promisify(execFile)
const tempDirs: string[] = []

async function createTempProjectDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

async function runGit(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd,
    maxBuffer: 1024 * 1024,
    encoding: 'utf8',
  })
  return stdout.trim()
}

async function initGitRepo(dir: string): Promise<void> {
  await runGit(dir, ['init'])
  await runGit(dir, ['config', 'user.name', 'OpenSpecUI Test'])
  await runGit(dir, ['config', 'user.email', 'test@openspecui.local'])
  await writeFile(join(dir, 'README.md'), 'init\n', 'utf8')
  await runGit(dir, ['add', 'README.md'])
  await runGit(dir, ['commit', '-m', 'init'])
  await runGit(dir, ['branch', '-M', 'main'])
}

async function waitForCondition(
  predicate: () => boolean,
  options: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 5000
  const intervalMs = options.intervalMs ?? 50
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    if (predicate()) {
      return
    }
    await new Promise((resolvePromise) => {
      setTimeout(resolvePromise, intervalMs)
    })
  }

  throw new Error('Timed out waiting for condition.')
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

function createRuntimeStatus(
  rootPath: string,
  projectResidency: WatcherRuntimeStatus['roots'][number]['projectResidency']
): WatcherRuntimeStatus {
  return {
    initialized: true,
    rootCount: 1,
    subscriptionCount: 1,
    roots: [
      {
        rootPath,
        referenceCount: 1,
        initialized: true,
        subscriptionCount: 1,
        generation: 1,
        reinitializeCount: 0,
        lastReinitializeReason: null,
        reinitializeReasonCounts: {
          'drop-events': 0,
          'watcher-error': 0,
          'missing-project-dir': 0,
          'project-dir-replaced': 0,
          manual: 0,
        },
        projectResidency,
      },
    ],
  }
}

afterEach(async () => {
  vi.restoreAllMocks()
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (!dir) continue
    await rm(dir, { recursive: true, force: true })
  }
})

describe('ProjectRecoveryService', () => {
  it('resolves a surviving default-branch worktree after the current worktree is deleted', async () => {
    const baseRepoDir = await createTempProjectDir('openspecui-recovery-base-')
    const featureWorktreeDir = await createTempProjectDir('openspecui-recovery-feature-')
    await initGitRepo(baseRepoDir)
    await runGit(baseRepoDir, ['worktree', 'add', featureWorktreeDir, '-b', 'feature-recovery'])
    const watcherRootPath = realpathSync(featureWorktreeDir)

    let watcherRuntimeListener: ((status: WatcherRuntimeStatus | null) => void) | null = null
    const handoffProvider = {
      ensureWorktreeServer: vi.fn().mockResolvedValue({
        projectDir: baseRepoDir,
        serverUrl: 'http://127.0.0.1:3200',
      }),
    }

    const service = new ProjectRecoveryService({
      projectDir: featureWorktreeDir,
      gitWorktreeHandoff: handoffProvider,
      subscribeWatcherRuntime: (listener) => {
        watcherRuntimeListener = listener
        listener(createRuntimeStatus(watcherRootPath, { state: 'active' }))
        return () => {
          watcherRuntimeListener = null
        }
      },
    })

    await waitForCondition(
      () =>
        ((service as unknown as { cachedGitCommonDir: string | null }).cachedGitCommonDir ?? '') !==
        ''
    )
    await rm(featureWorktreeDir, { recursive: true, force: true })
    watcherRuntimeListener?.(
      createRuntimeStatus(watcherRootPath, {
        state: 'evicted',
        reason: 'missing-project-dir',
        detectedAt: 100,
      })
    )

    await waitForCondition(() => service.getCurrent().state === 'ready')

    expect(handoffProvider.ensureWorktreeServer).toHaveBeenCalledWith({
      targetPath: realpathSync(baseRepoDir),
    })
    expect(service.getCurrent()).toEqual({
      state: 'ready',
      reason: 'missing-project-dir',
      detectedAt: 100,
      handoff: {
        projectDir: baseRepoDir,
        serverUrl: 'http://127.0.0.1:3200',
      },
    })

    service.dispose()
  }, 10000)

  it('reports unavailable when no surviving default-branch worktree exists', async () => {
    const baseRepoDir = await createTempProjectDir('openspecui-recovery-base-')
    const remoteRepoDir = await createTempProjectDir('openspecui-recovery-remote-')
    const mainWorktreeDir = await createTempProjectDir('openspecui-recovery-main-')
    await initGitRepo(baseRepoDir)
    await runGit(remoteRepoDir, ['init', '--bare'])
    await runGit(baseRepoDir, ['remote', 'add', 'origin', remoteRepoDir])
    await runGit(baseRepoDir, ['push', '-u', 'origin', 'main'])
    await runGit(baseRepoDir, ['remote', 'set-head', 'origin', 'main'])
    await runGit(baseRepoDir, ['checkout', '-b', 'feature-host'])
    await runGit(baseRepoDir, ['worktree', 'add', mainWorktreeDir, 'main'])
    const watcherRootPath = realpathSync(mainWorktreeDir)

    let watcherRuntimeListener: ((status: WatcherRuntimeStatus | null) => void) | null = null
    const service = new ProjectRecoveryService({
      projectDir: mainWorktreeDir,
      gitWorktreeHandoff: {
        ensureWorktreeServer: vi.fn(),
      },
      subscribeWatcherRuntime: (listener) => {
        watcherRuntimeListener = listener
        listener(createRuntimeStatus(watcherRootPath, { state: 'active' }))
        return () => {
          watcherRuntimeListener = null
        }
      },
    })

    await waitForCondition(
      () =>
        ((service as unknown as { cachedGitCommonDir: string | null }).cachedGitCommonDir ?? '') !==
        ''
    )
    await rm(mainWorktreeDir, { recursive: true, force: true })
    expect(await pathExists(mainWorktreeDir)).toBe(false)
    watcherRuntimeListener?.(
      createRuntimeStatus(watcherRootPath, {
        state: 'evicted',
        reason: 'missing-project-dir',
        detectedAt: 200,
      })
    )

    await waitForCondition(() => service.getCurrent().state === 'unavailable')

    expect(service.getCurrent()).toEqual({
      state: 'unavailable',
      reason: 'missing-project-dir',
      detectedAt: 200,
      message:
        'No existing default-branch worktree is available for automatic recovery. Restore the worktree manually or reopen the repo from a surviving worktree.',
    })

    service.dispose()
  }, 10000)

  it('reports failed when the fallback handoff provider throws', async () => {
    const baseRepoDir = await createTempProjectDir('openspecui-recovery-base-')
    const featureWorktreeDir = await createTempProjectDir('openspecui-recovery-feature-')
    await initGitRepo(baseRepoDir)
    await runGit(baseRepoDir, ['worktree', 'add', featureWorktreeDir, '-b', 'feature-recovery'])
    const watcherRootPath = realpathSync(featureWorktreeDir)

    let watcherRuntimeListener: ((status: WatcherRuntimeStatus | null) => void) | null = null
    const service = new ProjectRecoveryService({
      projectDir: featureWorktreeDir,
      gitWorktreeHandoff: {
        ensureWorktreeServer: vi.fn().mockRejectedValue(new Error('spawn failed')),
      },
      subscribeWatcherRuntime: (listener) => {
        watcherRuntimeListener = listener
        listener(createRuntimeStatus(watcherRootPath, { state: 'active' }))
        return () => {
          watcherRuntimeListener = null
        }
      },
    })

    await waitForCondition(
      () =>
        ((service as unknown as { cachedGitCommonDir: string | null }).cachedGitCommonDir ?? '') !==
        ''
    )
    await rm(featureWorktreeDir, { recursive: true, force: true })
    watcherRuntimeListener?.(
      createRuntimeStatus(watcherRootPath, {
        state: 'evicted',
        reason: 'missing-project-dir',
        detectedAt: 300,
      })
    )

    await waitForCondition(() => service.getCurrent().state === 'failed')

    expect(service.getCurrent()).toEqual({
      state: 'failed',
      reason: 'missing-project-dir',
      detectedAt: 300,
      message: 'spawn failed',
    })

    service.dispose()
  }, 10000)
})
