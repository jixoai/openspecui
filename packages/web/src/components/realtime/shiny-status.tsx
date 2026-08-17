/**
 * Orthogonal intents (created 2026-08-15 Asia/Shanghai):
 * 1. Animate normal-lifecycle text (loading/resolving/refreshing) with the shiny-text luminance language.
 * 2. Compose it into one keyboard-reachable Badge whose complete meaning lives in a Tooltip.
 * 3. Keep the polite live-region semantic for assistive tech without occupying layout space.
 *
 * Original request (2026-08-15): 刷新/解析中的块级 Alert 改为 Animated Shiny Text + Tooltip，不占界面空间。
 * Boundary: terminal errors/empty/block states are NOT normal lifecycle — they keep text notices.
 */
import { cn } from '../../lib/utils'
import { Badge, type BadgeProps } from '../badge'
import { Tooltip } from '../tooltip'
import { AccessibleStatus } from './realtime-primitives'

/** Normal-lifecycle text whose luminance sweep replaces a block-level loading notice. */
export function AnimatedShinyText({
  children,
  className,
}: {
  children: string
  className?: string
}) {
  return <span className={cn('rt-shiny-text', className)}>{children}</span>
}

export interface ShinyStatusBadgeProps extends Omit<BadgeProps, 'children'> {
  /** Compact visible label, e.g. "Refreshing planning root". */
  label: string
  /** Complete meaning retained for hover, keyboard focus, and assistive tech. */
  message: string
}

/**
 * One inline lifecycle badge: shiny label + Tooltip message + hidden live region.
 * The accessible status carries the full message so `getByRole('status')` semantics survive.
 */
export function ShinyStatusBadge({
  label,
  message,
  className,
  ...badgeProps
}: ShinyStatusBadgeProps) {
  return (
    <>
      <Tooltip content={message}>
        <Badge
          role="note"
          tabIndex={0}
          aria-label={message}
          tone="muted"
          className={cn(
            'focus-visible:ring-primary cursor-help px-1.5 text-[11px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
            className
          )}
          {...badgeProps}
        >
          <AnimatedShinyText>{label}</AnimatedShinyText>
        </Badge>
      </Tooltip>
      <AccessibleStatus>{message}</AccessibleStatus>
    </>
  )
}
