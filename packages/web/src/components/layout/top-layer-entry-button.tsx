import { Tooltip } from '@/components/tooltip'
import { cn } from '@/lib/utils'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type TopLayerEntryButtonSize = 'mobile' | 'desktop'

interface TopLayerEntryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  icon: ReactNode
  text?: ReactNode
  badge?: ReactNode
  collapsed?: boolean
  size?: TopLayerEntryButtonSize
  tooltipSideOffset?: number
}

const sizeClassNames: Record<TopLayerEntryButtonSize, string> = {
  mobile: 'h-7.5 w-7.5 justify-center',
  desktop: 'min-h-8 py-2',
}

export function TopLayerEntryButton({
  label,
  icon,
  text,
  badge,
  collapsed = true,
  size = 'mobile',
  tooltipSideOffset = 12,
  className,
  ...props
}: TopLayerEntryButtonProps) {
  const tooltipContent = collapsed ? label : undefined

  return (
    <Tooltip content={tooltipContent} sideOffset={tooltipSideOffset}>
      <button
        type="button"
        aria-label={collapsed ? label : props['aria-label']}
        title={collapsed ? label : props.title}
        className={cn(
          'top-layer-entry-button border-primary hover:bg-muted relative inline-flex shrink-0 items-center rounded-md border transition-colors',
          sizeClassNames[size],
          collapsed
            ? size === 'mobile'
              ? 'p-0'
              : 'justify-center px-2'
            : 'justify-start gap-2 px-3 text-left',
          className
        )}
        {...props}
      >
        <span className="inline-flex shrink-0 items-center justify-center">{icon}</span>
        {!collapsed ? <span className="font-nav text-base tracking-[0.04em]">{text}</span> : null}
        {badge}
      </button>
    </Tooltip>
  )
}
