import type {
  DashboardGitDiffStats,
  DashboardGitEntry,
  GitEntriesPage,
  GitEntryDetail,
  GitEntryFileDiff,
  GitEntryFilePatch,
  GitEntryFiles,
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
  normalizeGitPath,
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

interface GitEntrySnapshot {
  entry: DashboardGitEntry | null
  files: GitEntryFileSummary[]
  patchByFileId: Map<string, GitEntryFilePatch>
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

function buildSelectorCacheKey(selector: GitEntrySelector): string {
  return selector.type === 'commit' ? `commit:${selector.hash}` : 'uncommitted'
}

function buildTrackedPatchArgs(selector: GitEntrySelector): string[] {
  return selector.type === 'commit'
    ? ['show', '--patch', '--find-renames', '--format=', selector.hash]
    : ['diff', '--patch', '--find-renames', 'HEAD']
}

function decodeGitPatchPathToken(token: string): string | null {
  const trimmed = token.trim()
  if (!trimmed || trimmed === '/dev/null') {
    return null
  }

  let value = trimmed
  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    value = value
      .slice(1, -1)
      .replace(/\\([\\"])/g, '$1')
      .replace(/\\t/g, '\t')
      .replace(/\\n/g, '\n')
  }

  if (value === '/dev/null') {
    return null
  }

  if (value.startsWith('a/') || value.startsWith('b/')) {
    return normalizeGitPath(value.slice(2))
  }

  return normalizeGitPath(value)
}

function parseDiffGitHeaderPaths(line: string): { oldPath: string | null; newPath: string | null } {
  const rest = line.slice('diff --git '.length).trim()
  const quotedMatch = /^"a\/((?:[^"\\]|\\.)+)" "b\/((?:[^"\\]|\\.)+)"$/.exec(rest)
  if (quotedMatch) {
    return {
      oldPath: decodeGitPatchPathToken(`"a/${quotedMatch[1] ?? ''}"`),
      newPath: decodeGitPatchPathToken(`"b/${quotedMatch[2] ?? ''}"`),
    }
  }

  const plainMatch = /^a\/(.+?) b\/(.+)$/.exec(rest)
  if (plainMatch) {
    return {
      oldPath: decodeGitPatchPathToken(`a/${plainMatch[1] ?? ''}`),
      newPath: decodeGitPatchPathToken(`b/${plainMatch[2] ?? ''}`),
    }
  }

  return { oldPath: null, newPath: null }
}

function splitTrackedPatchBlocks(stdout: string): string[] {
  const lines = splitPatchLines(stdout)
  const blocks: string[] = []
  let current: string[] = []

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      if (current.length > 0) {
        blocks.push(current.join('\n'))
      }
      current = [line]
      continue
    }

    if (current.length > 0) {
      current.push(line)
    }
  }

  if (current.length > 0) {
    blocks.push(current.join('\n'))
  }

  return blocks
}

function resolveTrackedPatchBlockIdentity(block: string): {
  fileIdCandidates: string[]
  pathCandidates: string[]
} {
  const lines = splitPatchLines(block)
  const pathCandidates = new Set<string>()
  const fileIdCandidates = new Set<string>()

  let oldPath: string | null = null
  let newPath: string | null = null
  let renameFrom: string | null = null
  let renameTo: string | null = null

  const headerLine = lines[0]
  if (headerLine?.startsWith('diff --git ')) {
    const parsed = parseDiffGitHeaderPaths(headerLine)
    oldPath = parsed.oldPath
    newPath = parsed.newPath
  }

  for (const line of lines) {
    if (line.startsWith('rename from ') || line.startsWith('copy from ')) {
      renameFrom = normalizeGitPath(line.slice(line.indexOf(' from ') + ' from '.length).trim())
      continue
    }

    if (line.startsWith('rename to ') || line.startsWith('copy to ')) {
      renameTo = normalizeGitPath(line.slice(line.indexOf(' to ') + ' to '.length).trim())
      continue
    }

    if (line.startsWith('--- ')) {
      oldPath = decodeGitPatchPathToken(line.slice(4))
      continue
    }

    if (line.startsWith('+++ ')) {
      newPath = decodeGitPatchPathToken(line.slice(4))
    }
  }

  if (renameFrom) oldPath = renameFrom
  if (renameTo) newPath = renameTo

  if (newPath) {
    pathCandidates.add(newPath)
    fileIdCandidates.add(createGitFileId(newPath, null))
  }

  if (oldPath) {
    pathCandidates.add(oldPath)
    fileIdCandidates.add(createGitFileId(oldPath, null))
  }

  if (newPath && oldPath && newPath !== oldPath) {
    fileIdCandidates.add(createGitFileId(newPath, oldPath))
  }

  return {
    fileIdCandidates: [...fileIdCandidates],
    pathCandidates: [...pathCandidates],
  }
}

function buildTrackedPatchLookup(
  files: readonly GitEntryFileSummary[],
  stdout: string
): Map<string, string> {
  const trackedFiles = files.filter((file) => file.source === 'tracked')
  const fileIds = new Set(trackedFiles.map((file) => file.fileId))
  const fileIdsByPath = new Map<string, string[]>()

  for (const file of trackedFiles) {
    const pathCandidates = new Set<string>([file.path])
    if (file.previousPath) {
      pathCandidates.add(file.previousPath)
    }

    for (const path of pathCandidates) {
      const current = fileIdsByPath.get(path) ?? []
      current.push(file.fileId)
      fileIdsByPath.set(path, current)
    }
  }

  const patchByFileId = new Map<string, string>()

  for (const block of splitTrackedPatchBlocks(stdout)) {
    const identity = resolveTrackedPatchBlockIdentity(block)
    const directMatch = identity.fileIdCandidates.find((fileId) => fileIds.has(fileId))
    let matchedFileId = directMatch ?? null

    if (!matchedFileId) {
      for (const path of identity.pathCandidates) {
        const candidates = fileIdsByPath.get(path)
        if (!candidates || candidates.length === 0) {
          continue
        }
        matchedFileId =
          candidates.find((fileId) => !patchByFileId.has(fileId)) ?? candidates[0] ?? null
        if (matchedFileId) {
          break
        }
      }
    }

    if (matchedFileId && !patchByFileId.has(matchedFileId)) {
      patchByFileId.set(matchedFileId, block.trimEnd())
    }
  }

  return patchByFileId
}

function buildTrackedPatchFile(
  file: GitEntryFileSummary,
  rawPatch: string | null,
  available: boolean
): GitEntryFilePatch {
  const normalized = normalizePatchState(rawPatch ?? '')

  return {
    ...file,
    patch: available ? normalized.patch : null,
    state: available ? normalized.state : 'unavailable',
  }
}

function countPatchLines(file: GitEntryFilePatch): number {
  return file.patch ? splitPatchLines(file.patch).length : 0
}

function projectGitEntryFiles(
  snapshot: GitEntrySnapshot,
  eagerPatchLineBudget: number
): GitEntryFiles {
  if (eagerPatchLineBudget <= 0) {
    return {
      files: snapshot.files,
      eagerFiles: [],
      eagerPatchLineBudget,
      eagerPatchLineCount: 0,
    }
  }

  const eagerFiles: GitEntryFilePatch[] = []
  let eagerPatchLineCount = 0

  for (const file of snapshot.files) {
    if (eagerPatchLineCount >= eagerPatchLineBudget) {
      break
    }

    const patch = snapshot.patchByFileId.get(file.fileId)
    if (!patch) {
      continue
    }

    eagerFiles.push(patch)
    eagerPatchLineCount += countPatchLines(patch)
  }

  return {
    files: snapshot.files,
    eagerFiles,
    eagerPatchLineBudget,
    eagerPatchLineCount,
  }
}

async function buildGitEntrySnapshot(
  options: GitPanelDataOptions & { selector: GitEntrySelector }
): Promise<GitEntrySnapshot> {
  const runGit = options.runGit ?? defaultRunGit
  const resolvedProjectDir = resolve(options.projectDir)
  const shell = await loadGitEntryShell({ ...options, projectDir: resolvedProjectDir })

  if (!shell.entry) {
    return {
      entry: null,
      files: [],
      patchByFileId: new Map(),
    }
  }

  const trackedFiles = shell.files.filter((file) => file.source === 'tracked')
  const trackedPatchPromise =
    trackedFiles.length > 0
      ? runGit(resolvedProjectDir, buildTrackedPatchArgs(options.selector))
      : Promise.resolve({ ok: true, stdout: '' })

  const untrackedPatchPromise = Promise.all(
    shell.files
      .filter((file) => file.source === 'untracked')
      .map(
        async (file) =>
          [file.fileId, await buildUntrackedPatchFile(resolvedProjectDir, file)] as const
      )
  )

  const [trackedPatchResult, untrackedPatches] = await Promise.all([
    trackedPatchPromise,
    untrackedPatchPromise,
  ])

  const trackedPatchLookup = trackedPatchResult.ok
    ? buildTrackedPatchLookup(shell.files, trackedPatchResult.stdout)
    : new Map<string, string>()
  const patchByFileId = new Map<string, GitEntryFilePatch>(untrackedPatches)

  for (const file of trackedFiles) {
    patchByFileId.set(
      file.fileId,
      buildTrackedPatchFile(
        file,
        trackedPatchLookup.get(file.fileId) ?? null,
        trackedPatchResult.ok
      )
    )
  }

  return {
    entry: shell.entry,
    files: shell.files,
    patchByFileId,
  }
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
  const selectorKey = buildSelectorCacheKey(options.selector)

  return getCachedGitPanelValue('shell', resolvedProjectDir, selectorKey, () =>
    loadGitEntryShell({ ...options, projectDir: resolvedProjectDir })
  )
}

export async function getCurrentWorktreeGitEntryMeta(
  options: GitPanelDataOptions & { selector: GitEntrySelector }
): Promise<DashboardGitEntry | null> {
  const resolvedProjectDir = resolve(options.projectDir)
  const selectorKey = buildSelectorCacheKey(options.selector)

  return getCachedGitPanelValue('meta', resolvedProjectDir, selectorKey, async () => {
    const shell = await getCurrentWorktreeGitEntryShell({
      ...options,
      projectDir: resolvedProjectDir,
    })
    return shell.entry
  })
}

async function getCurrentWorktreeGitEntrySnapshot(
  options: GitPanelDataOptions & { selector: GitEntrySelector }
): Promise<GitEntrySnapshot> {
  const resolvedProjectDir = resolve(options.projectDir)
  const selectorKey = buildSelectorCacheKey(options.selector)

  return getCachedGitPanelValue('snapshot', resolvedProjectDir, selectorKey, () =>
    buildGitEntrySnapshot({ ...options, projectDir: resolvedProjectDir })
  )
}

export async function getCurrentWorktreeGitEntryFiles(
  options: GitPanelDataOptions & {
    selector: GitEntrySelector
    eagerPatchLineBudget: number
  }
): Promise<GitEntryFiles> {
  const snapshot = await getCurrentWorktreeGitEntrySnapshot(options)
  return projectGitEntryFiles(snapshot, options.eagerPatchLineBudget)
}

export async function getCurrentWorktreeGitEntryPatch(
  options: GitPanelDataOptions & { selector: GitEntrySelector; fileId: string }
): Promise<GitEntryPatch> {
  const snapshot = await getCurrentWorktreeGitEntrySnapshot(options)
  return {
    file: snapshot.patchByFileId.get(options.fileId) ?? null,
  }
}

export async function getCurrentWorktreeGitEntryDetail(
  options: GitPanelDataOptions & { selector: GitEntrySelector }
): Promise<GitEntryDetail> {
  const snapshot = await getCurrentWorktreeGitEntrySnapshot(options)
  if (!snapshot.entry) {
    return { entry: null, files: [] }
  }

  return {
    entry: snapshot.entry,
    files: snapshot.files.flatMap((file) => {
      const patch = snapshot.patchByFileId.get(file.fileId)
      return patch ? [patch] : []
    }),
  }
}
