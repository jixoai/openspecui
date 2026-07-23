/**
 * Orthogonal intents (created 2026-07-24 Asia/Shanghai):
 * 1. Truthful progress primitive: indeterminate when total is unknown, determinate only when known.
 * 2. Never fabricate a percentage or ETA from an unknown total.
 *
 * Original request (2026-07-23): "不要……伪造进度。"
 * Evidence: unknown total => indeterminate arrival motion only; known total => a real fill width.
 */
import type { RealtimeProjectionProgress } from '@/lib/realtime'
import { cn } from '@/lib/utils'

export interface RealtimeProgressProps {
  progress: RealtimeProjectionProgress | null
  className?: string
}

/** Render truthful progress. Null => nothing; unknown total => indeterminate; known => determinate fill. */
export function RealtimeProgress({ progress, className }: RealtimeProgressProps) {
  if (progress === null) return null
  if (progress.total === 'unknown') {
    return (
      <div
        className={cn('rt-progress-indeterminate', className)}
        role="progressbar"
        aria-valuetext="loading"
      />
    )
  }
  const total = progress.total === 0 ? 1 : progress.total
  const pct = Math.max(0, Math.min(100, (progress.completed / total) * 100))
  return (
    <div
      className={cn('rt-progress-track', className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={progress.total}
      aria-valuenow={progress.completed}
    >
      <div className="rt-progress-fill" style={{ inlineSize: `${pct}%` }} />
    </div>
  )
}
