/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Stable skeleton geometry atoms (line/row/card) that do not flash per-chunk.
 * 2. Layout-aware inventory skeleton mirroring the project's real list/grid conventions.
 * 3. Stay package-neutral so App and Web surfaces share the same visual atom.
 *
 * Original request (2026-07-23): "可以用光影来替代，将它做成一种视觉语言。"
 * Owner direction (2026-07-24): skeleton 之间需要有 gap，结构需符合客观布局；参考 shadcn 组合思想，项目化定制。
 * Original request (2026-07-27): "统一修复所有类似的问题，特别是app 那边新增的页面。"
 * Owner acceptance feedback (2026-07-28): "列表骨架之间需要 gap，要么得有分割线。"
 *
 * The shimmer is a CSS luminance sweep (styles/realtime.css); reduced-motion keeps a static band.
 */
import { Fragment, type CSSProperties, type ReactNode } from 'react'
import { cn } from '../../lib/utils'

export interface RealtimeSkeletonProps {
  className?: string
  style?: CSSProperties
}

/** A single skeleton block with the shimmer luminance cue. */
export function RealtimeSkeleton({ className, style }: RealtimeSkeletonProps) {
  return <div className={cn('rt-skeleton', className)} style={style} aria-hidden="true" />
}

/** A text-line skeleton (defaults to a readable line height; pass width via className). */
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

/**
 * Layout mode mirrors the project's real list/grid conventions so the skeleton geometry matches the settled
 * content rather than a generic gray stack.
 *
 * - `list-divide`: `border + 1px grid gap + rounded-lg` — rows touch, separated by an explicit line (mirrors
 *   change-list / archive-list / spec-list / git worktree lists).
 * - `grid-cards`: `grid gap-3` — cards with spacing (mirrors dashboard metric/trend grids).
 * - `plain`: `space-y-2` — stacked rows with a default gap (fallback, never clumped).
 */
export type RealtimeSkeletonMode = 'list-divide' | 'grid-cards' | 'plain'

const MODE_CONTAINER_CLASS: Record<RealtimeSkeletonMode, string> = {
  'list-divide': 'rt-anchor border-border bg-border grid gap-px overflow-hidden rounded-lg border',
  'grid-cards': 'rt-anchor grid gap-3',
  plain: 'rt-anchor space-y-2',
}

export interface RealtimeSkeletonInventoryProps {
  /** Layout mode; defaults to `plain` (spaced, never clumped). */
  mode?: RealtimeSkeletonMode
  /** Extra container className (e.g. responsive column counts for grid-cards). */
  containerClassName?: string
  count?: number
  rowClassName?: string
  /** Render a custom row/card skeleton; defaults to RealtimeSkeletonRow. */
  renderRow?: (index: number) => ReactNode
}

/** A repeating inventory skeleton whose container mirrors a real list/grid layout. */
export function RealtimeSkeletonInventory({
  mode = 'plain',
  containerClassName,
  count = 4,
  rowClassName,
  renderRow,
}: RealtimeSkeletonInventoryProps) {
  return (
    <div className={cn(MODE_CONTAINER_CLASS[mode], containerClassName)} aria-hidden="true">
      {Array.from({ length: count }, (_, index) =>
        renderRow ? (
          <Fragment key={index}>{renderRow(index)}</Fragment>
        ) : (
          <RealtimeSkeletonRow key={index} className={rowClassName} />
        )
      )}
    </div>
  )
}
