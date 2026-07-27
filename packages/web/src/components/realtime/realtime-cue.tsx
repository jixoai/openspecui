/**
 * Orthogonal intents (updated 2026-07-27 Asia/Shanghai):
 * 1. Revalidation luminance cue over retained content (low-noise edge luminance).
 * 2. Changed-item settling cue (brief luminance wash on a newly-committed item).
 * 3. Stay package-neutral so App and Web surfaces share the same lifecycle cue.
 * 4. Optionally preserve child DOM identity across active/inactive transitions.
 *
 * Original request (2026-07-23): "可以用光影来替代……尽量不要使用文字，而是使用视觉语言（动画、光影）。"
 * Original request (2026-07-27): "统一修复所有类似的问题，特别是app 那边新增的页面。"
 */
import { type CSSProperties, type ReactNode } from 'react'
import { cn } from '../../lib/utils'

export interface RealtimeRevalidateCueProps {
  children: ReactNode
  className?: string
  /** When false, the cue is removed (e.g. when content is current). */
  active?: boolean
  /** Hidden accessible equivalent for the visual luminance cue. */
  statusLabel?: string
  /** Keep the wrapper mounted when inactive so stateful children preserve DOM identity. */
  persistent?: boolean
}

/** A wrapper that applies the revalidation luminance cue while a region is display-only/revalidating. */
export function RealtimeRevalidateCue({
  children,
  className,
  active = true,
  statusLabel = 'updating',
  persistent = false,
}: RealtimeRevalidateCueProps) {
  if (!active && !persistent) return <>{children}</>
  return (
    <div className={cn(active && 'rt-revalidate-cue', className)} aria-busy={active || undefined}>
      <span
        className="rt-sr-status"
        role={active ? 'status' : undefined}
        aria-live={active ? 'polite' : undefined}
      >
        {active ? statusLabel : null}
      </span>
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
