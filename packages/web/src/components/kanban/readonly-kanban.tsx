/**
 * Orthogonal intents (updated 2026-08-03 Asia/Shanghai):
 * 1. Render objective Change lanes with navigation and no operation callbacks.
 * 2. Share one compact/full presentation while compact Pending geometry stays fixed.
 * 3. Own a 1/2/4-column container-responsive topology composed from layered lane viewports.
 * 4. Preserve list continuity through motion layout transitions and stable identities.
 *
 * Original request (2026-07-28): add ReadonlyKanban to Dashboard and keep static mode objective.
 * Owner correction (2026-07-28): use container queries for 4x1, 2x2, and 1x4 without horizontal scrolling.
 * Original request (2026-07-31): "Kanban 的高度可以固定下来，并且要让每个group都可以独立滚动"
 * Original request (2026-08-03): layer title and bottom space over a padded list with Grid, gradients, and progressive backdrop blur.
 */
import { CountBadge } from '@/components/badge'
import { RealtimeSkeleton } from '@/components/realtime'
import { formatDate, formatRelativeTime } from '@/lib/format-time'
import { cn } from '@/lib/utils'
import { VTLink } from '@/lib/view-transitions/navigation'
import { getSharedElementBinding } from '@/lib/view-transitions/shared-elements'
import { Archive, FileQuestion, ListChecks } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { KanbanLaneViewport } from './kanban-lane-viewport'
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
  pending?: boolean
  className?: string
}

/** Readonly objective Kanban with navigation but no mutation capability. */
export function ReadonlyKanban({
  activeItems,
  archivedItems,
  activeCounts,
  archivedCount,
  variant = 'full',
  pending = false,
  className,
}: ReadonlyKanbanProps) {
  const grouped = groupActiveKanbanItems(activeItems)
  const compact = variant === 'compact'

  return (
    <div
      data-testid="readonly-kanban"
      aria-busy={pending}
      className={cn(
        '@container min-w-0 max-w-full overflow-x-clip',
        compact && '@[32rem]:h-[32rem] @[64rem]:h-72 h-[46rem]',
        className
      )}
    >
      <div
        data-testid="readonly-kanban-grid"
        className={cn(
          '@[32rem]:grid-cols-2 @[64rem]:grid-cols-4 grid w-full min-w-0 max-w-full grid-cols-1 gap-3 overflow-x-clip',
          compact && '@[32rem]:grid-rows-2 @[64rem]:grid-rows-1 h-full min-h-0 grid-rows-4'
        )}
      >
        {KANBAN_LANES.map((lane) => {
          const rows = lane.id === 'archived' ? archivedItems : grouped[lane.id]
          const count = lane.id === 'archived' ? archivedCount : activeCounts[lane.id]

          return (
            <KanbanLaneViewport
              key={lane.id}
              laneId={lane.id}
              density={compact ? 'compact' : 'full'}
              header={
                <div className="flex h-full min-w-0 items-center justify-between gap-2 px-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={cn('h-2 w-2 shrink-0 rounded-full', lane.accentClass)} />
                    <h3 className="truncate text-xs font-semibold">
                      {compact ? lane.shortLabel : lane.label}
                    </h3>
                  </div>
                  {pending ? (
                    <RealtimeSkeleton className="h-5 w-8 rounded-full" />
                  ) : (
                    <CountBadge count={count} tone="muted" size="xs" shape="pill" />
                  )}
                </div>
              }
            >
              {pending ? (
                <div className="space-y-2" aria-hidden="true">
                  {Array.from({ length: 3 }, (_, index) => (
                    <div
                      key={index}
                      className="border-border/70 bg-card space-y-2 rounded-md border px-2.5 py-2"
                    >
                      <RealtimeSkeleton className="h-3 w-3/4" />
                      <RealtimeSkeleton className="h-2.5 w-1/2" />
                    </div>
                  ))}
                </div>
              ) : (
                <motion.div layout className="space-y-2" data-lane={lane.id}>
                  <AnimatePresence initial={false} mode="popLayout">
                    {rows.map((item) => (
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
                  {rows.length === 0 && count === 0 ? (
                    <div className="border-border/60 text-muted-foreground flex h-16 items-center justify-center rounded-md border border-dashed">
                      {lane.id === 'no-tasks' ? (
                        <FileQuestion className="h-4 w-4" aria-label="No entries" />
                      ) : (
                        <ListChecks className="h-4 w-4" aria-label="No entries" />
                      )}
                    </div>
                  ) : null}
                </motion.div>
              )}
            </KanbanLaneViewport>
          )
        })}
      </div>
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
