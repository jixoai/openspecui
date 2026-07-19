import { Badge, CountBadge } from '@/components/badge'
import { Select, type SelectOption } from '@/components/select'
import { useArchiveModal } from '@/lib/archive-modal-context'
import {
  classifyChangeWorkflowPhase,
  inferTrackedArtifactStatus,
} from '@/lib/change-workflow-phase'
import { formatDate, formatRelativeTime } from '@/lib/format-time'
import { isStaticMode } from '@/lib/static-mode'
import { useOpsxStatusListSubscription } from '@/lib/use-opsx'
import { useArchivesSubscription, useChangesSubscription } from '@/lib/use-subscription'
import { cn } from '@/lib/utils'
import { VTLink } from '@/lib/view-transitions/navigation'
import type { ArchiveMeta, ChangeMeta, ChangeStatus } from '@openspecui/core'
import { Archive, ChevronRight, GitBranch, GripVertical, SquareKanban } from 'lucide-react'
import { useMemo, useState, type DragEvent } from 'react'

type ActiveColumnId = 'todo' | 'in-progress' | 'qa'

interface ColumnDef {
  id: ActiveColumnId | 'done'
  label: string
  hint: string
  /** Tailwind background for the column accent dot. */
  dotClass: string
}

const COLUMNS: ColumnDef[] = [
  { id: 'todo', label: 'TODO', hint: 'No tasks started', dotClass: 'bg-muted-foreground/50' },
  { id: 'in-progress', label: 'In Progress', hint: 'Some tasks done', dotClass: 'bg-primary' },
  { id: 'qa', label: 'QA', hint: 'All tasks done', dotClass: 'bg-emerald-500' },
  { id: 'done', label: 'Done', hint: 'Archived', dotClass: 'bg-accent' },
]

/**
 * Derive an active change's board column from its task progress.
 *
 * `completed === 0` covers both "no tasks defined" (0/0) and "not started" (0/N),
 * so a change with no tasks lands in TODO, never QA. QA requires at least one
 * task and all tasks complete.
 */
export function classifyBoardColumn(progress: {
  total: number
  completed: number
}): ActiveColumnId {
  if (progress.completed === 0) return 'todo'
  if (progress.completed >= progress.total) return 'qa'
  return 'in-progress'
}

const ARCHIVE_DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})(?:-|$)/

/**
 * Archive timestamp taken from the `YYYY-MM-DD-` id prefix (the real archive
 * date), falling back to the filesystem-derived updatedAt when absent.
 */
export function archiveTimestamp(archive: ArchiveMeta): number {
  const match = ARCHIVE_DATE_PREFIX.exec(archive.id)
  if (match) {
    const ts = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    if (!Number.isNaN(ts)) return ts
  }
  return archive.updatedAt
}

type RangePreset = '7d' | '30d' | '90d' | 'all'

const RANGE_OPTIONS: SelectOption<RangePreset>[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
]

const RANGE_DAYS: Record<RangePreset, number | null> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  all: null,
}

// Module-level drag state: the QA change currently being dragged toward Done.
// Native HTML5 DnD, mirroring the pattern in components/layout/area-nav.tsx.
let draggedChange: { id: string; name: string } | null = null

function buildStatusMap(statuses: ChangeStatus[] | undefined): Map<string, ChangeStatus> {
  return new Map((statuses ?? []).map((status) => [status.changeName, status]))
}

export function Board() {
  const { data: changes, isLoading: changesLoading } = useChangesSubscription()
  const { data: archives, isLoading: archivesLoading } = useArchivesSubscription()
  const { data: statuses } = useOpsxStatusListSubscription()
  const { openArchiveModal } = useArchiveModal()

  const canArchive = !isStaticMode()
  const [range, setRange] = useState<RangePreset>('30d')
  const [dropActive, setDropActive] = useState(false)

  const statusMap = useMemo(() => buildStatusMap(statuses), [statuses])

  const grouped = useMemo(() => {
    const groups: Record<ActiveColumnId, ChangeMeta[]> = { todo: [], 'in-progress': [], qa: [] }
    for (const change of changes ?? []) {
      groups[classifyBoardColumn(change.progress)].push(change)
    }
    return groups
  }, [changes])

  const doneItems = useMemo(() => {
    const withTs = (archives ?? []).map((archive) => ({ archive, ts: archiveTimestamp(archive) }))
    withTs.sort((a, b) => b.ts - a.ts)
    const days = RANGE_DAYS[range]
    if (days == null) return withTs
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
    return withTs.filter((item) => item.ts >= cutoff)
  }, [archives, range])

  const totalArchived = archives?.length ?? 0
  const isLoading = (changesLoading && !changes) || (archivesLoading && !archives)

  if (isLoading) {
    return <div className="route-loading animate-pulse">Loading board…</div>
  }

  const handleDoneDrop = (e: DragEvent<HTMLElement>) => {
    e.preventDefault()
    setDropActive(false)
    const dragged = draggedChange
    draggedChange = null
    if (dragged) openArchiveModal(dragged.id, dragged.name)
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-nav flex items-center gap-2 text-2xl font-bold">
          <SquareKanban className="h-6 w-6 shrink-0" />
          Board
        </h1>
        <p className="text-muted-foreground text-sm">
          {canArchive
            ? 'Changes across their lifecycle. Drag a QA card onto Done to archive it.'
            : 'Changes across their lifecycle. Read-only in static mode.'}
        </p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {COLUMNS.map((column) => {
          const isDone = column.id === 'done'
          const activeItems: ChangeMeta[] = column.id === 'done' ? [] : grouped[column.id]
          const count = isDone ? doneItems.length : activeItems.length
          const isDropTarget = isDone && canArchive

          return (
            <section
              key={column.id}
              onDragOver={
                isDropTarget
                  ? (e) => {
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                      setDropActive(true)
                    }
                  : undefined
              }
              onDragLeave={
                isDropTarget
                  ? (e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropActive(false)
                    }
                  : undefined
              }
              onDrop={isDropTarget ? handleDoneDrop : undefined}
              className={cn(
                'border-border bg-card flex w-72 shrink-0 flex-col rounded-lg border sm:min-w-[15rem] sm:flex-1',
                isDropTarget && dropActive && 'border-primary ring-primary ring-1'
              )}
            >
              <header className="border-border flex items-center justify-between gap-2 border-b px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', column.dotClass)} />
                  <span className="font-nav truncate text-sm font-bold tracking-wide">
                    {column.label}
                  </span>
                  <CountBadge count={count} tone="muted" size="xs" shape="pill" />
                </div>
                {isDone ? (
                  <Select
                    value={range}
                    options={RANGE_OPTIONS}
                    onValueChange={setRange}
                    ariaLabel="Archived time range"
                    className="h-7 min-w-0 gap-1 px-2 text-xs"
                  />
                ) : (
                  <span className="text-muted-foreground shrink-0 text-[11px]">{column.hint}</span>
                )}
              </header>

              <div className="flex max-h-[68vh] min-h-24 flex-col gap-2 overflow-y-auto p-2">
                {isDone ? (
                  doneItems.length > 0 ? (
                    doneItems.map(({ archive }) => (
                      <ArchivedChangeCard key={archive.id} archive={archive} />
                    ))
                  ) : (
                    <EmptyColumn
                      message={
                        totalArchived > 0
                          ? 'No archived changes in this range.'
                          : 'No archived changes yet.'
                      }
                    />
                  )
                ) : activeItems.length > 0 ? (
                  activeItems.map((change) => (
                    <ActiveChangeCard
                      key={change.id}
                      change={change}
                      status={statusMap.get(change.id)}
                      draggable={column.id === 'qa' && canArchive}
                    />
                  ))
                ) : (
                  <EmptyColumn message="Nothing here." />
                )}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

function ActiveChangeCard({
  change,
  status,
  draggable,
}: {
  change: ChangeMeta
  status: ChangeStatus | undefined
  draggable: boolean
}) {
  const phase = classifyChangeWorkflowPhase({
    hasStatus: Boolean(status),
    isComplete: status?.isComplete ?? false,
    tasksComplete:
      change.progress.total === 0 || change.progress.completed >= change.progress.total,
    trackedArtifactStatus: inferTrackedArtifactStatus(
      status?.artifacts.map((artifact) => artifact.status) ?? []
    ),
  })
  const taskPercent =
    change.progress.total > 0
      ? Math.round((change.progress.completed / change.progress.total) * 100)
      : 0

  return (
    <div
      draggable={draggable}
      onDragStart={
        draggable
          ? (e) => {
              draggedChange = { id: change.id, name: change.name }
              e.dataTransfer.setData('text/plain', change.id)
              e.dataTransfer.effectAllowed = 'move'
            }
          : undefined
      }
      onDragEnd={
        draggable
          ? () => {
              draggedChange = null
            }
          : undefined
      }
      className={cn(
        'border-border bg-background group relative rounded-md border p-3',
        draggable && 'cursor-grab active:cursor-grabbing'
      )}
    >
      <VTLink
        to="/changes/$changeId"
        params={{ changeId: change.id }}
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        className="block"
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2">
            {draggable ? (
              <GripVertical className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0 opacity-40 group-hover:opacity-70" />
            ) : (
              <GitBranch className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{change.name}</div>
              <div className="text-muted-foreground truncate text-xs">
                {change.id}
                {change.updatedAt > 0 && <> · {formatRelativeTime(change.updatedAt)}</>}
              </div>
            </div>
          </div>
          <Badge tone="custom" size="sm" shape="box" className={`border ${phase.toneClass}`}>
            {phase.label}
          </Badge>
        </div>

        <div className="bg-muted h-1.5 rounded-full">
          <div
            className="bg-primary h-full rounded-full transition-all"
            style={{ width: `${taskPercent}%` }}
          />
        </div>

        <div className="text-muted-foreground mt-1.5 flex items-center justify-between text-xs">
          <span>
            {change.progress.completed}/{change.progress.total} tasks
          </span>
          <span>{taskPercent}%</span>
        </div>
      </VTLink>
    </div>
  )
}

function ArchivedChangeCard({ archive }: { archive: ArchiveMeta }) {
  return (
    <VTLink
      to="/archive/$changeId"
      params={{ changeId: archive.id }}
      className="border-border bg-background hover:bg-muted/50 flex items-start gap-2 rounded-md border p-3"
    >
      <Archive className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{archive.name}</div>
        <div className="text-muted-foreground mt-0.5 text-xs">
          Archived {formatDate(archiveTimestamp(archive))}
        </div>
      </div>
      <ChevronRight className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
    </VTLink>
  )
}

function EmptyColumn({ message }: { message: string }) {
  return (
    <div className="text-muted-foreground flex min-h-24 flex-1 items-center justify-center p-4 text-center text-xs">
      {message}
    </div>
  )
}
