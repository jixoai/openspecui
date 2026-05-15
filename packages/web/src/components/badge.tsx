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
  shape = 'pill',
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
  title,
  ...props
}: CountBadgeProps) {
  if (hideWhenZero && count <= 0) return null

  const value = formatCountBadgeValue(count, max)

  return (
    <Badge title={title} {...props}>
      {value}
    </Badge>
  )
}
