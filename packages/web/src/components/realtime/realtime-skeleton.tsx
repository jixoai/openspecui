/**
 * Orthogonal intents (created 2026-07-24 Asia/Shanghai):
 * 1. Stable skeleton geometry atoms (line/row/card/panel) that do not flash per-chunk.
 * 2. An inventory skeleton that repeats a row template without manual scroll bookkeeping.
 *
 * Original request (2026-07-23): "可以用光影来替代，将它做成一种视觉语言。"
 * The shimmer is a CSS luminance sweep (styles/realtime.css); reduced-motion keeps a static band.
 */
import { cn } from '@/lib/utils'
import { type CSSProperties } from 'react'

export interface RealtimeSkeletonProps {
  className?: string
  style?: CSSProperties
}

/** A single skeleton block with the shimmer luminance cue. */
export function RealtimeSkeleton({ className, style }: RealtimeSkeletonProps) {
  return <div className={cn('rt-skeleton', className)} style={style} aria-hidden="true" />
}

/** A text-line skeleton. */
export function RealtimeSkeletonLine({ className, style }: RealtimeSkeletonProps) {
  return <RealtimeSkeleton className={cn('rt-skeleton-line', className)} style={style} />
}

/** A row-height skeleton for list/table rows. */
export function RealtimeSkeletonRow({ className, style }: RealtimeSkeletonProps) {
  return <RealtimeSkeleton className={cn('rt-skeleton-row', className)} style={style} />
}

/** A card-height skeleton for metric/summary tiles. */
export function RealtimeSkeletonCard({ className, style }: RealtimeSkeletonProps) {
  return <RealtimeSkeleton className={cn('rt-skeleton-card', className)} style={style} />
}

export interface RealtimeSkeletonInventoryProps {
  count?: number
  rowClassName?: string
  /** Render a custom row skeleton; defaults to RealtimeSkeletonRow. */
  renderRow?: (index: number) => React.ReactNode
}

/** A repeating inventory skeleton with native overflow anchoring for physical stability. */
export function RealtimeSkeletonInventory({
  count = 4,
  rowClassName,
  renderRow,
}: RealtimeSkeletonInventoryProps) {
  return (
    <div className="rt-anchor" aria-hidden="true">
      {Array.from({ length: count }, (_, index) =>
        renderRow ? renderRow(index) : <RealtimeSkeletonRow key={index} className={rowClassName} />
      )}
    </div>
  )
}
