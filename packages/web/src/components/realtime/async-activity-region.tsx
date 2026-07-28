/**
 * Orthogonal intents (created 2026-07-28 Asia/Shanghai):
 * 1. Expose region-scoped asynchronous activity without implying retained data is stale.
 * 2. Keep the region owner and polite accessible status mounted across activity transitions.
 *
 * Original request (2026-07-28): "让用户知道这部分区域的数据已经是旧的，即将会发生更新。"
 * This component deliberately has no stale veil; use RealtimeRevalidateCue only for retained projections.
 */
import { type ReactNode } from 'react'

import { cn } from '../../lib/utils'
import { AccessibleStatus } from './realtime-primitives'

export interface AsyncActivityRegionProps {
  active: boolean
  children: ReactNode
  className?: string
  statusLabel: string
}

/** Mark a region busy while preserving its command/data semantics and mounted content. */
export function AsyncActivityRegion({
  active,
  children,
  className,
  statusLabel,
}: AsyncActivityRegionProps) {
  return (
    <div className={cn(className)} aria-busy={active || undefined}>
      <AccessibleStatus>{active ? statusLabel : null}</AccessibleStatus>
      {children}
    </div>
  )
}
