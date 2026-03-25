import { describe, expect, it, vi } from 'vitest'
import {
  buildDashboardGitSnapshot,
  removeDetachedDashboardGitWorktree,
} from './dashboard-git-snapshot.js'

describe('dashboard git snapshot helpers', () => {
  it('builds worktree + commit/uncommitted tree with related openspec changes', async () => {
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
        cmd === 'log --format=%x1e%H%x1f%ct%x1f%s --numstat --skip=0 -n9 origin/main..HEAD'
      ) {
        return { ok: true, stdout: '' }
      }
      if (
        cwd === featureDir &&
        cmd === 'log --format=%x1e%H%x1f%ct%x1f%s --numstat --skip=0 -n9 origin/main..HEAD'
      ) {
        return {
          ok: true,
          stdout: [
            '\u001eabc123\u001f1710000000\u001ffeat: wire dashboard',
            '5\t1\topenspec/changes/dashboard-live-workflow-status/proposal.md',
          ].join('\n'),
        }
      }

      if (cmd === 'diff --numstat HEAD') {
        if (cwd === projectDir) return { ok: true, stdout: '' }
        if (cwd === featureDir) {
          return {
            ok: true,
            stdout:
              '3\t0\topenspec/changes/dashboard-live-workflow-status/specs/opsx-ui-views/spec.md\n',
          }
        }
      }

      if (cmd === 'diff --name-only HEAD') {
        if (cwd === projectDir) return { ok: true, stdout: '' }
        if (cwd === featureDir) {
          return {
            ok: true,
            stdout: 'openspec/changes/dashboard-live-workflow-status/specs/opsx-ui-views/spec.md\n',
          }
        }
      }

      if (cmd === 'ls-files --others --exclude-standard') {
        if (cwd === projectDir) return { ok: true, stdout: '' }
        if (cwd === featureDir) {
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
      runGit,
      maxCommitEntries: 8,
      readPathTimestampMs,
    })

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

    expect(feature?.entries[0]).toMatchObject({
      type: 'uncommitted',
      updatedAt: 1_710_200_000_000,
    })

    const commitEntry = feature?.entries.find((entry) => entry.type === 'commit')
    expect(commitEntry?.relatedChanges).toEqual(['dashboard-live-workflow-status'])
    expect(commitEntry?.committedAt).toBe(1_710_000_000_000)
    expect(commitEntry?.diff).toEqual({ files: 1, insertions: 5, deletions: 1 })

    const uncommittedEntry = feature?.entries.find((entry) => entry.type === 'uncommitted')
    expect(uncommittedEntry?.relatedChanges).toEqual(['dashboard-live-workflow-status'])
    expect(uncommittedEntry?.diff).toEqual({ files: 2, insertions: 3, deletions: 0 })
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
