/**
 * Orthogonal intents (created 2026-07-24 Asia/Shanghai):
 * 1. Revalidation luminance cue over retained content (low-noise edge luminance).
 * 2. Changed-item settling cue (brief luminance wash on a newly-committed item).
 *
 * Original request (2026-07-23): "可以用光影来替代……尽量不要使用文字，而是使用视觉语言（动画、光影）。"
 */
import { cn } from '@/lib/utils'
import { type CSSProperties, type ReactNode } from 'react'

export interface RealtimeRevalidateCueProps {
  children: ReactNode
  className?: string
  /** When false, the cue is removed (e.g. when content is current). */
  active?: boolean
}

/** A wrapper that applies the revalidation luminance cue while a region is display-only/revalidating. */
export function RealtimeRevalidateCue({
  children,
  className,
  active = true,
}: RealtimeRevalidateCueProps) {
  if (!active) return <>{children}</>
  return <div className={cn('rt-revalidate-cue', className)}>{children}</div>
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
