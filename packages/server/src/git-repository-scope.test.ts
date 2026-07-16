/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Prove same-repository roots collapse to Code scope.
 * 2. Prove only distinct, available planning repositories are advertised.
 *
 * Original request (2026-07-16): "接下来，你来接手后续工作"
 */
import { describe, expect, it } from 'vitest'

import { resolveGitRepositoryScopes, selectGitRepositoryScope } from './git-repository-scope.js'
import type { GitRunner } from './git-shared.js'

function createIdentityRunner(
  identities: Record<string, { topLevel: string; commonDir: string } | null>
): GitRunner {
  return async (cwd, args) => {
    const identity = identities[cwd] ?? null
    if (!identity) return { ok: false, stdout: '' }
    if (args.join(' ') === 'rev-parse --show-toplevel') {
      return { ok: true, stdout: `${identity.topLevel}\n` }
    }
    if (args.join(' ') === 'rev-parse --git-common-dir') {
      return { ok: true, stdout: `${identity.commonDir}\n` }
    }
    return { ok: false, stdout: '' }
  }
}

describe('Git repository scopes', () => {
  it('collapses nested launch and planning roots inside one Git worktree', async () => {
    const runGit = createIdentityRunner({
      '/repo/apps/ui': { topLevel: '/repo', commonDir: '/repo/.git' },
      '/repo/planning': { topLevel: '/repo', commonDir: '/repo/.git' },
    })

    const scopes = await resolveGitRepositoryScopes({
      launchProjectDir: '/repo/apps/ui',
      planningRootDir: '/repo/planning',
      runGit,
    })

    expect(scopes.code.repository).toEqual({ topLevel: '/repo', commonDir: '/repo/.git' })
    expect(scopes.planning).toBeNull()
    expect(() => selectGitRepositoryScope(scopes, 'planning')).toThrow(
      'Planning repository scope is unavailable or identical to Code repository.'
    )
  })

  it('exposes planning only for a distinct canonical repository identity', async () => {
    const runGit = createIdentityRunner({
      '/code': { topLevel: '/code', commonDir: '/code/.git' },
      '/planning/specs': { topLevel: '/planning', commonDir: '/planning/.git' },
    })

    const scopes = await resolveGitRepositoryScopes({
      launchProjectDir: '/code',
      planningRootDir: '/planning/specs',
      runGit,
    })

    expect(scopes.defaultScope).toBe('code')
    expect(scopes.planning).toMatchObject({
      scope: 'planning',
      rootPath: '/planning/specs',
      repository: { topLevel: '/planning', commonDir: '/planning/.git' },
    })
  })

  it('does not advertise a planning root that is not a Git repository', async () => {
    const runGit = createIdentityRunner({
      '/code': { topLevel: '/code', commonDir: '/code/.git' },
      '/planning': null,
    })

    const scopes = await resolveGitRepositoryScopes({
      launchProjectDir: '/code',
      planningRootDir: '/planning',
      runGit,
    })

    expect(scopes.code.repository?.topLevel).toBe('/code')
    expect(scopes.planning).toBeNull()
  })
})
