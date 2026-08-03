/**
 * Orthogonal intents (updated 2026-08-02 Asia/Shanghai):
 * 1. Present recoverable Active Root revision conflicts without acquiring mutation ownership.
 *
 * Original request (2026-08-01): stale saves must preserve the latest physical YAML for explicit user recovery.
 */
import { Button } from '@/components/button'
import type { ActiveRootConfigView } from '@/lib/use-planning-config'
import { RotateCcw, ShieldAlert } from 'lucide-react'

export interface ActiveRootConflictNoticeProps {
  latest: ActiveRootConfigView
  mode: 'structured' | 'raw'
  pending: boolean
  retryDisabled: boolean
  onReload(): void
  onRetry(): void
}

/** Revision-conflict presentation; draft and mutation ownership remain in the parent section. */
export function ActiveRootConflictNotice({
  latest,
  mode,
  pending,
  retryDisabled,
  onReload,
  onRetry,
}: ActiveRootConflictNoticeProps) {
  return (
    <div
      role="alert"
      className="space-y-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3"
    >
      <div className="flex items-start gap-2">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0">
          <p className="text-sm font-medium">Active Root changed after this draft was loaded.</p>
          <p className="text-muted-foreground mt-1 text-xs">
            The physical file was not overwritten. Review revision{' '}
            {latest.revision?.slice(0, 15) ?? 'latest'}
            before reloading or retrying.
          </p>
          {mode === 'raw' ? (
            <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
              Retrying Raw YAML replaces the complete latest document, including external changes.
            </p>
          ) : null}
        </div>
      </div>

      <details className="border-border bg-background/70 rounded-md border p-2">
        <summary className="cursor-pointer text-xs font-medium">
          Review latest physical YAML
        </summary>
        <pre className="text-muted-foreground mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap break-words text-xs">
          {latest.content ?? ''}
        </pre>
      </details>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" size="sm" disabled={pending} onClick={onReload}>
          <RotateCcw className="h-3.5 w-3.5" />
          Reload latest
        </Button>
        <Button size="sm" disabled={pending || retryDisabled} onClick={onRetry}>
          Retry against latest
        </Button>
      </div>
    </div>
  )
}
