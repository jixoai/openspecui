/**
 * Orthogonal intents (created 2026-07-28 Asia/Shanghai):
 * 1. Render objective Change lanes with navigation and no operation callbacks.
 * 2. Share one compact/full presentation across Dashboard and static Board.
 * 3. Preserve list continuity through motion layout transitions and stable identities.
 *
 * Original request (2026-07-28): add ReadonlyKanban to Dashboard and keep static mode objective.
 */
import { CountBadge } from '@/components/badge'
import { formatDate, formatRelativeTime } from '@/lib/format-time'
import { cn } from '@/lib/utils'
import { VTLink } from '@/lib/view-transitions/navigation'
import { getSharedElementBinding } from '@/lib/view-transitions/shared-elements'
import { Archive, FileQuestion, ListChecks } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import {
  getKanbanArchiveTimestamp,
  groupActiveKanbanItems,
  KANBAN_LANES,
  type KanbanActiveItem,
  type KanbanArchiveItem,
  type KanbanLaneId,
} from './kanban-model'

export interface ReadonlyKanbanProps {
  activeItems: readonly KanbanActiveItem[]
  archivedItems: readonly KanbanArchiveItem[]
  activeCounts: Record<'no-tasks' | 'in-progress' | 'complete', number>
  archivedCount: number
  variant?: 'compact' | 'full'
  className?: string
}

/** Readonly objective Kanban with navigation but no mutation capability. */
export function ReadonlyKanban({
  activeItems,
  archivedItems,
  activeCounts,
  archivedCount,
  variant = 'full',
  className,
}: ReadonlyKanbanProps) {
  const grouped = groupActiveKanbanItems(activeItems)
  const compact = variant === 'compact'
  const maxItems = compact ? 3 : Number.POSITIVE_INFINITY

  return (
    <div
      data-testid="readonly-kanban"
      className={cn(
        'grid min-w-0 auto-cols-[minmax(14rem,1fr)] grid-flow-col gap-3 overflow-x-auto pb-1',
        !compact && 'lg:grid-flow-row lg:grid-cols-4 lg:overflow-x-visible',
        className
      )}
    >
      {KANBAN_LANES.map((lane) => {
        const rows = lane.id === 'archived' ? archivedItems : grouped[lane.id]
        const visibleRows = rows.slice(0, maxItems)
        const count = lane.id === 'archived' ? archivedCount : activeCounts[lane.id]

        return (
          <section key={lane.id} className="border-border/70 min-w-0 border-t">
            <header className="flex h-10 min-w-0 items-center justify-between gap-2 px-1">
              <div className="flex min-w-0 items-center gap-2">
                <span className={cn('h-2 w-2 shrink-0 rounded-full', lane.accentClass)} />
                <h3 className="truncate text-xs font-semibold">
                  {compact ? lane.shortLabel : lane.label}
                </h3>
              </div>
              <CountBadge count={count} tone="muted" size="xs" shape="pill" />
            </header>

            <motion.div layout className="space-y-2" data-lane={lane.id}>
              <AnimatePresence initial={false} mode="popLayout">
                {visibleRows.map((item) => (
                  <motion.div
                    layout
                    layoutId={`readonly-kanban:${item.id}`}
                    key={`${lane.id}:${item.id}`}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.16 }}
                  >
                    <ReadonlyKanbanRow item={item} laneId={lane.id} compact={compact} />
                  </motion.div>
                ))}
              </AnimatePresence>
              {visibleRows.length === 0 && count === 0 ? (
                <div className="border-border/60 text-muted-foreground flex h-16 items-center justify-center rounded-md border border-dashed">
                  {lane.id === 'no-tasks' ? (
                    <FileQuestion className="h-4 w-4" aria-label="No entries" />
                  ) : (
                    <ListChecks className="h-4 w-4" aria-label="No entries" />
                  )}
                </div>
              ) : null}
            </motion.div>
          </section>
        )
      })}
    </div>
  )
}

function ReadonlyKanbanRow({
  item,
  laneId,
  compact,
}: {
  item: KanbanActiveItem | KanbanArchiveItem
  laneId: KanbanLaneId
  compact: boolean
}) {
  const archived = laneId === 'archived'
  const sharedDescriptor = {
    family: archived ? ('archive' as const) : ('changes' as const),
    entityId: item.id,
  }
  const progress = item.trackedTaskProgress
  const percent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0

  return (
    <VTLink
      to={archived ? '/archive/$changeId' : '/changes/$changeId'}
      params={{ changeId: item.id }}
      state={(previous) => ({
        ...previous,
        __vtHandoff: {
          ...sharedDescriptor,
          title: item.name,
          subtitle: item.id,
        },
      })}
      vt={{ sharedElements: sharedDescriptor }}
      {...getSharedElementBinding(sharedDescriptor, 'container')}
      className="border-border/70 bg-card hover:bg-muted/50 block min-w-0 rounded-md border px-2.5 py-2"
    >
      <div className="flex min-w-0 items-start gap-2">
        {archived ? (
          <Archive className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
        ) : null}
        <div className="min-w-0 flex-1">
          <div
            {...getSharedElementBinding(sharedDescriptor, 'title')}
            className="truncate text-xs font-medium"
          >
            {item.name}
          </div>
          <div className="text-muted-foreground truncate text-[11px]">
            {archived
              ? formatDate(getKanbanArchiveTimestamp(item))
              : item.updatedAt > 0
                ? formatRelativeTime(item.updatedAt)
                : item.id}
          </div>
        </div>
        {!archived ? (
          <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
            {progress.completed}/{progress.total}
          </span>
        ) : null}
      </div>
      {!archived && !compact ? (
        <div className="bg-muted mt-2 h-1 rounded-full">
          <motion.div
            className="bg-primary h-full rounded-full"
            initial={false}
            animate={{ width: `${percent}%` }}
          />
        </div>
      ) : null}
    </VTLink>
  )
}
