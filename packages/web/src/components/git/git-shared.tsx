import type { DashboardGitAutoRefreshPreset } from '@/lib/dashboard-git'
import { getDashboardGitEntryTimestamp } from '@/lib/dashboard-git'
import { formatDateTime, formatRelativeTime } from '@/lib/format-time'
import {
  getSharedElementBinding,
  type SharedElementDescriptor,
  type SharedElementHandoff,
} from '@/lib/view-transitions/shared-elements'
import type {
  DashboardGitDiffStats,
  DashboardGitEntry,
  DashboardGitWorktree,
  GitEntryFileDiff,
  GitEntrySelector,
  GitWorktreeSummary,
} from '@openspecui/core'
import {
  Check,
  ChevronDown,
  Clock1,
  Clock3,
  Clock6,
  Copy,
  FolderOpen,
  FolderOpenDot,
  GitBranch,
  GitCommitHorizontal,
  LoaderCircle,
  Minus,
  Plus,
  Trash2,
} from 'lucide-react'
import { useCallback, useState } from 'react'

import { Tooltip } from '../tooltip'

export const GIT_WORKTREE_BORDER_CLASS = 'border-zinc-400/50'
export const GIT_WORKTREE_BG_CLASS = 'bg-zinc-500/8'
export const GIT_WORKTREE_LINE_CLASS = 'border-zinc-400/50'

function isReadyDiff(
  diff: DashboardGitDiffStats | GitEntryFileDiff
): diff is DashboardGitDiffStats | ({ state: 'ready' } & DashboardGitDiffStats) {
  return !('state' in diff) || diff.state === 'ready'
}

export function hasVisibleLineDiff(diff: DashboardGitDiffStats | GitEntryFileDiff): boolean {
  return isReadyDiff(diff) && (diff.insertions > 0 || diff.deletions > 0)
}

export function formatRelatedChanges(relatedChanges: string[]): string {
  if (relatedChanges.length === 0) return 'linked openspec changes: none'
  if (relatedChanges.length === 1) return `linked openspec changes: ${relatedChanges[0]}`
  return `linked openspec changes: ${relatedChanges.join(', ')}`
}

export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//.test(value)
}

export async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'absolute'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

export function GitAutoRefreshPresetIcon({ preset }: { preset: DashboardGitAutoRefreshPreset }) {
  if (preset === '30s') return <Clock1 className="h-3.5 w-3.5" />
  if (preset === '5min') return <Clock3 className="h-3.5 w-3.5" />
  if (preset === '30min') return <Clock6 className="h-3.5 w-3.5" />
  return <ChevronDown className="h-3.5 w-3.5" />
}

export function getGitEntryEntityId(entry: DashboardGitEntry | GitEntrySelector): string {
  return entry.type === 'commit' ? entry.hash : 'uncommitted'
}

export function getGitEntrySharedDescriptor(
  entry: DashboardGitEntry | GitEntrySelector
): SharedElementDescriptor {
  return {
    family: 'git',
    entityId: getGitEntryEntityId(entry),
  }
}

export function getGitEntrySharedHandoff(entry: DashboardGitEntry): SharedElementHandoff {
  return {
    family: 'git',
    entityId: getGitEntryEntityId(entry),
    title: entry.title,
    subtitle:
      entry.type === 'commit'
        ? `${entry.hash.slice(0, 8)} · ${formatRelatedChanges(entry.relatedChanges)}`
        : `working tree · ${formatRelatedChanges(entry.relatedChanges)}`,
  }
}

export function GitEntryRow({
  entry,
  selected = false,
  onSelect,
}: {
  entry: DashboardGitEntry
  selected?: boolean
  onSelect?: (entry: DashboardGitEntry, sourceElement: HTMLElement) => void
}) {
  const isCommit = entry.type === 'commit'
  const timestamp = getDashboardGitEntryTimestamp(entry)
  const timeLabel = timestamp
    ? formatRelativeTime(timestamp)
    : isCommit
      ? 'unknown time'
      : 'working tree'
  const timeTooltip = timestamp ? formatDateTime(timestamp) : undefined
  const sharedDescriptor = getGitEntrySharedDescriptor(entry)

  return (
    <button
      type="button"
      onClick={(event) => onSelect?.(entry, event.currentTarget)}
      {...getSharedElementBinding(sharedDescriptor, 'container')}
      className={`block w-full min-w-0 rounded-md border px-2 py-1.5 text-left ${
        isCommit ? 'bg-sky-500/7 border-sky-500/30' : 'bg-amber-500/7 border-amber-500/30'
      } ${selected ? 'ring-primary ring-1' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-medium">
            {isCommit ? (
              <GitCommitHorizontal
                {...getSharedElementBinding(sharedDescriptor, 'icon')}
                className="h-3.5 w-3.5 text-sky-600 dark:text-sky-300"
              />
            ) : (
              <LoaderCircle
                {...getSharedElementBinding(sharedDescriptor, 'icon')}
                className="h-3.5 w-3.5 text-amber-600 dark:text-amber-300"
              />
            )}
            <span {...getSharedElementBinding(sharedDescriptor, 'title')} className="truncate">
              {entry.title}
            </span>
          </div>
          <div className="text-muted-foreground truncate text-[11px]">
            {isCommit ? entry.hash.slice(0, 8) : 'working tree'} ·{' '}
            {formatRelatedChanges(entry.relatedChanges)}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="flex items-center justify-end gap-1">
            <GitFilesBadge files={entry.diff.files} />
            <DiffStat diff={entry.diff} className="justify-end" />
          </div>
          <Tooltip content={timeTooltip} delay={0}>
            <span
              className="text-muted-foreground hover:text-foreground mt-0.5 inline-flex min-h-5 items-center rounded-sm bg-transparent px-1 py-0 text-[10px]"
              title={timeTooltip}
            >
              {timeLabel}
            </span>
          </Tooltip>
        </div>
      </div>
    </button>
  )
}

export function WorktreeRow<TWorktree extends DashboardGitWorktree | GitWorktreeSummary>({
  worktree,
  emphasize,
  removing = false,
  onRemoveDetachedWorktree,
}: {
  worktree: TWorktree
  emphasize: boolean
  removing?: boolean
  onRemoveDetachedWorktree?: (worktree: TWorktree) => void | Promise<void>
}) {
  const isRemotePath = isHttpUrl(worktree.path)
  const canToggleRelativePath = !isRemotePath
  const canRemoveDetached = !isRemotePath && worktree.detached && !worktree.isCurrent
  const [showRelativePath, setShowRelativePath] = useState(false)
  const [copied, setCopied] = useState(false)
  const displayPath = isRemotePath
    ? worktree.path
    : showRelativePath
      ? worktree.relativePath
      : worktree.path

  const handleCopyPath = useCallback(async () => {
    try {
      await copyText(displayPath)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch (error) {
      console.error('[Git] Failed to copy worktree path:', error)
    }
  }, [displayPath])

  return (
    <div
      className={`min-w-0 rounded-e-md rounded-t-md border px-2.5 py-2 ${
        emphasize
          ? `${GIT_WORKTREE_BORDER_CLASS} ${GIT_WORKTREE_BG_CLASS}`
          : 'border-border/70 bg-muted/15'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <GitBranch className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{worktree.branchName}</span>
          </div>
          <div className="mt-0.5 flex min-w-0 items-center gap-1">
            {canToggleRelativePath ? (
              <button
                type="button"
                onClick={() => setShowRelativePath((current) => !current)}
                className="text-muted-foreground hover:text-foreground inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-transparent"
                title={showRelativePath ? 'Show absolute path' : 'Show relative path'}
                aria-label={showRelativePath ? 'Show absolute path' : 'Show relative path'}
              >
                {showRelativePath ? (
                  <FolderOpenDot className="h-3.5 w-3.5" />
                ) : (
                  <FolderOpen className="h-3.5 w-3.5" />
                )}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                void handleCopyPath()
              }}
              onDoubleClick={() => {
                if (!canToggleRelativePath) return
                setShowRelativePath((current) => !current)
              }}
              className="text-muted-foreground hover:text-foreground inline-flex min-w-0 flex-1 items-center gap-1 truncate text-left text-xs"
              title={displayPath}
              aria-label={`Copy ${showRelativePath && canToggleRelativePath ? 'relative' : 'absolute'} path for ${worktree.branchName}`}
            >
              <span className="truncate">{displayPath}</span>
              {copied ? (
                <Check className="h-3 w-3 shrink-0" />
              ) : (
                <Copy className="h-3 w-3 shrink-0" />
              )}
            </button>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="flex items-center justify-end gap-1">
            {canRemoveDetached ? (
              <button
                type="button"
                onClick={() => {
                  void onRemoveDetachedWorktree?.(worktree)
                }}
                disabled={removing}
                className="text-muted-foreground hover:text-destructive inline-flex h-5 w-5 items-center justify-center rounded border border-transparent disabled:cursor-not-allowed disabled:opacity-60"
                title="Remove detached worktree"
                aria-label="Remove detached worktree"
              >
                {removing ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </button>
            ) : null}
            <GitAheadBehindBadge ahead={worktree.ahead} behind={worktree.behind} />
            <GitFilesBadge files={worktree.diff.files} />
            <DiffStat diff={worktree.diff} className="justify-end" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function DiffStat({
  diff,
  className = '',
}: {
  diff: DashboardGitDiffStats | GitEntryFileDiff
  className?: string
}) {
  if (isReadyDiff(diff) && !hasVisibleLineDiff(diff)) {
    return null
  }

  if (!isReadyDiff(diff)) {
    return (
      <span
        className={`inline-flex items-center rounded border border-zinc-500/35 bg-zinc-500/10 px-[0.15rem] py-0 font-mono text-[10px] text-zinc-700 dark:border-zinc-300/40 dark:bg-zinc-300/15 dark:text-zinc-100 ${className}`}
      >
        {diff.state === 'loading' ? 'loading' : 'n/a'}
      </span>
    )
  }

  return (
    <div className={`flex items-center gap-1 text-[10px] ${className}`}>
      <span className="bg-emerald-500/12 inline-flex items-center gap-0.5 rounded border border-emerald-500/40 px-[0.15rem] py-0 font-mono text-[10px] text-emerald-700 dark:border-emerald-300/45 dark:bg-emerald-400/20 dark:text-emerald-100">
        <Plus className="h-2.5 w-2.5" />
        <span>{diff.insertions}</span>
      </span>
      <span className="bg-rose-500/12 inline-flex items-center gap-0.5 rounded border border-rose-500/40 px-[0.15rem] py-0 font-mono text-[10px] text-rose-700 dark:border-rose-300/45 dark:bg-rose-400/20 dark:text-rose-100">
        <Minus className="h-2.5 w-2.5" />
        <span>{diff.deletions}</span>
      </span>
    </div>
  )
}

export function GitFilesBadge({ files }: { files: number }) {
  if (files <= 0) {
    return null
  }

  return (
    <span className="inline-flex items-center rounded border border-zinc-500/35 bg-zinc-500/10 px-[0.15rem] py-0 font-mono text-[10px] text-zinc-700 dark:border-zinc-300/40 dark:bg-zinc-300/15 dark:text-zinc-100">
      {files}f
    </span>
  )
}

export function GitAheadBehindBadge({ ahead, behind }: { ahead: number; behind: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-zinc-500/35 bg-zinc-500/10 px-[0.15rem] py-0 font-mono text-[10px] text-zinc-700 dark:border-zinc-300/40 dark:bg-zinc-300/15 dark:text-zinc-100">
      <span>↑{ahead}</span>
      <span>↓{behind}</span>
    </span>
  )
}
