import type {
  DashboardGitCommitEntry,
  DashboardGitEntry,
  DashboardGitUncommittedEntry,
} from '@openspecui/core'
import { resolve } from 'node:path'

import {
  defaultReadPathTimestampMs,
  EMPTY_DIFF,
  extractGitPathVariants,
  parseRelatedChanges,
  type GitRunner,
  type PathTimestampReader,
} from './git-shared.js'

interface GitCommitStatRecord {
  hash: string
  committedAt: number
  title: string
  diff: DashboardGitCommitEntry['diff']
  changedPaths: string[]
}

function createEmptyCommitRecord(
  hash: string,
  committedAt: number,
  title: string
): GitCommitStatRecord {
  return {
    hash,
    committedAt,
    title,
    diff: { ...EMPTY_DIFF },
    changedPaths: [],
  }
}

function parseGitLogNumstatRecords(stdout: string): GitCommitStatRecord[] {
  const records: GitCommitStatRecord[] = []

  for (const block of stdout.split('\u001e')) {
    const trimmedBlock = block.trim()
    if (!trimmedBlock) continue

    const lines = trimmedBlock.split('\n')
    const header = lines.shift()?.trim()
    if (!header) continue

    const [hash, committedAtRaw = '0', title = ''] = header.split('\u001f')
    if (!hash) continue

    const committedAtSeconds = Number(committedAtRaw)
    const committedAt =
      Number.isFinite(committedAtSeconds) && committedAtSeconds > 0 ? committedAtSeconds * 1000 : 0
    const record = createEmptyCommitRecord(hash, committedAt, title.trim() || hash.slice(0, 7))

    for (const line of lines) {
      const trimmedLine = line.trim()
      if (!trimmedLine) continue

      const parts = trimmedLine.split('\t')
      if (parts.length < 3) continue

      const [insertionsRaw = '0', deletionsRaw = '0', ...pathParts] = parts
      const rawPath = pathParts.join('\t').trim()
      if (!rawPath) continue

      record.diff.files += 1
      if (insertionsRaw !== '-') record.diff.insertions += Number(insertionsRaw) || 0
      if (deletionsRaw !== '-') record.diff.deletions += Number(deletionsRaw) || 0
      record.changedPaths.push(...extractGitPathVariants(rawPath))
    }

    records.push(record)
  }

  return records
}

export async function listGitCommitEntriesPage(options: {
  worktreePath: string
  defaultBranch: string
  offset: number
  limit: number
  runGit: GitRunner
}): Promise<{
  items: DashboardGitCommitEntry[]
  nextCursor: string | null
}> {
  const { worktreePath, defaultBranch, offset, limit, runGit } = options
  const commits = await runGit(worktreePath, [
    'log',
    '--format=%x1e%H%x1f%ct%x1f%s',
    '--numstat',
    `--skip=${offset}`,
    `-n${limit + 1}`,
    `${defaultBranch}..HEAD`,
  ])

  if (!commits.ok) {
    return { items: [], nextCursor: null }
  }

  const records = parseGitLogNumstatRecords(commits.stdout)
  const pageRecords = records.slice(0, limit)

  return {
    items: pageRecords.map<DashboardGitCommitEntry>((record) => ({
      type: 'commit',
      hash: record.hash,
      title: record.title,
      committedAt: record.committedAt,
      relatedChanges: parseRelatedChanges(record.changedPaths),
      diff: record.diff,
    })),
    nextCursor: records.length > limit ? String(offset + limit) : null,
  }
}

export async function readGitCommitEntryByHash(options: {
  worktreePath: string
  hash: string
  runGit: GitRunner
}): Promise<DashboardGitCommitEntry | null> {
  const { worktreePath, hash, runGit } = options
  const result = await runGit(worktreePath, [
    'show',
    '--numstat',
    '--format=%x1e%H%x1f%ct%x1f%s',
    hash,
  ])
  if (!result.ok) return null

  const record = parseGitLogNumstatRecords(result.stdout)[0]
  if (!record) return null

  return {
    type: 'commit',
    hash: record.hash,
    title: record.title,
    committedAt: record.committedAt,
    relatedChanges: parseRelatedChanges(record.changedPaths),
    diff: record.diff,
  }
}

export async function collectUncommittedEntrySummary(options: {
  worktreePath: string
  runGit: GitRunner
  readPathTimestampMs?: PathTimestampReader
}): Promise<DashboardGitUncommittedEntry> {
  const { worktreePath, runGit } = options
  const readPathTimestampMs = options.readPathTimestampMs ?? defaultReadPathTimestampMs
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

  const trackedDiff =
    parseGitLogNumstatRecords(`\u001ehead\u001f0\u001fUncommitted\n${trackedResult.stdout}`)[0]
      ?.diff ?? EMPTY_DIFF
  const allUncommittedFiles = new Set<string>([...trackedFiles, ...untrackedFiles])
  const updatedAtCandidates = await Promise.all(
    [...allUncommittedFiles].map((path) => readPathTimestampMs(resolve(worktreePath, path)))
  )
  const updatedAt =
    updatedAtCandidates.reduce<number | null>((latest, current) => {
      if (!current || !Number.isFinite(current) || current <= 0) return latest
      return latest === null || current > latest ? current : latest
    }, null) ?? null

  return {
    type: 'uncommitted',
    title: 'Uncommitted',
    updatedAt,
    relatedChanges: parseRelatedChanges([...allUncommittedFiles]),
    diff: {
      files: allUncommittedFiles.size,
      insertions: trackedDiff.insertions,
      deletions: trackedDiff.deletions,
    },
  }
}

export async function listRecentGitEntries(options: {
  worktreePath: string
  defaultBranch: string
  maxCommitEntries: number
  runGit: GitRunner
  readPathTimestampMs?: PathTimestampReader
}): Promise<DashboardGitEntry[]> {
  const { worktreePath, defaultBranch, maxCommitEntries, runGit, readPathTimestampMs } = options
  const [uncommitted, commitsPage] = await Promise.all([
    collectUncommittedEntrySummary({ worktreePath, runGit, readPathTimestampMs }),
    listGitCommitEntriesPage({
      worktreePath,
      defaultBranch,
      offset: 0,
      limit: maxCommitEntries,
      runGit,
    }),
  ])

  return [uncommitted, ...commitsPage.items]
}
