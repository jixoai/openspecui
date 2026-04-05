import { cn } from '@/lib/utils'
import type { GitEntryFilePatch, GitEntryFileSummary } from '@openspecui/core'
import { FileCode2, FileWarning, LoaderCircle } from 'lucide-react'
import { memo, useCallback } from 'react'

import { DiffStat } from './git-shared'

export type GitPatchCardStatus = 'idle' | 'loading' | 'error' | 'ready'

function changeTypeTone(changeType: GitEntryFileSummary['changeType']): string {
  switch (changeType) {
    case 'added':
      return 'border-emerald-500/40 bg-emerald-500/12 text-emerald-700 dark:border-emerald-300/45 dark:bg-emerald-400/20 dark:text-emerald-100'
    case 'deleted':
      return 'border-rose-500/40 bg-rose-500/12 text-rose-700 dark:border-rose-300/45 dark:bg-rose-400/20 dark:text-rose-100'
    case 'renamed':
    case 'copied':
      return 'border-sky-500/40 bg-sky-500/12 text-sky-700 dark:border-sky-300/45 dark:bg-sky-400/20 dark:text-sky-100'
    case 'modified':
      return 'border-amber-500/40 bg-amber-500/12 text-amber-700 dark:border-amber-300/45 dark:bg-amber-400/20 dark:text-amber-100'
    default:
      return 'border-zinc-500/35 bg-zinc-500/10 text-zinc-700 dark:border-zinc-300/40 dark:bg-zinc-300/15 dark:text-zinc-100'
  }
}

function patchStateMessage(file: GitEntryFilePatch | null): string {
  if (!file) return 'Patch preview is unavailable for this file.'

  switch (file.state) {
    case 'binary':
      return 'Binary file. Patch preview is unavailable.'
    case 'too-large':
      return 'Patch is too large to preview in the panel.'
    case 'unavailable':
      return 'Patch preview is unavailable for this file.'
    default:
      return ''
  }
}

function patchCardTitle(file: GitEntryFileSummary): string {
  if (file.previousPath && (file.changeType === 'renamed' || file.changeType === 'copied')) {
    return file.path
  }
  return file.displayPath
}

function renderPatchLine(line: string, index: number) {
  let tone = 'readonly-diff-line'

  if (line.startsWith('diff --git') || line.startsWith('index ') || line.startsWith('@@')) {
    tone = 'readonly-diff-line readonly-diff-line-meta'
  } else if (line.startsWith('+') && !line.startsWith('+++')) {
    tone = 'readonly-diff-line readonly-diff-line-add'
  } else if (line.startsWith('-') && !line.startsWith('---')) {
    tone = 'readonly-diff-line readonly-diff-line-del'
  } else if (line.startsWith('+++') || line.startsWith('---')) {
    tone = 'readonly-diff-line readonly-diff-line-file'
  }

  return (
    <div key={`${index}:${line.slice(0, 16)}`} className={tone}>
      {line || ' '}
    </div>
  )
}

function GitPatchCardImpl({
  file,
  patch,
  status,
  error,
  onRegisterCard,
  scrollMarginTop,
}: {
  file: GitEntryFileSummary
  patch: GitEntryFilePatch | null
  status: GitPatchCardStatus
  error: Error | null
  onRegisterCard?: (fileId: string, node: HTMLElement | null) => void
  scrollMarginTop?: number
}) {
  const message = patchStateMessage(patch)
  const handleRef = useCallback(
    (node: HTMLElement | null) => {
      onRegisterCard?.(file.fileId, node)
    },
    [file.fileId, onRegisterCard]
  )

  return (
    <section
      data-file-id={file.fileId}
      ref={handleRef}
      style={scrollMarginTop ? { scrollMarginTop: `${scrollMarginTop}px` } : undefined}
      className="overflow-hidden rounded-md border border-zinc-500/20"
    >
      <header className="bg-card flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <FileCode2 className="text-muted-foreground h-4 w-4 shrink-0" />
            <span className="min-w-0 text-sm font-medium leading-5 [overflow-wrap:anywhere]">
              {patchCardTitle(file)}
            </span>
          </div>
          {file.previousPath ? (
            <div className="text-muted-foreground pl-6 text-[11px] leading-4 [overflow-wrap:anywhere]">
              from {file.previousPath}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span
            className={cn(
              'inline-flex items-center rounded border px-[0.35rem] py-0 text-[10px] font-medium uppercase tracking-wide',
              changeTypeTone(file.changeType)
            )}
          >
            {file.changeType}
          </span>
          <DiffStat diff={patch?.diff ?? file.diff} />
        </div>
      </header>

      {status === 'loading' || status === 'idle' ? (
        <div className="readonly-code-surface text-muted-foreground flex items-center gap-2 px-3 py-3 text-sm">
          <LoaderCircle
            className={cn('h-4 w-4 shrink-0', status === 'loading' && 'animate-spin')}
          />
          <span>{status === 'loading' ? 'Loading patch…' : 'Patch loads when visible.'}</span>
        </div>
      ) : error ? (
        <div className="readonly-code-surface text-destructive flex items-start gap-2 px-3 py-3 text-sm">
          <FileWarning className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error.message}</span>
        </div>
      ) : patch?.patch ? (
        <pre className="readonly-code-surface scrollbar-thin scrollbar-track-transparent overflow-x-auto py-2 font-mono text-[11px] leading-5">
          {patch.patch.split('\n').map((line, index) => renderPatchLine(line, index))}
        </pre>
      ) : (
        <div className="readonly-code-surface text-muted-foreground flex items-start gap-2 px-3 py-3 text-sm">
          <FileWarning className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}
    </section>
  )
}

GitPatchCardImpl.displayName = 'GitPatchCard'

export const GitPatchCard = memo(GitPatchCardImpl)
