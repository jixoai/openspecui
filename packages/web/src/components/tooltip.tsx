import { cn } from '@/lib/utils'
import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip'
import type { ReactElement, ReactNode } from 'react'

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

  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger render={children} delay={delay} />
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
