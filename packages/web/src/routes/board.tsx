/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Compose live Changes and Archives as independent objective Kanban regions.
 * 2. Bind live commands to shared Change Operators and current projection authority.
 * 3. Render static Board through the shared readonly presentation and archive range policy.
 *
 * Contributor request (2026-07-18): add a Kanban-style Change view.
 * Owner decision (2026-07-28): implement objective OPSX lanes and shared Operator ownership.
 */
import { InteractiveKanban } from '@/components/kanban/interactive-kanban'
import { countActiveKanbanPhases, filterKanbanArchives } from '@/components/kanban/kanban-model'
import { ReadonlyKanban } from '@/components/kanban/readonly-kanban'
import { ChangeListSkeleton } from '@/components/realtime'
import { Select, type SelectOption } from '@/components/select'
import { isStaticMode } from '@/lib/static-mode'
import { useChangeOperatorLauncher } from '@/lib/use-change-operator-launcher'
import { useOpsxStatusListSubscription } from '@/lib/use-opsx'
import { useArchivesSubscription, useChangesSubscription } from '@/lib/use-subscription'
import type { DashboardArchiveRange } from '@openspecui/core/dashboard-display'
import { AlertCircle, SquareKanban } from 'lucide-react'
import { useMemo, useState } from 'react'

const RANGE_OPTIONS: SelectOption<DashboardArchiveRange>[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
]

export function Board() {
  const staticMode = isStaticMode()
  const changesState = useChangesSubscription()
  const archivesState = useArchivesSubscription()
  const statusState = useOpsxStatusListSubscription(!staticMode)
  const [range, setRange] = useState<DashboardArchiveRange>('30d')

  const activeItems = changesState.data ?? []
  const archivedItems = useMemo(
    () => filterKanbanArchives(archivesState.data ?? [], range),
    [archivesState.data, range]
  )
  const activeCurrent =
    changesState.data !== undefined &&
    !changesState.isLoading &&
    !changesState.isUpdating &&
    changesState.error === null
  const archiveCurrent =
    archivesState.data !== undefined &&
    !archivesState.isLoading &&
    !archivesState.isUpdating &&
    archivesState.error === null
  const applyStatusCurrent =
    statusState.data !== undefined && statusState.authority.state === 'current'
  const { rootAction, launchApply, launchArchive } = useChangeOperatorLauncher({
    applyCurrent: activeCurrent && applyStatusCurrent,
    archiveCurrent: activeCurrent,
  })

  const header = (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
      <h1 className="font-nav flex items-center gap-2 text-2xl font-bold">
        <SquareKanban className="h-6 w-6 shrink-0" />
        Kanban
      </h1>
      {staticMode ? (
        <Select
          value={range}
          options={RANGE_OPTIONS}
          onValueChange={setRange}
          ariaLabel="Archived time range"
          className="h-8"
        />
      ) : null}
    </div>
  )

  if (staticMode) {
    const staticError = changesState.error ?? archivesState.error
    const initialLoading =
      (changesState.isLoading && changesState.data === undefined) ||
      (archivesState.isLoading && archivesState.data === undefined)

    return (
      <div className="min-w-0 space-y-4 p-4">
        {header}
        {staticError ? (
          <div
            role="alert"
            className="border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{staticError.message}</span>
          </div>
        ) : null}
        {initialLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
            {Array.from({ length: 4 }, (_, index) => (
              <ChangeListSkeleton key={index} count={2} />
            ))}
          </div>
        ) : (
          <ReadonlyKanban
            activeItems={activeItems}
            archivedItems={archivedItems}
            activeCounts={countActiveKanbanPhases(activeItems)}
            archivedCount={archivedItems.length}
          />
        )}
      </div>
    )
  }

  return (
    <div className="min-w-0 space-y-4 p-4">
      {header}
      <InteractiveKanban
        activeItems={activeItems}
        archivedItems={archivedItems}
        statuses={statusState.data ?? []}
        range={range}
        onRangeChange={setRange}
        activeState={{
          initialLoading: changesState.isLoading && changesState.data === undefined,
          updating: changesState.isUpdating,
          current: activeCurrent,
          error: changesState.error,
          rowErrors: changesState.rowErrors,
          progress: changesState.progress,
        }}
        archiveState={{
          initialLoading: archivesState.isLoading && archivesState.data === undefined,
          updating: archivesState.isUpdating,
          current: archiveCurrent,
          error: archivesState.error,
        }}
        rootReady={rootAction.status === 'ready'}
        rootBlockedReason={rootAction.message}
        applyStatusCurrent={applyStatusCurrent}
        applyStatusError={statusState.error}
        onApply={(item) => launchApply({ changeId: item.id, changeName: item.name })}
        onArchive={(item) => launchArchive({ changeId: item.id, changeName: item.name })}
      />
    </div>
  )
}
