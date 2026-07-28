/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Revalidation veil over retained content (stale wash plus skeleton-like luminance sweep).
 * 2. Changed-item settling cue (brief luminance wash on a newly-committed item).
 * 3. Stay package-neutral so App and Web surfaces share the same lifecycle cue.
 * 4. Optionally preserve child DOM identity across active/inactive transitions.
 *
 * Original request (2026-07-23): "可以用光影来替代……尽量不要使用文字，而是使用视觉语言（动画、光影）。"
 * Original request (2026-07-27): "统一修复所有类似的问题，特别是app 那边新增的页面。"
 * Original request (2026-07-28): "让用户知道这部分区域的数据已经是旧的，即将会发生更新。"
 */
import { type CSSProperties, type ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { AccessibleStatus } from './realtime-primitives'

export interface RealtimeRevalidateCueProps {
  children: ReactNode
  className?: string
  /** When false, the stale veil is removed while the host remains mounted. */
  active?: boolean
  /** Hidden accessible equivalent for the visual luminance cue. */
  statusLabel?: string
  /** Keep the wrapper mounted when inactive so stateful children preserve DOM identity. */
  persistent?: boolean
}

/** A stable host that veils retained content while its replacement projection is pending. */
export function RealtimeRevalidateCue({
  children,
  className,
  active = true,
  statusLabel = 'updating',
  persistent = false,
}: RealtimeRevalidateCueProps) {
  return (
    <div
      className={cn(!active && !persistent && 'contents', active && 'rt-revalidate-cue', className)}
      aria-busy={active || undefined}
    >
      <AccessibleStatus>{active ? statusLabel : null}</AccessibleStatus>
      {children}
    </div>
  )
}

export interface RealtimeSettleProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
  /** Key change triggers the settle animation on commit. */
  settleKey?: string | number
}

/** Marks a newly-committed item with a brief settling luminance wash. */
export function RealtimeSettle({ children, className, style, settleKey }: RealtimeSettleProps) {
  return (
    <div key={settleKey} className={cn('rt-settle', className)} style={style}>
      {children}
    </div>
  )
}
