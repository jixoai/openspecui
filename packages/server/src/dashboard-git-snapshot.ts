/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Build Dashboard-shaped Git data with full activity only for the current worktree.
 * 2. Carry the backend-issued Code binding token with every live snapshot.
 * 3. Skip hidden or unavailable worktree detail and propagate cooperative cancellation.
 *
 * Original request (2026-07-19): "代码已经提交，开始review。如果有问题，那么可更新change。"
 * Derived requirement (2026-07-19): Checkpoint 6.11 binds Dashboard snapshots to their Code token.
 * Original request (2026-07-31): "Code Git Snapshot 的 Other Worktrees 默认隐藏 (detached)。然后commitList这里默认显示5个就好"
 */
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
  bindingToken: string
  runGit?: GitRunner
  maxCommitEntries?: number
  readPathTimestampMs?: PathTimestampReader
  pathAvailable?: (absolutePath: string) => Promise<boolean>
  signal?: AbortSignal
}

async function collectCommitEntries(options: {
  worktreePath: string
  defaultBranch: string
  maxCommitEntries: number
  runGit: GitRunner
  readPathTimestampMs: PathTimestampReader
}): Promise<DashboardGitEntry[]> {
  const { worktreePath, defaultBranch, maxCommitEntries, runGit, readPathTimestampMs } = options
  const entries = await listRecentGitEntries({
    worktreePath,
    defaultBranch,
    maxCommitEntries,
    runGit,
    readPathTimestampMs,
  })
  const uncommitted = entries.find((entry) => entry.type === 'uncommitted')
  const commits = entries.filter((entry) => entry.type === 'commit')
  const hasUncommittedChanges =
    uncommitted?.type === 'uncommitted' &&
    (uncommitted.diff.files > 0 ||
      uncommitted.diff.insertions > 0 ||
      uncommitted.diff.deletions > 0)
  return hasUncommittedChanges
    ? [uncommitted, ...commits.slice(0, Math.max(0, maxCommitEntries - 1))]
    : commits.slice(0, maxCommitEntries)
}

async function collectWorktree(options: {
  projectDir: string
  worktree: ParsedWorktree
  defaultBranch: string
  runGit: GitRunner
  maxCommitEntries: number
  readPathTimestampMs: PathTimestampReader
  pathAvailable: (absolutePath: string) => Promise<boolean>
}): Promise<DashboardGitWorktree> {
  const {
    projectDir,
    worktree,
    defaultBranch,
    runGit,
    maxCommitEntries,
    readPathTimestampMs,
    pathAvailable,
  } = options
  const worktreePath = resolve(worktree.path)
  const resolvedProjectDir = resolve(projectDir)
  const isCurrent = await sameGitPath(worktreePath, resolvedProjectDir)
  const isPathAvailable = await pathAvailable(worktreePath)
  const baseWorktree = {
    path: worktreePath,
    relativePath: relativePath(resolvedProjectDir, worktreePath),
    pathAvailable: isPathAvailable,
    branchName: parseBranchName(worktree.branchRef, worktree.detached),
    detached: worktree.detached,
    isCurrent,
  }
  if (!isPathAvailable || worktree.detached) {
    return { ...baseWorktree, ahead: 0, behind: 0, diff: EMPTY_DIFF, entries: [] }
  }

  const [aheadBehindResult, diffResult, entries] = await Promise.all([
    runGit(worktreePath, ['rev-list', '--left-right', '--count', `${defaultBranch}...HEAD`]),
    runGit(worktreePath, ['diff', '--shortstat', `${defaultBranch}...HEAD`]),
    isCurrent
      ? collectCommitEntries({
          worktreePath,
          defaultBranch,
          maxCommitEntries,
          runGit,
          readPathTimestampMs,
        })
      : Promise.resolve([]),
  ])
  let ahead = 0
  let behind = 0
  if (aheadBehindResult.ok) {
    const [behindRaw, aheadRaw] = aheadBehindResult.stdout.trim().split(/\s+/)
    ahead = Number(aheadRaw) || 0
    behind = Number(behindRaw) || 0
  }

  const diff = diffResult.ok ? parseShortStat(diffResult.stdout) : EMPTY_DIFF

  return {
    ...baseWorktree,
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
  const maxCommitEntries = options.maxCommitEntries ?? 5
  const readPathTimestampMs = options.readPathTimestampMs ?? defaultReadPathTimestampMs
  const readPathAvailable = options.pathAvailable ?? pathExists
  const runSnapshotGit: GitRunner = (cwd, args) => runGit(cwd, args, options.signal)
  const resolvedProjectDir = resolve(options.projectDir)

  const defaultBranch = await resolveDefaultBranch(resolvedProjectDir, runSnapshotGit)
  const baseWorktrees = await listGitWorktrees(resolvedProjectDir, runSnapshotGit)

  const worktrees = await Promise.all(
    baseWorktrees.map((worktree) =>
      collectWorktree({
        projectDir: resolvedProjectDir,
        worktree,
        defaultBranch,
        runGit: runSnapshotGit,
        maxCommitEntries,
        readPathTimestampMs,
        pathAvailable: readPathAvailable,
      })
    )
  )

  worktrees.sort((a, b) => {
    if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1
    return a.branchName.localeCompare(b.branchName)
  })

  return {
    bindingToken: options.bindingToken,
    defaultBranch,
    worktrees,
  }
}
