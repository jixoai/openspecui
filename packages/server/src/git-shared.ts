import { execFile } from 'node:child_process'
import { realpath, stat } from 'node:fs/promises'
import { relative, resolve } from 'node:path'
import { promisify } from 'node:util'

import type { DashboardGitDiffStats } from '@openspecui/core'

const execFileAsync = promisify(execFile)

export interface GitCommandResult {
  ok: boolean
  stdout: string
}

export type GitRunner = (cwd: string, args: string[]) => Promise<GitCommandResult>
export type PathTimestampReader = (absolutePath: string) => Promise<number | null>

export interface ParsedWorktree {
  path: string
  branchRef: string | null
  detached: boolean
}

export const EMPTY_DIFF: DashboardGitDiffStats = {
  files: 0,
  insertions: 0,
  deletions: 0,
}

export async function defaultRunGit(cwd: string, args: string[]): Promise<GitCommandResult> {
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

export async function defaultReadPathTimestampMs(absolutePath: string): Promise<number | null> {
  try {
    const stats = await stat(absolutePath)
    return Number.isFinite(stats.mtimeMs) && stats.mtimeMs > 0 ? stats.mtimeMs : null
  } catch {
    return null
  }
}

export async function pathExists(absolutePath: string): Promise<boolean> {
  try {
    await stat(absolutePath)
    return true
  } catch {
    return false
  }
}

export function parseShortStat(output: string): DashboardGitDiffStats {
  const files = Number(/(\d+)\s+files? changed/.exec(output)?.[1] ?? 0)
  const insertions = Number(/(\d+)\s+insertions?\(\+\)/.exec(output)?.[1] ?? 0)
  const deletions = Number(/(\d+)\s+deletions?\(-\)/.exec(output)?.[1] ?? 0)
  return {
    files: Number.isFinite(files) ? files : 0,
    insertions: Number.isFinite(insertions) ? insertions : 0,
    deletions: Number.isFinite(deletions) ? deletions : 0,
  }
}

export function parseNumStat(output: string): DashboardGitDiffStats {
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

export function normalizeGitPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '')
}

export function extractGitPathVariants(rawPath: string): string[] {
  const trimmed = rawPath.trim()
  if (!trimmed) return []

  const normalizedRaw = normalizeGitPath(trimmed)

  const braceRenameMatch = /^(.*?)\{(.*?) => (.*?)\}(.*)$/.exec(trimmed)
  if (braceRenameMatch) {
    const [, prefix = '', left = '', right = '', suffix = ''] = braceRenameMatch
    const variants = new Set<string>()
    variants.add(normalizeGitPath(`${prefix}${left}${suffix}`))
    variants.add(normalizeGitPath(`${prefix}${right}${suffix}`))
    return [...variants]
  }

  const renameParts = trimmed.split(' => ')
  if (renameParts.length === 2) {
    const [left = '', right = ''] = renameParts
    const variants = new Set<string>()
    variants.add(normalizeGitPath(left))
    variants.add(normalizeGitPath(right))
    return [...variants]
  }

  return [normalizedRaw]
}

export function relativePath(fromDir: string, target: string): string {
  const rel = relative(fromDir, target)
  if (!rel || rel.length === 0) return '.'
  return rel
}

export async function canonicalGitPath(path: string): Promise<string> {
  const resolved = resolve(path)
  try {
    return await realpath(resolved)
  } catch {
    return resolved
  }
}

export async function sameGitPath(left: string, right: string): Promise<boolean> {
  const [canonicalLeft, canonicalRight] = await Promise.all([
    canonicalGitPath(left),
    canonicalGitPath(right),
  ])
  return canonicalLeft === canonicalRight
}

export function parseBranchName(branchRef: string | null, detached: boolean): string {
  if (detached) return '(detached)'
  if (!branchRef) return '(unknown)'
  return branchRef.replace(/^refs\/heads\//, '')
}

export function parseWorktreeList(porcelain: string): ParsedWorktree[] {
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
    }
  }

  flush()
  return entries
}

export function parseRelatedChanges(paths: string[]): string[] {
  const related = new Set<string>()

  for (const path of paths) {
    const normalized = normalizeGitPath(path)
    if (normalized.includes('{') || normalized.includes('=>')) {
      continue
    }
    const archiveMatch = /^openspec\/changes\/archive\/([^/]+)\//.exec(normalized)
    if (archiveMatch?.[1]) {
      related.add(archiveMatch[1].replace(/^\d{4}-\d{2}-\d{2}-/, ''))
      continue
    }

    const activeMatch = /^openspec\/changes\/([^/]+)\//.exec(normalized)
    if (activeMatch?.[1]) {
      related.add(activeMatch[1])
      continue
    }
  }

  return [...related].sort((a, b) => a.localeCompare(b))
}

export async function resolveDefaultBranch(projectDir: string, runGit: GitRunner): Promise<string> {
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

export async function listGitWorktrees(
  projectDir: string,
  runGit: GitRunner
): Promise<ParsedWorktree[]> {
  const resolvedProjectDir = resolve(projectDir)
  const worktreeResult = await runGit(resolvedProjectDir, ['worktree', 'list', '--porcelain'])
  const parsed = worktreeResult.ok ? parseWorktreeList(worktreeResult.stdout) : []

  if (parsed.length > 0) {
    return parsed
  }

  return [
    {
      path: resolvedProjectDir,
      branchRef: null,
      detached: false,
    },
  ]
}
