/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Prove Dashboard Git computes full activity only for the current worktree and summary-only data elsewhere.
 * 2. Prove each live snapshot carries the backend-issued Code binding provenance.
 * 3. Prove detached and unavailable worktrees never start hidden detail commands.
 * 4. Prove the current activity window is five rows with conditional Uncommitted inclusion.
 *
 * Original request (2026-07-19): "代码已经提交，开始review。如果有问题，那么可更新change。"
 * Derived requirement (2026-07-19): Checkpoint 6.11 binds Dashboard snapshots to their Code token.
 * Original request (2026-07-31): "Code Git Snapshot 的 Other Worktrees 默认隐藏 (detached)。然后commitList这里默认显示5个就好"
 */
import { describe, expect, it, vi } from 'vitest'
import {
  buildDashboardGitSnapshot,
  removeDetachedDashboardGitWorktree,
} from './dashboard-git-snapshot.js'

describe('dashboard git snapshot helpers', () => {
  it('builds five current-worktree activity rows and summary-only other worktrees', async () => {
    const projectDir = '/repo/main'
    const featureDir = '/repo/feature-a'
    const readPathTimestampMs = vi.fn(async (absolutePath: string) => {
      if (absolutePath.endsWith('/spec.md')) return 1_710_100_000_000
      if (absolutePath.endsWith('/tasks.md')) return 1_710_200_000_000
      return null
    })

    const runGit = async (cwd: string, args: string[]) => {
      const cmd = args.join(' ')

      if (cwd === projectDir && cmd === 'symbolic-ref --quiet --short refs/remotes/origin/HEAD') {
        return { ok: true, stdout: 'origin/main\n' }
      }
      if (cwd === projectDir && cmd === 'worktree list --porcelain') {
        return {
          ok: true,
          stdout: [
            `worktree ${projectDir}`,
            'HEAD aaaaaaa',
            'branch refs/heads/main',
            '',
            `worktree ${featureDir}`,
            'HEAD bbbbbbb',
            'branch refs/heads/feature/a',
            '',
          ].join('\n'),
        }
      }

      if (cmd === 'rev-list --left-right --count origin/main...HEAD') {
        if (cwd === projectDir) return { ok: true, stdout: '0\t0\n' }
        if (cwd === featureDir) return { ok: true, stdout: '1\t3\n' }
      }

      if (cmd === 'diff --shortstat origin/main...HEAD') {
        if (cwd === projectDir) return { ok: true, stdout: '' }
        if (cwd === featureDir) {
          return { ok: true, stdout: ' 3 files changed, 10 insertions(+), 2 deletions(-)\n' }
        }
      }

      if (
        cwd === projectDir &&
        cmd === 'log --format=%x1e%H%x1f%ct%x1f%s --numstat --skip=0 -n6 origin/main..HEAD'
      ) {
        return {
          ok: true,
          stdout: Array.from({ length: 6 }, (_, index) =>
            [
              `\u001ecommit-${index + 1}\u001f${1_710_000_000 + index}\u001fCommit ${index + 1}`,
              '5\t1\topenspec/changes/dashboard-live-workflow-status/proposal.md',
            ].join('\n')
          ).join('\n'),
        }
      }

      if (cmd === 'diff --numstat HEAD') {
        if (cwd === projectDir) {
          return {
            ok: true,
            stdout:
              '3\t0\topenspec/changes/dashboard-live-workflow-status/specs/opsx-ui-views/spec.md\n',
          }
        }
      }

      if (cmd === 'diff --name-only HEAD') {
        if (cwd === projectDir) {
          return {
            ok: true,
            stdout: 'openspec/changes/dashboard-live-workflow-status/specs/opsx-ui-views/spec.md\n',
          }
        }
      }

      if (cmd === 'ls-files --others --exclude-standard') {
        if (cwd === projectDir) {
          return {
            ok: true,
            stdout: 'openspec/changes/dashboard-live-workflow-status/tasks.md\n',
          }
        }
      }

      return { ok: false, stdout: '' }
    }

    const snapshot = await buildDashboardGitSnapshot({
      projectDir,
      bindingToken: 'code-binding',
      runGit,
      readPathTimestampMs,
      pathAvailable: async () => true,
    })

    expect(snapshot.bindingToken).toBe('code-binding')
    expect(snapshot.defaultBranch).toBe('origin/main')
    expect(snapshot.worktrees).toHaveLength(2)
    expect(snapshot.worktrees[0]?.isCurrent).toBe(true)
    expect(snapshot.worktrees[0]?.branchName).toBe('main')
    expect(snapshot.worktrees[0]?.detached).toBe(false)

    const feature = snapshot.worktrees.find((worktree) => worktree.path === featureDir)
    expect(feature).toBeDefined()
    expect(feature?.ahead).toBe(3)
    expect(feature?.behind).toBe(1)
    expect(feature?.detached).toBe(false)
    expect(feature?.diff).toEqual({ files: 3, insertions: 10, deletions: 2 })
    expect(feature?.entries).toEqual([])

    const currentEntries = snapshot.worktrees[0]?.entries ?? []
    expect(currentEntries).toHaveLength(5)
    expect(currentEntries.filter((entry) => entry.type === 'commit')).toHaveLength(4)
    expect(currentEntries[0]).toMatchObject({
      type: 'uncommitted',
      updatedAt: 1_710_200_000_000,
    })

    const commitEntry = currentEntries.find((entry) => entry.type === 'commit')
    expect(commitEntry?.relatedChanges).toEqual(['dashboard-live-workflow-status'])
    expect(commitEntry?.committedAt).toBe(1_710_000_000_000)
    expect(commitEntry?.diff).toEqual({ files: 1, insertions: 5, deletions: 1 })

    const uncommittedEntry = currentEntries.find((entry) => entry.type === 'uncommitted')
    expect(uncommittedEntry?.relatedChanges).toEqual(['dashboard-live-workflow-status'])
    expect(uncommittedEntry?.diff).toEqual({ files: 2, insertions: 3, deletions: 0 })
    expect(readPathTimestampMs).toHaveBeenCalledTimes(2)
  })

  it('shows five commits and no Uncommitted row when the current worktree is clean', async () => {
    const projectDir = '/repo/main'
    const runGit = vi.fn(async (cwd: string, args: string[]) => {
      const command = args.join(' ')
      if (
        cwd === projectDir &&
        command === 'symbolic-ref --quiet --short refs/remotes/origin/HEAD'
      ) {
        return { ok: true, stdout: 'origin/main\n' }
      }
      if (cwd === projectDir && command === 'worktree list --porcelain') {
        return {
          ok: true,
          stdout: [`worktree ${projectDir}`, 'branch refs/heads/main', ''].join('\n'),
        }
      }
      if (command === 'rev-list --left-right --count origin/main...HEAD') {
        return { ok: true, stdout: '0\t5\n' }
      }
      if (command === 'diff --shortstat origin/main...HEAD') return { ok: true, stdout: '' }
      if (command === 'log --format=%x1e%H%x1f%ct%x1f%s --numstat --skip=0 -n6 origin/main..HEAD') {
        return {
          ok: true,
          stdout: Array.from(
            { length: 6 },
            (_, index) =>
              `\u001ecommit-${index + 1}\u001f${1_710_000_000 + index}\u001fCommit ${index + 1}`
          ).join('\n'),
        }
      }
      return { ok: true, stdout: '' }
    })

    const snapshot = await buildDashboardGitSnapshot({
      projectDir,
      bindingToken: 'code-binding',
      runGit,
      pathAvailable: async () => true,
    })

    const entries = snapshot.worktrees[0]?.entries ?? []
    expect(entries).toHaveLength(5)
    expect(entries.every((entry) => entry.type === 'commit')).toBe(true)
  })

  it('skips Git detail commands for detached and unavailable worktrees', async () => {
    const projectDir = '/repo/main'
    const detachedDir = '/repo/detached'
    const unavailableDir = '/repo/unavailable'
    const commands: Array<{ cwd: string; command: string }> = []
    const runGit = vi.fn(async (cwd: string, args: string[]) => {
      const command = args.join(' ')
      commands.push({ cwd, command })
      if (
        cwd === projectDir &&
        command === 'symbolic-ref --quiet --short refs/remotes/origin/HEAD'
      ) {
        return { ok: true, stdout: 'origin/main\n' }
      }
      if (cwd === projectDir && command === 'worktree list --porcelain') {
        return {
          ok: true,
          stdout: [
            `worktree ${projectDir}`,
            'branch refs/heads/main',
            '',
            `worktree ${detachedDir}`,
            'detached',
            '',
            `worktree ${unavailableDir}`,
            'branch refs/heads/feature/unavailable',
            '',
          ].join('\n'),
        }
      }
      if (cwd === projectDir) return { ok: true, stdout: '' }
      return { ok: false, stdout: '' }
    })

    const snapshot = await buildDashboardGitSnapshot({
      projectDir,
      bindingToken: 'code-binding',
      runGit,
      pathAvailable: async (path) => path !== unavailableDir,
    })

    expect(snapshot.worktrees.find((worktree) => worktree.path === detachedDir)?.entries).toEqual(
      []
    )
    expect(snapshot.worktrees.find((worktree) => worktree.path === unavailableDir)).toMatchObject({
      pathAvailable: false,
      entries: [],
    })
    expect(commands.filter(({ cwd }) => cwd === detachedDir)).toEqual([])
    expect(commands.filter(({ cwd }) => cwd === unavailableDir)).toEqual([])
  })

  it('omits empty Uncommitted and returns the five newest current commits', async () => {
    const projectDir = '/repo/main'
    const runGit = vi.fn(async (cwd: string, args: string[]) => {
      const command = args.join(' ')
      if (
        cwd === projectDir &&
        command === 'symbolic-ref --quiet --short refs/remotes/origin/HEAD'
      ) {
        return { ok: true, stdout: 'origin/main\n' }
      }
      if (cwd === projectDir && command === 'worktree list --porcelain') {
        return { ok: true, stdout: `worktree ${projectDir}\nbranch refs/heads/feature/current\n` }
      }
      if (command === 'log --format=%x1e%H%x1f%ct%x1f%s --numstat --skip=0 -n6 origin/main..HEAD') {
        return {
          ok: true,
          stdout: Array.from(
            { length: 6 },
            (_, index) =>
              `\u001ecommit-${index + 1}\u001f${1_710_000_000 + index}\u001fCommit ${index + 1}`
          ).join('\n'),
        }
      }
      return { ok: true, stdout: '' }
    })

    const snapshot = await buildDashboardGitSnapshot({
      projectDir,
      bindingToken: 'code-binding',
      runGit,
      pathAvailable: async () => true,
    })

    const entries = snapshot.worktrees[0]?.entries ?? []
    expect(entries).toHaveLength(5)
    expect(entries.every((entry) => entry.type === 'commit')).toBe(true)
    expect(entries.map((entry) => entry.title)).toEqual([
      'Commit 1',
      'Commit 2',
      'Commit 3',
      'Commit 4',
      'Commit 5',
    ])
  })

  it('removes detached worktrees with a forced git worktree remove command', async () => {
    const runGit = vi.fn(async (_cwd: string, args: string[]) => {
      const cmd = args.join(' ')
      if (cmd === 'worktree list --porcelain') {
        return {
          ok: true,
          stdout: [
            'worktree /repo/main',
            'branch refs/heads/main',
            '',
            'worktree /tmp/detached',
            'detached',
            '',
          ].join('\n'),
        }
      }
      if (cmd === 'worktree remove --force /tmp/detached') {
        return { ok: true, stdout: '' }
      }
      return { ok: false, stdout: '' }
    })

    await removeDetachedDashboardGitWorktree({
      projectDir: '/repo/main',
      targetPath: '/tmp/detached',
      runGit,
    })

    expect(runGit).toHaveBeenCalledWith('/repo/main', ['worktree', 'list', '--porcelain'])
    expect(runGit).toHaveBeenCalledWith('/repo/main', [
      'worktree',
      'remove',
      '--force',
      '/tmp/detached',
    ])
  })

  it('rejects non-detached or current worktrees for dashboard removal', async () => {
    const nonDetachedRunGit = vi.fn(async () => ({
      ok: true,
      stdout: [
        'worktree /repo/main',
        'branch refs/heads/main',
        '',
        'worktree /repo/feature',
        'branch refs/heads/feature',
        '',
      ].join('\n'),
    }))

    await expect(
      removeDetachedDashboardGitWorktree({
        projectDir: '/repo/main',
        targetPath: '/repo/main',
        runGit: nonDetachedRunGit,
      })
    ).rejects.toThrow(/Cannot remove the current worktree/)

    await expect(
      removeDetachedDashboardGitWorktree({
        projectDir: '/repo/main',
        targetPath: '/repo/feature',
        runGit: nonDetachedRunGit,
      })
    ).rejects.toThrow(/Only detached worktrees can be removed/)
  })
})
