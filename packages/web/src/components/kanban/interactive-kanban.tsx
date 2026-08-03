/**
 * Orthogonal intents (updated 2026-08-03 Asia/Shanghai):
 * 1. Render live objective lanes with independent active/archive lifecycle evidence.
 * 2. Expose accessible Apply/Archive launchers without mutating projected state.
 * 3. Resolve archive drops through DataTransfer identity and current-row authority.
 * 4. Preserve progressive evidence while assigning one inline scroller and layered lane block scrollers.
 *
 * Original request (2026-07-28): implement the reviewed interactive Kanban rewrite.
 * Owner correction (2026-07-28): remove double horizontal scrolling and let each lane scroll vertically.
 * Original request (2026-08-03): layer title and bottom space over a padded list with Grid, gradients, and progressive backdrop blur.
 */
import { CountBadge } from '@/components/badge'
import { ChangeListSkeleton, RealtimeRevalidateCue } from '@/components/realtime'
import { Select, type SelectOption } from '@/components/select'
import { getChangeApplyAvailability } from '@/lib/change-operator-availability'
import { formatDate, formatRelativeTime } from '@/lib/format-time'
import { cn } from '@/lib/utils'
import { VTLink } from '@/lib/view-transitions/navigation'
import { getSharedElementBinding } from '@/lib/view-transitions/shared-elements'
import type { ChangeProjectionRowError, ChangeStatus } from '@openspecui/core'
import type { DashboardArchiveRange } from '@openspecui/core/dashboard-display'
import { AlertCircle, Archive, FileQuestion, ListChecks, Play } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState, type DragEvent } from 'react'
import { KanbanLaneViewport } from './kanban-lane-viewport'
import {
  getKanbanArchiveTimestamp,
  groupActiveKanbanItems,
  KANBAN_LANES,
  type KanbanActiveItem,
  type KanbanArchiveItem,
} from './kanban-model'

const CHANGE_DRAG_MIME = 'application/x-openspecui-change-id'

const RANGE_OPTIONS: SelectOption<DashboardArchiveRange>[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
]

export interface InteractiveKanbanProps {
  activeItems: readonly KanbanActiveItem[]
  archivedItems: readonly KanbanArchiveItem[]
  statuses: readonly ChangeStatus[]
  range: DashboardArchiveRange
  onRangeChange(range: DashboardArchiveRange): void
  activeState: {
    initialLoading: boolean
    updating: boolean
    current: boolean
    error: Error | null
    rowErrors: ChangeProjectionRowError[]
    progress: { completed: number; total: number | 'unknown' } | null
  }
  archiveState: {
    initialLoading: boolean
    updating: boolean
    current: boolean
    error: Error | null
  }
  rootReady: boolean
  rootBlockedReason: string | null
  applyStatusCurrent: boolean
  applyStatusError: Error | null
  onApply(item: KanbanActiveItem): void
  onArchive(item: KanbanActiveItem): void
}

/** Live Kanban presentation; all callbacks launch established Operators. */
export function InteractiveKanban({
  activeItems,
  archivedItems,
  statuses,
  range,
  onRangeChange,
  activeState,
  archiveState,
  rootReady,
  rootBlockedReason,
  applyStatusCurrent,
  applyStatusError,
  onApply,
  onArchive,
}: InteractiveKanbanProps) {
  const [dropActive, setDropActive] = useState(false)
  const grouped = useMemo(() => groupActiveKanbanItems(activeItems), [activeItems])
  const activeById = useMemo(
    () => new Map(activeItems.map((item) => [item.id, item] as const)),
    [activeItems]
  )
  const statusById = useMemo(
    () => new Map(statuses.map((status) => [status.changeName, status] as const)),
    [statuses]
  )
  const activeOperationsCurrent = rootReady && activeState.current
  const archiveDropCurrent = activeOperationsCurrent && archiveState.current

  const handleArchiveDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    setDropActive(false)
    if (!archiveDropCurrent) return
    const changeId = event.dataTransfer.getData(CHANGE_DRAG_MIME)
    if (!changeId) return
    const currentItem = activeById.get(changeId)
    if (currentItem) onArchive(currentItem)
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="shrink-0">
        <ProjectionEvidence
          activeError={activeState.error}
          archiveError={archiveState.error}
          applyStatusError={applyStatusError}
          rowErrors={activeState.rowErrors}
          progress={activeState.progress}
        />
      </div>

      <div
        data-kanban-grid
        className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[color-mix(in_srgb,currentColor,transparent_78%)] grid min-h-0 min-w-0 flex-1 auto-cols-[minmax(16rem,1fr)] grid-flow-col gap-3 overflow-x-auto overflow-y-hidden overscroll-x-contain pb-2"
      >
        {KANBAN_LANES.map((lane) => {
          const archived = lane.id === 'archived'
          const activeRows = lane.id === 'archived' ? [] : grouped[lane.id]
          const archiveRows = archived ? archivedItems : []
          const rowCount = archived ? archiveRows.length : activeRows.length
          const initialLoading = archived ? archiveState.initialLoading : activeState.initialLoading
          const updating = archived ? archiveState.updating : activeState.updating

          return (
            <KanbanLaneViewport
              key={lane.id}
              laneId={lane.id}
              density="full"
              data-lane={lane.id}
              onDragOver={
                archived
                  ? (event) => {
                      if (
                        !archiveDropCurrent ||
                        !event.dataTransfer.types.includes(CHANGE_DRAG_MIME)
                      )
                        return
                      event.preventDefault()
                      event.dataTransfer.dropEffect = 'move'
                      setDropActive(true)
                    }
                  : undefined
              }
              onDragLeave={
                archived
                  ? (event) => {
                      if (!event.currentTarget.contains(event.relatedTarget as Node))
                        setDropActive(false)
                    }
                  : undefined
              }
              onDrop={archived ? handleArchiveDrop : undefined}
              className={cn(
                'transition-colors',
                archived && dropActive && 'border-primary bg-primary/5'
              )}
              header={
                <div className="flex h-full min-w-0 items-center justify-between gap-2 px-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={cn('h-2 w-2 shrink-0 rounded-full', lane.accentClass)} />
                    <h2 className="truncate text-sm font-semibold">{lane.label}</h2>
                    <CountBadge count={rowCount} tone="muted" size="xs" shape="pill" />
                  </div>
                  {archived ? (
                    <Select
                      value={range}
                      options={RANGE_OPTIONS}
                      onValueChange={onRangeChange}
                      ariaLabel="Archived time range"
                      className="pointer-events-auto h-7 min-w-0 gap-1 px-2 text-xs"
                    />
                  ) : null}
                </div>
              }
            >
              <RealtimeRevalidateCue active={updating && rowCount > 0}>
                <motion.div layout className="min-h-24 space-y-2">
                  {initialLoading && rowCount === 0 ? <ChangeListSkeleton count={2} /> : null}
                  <AnimatePresence initial={false} mode="popLayout">
                    {archiveRows.map((item) => (
                      <motion.div
                        layout
                        layoutId={`live-kanban:${item.id}`}
                        key={`archived:${item.id}`}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                      >
                        <ArchivedRow item={item} />
                      </motion.div>
                    ))}
                    {activeRows.map((item) => (
                      <motion.div
                        layout
                        layoutId={`live-kanban:${item.id}`}
                        key={`active:${item.id}`}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                      >
                        <ActiveRow
                          item={item}
                          status={statusById.get(item.id)}
                          canApply={activeOperationsCurrent && applyStatusCurrent}
                          canArchive={activeOperationsCurrent}
                          canDragArchive={archiveDropCurrent}
                          applyBlockedReason={
                            rootBlockedReason ??
                            (applyStatusCurrent ? null : 'Apply availability is not current.')
                          }
                          archiveBlockedReason={rootBlockedReason}
                          onApply={onApply}
                          onArchive={onArchive}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {!initialLoading && rowCount === 0 ? (
                    <div className="border-border/60 text-muted-foreground flex h-20 items-center justify-center rounded-md border border-dashed">
                      {lane.id === 'no-tasks' ? (
                        <FileQuestion className="h-4 w-4" aria-label="No entries" />
                      ) : (
                        <ListChecks className="h-4 w-4" aria-label="No entries" />
                      )}
                    </div>
                  ) : null}
                </motion.div>
              </RealtimeRevalidateCue>
            </KanbanLaneViewport>
          )
        })}
      </div>
    </div>
  )
}

function ActiveRow({
  item,
  status,
  canApply,
  canArchive,
  canDragArchive,
  applyBlockedReason,
  archiveBlockedReason,
  onApply,
  onArchive,
}: {
  item: KanbanActiveItem
  status: ChangeStatus | undefined
  canApply: boolean
  canArchive: boolean
  canDragArchive: boolean
  applyBlockedReason: string | null
  archiveBlockedReason: string | null
  onApply(item: KanbanActiveItem): void
  onArchive(item: KanbanActiveItem): void
}) {
  const applyAvailability = getChangeApplyAvailability(status)
  const progress = item.trackedTaskProgress
  const percent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0
  const sharedDescriptor = { family: 'changes' as const, entityId: item.id }
  const applyDisabled = !canApply || !applyAvailability.available

  return (
    <article
      draggable={canDragArchive}
      onDragStart={
        canDragArchive
          ? (event) => {
              event.dataTransfer.setData(CHANGE_DRAG_MIME, item.id)
              event.dataTransfer.effectAllowed = 'move'
            }
          : undefined
      }
      className={cn(
        'border-border/70 bg-card min-w-0 rounded-md border p-2.5',
        canDragArchive && 'cursor-grab active:cursor-grabbing'
      )}
    >
      <VTLink
        to="/changes/$changeId"
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
        draggable={false}
        className="block min-w-0"
      >
        <div
          {...getSharedElementBinding(sharedDescriptor, 'title')}
          className="truncate text-sm font-medium"
        >
          {item.name}
        </div>
        <div className="text-muted-foreground truncate text-xs">
          {item.updatedAt > 0 ? formatRelativeTime(item.updatedAt) : item.id}
        </div>
        <div className="bg-muted mt-2 h-1.5 rounded-full">
          <motion.div
            className="bg-primary h-full rounded-full"
            initial={false}
            animate={{ width: `${percent}%` }}
          />
        </div>
      </VTLink>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-muted-foreground font-mono text-[11px]">
          {progress.completed}/{progress.total}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={applyDisabled}
            onClick={() => onApply(item)}
            aria-label={`Apply ${item.name}`}
            title={
              applyBlockedReason ??
              (applyAvailability.missingArtifactIds.length > 0
                ? `Missing: ${applyAvailability.missingArtifactIds.join(', ')}`
                : 'Apply')
            }
            className="hover:bg-muted inline-flex h-7 w-7 items-center justify-center rounded-md disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Play className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={!canArchive}
            onClick={() => onArchive(item)}
            aria-label={`Archive ${item.name}`}
            title={archiveBlockedReason ?? 'Archive'}
            className="hover:bg-muted inline-flex h-7 w-7 items-center justify-center rounded-md disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Archive className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </article>
  )
}

function ArchivedRow({ item }: { item: KanbanArchiveItem }) {
  const sharedDescriptor = { family: 'archive' as const, entityId: item.id }
  return (
    <VTLink
      to="/archive/$changeId"
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
      className="border-border/70 bg-card hover:bg-muted/50 block min-w-0 rounded-md border p-2.5"
    >
      <div className="flex min-w-0 items-start gap-2">
        <Archive className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <div
            {...getSharedElementBinding(sharedDescriptor, 'title')}
            className="truncate text-sm font-medium"
          >
            {item.name}
          </div>
          <div className="text-muted-foreground text-xs">
            {formatDate(getKanbanArchiveTimestamp(item))}
          </div>
        </div>
      </div>
    </VTLink>
  )
}

function ProjectionEvidence({
  activeError,
  archiveError,
  applyStatusError,
  rowErrors,
  progress,
}: {
  activeError: Error | null
  archiveError: Error | null
  applyStatusError: Error | null
  rowErrors: ChangeProjectionRowError[]
  progress: { completed: number; total: number | 'unknown' } | null
}) {
  const messages = [
    activeError ? `Changes: ${activeError.message}` : null,
    archiveError ? `Archives: ${archiveError.message}` : null,
    applyStatusError ? `Apply status: ${applyStatusError.message}` : null,
    ...rowErrors.map((error) => `${error.changeId}: ${error.message}`),
  ].filter((message): message is string => message !== null)

  return (
    <>
      {progress ? (
        <div className="text-muted-foreground font-mono text-xs" aria-live="polite">
          {progress.completed}/{progress.total}
        </div>
      ) : null}
      {messages.length > 0 ? (
        <div
          role="alert"
          className="border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-2 rounded-md border px-3 py-2 text-xs"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div className="min-w-0 space-y-1">
            {messages.map((message) => (
              <div key={message} className="break-words">
                {message}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </>
  )
}
