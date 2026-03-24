import type {
  DashboardGitDiffStats,
  DashboardGitEntry,
  DashboardGitSnapshot,
  DashboardGitWorktree,
} from '@openspecui/core'
import { execFile } from 'node:child_process'
import { stat } from 'node:fs/promises'
import { relative, resolve } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

interface GitCommandResult {
  ok: boolean
  stdout: string
}

type GitRunner = (cwd: string, args: string[]) => Promise<GitCommandResult>
type PathTimestampReader = (absolutePath: string) => Promise<number | null>

interface BuildDashboardGitSnapshotOptions {
  projectDir: string
  runGit?: GitRunner
  maxCommitEntries?: number
  readPathTimestampMs?: PathTimestampReader
}

interface ParsedWorktree {
  path: string
  branchRef: string | null
  detached: boolean
}

const EMPTY_DIFF: DashboardGitDiffStats = {
  files: 0,
  insertions: 0,
  deletions: 0,
}

async function defaultRunGit(cwd: string, args: string[]): Promise<GitCommandResult> {
  try {
    const { stdout } = await execFileAsync('git', args, {
      cwd,
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
    })
    return { ok: true, stdout }
  } catch {
    return { ok: false, stdout: '' }
  }
}

async function defaultReadPathTimestampMs(absolutePath: string): Promise<number | null> {
  try {
    const stats = await stat(absolutePath)
    return Number.isFinite(stats.mtimeMs) && stats.mtimeMs > 0 ? stats.mtimeMs : null
  } catch {
    return null
  }
}

function parseShortStat(output: string): DashboardGitDiffStats {
  const files = Number(/(\d+)\s+files? changed/.exec(output)?.[1] ?? 0)
  const insertions = Number(/(\d+)\s+insertions?\(\+\)/.exec(output)?.[1] ?? 0)
  const deletions = Number(/(\d+)\s+deletions?\(-\)/.exec(output)?.[1] ?? 0)
  return {
    files: Number.isFinite(files) ? files : 0,
    insertions: Number.isFinite(insertions) ? insertions : 0,
    deletions: Number.isFinite(deletions) ? deletions : 0,
  }
}

function parseNumStat(output: string): DashboardGitDiffStats {
  let files = 0
  let insertions = 0
  let deletions = 0

  for (const line of output.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const [addRaw, deleteRaw] = trimmed.split('\t')
    if (!addRaw || !deleteRaw) continue

    files += 1
    if (addRaw !== '-') insertions += Number(addRaw) || 0
    if (deleteRaw !== '-') deletions += Number(deleteRaw) || 0
  }

  return { files, insertions, deletions }
}

function normalizeGitPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '')
}

function relativePath(fromDir: string, target: string): string {
  const rel = relative(fromDir, target)
  if (!rel || rel.length === 0) return '.'
  return rel
}

function parseBranchName(branchRef: string | null, detached: boolean): string {
  if (detached) return '(detached)'
  if (!branchRef) return '(unknown)'
  return branchRef.replace(/^refs\/heads\//, '')
}

function parseWorktreeList(porcelain: string): ParsedWorktree[] {
  const entries: ParsedWorktree[] = []
  let current: ParsedWorktree | null = null

  const flush = () => {
    if (!current) return
    entries.push(current)
    current = null
  }

  for (const line of porcelain.split('\n')) {
    if (line.startsWith('worktree ')) {
      flush()
      current = {
        path: line.slice('worktree '.length).trim(),
        branchRef: null,
        detached: false,
      }
      continue
    }

    if (!current) continue

    if (line.startsWith('branch ')) {
      current.branchRef = line.slice('branch '.length).trim()
      continue
    }

    if (line === 'detached') {
      current.detached = true
      continue
    }
  }

  flush()
  return entries
}

function parseRelatedChanges(paths: string[]): string[] {
  const related = new Set<string>()

  for (const path of paths) {
    const normalized = normalizeGitPath(path)
    const activeMatch = /^openspec\/changes\/([^/]+)\//.exec(normalized)
    if (activeMatch?.[1]) {
      related.add(activeMatch[1])
      continue
    }

    const archiveMatch = /^openspec\/changes\/archive\/([^/]+)\//.exec(normalized)
    if (archiveMatch?.[1]) {
      const fullName = archiveMatch[1]
      related.add(fullName.replace(/^\d{4}-\d{2}-\d{2}-/, ''))
    }
  }

  return [...related].sort((a, b) => a.localeCompare(b))
}

async function resolveDefaultBranch(projectDir: string, runGit: GitRunner): Promise<string> {
  const remoteHead = await runGit(projectDir, [
    'symbolic-ref',
    '--quiet',
    '--short',
    'refs/remotes/origin/HEAD',
  ])
  const remoteRef = remoteHead.stdout.trim()
  if (remoteHead.ok && remoteRef) {
    return remoteRef
  }

  const localHead = await runGit(projectDir, ['rev-parse', '--abbrev-ref', 'HEAD'])
  const localRef = localHead.stdout.trim()
  if (localHead.ok && localRef && localRef !== 'HEAD') {
    return localRef
  }

  return 'main'
}

async function collectCommitEntries(options: {
  worktreePath: string
  defaultBranch: string
  maxCommitEntries: number
  runGit: GitRunner
  readPathTimestampMs: PathTimestampReader
}): Promise<DashboardGitEntry[]> {
  const { worktreePath, defaultBranch, maxCommitEntries, runGit, readPathTimestampMs } = options
  const commitEntries: DashboardGitEntry[] = []

  const commits = await runGit(worktreePath, [
    'log',
    '--format=%H%x1f%ct%x1f%s',
    `-n${maxCommitEntries}`,
    `${defaultBranch}..HEAD`,
  ])

  if (commits.ok) {
    for (const line of commits.stdout.split('\n')) {
      if (!line.trim()) continue
      const [hash, committedAtRaw = '0', title = ''] = line.split('\u001f')
      if (!hash) continue

      const diffResult = await runGit(worktreePath, ['show', '--numstat', '--format=', hash])
      const changedFilesResult = await runGit(worktreePath, [
        'show',
        '--name-only',
        '--format=',
        hash,
      ])

      const changedFiles = changedFilesResult.stdout
        .split('\n')
        .map((item) => item.trim())
        .filter((item) => item.length > 0)

      const committedAt = Number(committedAtRaw) * 1000

      commitEntries.push({
        type: 'commit',
        hash,
        title: title.trim() || hash.slice(0, 7),
        committedAt: Number.isFinite(committedAt) && committedAt > 0 ? committedAt : 0,
        relatedChanges: parseRelatedChanges(changedFiles),
        diff: diffResult.ok ? parseNumStat(diffResult.stdout) : EMPTY_DIFF,
      })
    }
  }

  const trackedResult = await runGit(worktreePath, ['diff', '--numstat', 'HEAD'])
  const trackedFilesResult = await runGit(worktreePath, ['diff', '--name-only', 'HEAD'])
  const untrackedResult = await runGit(worktreePath, ['ls-files', '--others', '--exclude-standard'])

  const trackedFiles = trackedFilesResult.stdout
    .split('\n')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
  const untrackedFiles = untrackedResult.stdout
    .split('\n')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)

  const allUncommittedFiles = new Set<string>([...trackedFiles, ...untrackedFiles])
  const trackedDiff = trackedResult.ok ? parseNumStat(trackedResult.stdout) : EMPTY_DIFF
  const updatedAtCandidates = await Promise.all(
    [...allUncommittedFiles].map((path) => readPathTimestampMs(resolve(worktreePath, path)))
  )
  const updatedAt =
    updatedAtCandidates.reduce<number | null>((latest, current) => {
      if (!current || !Number.isFinite(current) || current <= 0) return latest
      return latest === null || current > latest ? current : latest
    }, null) ?? null

  commitEntries.sort((left, right) => {
    if (left.type !== 'commit' || right.type !== 'commit') return 0
    return right.committedAt - left.committedAt
  })

  return [
    {
      type: 'uncommitted',
      title: 'Uncommitted',
      updatedAt,
      relatedChanges: parseRelatedChanges([...allUncommittedFiles]),
      diff: {
        files: allUncommittedFiles.size,
        insertions: trackedDiff.insertions,
        deletions: trackedDiff.deletions,
      },
    },
    ...commitEntries,
  ]
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
    branchName: parseBranchName(worktree.branchRef, worktree.detached),
    detached: worktree.detached,
    isCurrent: resolvedProjectDir === worktreePath,
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

  if (resolvedTargetPath === resolvedProjectDir) {
    throw new Error('Cannot remove the current worktree.')
  }

  const worktreeResult = await runGit(resolvedProjectDir, ['worktree', 'list', '--porcelain'])
  if (!worktreeResult.ok) {
    throw new Error('Failed to inspect git worktrees.')
  }

  const matched = parseWorktreeList(worktreeResult.stdout).find(
    (worktree) => resolve(worktree.path) === resolvedTargetPath
  )

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

  const worktreeResult = await runGit(resolvedProjectDir, ['worktree', 'list', '--porcelain'])

  const parsed = worktreeResult.ok ? parseWorktreeList(worktreeResult.stdout) : []

  const baseWorktrees: ParsedWorktree[] =
    parsed.length > 0
      ? parsed
      : [
          {
            path: resolvedProjectDir,
            branchRef: null,
            detached: false,
          },
        ]

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
