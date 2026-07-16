/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Resolve objective Git repository identity from a requested project/root path.
 * 2. Expose Code and Planning scopes only when their canonical identities differ.
 * 3. Reject unavailable or collapsed scope selection before any Git command runs.
 *
 * Original request (2026-07-16): "3.7 Git exposes explicit code-repository and planning-repository scopes when they differ"
 */
import type {
  GitRepositoryIdentity,
  GitRepositoryScope,
  GitRepositoryScopeDescriptor,
  GitRepositoryScopes,
} from '@openspecui/core'
import { resolve } from 'node:path'

import { canonicalGitPath, defaultRunGit, type GitRunner } from './git-shared.js'

interface ResolveGitRepositoryDescriptorOptions {
  scope: GitRepositoryScope
  rootPath: string
  runGit?: GitRunner
}

interface ResolveGitRepositoryScopesOptions {
  launchProjectDir: string
  planningRootDir: string | null
  runGit?: GitRunner
}

async function readGitPath(
  rootPath: string,
  args: string[],
  runGit: GitRunner
): Promise<string | null> {
  const result = await runGit(rootPath, args)
  const value = result.stdout.trim()
  return result.ok && value ? value : null
}

/** Resolve canonical worktree and common-dir identity without inferring repository health. */
export async function resolveGitRepositoryDescriptor(
  options: ResolveGitRepositoryDescriptorOptions
): Promise<GitRepositoryScopeDescriptor> {
  const rootPath = resolve(options.rootPath)
  const runGit = options.runGit ?? defaultRunGit
  const [topLevel, commonDir] = await Promise.all([
    readGitPath(rootPath, ['rev-parse', '--show-toplevel'], runGit),
    readGitPath(rootPath, ['rev-parse', '--git-common-dir'], runGit),
  ])

  if (!topLevel || !commonDir) {
    return {
      scope: options.scope,
      rootPath,
      repository: null,
    }
  }

  const [canonicalTopLevel, canonicalCommonDir] = await Promise.all([
    canonicalGitPath(resolve(rootPath, topLevel)),
    canonicalGitPath(resolve(rootPath, commonDir)),
  ])

  return {
    scope: options.scope,
    rootPath,
    repository: {
      topLevel: canonicalTopLevel,
      commonDir: canonicalCommonDir,
    },
  }
}

export function isSameGitRepositoryIdentity(
  left: GitRepositoryIdentity | null,
  right: GitRepositoryIdentity | null
): boolean {
  return (
    left !== null &&
    right !== null &&
    left.topLevel === right.topLevel &&
    left.commonDir === right.commonDir
  )
}

/** Build the public repository-scope inventory for one project backend. */
export async function resolveGitRepositoryScopes(
  options: ResolveGitRepositoryScopesOptions
): Promise<GitRepositoryScopes> {
  const codePromise = resolveGitRepositoryDescriptor({
    scope: 'code',
    rootPath: options.launchProjectDir,
    runGit: options.runGit,
  })
  const planningPromise = options.planningRootDir
    ? resolveGitRepositoryDescriptor({
        scope: 'planning',
        rootPath: options.planningRootDir,
        runGit: options.runGit,
      })
    : Promise.resolve(null)
  const [code, planningCandidate] = await Promise.all([codePromise, planningPromise])
  const planning =
    planningCandidate?.repository &&
    !isSameGitRepositoryIdentity(code.repository, planningCandidate.repository)
      ? planningCandidate
      : null

  return {
    defaultScope: 'code',
    code: { ...code, scope: 'code' },
    planning: planning ? { ...planning, scope: 'planning' } : null,
  }
}

/** Select one advertised scope and return the exact cwd used by every downstream Git operation. */
export function selectGitRepositoryScope(
  scopes: GitRepositoryScopes,
  scope: GitRepositoryScope
): GitRepositoryScopeDescriptor {
  const selected = scope === 'code' ? scopes.code : scopes.planning
  if (!selected) {
    throw new Error('Planning repository scope is unavailable or identical to Code repository.')
  }
  return selected
}
