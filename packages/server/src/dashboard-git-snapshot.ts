import type {
  DashboardGitEntry,
  DashboardGitSnapshot,
  DashboardGitWorktree,
} from '@openspecui/core'
import { resolve } from 'node:path'

import { listRecentGitEntries } from './git-entry-summary.js'
import {
  defaultReadPathTimestampMs,
  defaultRunGit,
  EMPTY_DIFF,
  listGitWorktrees,
  parseBranchName,
  parseShortStat,
  pathExists,
  relativePath,
  resolveDefaultBranch,
  sameGitPath,
  type GitRunner,
  type ParsedWorktree,
  type PathTimestampReader,
} from './git-shared.js'

interface BuildDashboardGitSnapshotOptions {
  projectDir: string
  runGit?: GitRunner
  maxCommitEntries?: number
  readPathTimestampMs?: PathTimestampReader
}

async function collectCommitEntries(options: {
  worktreePath: string
  defaultBranch: string
  maxCommitEntries: number
  runGit: GitRunner
  readPathTimestampMs: PathTimestampReader
}): Promise<DashboardGitEntry[]> {
  const { worktreePath, defaultBranch, maxCommitEntries, runGit, readPathTimestampMs } = options
  return listRecentGitEntries({
    worktreePath,
    defaultBranch,
    maxCommitEntries,
    runGit,
    readPathTimestampMs,
  })
}

async function collectWorktree(options: {
  projectDir: string
  worktree: ParsedWorktree
  defaultBranch: string
  runGit: GitRunner
  maxCommitEntries: number
  readPathTimestampMs: PathTimestampReader
}): Promise<DashboardGitWorktree> {
  const { projectDir, worktree, defaultBranch, runGit, maxCommitEntries, readPathTimestampMs } =
    options
  const worktreePath = resolve(worktree.path)
  const resolvedProjectDir = resolve(projectDir)
  const isCurrent = await sameGitPath(worktreePath, resolvedProjectDir)
  const pathAvailable = await pathExists(worktreePath)

  const aheadBehindResult = await runGit(worktreePath, [
    'rev-list',
    '--left-right',
    '--count',
    `${defaultBranch}...HEAD`,
  ])
  let ahead = 0
  let behind = 0
  if (aheadBehindResult.ok) {
    const [behindRaw, aheadRaw] = aheadBehindResult.stdout.trim().split(/\s+/)
    ahead = Number(aheadRaw) || 0
    behind = Number(behindRaw) || 0
  }

  const diffResult = await runGit(worktreePath, ['diff', '--shortstat', `${defaultBranch}...HEAD`])
  const diff = diffResult.ok ? parseShortStat(diffResult.stdout) : EMPTY_DIFF

  const entries = await collectCommitEntries({
    worktreePath,
    defaultBranch,
    maxCommitEntries,
    runGit,
    readPathTimestampMs,
  })

  return {
    path: worktreePath,
    relativePath: relativePath(resolvedProjectDir, worktreePath),
    pathAvailable,
    branchName: parseBranchName(worktree.branchRef, worktree.detached),
    detached: worktree.detached,
    isCurrent,
    ahead,
    behind,
    diff,
    entries,
  }
}

export async function removeDetachedDashboardGitWorktree(options: {
  projectDir: string
  targetPath: string
  runGit?: GitRunner
}): Promise<void> {
  const runGit = options.runGit ?? defaultRunGit
  const resolvedProjectDir = resolve(options.projectDir)
  const resolvedTargetPath = resolve(options.targetPath)

  if (await sameGitPath(resolvedTargetPath, resolvedProjectDir)) {
    throw new Error('Cannot remove the current worktree.')
  }

  const worktrees = await listGitWorktrees(resolvedProjectDir, runGit)
  let matched: ParsedWorktree | undefined
  for (const worktree of worktrees) {
    if (await sameGitPath(worktree.path, resolvedTargetPath)) {
      matched = worktree
      break
    }
  }

  if (!matched) {
    throw new Error('Worktree not found.')
  }

  if (!matched.detached) {
    throw new Error('Only detached worktrees can be removed from Dashboard.')
  }

  const removeResult = await runGit(resolvedProjectDir, [
    'worktree',
    'remove',
    '--force',
    resolvedTargetPath,
  ])
  if (!removeResult.ok) {
    throw new Error('Failed to remove detached worktree.')
  }
}

export async function buildDashboardGitSnapshot(
  options: BuildDashboardGitSnapshotOptions
): Promise<DashboardGitSnapshot> {
  const runGit = options.runGit ?? defaultRunGit
  const maxCommitEntries = options.maxCommitEntries ?? 8
  const readPathTimestampMs = options.readPathTimestampMs ?? defaultReadPathTimestampMs
  const resolvedProjectDir = resolve(options.projectDir)

  const defaultBranch = await resolveDefaultBranch(resolvedProjectDir, runGit)
  const baseWorktrees = await listGitWorktrees(resolvedProjectDir, runGit)

  const worktrees = await Promise.all(
    baseWorktrees.map((worktree) =>
      collectWorktree({
        projectDir: resolvedProjectDir,
        worktree,
        defaultBranch,
        runGit,
        maxCommitEntries,
        readPathTimestampMs,
      })
    )
  )

  worktrees.sort((a, b) => {
    if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1
    return a.branchName.localeCompare(b.branchName)
  })

  return {
    defaultBranch,
    worktrees,
  }
}
