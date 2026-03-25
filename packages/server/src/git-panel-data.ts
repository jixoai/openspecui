import type {
  DashboardGitDiffStats,
  GitEntriesPage,
  GitEntryDetail,
  GitEntryFileDiff,
  GitEntryFilePatch,
  GitEntryFileSummary,
  GitEntryPatch,
  GitEntrySelector,
  GitEntryShell,
  GitFileChangeType,
  GitWorktreeOverview,
  GitWorktreeSummary,
} from '@openspecui/core'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import {
  collectUncommittedEntrySummary,
  listGitCommitEntriesPage,
  readGitCommitEntryByHash,
} from './git-entry-summary.js'
import { getCachedGitPanelValue } from './git-panel-cache.js'
import {
  defaultReadPathTimestampMs,
  defaultRunGit,
  EMPTY_DIFF,
  extractGitPathVariants,
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

const DEFAULT_ENTRY_PAGE_SIZE = 50
const MAX_ENTRY_PAGE_SIZE = 100
const MAX_PATCH_BYTES = 200_000
const MAX_SYNTHETIC_TEXT_BYTES = 200_000

interface GitPanelDataOptions {
  projectDir: string
  runGit?: GitRunner
  readPathTimestampMs?: PathTimestampReader
}

interface GitNameStatusEntry {
  path: string
  previousPath: string | null
  changeType: GitFileChangeType
}

function clampEntryLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) return DEFAULT_ENTRY_PAGE_SIZE
  return Math.max(1, Math.min(MAX_ENTRY_PAGE_SIZE, Math.trunc(limit ?? DEFAULT_ENTRY_PAGE_SIZE)))
}

function parseCursor(cursor: string | undefined): number {
  const value = Number(cursor)
  if (!Number.isFinite(value) || value < 0) return 0
  return Math.trunc(value)
}

function createGitFileId(path: string, previousPath: string | null): string {
  return JSON.stringify([previousPath ?? null, path])
}

function parseGitNameStatus(stdout: string): GitNameStatusEntry[] {
  const entries: GitNameStatusEntry[] = []

  for (const line of stdout.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const parts = trimmed.split('\t')
    const code = parts[0] ?? ''
    const normalized = code[0] ?? ''

    if (!normalized) continue

    if ((normalized === 'R' || normalized === 'C') && parts.length >= 3) {
      entries.push({
        previousPath: parts[1] ?? null,
        path: parts[2] ?? '',
        changeType: normalized === 'R' ? 'renamed' : 'copied',
      })
      continue
    }

    if (parts.length < 2) continue

    entries.push({
      previousPath: null,
      path: parts[1] ?? '',
      changeType:
        normalized === 'A'
          ? 'added'
          : normalized === 'M'
            ? 'modified'
            : normalized === 'D'
              ? 'deleted'
              : normalized === 'T'
                ? 'typechanged'
                : normalized === 'U'
                  ? 'unmerged'
                  : 'unknown',
    })
  }

  return entries
}

function parseNumStatMap(stdout: string): Map<string, DashboardGitDiffStats> {
  const diffByPath = new Map<string, DashboardGitDiffStats>()

  for (const line of stdout.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const parts = trimmed.split('\t')
    if (parts.length < 3) continue

    const [insertionsRaw = '0', deletionsRaw = '0', ...pathParts] = parts
    const rawPath = pathParts.join('\t').trim()
    const diff: DashboardGitDiffStats = {
      files: 1,
      insertions: insertionsRaw === '-' ? 0 : Number(insertionsRaw) || 0,
      deletions: deletionsRaw === '-' ? 0 : Number(deletionsRaw) || 0,
    }

    for (const path of extractGitPathVariants(rawPath)) {
      diffByPath.set(path, diff)
    }
  }

  return diffByPath
}

function resolveTrackedDiff(
  diffByPath: Map<string, DashboardGitDiffStats>,
  status: GitNameStatusEntry
): DashboardGitDiffStats {
  return (
    diffByPath.get(status.path) ??
    (status.previousPath ? diffByPath.get(status.previousPath) : undefined) ?? {
      files: 1,
      insertions: 0,
      deletions: 0,
    }
  )
}

function readyFileDiff(diff: DashboardGitDiffStats): GitEntryFileDiff {
  return {
    state: 'ready',
    ...diff,
  }
}

function loadingFileDiff(files = 1): GitEntryFileDiff {
  return {
    state: 'loading',
    files,
  }
}

function unavailableFileDiff(files = 1): GitEntryFileDiff {
  return {
    state: 'unavailable',
    files,
  }
}

function buildTrackedFileSummaries(
  statuses: GitNameStatusEntry[],
  numStatOutput: string
): GitEntryFileSummary[] {
  const diffByPath = parseNumStatMap(numStatOutput)

  return statuses
    .map<GitEntryFileSummary>((status) => ({
      fileId: createGitFileId(status.path, status.previousPath),
      source: 'tracked',
      path: status.path,
      displayPath: status.previousPath ? `${status.previousPath} -> ${status.path}` : status.path,
      previousPath: status.previousPath,
      changeType: status.changeType,
      diff: readyFileDiff(resolveTrackedDiff(diffByPath, status)),
    }))
    .sort((left, right) => left.path.localeCompare(right.path))
}

function buildUntrackedFileSummary(path: string): GitEntryFileSummary {
  return {
    fileId: createGitFileId(path, null),
    source: 'untracked',
    path,
    displayPath: path,
    previousPath: null,
    changeType: 'added',
    diff: loadingFileDiff(),
  }
}

async function collectWorktreeSummary(options: {
  projectDir: string
  worktree: ParsedWorktree
  defaultBranch: string
  runGit: GitRunner
}): Promise<GitWorktreeSummary> {
  const { projectDir, worktree, defaultBranch, runGit } = options
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
  }
}

function normalizePatchState(patch: string): {
  state: GitEntryFilePatch['state']
  patch: string | null
} {
  const trimmed = patch.trimEnd()
  if (!trimmed) {
    return { state: 'unavailable', patch: null }
  }
  if (/^GIT binary patch$/m.test(trimmed) || /^Binary files .* differ$/m.test(trimmed)) {
    return { state: 'binary', patch: null }
  }
  if (Buffer.byteLength(trimmed, 'utf8') > MAX_PATCH_BYTES) {
    return { state: 'too-large', patch: null }
  }
  return { state: 'available', patch: trimmed }
}

function splitPatchLines(text: string): string[] {
  if (!text) return []
  const normalized = text.replace(/\r\n/g, '\n')
  const lines = normalized.split('\n')
  if (lines.at(-1) === '') {
    lines.pop()
  }
  return lines
}

async function buildTrackedPatchFile(options: {
  worktreePath: string
  file: GitEntryFileSummary
  runGit: GitRunner
  selector: GitEntrySelector
}): Promise<GitEntryFilePatch> {
  const { worktreePath, file, runGit, selector } = options
  const diffArgs =
    selector.type === 'commit'
      ? ['show', '--patch', '--find-renames', '--format=', selector.hash, '--', file.path]
      : ['diff', '--patch', '--find-renames', 'HEAD', '--', file.path]

  const patchResult = await runGit(worktreePath, diffArgs)
  const normalized = normalizePatchState(patchResult.stdout)

  return {
    ...file,
    patch: normalized.patch,
    state: patchResult.ok ? normalized.state : 'unavailable',
  }
}

async function buildUntrackedPatchFile(
  worktreePath: string,
  file: GitEntryFileSummary
): Promise<GitEntryFilePatch> {
  try {
    const absolutePath = resolve(worktreePath, file.path)
    const buffer = await readFile(absolutePath)

    if (buffer.byteLength > MAX_SYNTHETIC_TEXT_BYTES) {
      return {
        ...file,
        diff: unavailableFileDiff(),
        patch: null,
        state: 'too-large',
      }
    }

    if (buffer.includes(0)) {
      return {
        ...file,
        diff: unavailableFileDiff(),
        patch: null,
        state: 'binary',
      }
    }

    const text = buffer.toString('utf8')
    const lines = splitPatchLines(text)
    const hunkHeader = lines.length > 0 ? `@@ -0,0 +1,${lines.length} @@` : null
    const body = lines.map((line) => `+${line}`)
    const patch = [
      `diff --git a/${file.path} b/${file.path}`,
      'new file mode 100644',
      '--- /dev/null',
      `+++ b/${file.path}`,
      ...(hunkHeader ? [hunkHeader] : []),
      ...body,
    ].join('\n')

    return {
      ...file,
      diff: readyFileDiff({ files: 1, insertions: lines.length, deletions: 0 }),
      patch: patch.trimEnd(),
      state: 'available',
    }
  } catch {
    return {
      ...file,
      diff: unavailableFileDiff(),
      patch: null,
      state: 'unavailable',
    }
  }
}

async function buildCommitShell(options: {
  worktreePath: string
  hash: string
  runGit: GitRunner
}): Promise<GitEntryShell> {
  const { worktreePath, hash, runGit } = options
  const [entry, nameStatusResult, numStatResult] = await Promise.all([
    readGitCommitEntryByHash({ worktreePath, hash, runGit }),
    runGit(worktreePath, ['show', '--name-status', '--find-renames', '--format=', hash]),
    runGit(worktreePath, ['show', '--numstat', '--format=', hash]),
  ])

  if (!entry) {
    return { entry: null, files: [] }
  }

  const statuses = nameStatusResult.ok ? parseGitNameStatus(nameStatusResult.stdout) : []
  return {
    entry,
    files: buildTrackedFileSummaries(statuses, numStatResult.stdout),
  }
}

async function buildUncommittedShell(options: {
  worktreePath: string
  runGit: GitRunner
  readPathTimestampMs: PathTimestampReader
}): Promise<GitEntryShell> {
  const { worktreePath, runGit, readPathTimestampMs } = options
  const [entry, trackedStatusResult, trackedNumStatResult, untrackedResult] = await Promise.all([
    collectUncommittedEntrySummary({ worktreePath, runGit, readPathTimestampMs }),
    runGit(worktreePath, ['diff', '--name-status', '--find-renames', 'HEAD']),
    runGit(worktreePath, ['diff', '--numstat', 'HEAD']),
    runGit(worktreePath, ['ls-files', '--others', '--exclude-standard']),
  ])

  const trackedStatuses = trackedStatusResult.ok
    ? parseGitNameStatus(trackedStatusResult.stdout)
    : []
  const trackedFiles = buildTrackedFileSummaries(trackedStatuses, trackedNumStatResult.stdout)
  const untrackedFiles = untrackedResult.stdout
    .split('\n')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((path) => buildUntrackedFileSummary(path))

  return {
    entry,
    files: [...trackedFiles, ...untrackedFiles].sort((left, right) =>
      left.path.localeCompare(right.path)
    ),
  }
}

async function loadGitEntryShell(
  options: GitPanelDataOptions & { selector: GitEntrySelector }
): Promise<GitEntryShell> {
  const runGit = options.runGit ?? defaultRunGit
  const readPathTimestampMs = options.readPathTimestampMs ?? defaultReadPathTimestampMs
  const resolvedProjectDir = resolve(options.projectDir)

  if (options.selector.type === 'uncommitted') {
    return buildUncommittedShell({
      worktreePath: resolvedProjectDir,
      runGit,
      readPathTimestampMs,
    })
  }

  return buildCommitShell({
    worktreePath: resolvedProjectDir,
    hash: options.selector.hash,
    runGit,
  })
}

export async function buildGitWorktreeOverview(
  options: GitPanelDataOptions
): Promise<GitWorktreeOverview> {
  const resolvedProjectDir = resolve(options.projectDir)

  return getCachedGitPanelValue('overview', resolvedProjectDir, 'overview', async () => {
    const runGit = options.runGit ?? defaultRunGit
    const defaultBranch = await resolveDefaultBranch(resolvedProjectDir, runGit)
    const worktrees = await listGitWorktrees(resolvedProjectDir, runGit)
    const summaries = await Promise.all(
      worktrees.map((worktree) =>
        collectWorktreeSummary({
          projectDir: resolvedProjectDir,
          worktree,
          defaultBranch,
          runGit,
        })
      )
    )

    summaries.sort((left, right) => {
      if (left.isCurrent !== right.isCurrent) return left.isCurrent ? -1 : 1
      return left.branchName.localeCompare(right.branchName)
    })

    return {
      defaultBranch,
      currentWorktree: summaries.find((worktree) => worktree.isCurrent) ?? null,
      otherWorktrees: summaries.filter((worktree) => !worktree.isCurrent),
    }
  })
}

export async function listCurrentWorktreeGitEntries(
  options: GitPanelDataOptions & { cursor?: string; limit?: number }
): Promise<GitEntriesPage> {
  const resolvedProjectDir = resolve(options.projectDir)
  const limit = clampEntryLimit(options.limit)
  const offset = parseCursor(options.cursor)

  return getCachedGitPanelValue(
    'entries',
    resolvedProjectDir,
    `entries:${offset}:${limit}`,
    async () => {
      const runGit = options.runGit ?? defaultRunGit
      const readPathTimestampMs = options.readPathTimestampMs ?? defaultReadPathTimestampMs
      const defaultBranch = await resolveDefaultBranch(resolvedProjectDir, runGit)
      const uncommitted = await collectUncommittedEntrySummary({
        worktreePath: resolvedProjectDir,
        runGit,
        readPathTimestampMs,
      })
      const includeUncommitted = offset === 0 && uncommitted.diff.files > 0
      const commitLimit = includeUncommitted ? Math.max(0, limit - 1) : limit
      const commitsPage =
        commitLimit > 0
          ? await listGitCommitEntriesPage({
              worktreePath: resolvedProjectDir,
              defaultBranch,
              offset,
              limit: commitLimit,
              runGit,
            })
          : { items: [], nextCursor: null }

      return {
        items: includeUncommitted ? [uncommitted, ...commitsPage.items] : commitsPage.items,
        nextCursor: commitsPage.nextCursor,
      }
    }
  )
}

export async function getCurrentWorktreeGitEntryShell(
  options: GitPanelDataOptions & { selector: GitEntrySelector }
): Promise<GitEntryShell> {
  const resolvedProjectDir = resolve(options.projectDir)
  const selectorKey =
    options.selector.type === 'commit' ? `commit:${options.selector.hash}` : 'uncommitted'

  return getCachedGitPanelValue('shell', resolvedProjectDir, selectorKey, () =>
    loadGitEntryShell({ ...options, projectDir: resolvedProjectDir })
  )
}

export async function getCurrentWorktreeGitEntryPatch(
  options: GitPanelDataOptions & { selector: GitEntrySelector; fileId: string }
): Promise<GitEntryPatch> {
  const resolvedProjectDir = resolve(options.projectDir)
  const selectorKey =
    options.selector.type === 'commit' ? `commit:${options.selector.hash}` : 'uncommitted'

  return getCachedGitPanelValue(
    'patch',
    resolvedProjectDir,
    `${selectorKey}:${options.fileId}`,
    async () => {
      const runGit = options.runGit ?? defaultRunGit
      const shell = await getCurrentWorktreeGitEntryShell({
        ...options,
        projectDir: resolvedProjectDir,
      })
      const file = shell.files.find((candidate) => candidate.fileId === options.fileId) ?? null

      if (!shell.entry || !file) {
        return {
          entry: shell.entry,
          file: null,
        }
      }

      const patch =
        file.source === 'untracked'
          ? await buildUntrackedPatchFile(resolvedProjectDir, file)
          : await buildTrackedPatchFile({
              worktreePath: resolvedProjectDir,
              file,
              runGit,
              selector: options.selector,
            })

      return {
        entry: shell.entry,
        file: patch,
      }
    }
  )
}

export async function getCurrentWorktreeGitEntryDetail(
  options: GitPanelDataOptions & { selector: GitEntrySelector }
): Promise<GitEntryDetail> {
  const shell = await getCurrentWorktreeGitEntryShell(options)
  if (!shell.entry) {
    return { entry: null, files: [] }
  }

  const patches = await Promise.all(
    shell.files.map(async (file) => {
      const patch = await getCurrentWorktreeGitEntryPatch({
        ...options,
        fileId: file.fileId,
      })
      return patch.file
    })
  )

  return {
    entry: shell.entry,
    files: patches.filter((file): file is GitEntryFilePatch => file !== null),
  }
}
