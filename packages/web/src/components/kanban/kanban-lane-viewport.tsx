/**
 * Orthogonal intents (created 2026-08-03 Asia/Shanghai):
 * 1. Layer one semantic lane header and two visual edge veils over a full-height row scroller.
 * 2. Reserve readable header/footer landing space through density-owned scroll padding.
 * 3. Forward native section interactions without owning Kanban data or operations.
 *
 * Original request (2026-08-03): layer title and bottom space over a padded list with Grid, gradients, and progressive backdrop blur.
 */
import { cn } from '@/lib/utils'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import './kanban-lane-viewport.css'
import type { KanbanLaneId } from './kanban-model'

export interface KanbanLaneViewportProps
  extends Omit<ComponentPropsWithoutRef<'section'>, 'children'> {
  laneId: KanbanLaneId
  density: 'compact' | 'full'
  header: ReactNode
  children: ReactNode
}

/** Grid-layered lane viewport with one independent block-axis scroll owner. */
export function KanbanLaneViewport({
  laneId,
  density,
  header,
  children,
  className,
  ...sectionProps
}: KanbanLaneViewportProps) {
  return (
    <section
      {...sectionProps}
      data-kanban-lane={laneId}
      data-kanban-lane-density={density}
      className={cn(
        'kanban-lane-viewport border-border/70 grid min-h-0 min-w-0 overflow-hidden border-t',
        className
      )}
    >
      <div
        data-kanban-lane-scroll={laneId}
        className="kanban-lane-viewport__scroll scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[color-mix(in_srgb,currentColor,transparent_78%)] min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain pr-1"
      >
        {children}
      </div>

      <div
        aria-hidden="true"
        data-kanban-lane-veil="top"
        className="kanban-lane-viewport__veil kanban-lane-viewport__veil--top"
      />
      <header data-kanban-lane-header={laneId} className="kanban-lane-viewport__header">
        {header}
      </header>
      <div
        aria-hidden="true"
        data-kanban-lane-veil="bottom"
        className="kanban-lane-viewport__veil kanban-lane-viewport__veil--bottom"
      />
    </section>
  )
}
