/**
 * Orthogonal intents (updated 2026-07-19 Asia/Shanghai):
 * 1. Resolve objective Git repository identity from a requested project/root path.
 * 2. Expose Code and Planning scopes only when their canonical identities differ.
 * 3. Preserve backend-issued binding provenance on every resolved descriptor.
 * 4. Reject unavailable or collapsed scope selection before any Git command runs.
 *
 * Original request (2026-07-16): "3.7 Git exposes explicit code-repository and planning-repository scopes when they differ"
 * Derived requirement (2026-07-19): Checkpoint 6.11 rejects stale Git repository bindings.
 */
import type {
  GitRepositoryIdentity,
  GitRepositoryScope,
  GitRepositoryScopeDescriptor,
  GitRepositoryScopes,
} from '@openspecui/core'
import { resolve } from 'node:path'

import { defaultRunGit, strictCanonicalGitPath, type GitRunner } from './git-shared.js'

type GitPathCanonicalizer = (path: string) => Promise<string>

interface ResolveGitRepositoryDescriptorOptions {
  scope: GitRepositoryScope
  bindingToken: string
  rootPath: string
  runGit?: GitRunner
  canonicalizePath?: GitPathCanonicalizer
}

interface ResolveGitRepositoryScopesOptions {
  launchProjectDir: string
  codeBindingToken: string
  planningRootDir: string | null
  planningBindingToken: string | null
  runGit?: GitRunner
  canonicalizePath?: GitPathCanonicalizer
}

interface ResolvePlanningGitRepositoryScopesOptions {
  code: GitRepositoryScopes['code']
  planningRootDir: string | null
  planningBindingToken: string | null
  runGit?: GitRunner
  canonicalizePath?: GitPathCanonicalizer
}

async function readGitPath(
  rootPath: string,
  args: string[],
  runGit: GitRunner
): Promise<string | null> {
  const result = await runGit(rootPath, args)
  const value = result.stdout.trim()
  if (result.ok && value) return value
  if (!result.ok && isNotRepositoryResult(result)) return null

  const evidence = [
    result.stderr,
    result.exitCode === undefined ? undefined : `exit ${String(result.exitCode)}`,
  ].filter((item): item is string => item !== undefined && item.length > 0)
  throw new Error(
    `Git repository identity command failed (${args.join(' ')}): ${
      evidence.join('; ') || 'no diagnostic evidence'
    }`
  )
}

function isNotRepositoryResult(result: Awaited<ReturnType<GitRunner>>): boolean {
  if (result.failureKind === 'not-repository') return true
  if (result.failureKind === 'command-failed') return false
  if (result.stderr === undefined || result.stderr.trim().length === 0) return false
  return /not a git repository/i.test(result.stderr) && !/permission denied/i.test(result.stderr)
}

/** Resolve canonical worktree and common-dir identity without inferring repository health. */
export async function resolveGitRepositoryDescriptor(
  options: ResolveGitRepositoryDescriptorOptions
): Promise<GitRepositoryScopeDescriptor> {
  const rootPath = resolve(options.rootPath)
  const runGit = options.runGit ?? defaultRunGit
  const canonicalizePath = options.canonicalizePath ?? strictCanonicalGitPath
  const [topLevel, commonDir] = await Promise.all([
    readGitPath(rootPath, ['rev-parse', '--show-toplevel'], runGit),
    readGitPath(rootPath, ['rev-parse', '--git-common-dir'], runGit),
  ])

  if (!topLevel || !commonDir) {
    return {
      scope: options.scope,
      bindingToken: options.bindingToken,
      rootPath,
      repository: null,
    }
  }

  const [canonicalTopLevel, canonicalCommonDir] = await Promise.all([
    canonicalizePath(resolve(rootPath, topLevel)),
    canonicalizePath(resolve(rootPath, commonDir)),
  ])

  return {
    scope: options.scope,
    bindingToken: options.bindingToken,
    rootPath,
    repository: {
      topLevel: canonicalTopLevel,
      commonDir: canonicalCommonDir,
    },
  }
}

/** Return whether two filesystem locations resolve to the same Git repository identity. */
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
  const code = await resolveGitRepositoryDescriptor({
    scope: 'code',
    bindingToken: options.codeBindingToken,
    rootPath: options.launchProjectDir,
    runGit: options.runGit,
    canonicalizePath: options.canonicalizePath,
  })
  return resolvePlanningGitRepositoryScopes({
    code: { ...code, scope: 'code' },
    planningRootDir: options.planningRootDir,
    planningBindingToken: options.planningBindingToken,
    runGit: options.runGit,
    canonicalizePath: options.canonicalizePath,
  })
}

/** Compare one Planning candidate against an already observed Code repository descriptor. */
export async function resolvePlanningGitRepositoryScopes(
  options: ResolvePlanningGitRepositoryScopesOptions
): Promise<GitRepositoryScopes> {
  const planningCandidate =
    options.planningRootDir && options.planningBindingToken
      ? await resolveGitRepositoryDescriptor({
          scope: 'planning',
          bindingToken: options.planningBindingToken,
          rootPath: options.planningRootDir,
          runGit: options.runGit,
          canonicalizePath: options.canonicalizePath,
        })
      : null
  const planning =
    planningCandidate?.repository &&
    !isSameGitRepositoryIdentity(options.code.repository, planningCandidate.repository)
      ? planningCandidate
      : null

  return {
    defaultScope: 'code',
    code: options.code,
    planningState: 'settled',
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
