/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Render compact lifecycle and compatibility status labels for Settings OpenSpec surfaces.
 * 2. Present accepted compatible CLI lines as verified facts rather than warnings.
 *
 * Original request (2026-07-20): "Keep dense operational presentation."
 * Owner clarification (2026-07-31): "6.* 本身就是适配 1.6.*；对于 1.7 只是兼容而已。"
 */
import { AlertTriangle, CheckCircle, CircleDot, Loader2, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'

function statusTone(status: string): string {
  if (
    status === 'current' ||
    status === 'compatible' ||
    status === 'ready' ||
    status === 'initialized' ||
    status === 'in-sync'
  ) {
    return 'text-emerald-600 dark:text-emerald-300'
  }
  if (status === 'refreshing' || status === 'partial' || status === 'drift' || status === 'stale') {
    return 'text-amber-600 dark:text-amber-300'
  }
  if (
    status === 'loading' ||
    status === 'pending' ||
    status === 'unknown' ||
    status === 'uninitialized'
  ) {
    return 'text-muted-foreground'
  }
  return 'text-destructive'
}

/** Compact icon-plus-text state label shared by diagnostics and initialization. */
export function SettingsStatusLabel({ status, children }: { status: string; children: ReactNode }) {
  const Icon =
    status === 'current' ||
    status === 'compatible' ||
    status === 'ready' ||
    status === 'initialized' ||
    status === 'in-sync'
      ? CheckCircle
      : status === 'loading' || status === 'refreshing'
        ? Loader2
        : status === 'partial' || status === 'drift' || status === 'stale'
          ? AlertTriangle
          : status === 'pending' || status === 'unknown' || status === 'uninitialized'
            ? CircleDot
            : XCircle

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${statusTone(status)}`}>
      <Icon
        className={`h-3.5 w-3.5 shrink-0 ${status === 'loading' || status === 'refreshing' ? 'animate-spin' : ''}`}
        aria-hidden
      />
      {children}
    </span>
  )
}
