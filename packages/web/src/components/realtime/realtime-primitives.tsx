/**
 * Orthogonal intents (created 2026-07-24 Asia/Shanghai):
 * 1. Concise recovery primitive for terminal errors (text + actionable control).
 * 2. Concise empty primitive for committed-empty projections.
 * 3. A hidden accessible status that mirrors the visual topology for assistive tech.
 *
 * Original request (2026-07-23): "空结果、错误、冲突、阻塞和恢复路径保留简洁文字和可操作控件。"
 * These primitives retain text because errors/empty/block states are NOT normal lifecycle.
 */
import { cn } from '@/lib/utils'
import { type ReactNode } from 'react'

import type { RealtimeProjectionState } from '@/lib/realtime'

export interface RealtimeErrorProps {
  error: Error | null
  /** Optional recovery control rendered beside the message. */
  action?: ReactNode
  className?: string
}

/** Render a terminal/refresh error with its raw message and an optional recovery control. */
export function RealtimeError({ error, action, className }: RealtimeErrorProps) {
  if (error === null) return null
  return (
    <div role="alert" className={cn('text-destructive flex items-center gap-2 text-sm', className)}>
      <span className="truncate">{error.message}</span>
      {action}
    </div>
  )
}

export interface RealtimeEmptyProps {
  message: string
  action?: ReactNode
  className?: string
}

/** Render a committed-empty projection with concise text and an optional action. */
export function RealtimeEmpty({ message, action, className }: RealtimeEmptyProps) {
  return (
    <div className={cn('text-muted-foreground flex items-center gap-2 text-sm', className)}>
      <span>{message}</span>
      {action}
    </div>
  )
}

export interface RealtimeAccessibleStatusProps<T> {
  state: RealtimeProjectionState<T>
  className?: string
}

const TOPOLOGY_LABEL: Record<RealtimeProjectionState<unknown>['topology'], string> = {
  idle: 'idle',
  'initial-loading': 'loading',
  empty: 'empty',
  'initial-error': 'error',
  partial: 'loading partial content',
  current: 'current',
  revalidating: 'updating',
  'refresh-error': 'update failed',
}

/** A hidden accessible status that mirrors the visual topology (reduced-motion + screen-reader equivalent). */
export function RealtimeAccessibleStatus<T>({
  state,
  className,
}: RealtimeAccessibleStatusProps<T>) {
  return (
    <span className={cn('rt-sr-status', className)} role="status" aria-live="polite">
      {TOPOLOGY_LABEL[state.topology]}
    </span>
  )
}
