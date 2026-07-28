/**
 * Orthogonal intents (created 2026-07-28 Asia/Shanghai):
 * 1. Render keyboard-reachable scan facts through the existing Badge and Tooltip owners.
 * 2. Render verbose evidence through one accessible, collapsed-by-default Accordion vocabulary.
 * 3. Remain a pure presentation boundary with no subscription, routing, or mutation ownership.
 *
 * Original request (2026-07-28): "这些信息绝大部分应该简化成badge+toolip或者手风琴。"
 */
import { Badge, type BadgeProps } from '@/components/badge'
import { Tooltip } from '@/components/tooltip'
import { cn } from '@/lib/utils'
import { Accordion } from '@base-ui/react/accordion'
import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

export interface InformationBadgeProps extends Omit<BadgeProps, 'children' | 'title'> {
  /** Accessible identity for the complete fact, not only its compact visual label. */
  ariaLabel: string
  children: ReactNode
  tooltip: ReactNode
}

/** Compact objective status whose complete meaning remains available on hover or keyboard focus. */
export function InformationBadge({
  ariaLabel,
  children,
  tooltip,
  className,
  tone = 'muted',
  shape = 'box',
  ...badgeProps
}: InformationBadgeProps) {
  return (
    <Tooltip content={tooltip}>
      <Badge
        role="note"
        tabIndex={0}
        aria-label={ariaLabel}
        tone={tone}
        shape={shape}
        className={cn(
          'focus-visible:ring-primary cursor-help outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          className
        )}
        {...badgeProps}
      >
        {children}
      </Badge>
    </Tooltip>
  )
}

export interface EvidenceDisclosureProps {
  title: ReactNode
  children: ReactNode
  summary?: ReactNode
  defaultOpen?: boolean
  className?: string
  panelClassName?: string
}

/** Consistent on-demand owner for paths, provenance, raw CLI envelopes, and verbose diagnostics. */
export function EvidenceDisclosure({
  title,
  children,
  summary,
  defaultOpen = false,
  className,
  panelClassName,
}: EvidenceDisclosureProps) {
  return (
    <Accordion.Root defaultValue={defaultOpen ? ['evidence'] : []} hiddenUntilFound>
      <Accordion.Item
        value="evidence"
        className={cn('border-border/70 rounded-md border', className)}
      >
        <Accordion.Header className="m-0">
          <Accordion.Trigger
            className={cn(
              'hover:bg-muted/60 focus-visible:ring-primary flex min-h-9 w-full min-w-0 items-center gap-2 rounded-md px-3 py-2 text-left text-xs outline-none focus-visible:ring-2 focus-visible:ring-inset',
              'group/disclosure'
            )}
          >
            <span className="min-w-0 flex-1 font-medium">{title}</span>
            {summary ? (
              <span className="text-muted-foreground min-w-0 truncate text-[11px]">{summary}</span>
            ) : null}
            <ChevronRight
              className="text-muted-foreground h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-data-[panel-open]/disclosure:rotate-90 motion-reduce:transition-none"
              aria-hidden
            />
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel
          className={cn(
            'h-(--accordion-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-[ending-style]:h-0 data-[starting-style]:h-0 motion-reduce:transition-none',
            panelClassName
          )}
        >
          <div className="border-border/60 border-t px-3 py-3 text-xs">{children}</div>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion.Root>
  )
}
