import { describe, expect, it } from 'vitest'
import { buildDashboardGitSnapshot } from './dashboard-git-snapshot.js'

describe('buildDashboardGitSnapshot', () => {
  it('builds worktree + commit/uncommitted tree with related openspec changes', async () => {
    const projectDir = '/repo/main'
    const featureDir = '/repo/feature-a'

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

      if (cwd === projectDir && cmd === 'log --format=%H%x1f%s -n8 origin/main..HEAD') {
        return { ok: true, stdout: '' }
      }
      if (cwd === featureDir && cmd === 'log --format=%H%x1f%s -n8 origin/main..HEAD') {
        return { ok: true, stdout: 'abc123\u001ffeat: wire dashboard\n' }
      }

      if (cwd === featureDir && cmd === 'show --numstat --format= abc123') {
        return {
          ok: true,
          stdout: '5\t1\topenspec/changes/dashboard-live-workflow-status/proposal.md\n',
        }
      }
      if (cwd === featureDir && cmd === 'show --name-only --format= abc123') {
        return {
          ok: true,
          stdout:
            'openspec/changes/dashboard-live-workflow-status/proposal.md\npackages/web/src/routes/dashboard.tsx\n',
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
    })

    expect(snapshot.defaultBranch).toBe('origin/main')
    expect(snapshot.worktrees).toHaveLength(2)
    expect(snapshot.worktrees[0]?.isCurrent).toBe(true)
    expect(snapshot.worktrees[0]?.branchName).toBe('main')

    const feature = snapshot.worktrees.find((worktree) => worktree.path === featureDir)
    expect(feature).toBeDefined()
    expect(feature?.ahead).toBe(3)
    expect(feature?.behind).toBe(1)
    expect(feature?.diff).toEqual({ files: 3, insertions: 10, deletions: 2 })

    const commitEntry = feature?.entries.find((entry) => entry.type === 'commit')
    expect(commitEntry?.relatedChanges).toEqual(['dashboard-live-workflow-status'])
    expect(commitEntry?.diff).toEqual({ files: 1, insertions: 5, deletions: 1 })

    const uncommittedEntry = feature?.entries.find((entry) => entry.type === 'uncommitted')
    expect(uncommittedEntry?.relatedChanges).toEqual(['dashboard-live-workflow-status'])
    expect(uncommittedEntry?.diff).toEqual({ files: 2, insertions: 3, deletions: 0 })
  })
})
