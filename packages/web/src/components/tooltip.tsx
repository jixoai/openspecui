/**
 * Orthogonal intents (updated 2026-07-30 Asia/Shanghai):
 * 1. Render a keyboard-compatible Base UI Tooltip with disabled-trigger support.
 * 2. Remain source-reusable by App without relying on the Web-only path alias.
 *
 * Original request (2026-07-29): "使用 tooltip 来提供解释和帮助信息。"
 */
import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip'
import type { ReactElement, ReactNode } from 'react'
import { cn } from '../lib/utils'

interface TooltipProps {
  content?: ReactNode
  children: ReactElement
  delay?: number
  sideOffset?: number
  className?: string
}

export function Tooltip({
  content,
  children,
  delay = 180,
  sideOffset = 8,
  className,
}: TooltipProps) {
  if (!content) return children
  const disabled =
    typeof children.props === 'object' &&
    children.props !== null &&
    'disabled' in children.props &&
    Boolean(children.props.disabled)
  const trigger = disabled ? <span className="inline-flex max-w-full">{children}</span> : children

  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger render={trigger} delay={delay} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner sideOffset={sideOffset} className="z-50 outline-none">
          <BaseTooltip.Popup
            className={cn(
              'bg-popover text-popover-foreground border-border max-w-72 rounded-md border px-2 py-1.5 text-xs leading-snug shadow-lg',
              'origin-(--transform-origin) transition-[transform,opacity] duration-150',
              'data-[ending-style]:translate-y-0.5 data-[ending-style]:opacity-0',
              'data-[starting-style]:translate-y-0.5 data-[starting-style]:opacity-0',
              className
            )}
          >
            {content}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  )
}
