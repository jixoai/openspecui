/**
 * Orthogonal intents (updated 2026-08-05 Asia/Shanghai):
 * 1. Prove same-repository roots collapse to Code scope.
 * 2. Prove only distinct, available planning repositories are advertised.
 * 3. Preserve backend-issued binding tokens through repository identity resolution.
 * 4. Keep mocked physical repository identities native on Windows and POSIX.
 *
 * Original request (2026-07-16): "接下来，你来接手后续工作"
 * Derived requirement (2026-07-19): Checkpoint 6.11 rejects stale Git repository bindings.
 */
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  resolveGitRepositoryDescriptor,
  resolveGitRepositoryScopes,
  selectGitRepositoryScope,
} from './git-repository-scope.js'
import type { GitRunner } from './git-shared.js'

const preserveSyntheticPath = async (path: string): Promise<string> => path

function createIdentityRunner(
  identities: Record<string, { topLevel: string; commonDir: string } | null>
): GitRunner {
  return async (cwd, args) => {
    const identity = identities[cwd] ?? null
    if (!identity) return { ok: false, stdout: '', failureKind: 'not-repository' }
    if (args.join(' ') === 'rev-parse --show-toplevel') {
      return { ok: true, stdout: `${identity.topLevel}\n` }
    }
    if (args.join(' ') === 'rev-parse --git-common-dir') {
      return { ok: true, stdout: `${identity.commonDir}\n` }
    }
    return { ok: false, stdout: '', failureKind: 'not-repository' }
  }
}

describe('Git repository scopes', () => {
  it('collapses nested launch and planning roots inside one Git worktree', async () => {
    const repositoryRoot = resolve('/repo')
    const launchRoot = resolve('/repo/apps/ui')
    const planningRoot = resolve('/repo/planning')
    const runGit = createIdentityRunner({
      [launchRoot]: { topLevel: repositoryRoot, commonDir: resolve('/repo/.git') },
      [planningRoot]: { topLevel: repositoryRoot, commonDir: resolve('/repo/.git') },
    })

    const scopes = await resolveGitRepositoryScopes({
      launchProjectDir: launchRoot,
      codeBindingToken: 'code-token',
      planningRootDir: planningRoot,
      planningBindingToken: 'planning-token',
      runGit,
      canonicalizePath: preserveSyntheticPath,
    })

    expect(scopes.code.repository).toEqual({
      topLevel: repositoryRoot,
      commonDir: resolve('/repo/.git'),
    })
    expect(scopes.code.bindingToken).toBe('code-token')
    expect(scopes.planning).toBeNull()
    expect(() => selectGitRepositoryScope(scopes, 'planning')).toThrow(
      'Planning repository scope is unavailable or identical to Code repository.'
    )
  })

  it('exposes planning only for a distinct canonical repository identity', async () => {
    const codeRoot = resolve('/code')
    const planningRoot = resolve('/planning/specs')
    const runGit = createIdentityRunner({
      [codeRoot]: { topLevel: codeRoot, commonDir: resolve('/code/.git') },
      [planningRoot]: {
        topLevel: resolve('/planning'),
        commonDir: resolve('/planning/.git'),
      },
    })

    const scopes = await resolveGitRepositoryScopes({
      launchProjectDir: codeRoot,
      codeBindingToken: 'code-token',
      planningRootDir: planningRoot,
      planningBindingToken: 'planning-token',
      runGit,
      canonicalizePath: preserveSyntheticPath,
    })

    expect(scopes.defaultScope).toBe('code')
    expect(scopes.planning).toMatchObject({
      scope: 'planning',
      bindingToken: 'planning-token',
      rootPath: planningRoot,
      repository: { topLevel: resolve('/planning'), commonDir: resolve('/planning/.git') },
    })
  })

  it('does not advertise a planning root that is not a Git repository', async () => {
    const codeRoot = resolve('/code')
    const planningRoot = resolve('/planning')
    const runGit = createIdentityRunner({
      [codeRoot]: { topLevel: codeRoot, commonDir: resolve('/code/.git') },
      [planningRoot]: null,
    })

    const scopes = await resolveGitRepositoryScopes({
      launchProjectDir: codeRoot,
      codeBindingToken: 'code-token',
      planningRootDir: planningRoot,
      planningBindingToken: 'planning-token',
      runGit,
      canonicalizePath: preserveSyntheticPath,
    })

    expect(scopes.code.repository?.topLevel).toBe(codeRoot)
    expect(scopes.planning).toBeNull()
  })

  it.each([
    { label: 'permission failure', stderr: 'fatal: Permission denied', exitCode: 128 },
    { label: 'missing executable', stderr: 'spawn git ENOENT', exitCode: 'ENOENT' },
    { label: 'unknown failure', stderr: undefined, exitCode: undefined },
  ])('rejects a $label Git identity failure instead of collapsing it', async (failure) => {
    const runGit: GitRunner = async () => ({
      ok: false,
      stdout: '',
      stderr: failure.stderr,
      exitCode: failure.exitCode,
      failureKind: 'command-failed',
    })

    await expect(
      resolveGitRepositoryDescriptor({
        scope: 'planning',
        bindingToken: 'planning-token',
        rootPath: '/planning',
        runGit,
        canonicalizePath: preserveSyntheticPath,
      })
    ).rejects.toThrow('Git repository identity command failed')
  })

  it('collapses only an explicitly classified non-repository identity result', async () => {
    const runGit: GitRunner = async () => ({
      ok: false,
      stdout: '',
      failureKind: 'not-repository',
    })

    const scopes = await resolveGitRepositoryScopes({
      launchProjectDir: '/code',
      codeBindingToken: 'code-token',
      planningRootDir: '/planning',
      planningBindingToken: 'planning-token',
      runGit,
      canonicalizePath: preserveSyntheticPath,
    })

    expect(scopes.planningState).toBe('settled')
    expect(scopes.planning).toBeNull()
  })

  it('rejects an unknown empty failure without an explicit classifier', async () => {
    const runGit: GitRunner = async () => ({ ok: false, stdout: '', stderr: '' })

    await expect(
      resolveGitRepositoryDescriptor({
        scope: 'planning',
        bindingToken: 'planning-token',
        rootPath: '/planning',
        runGit,
        canonicalizePath: preserveSyntheticPath,
      })
    ).rejects.toThrow('Git repository identity command failed')
  })

  it('rejects a successful identity command with empty output', async () => {
    const runGit: GitRunner = async () => ({ ok: true, stdout: '' })

    await expect(
      resolveGitRepositoryDescriptor({
        scope: 'planning',
        bindingToken: 'planning-token',
        rootPath: '/planning',
        runGit,
        canonicalizePath: preserveSyntheticPath,
      })
    ).rejects.toThrow('Git repository identity command failed')
  })

  it('recognizes Git canonical non-repository stderr as a settled collapse', async () => {
    const runGit: GitRunner = async () => ({
      ok: false,
      stdout: '',
      stderr: 'fatal: not a git repository (or any of the parent directories): .git',
      exitCode: 128,
    })

    const scopes = await resolveGitRepositoryScopes({
      launchProjectDir: '/code',
      codeBindingToken: 'code-token',
      planningRootDir: '/planning',
      planningBindingToken: 'planning-token',
      runGit,
      canonicalizePath: preserveSyntheticPath,
    })

    expect(scopes.planningState).toBe('settled')
    expect(scopes.planning).toBeNull()
  })

  it('propagates canonical identity failures instead of using an unresolved path', async () => {
    const runGit: GitRunner = async (_cwd, args) => {
      if (args.includes('--show-toplevel')) return { ok: true, stdout: '/planning\n' }
      return { ok: true, stdout: '.git\n' }
    }

    await expect(
      resolveGitRepositoryDescriptor({
        scope: 'planning',
        bindingToken: 'planning-token',
        rootPath: '/planning',
        runGit,
        canonicalizePath: async () => {
          throw new Error('canonical Git path unavailable')
        },
      })
    ).rejects.toThrow('canonical Git path unavailable')
  })
})
