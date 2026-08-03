/**
 * Orthogonal intents (updated 2026-08-02 Asia/Shanghai):
 * 1. Provide shared semantic badges with compact box geometry and domain-owned color.
 * 2. Preserve pill geometry only for compact numeric counts and explicitly circular indicators.
 *
 * Original request (2026-08-02): generalize the reduced-radius status styling across similar UI surfaces.
 */
import { cn } from '@/lib/utils'
import type { HTMLAttributes } from 'react'

export type BadgeTone = 'primary' | 'subtle' | 'muted' | 'custom'
export type BadgeSize = 'dot' | 'xs' | 'sm'
export type BadgeShape = 'pill' | 'box'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
  size?: BadgeSize
  shape?: BadgeShape
}

const toneClassNames: Record<BadgeTone, string> = {
  primary: 'bg-primary text-primary-foreground',
  subtle: 'border border-primary/35 bg-primary/10 text-primary',
  muted: 'border border-border bg-muted text-muted-foreground',
  custom: '',
}

const sizeClassNames: Record<BadgeSize, string> = {
  dot: 'h-1.5 w-1.5 min-w-0 p-0',
  xs: 'h-4 min-w-4 px-1 text-[10px] leading-none',
  sm: 'h-5 min-w-5 px-1.5 text-[11px] leading-none',
}

const shapeClassNames: Record<BadgeShape, string> = {
  pill: 'rounded-full',
  box: 'rounded',
}

export function Badge({
  tone = 'primary',
  size = 'xs',
  shape = 'box',
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      data-ui-badge="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-0.5 whitespace-nowrap font-semibold',
        toneClassNames[tone],
        sizeClassNames[size],
        shapeClassNames[shape],
        className
      )}
      {...props}
    />
  )
}

export interface CountBadgeProps extends Omit<BadgeProps, 'children'> {
  count: number
  max?: number
  hideWhenZero?: boolean
}

export function formatCountBadgeValue(count: number, max = 99): string {
  return count > max ? `${max}+` : String(count)
}

export function CountBadge({
  count,
  max = 99,
  hideWhenZero = false,
  shape = 'pill',
  title,
  ...props
}: CountBadgeProps) {
  if (hideWhenZero && count <= 0) return null

  const value = formatCountBadgeValue(count, max)

  return (
    <Badge title={title} shape={shape} {...props}>
      {value}
    </Badge>
  )
}
