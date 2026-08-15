/**
 * Orthogonal intents (updated 2026-07-27 Asia/Shanghai):
 * 1. List only active Changes from the current writable Planning root.
 * 2. Derive workflow state and terminal evidence from CLI Status and formal tracked-task progress.
 * 3. Preserve ChangeList row continuity and stale display together with collision-safe detail navigation.
 * 4. Keep the advanced New Change command reachable from the page header.
 * 5. Defer aggregate workflow Status until a primary Change row is renderable; preserve explicit failures.
 *
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 * Original request (2026-07-23): "List mutations and route changes preserve physical continuity through existing motion/View Transition patterns."
 * Original request (2026-07-27): "统一修复所有类似的问题（我们也没不多，各个页面都检查一下，特别是app 那边新增的页面）"
 *
 * Original request (2026-07-15): "One project backend has one launch project and one CLI-selected writable planning root."
 * Original request (2026-07-21): "Changes页面的右上角没有 New,你要不要快速补一个"
 
 * Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"*/
import { Badge } from '@/components/badge'
import {
  ChangeListSkeleton,
  RealtimeProgress,
  RealtimeRevalidateCue,
  RealtimeSkeletonLine,
} from '@/components/realtime'
import {
  classifyChangeWorkflowPhase,
  inferTrackedArtifactStatus,
} from '@/lib/change-workflow-phase'
import { formatRelativeTime } from '@/lib/format-time'
import { useOpsxStatusListSubscription } from '@/lib/use-opsx'
import { useChangesSubscription } from '@/lib/use-subscription'
import { VTLink, vtNavController } from '@/lib/view-transitions/navigation'
import { getSharedElementBinding } from '@/lib/view-transitions/shared-elements'
import { useChangeListContinuity } from '@/routes/change-list-continuity'
import type { ChangeStatus } from '@openspecui/core'
import { AlertCircle, ChevronRight, GitBranch, Plus, Sparkles } from 'lucide-react'
import { useRef } from 'react'

function buildStatusMap(statuses: ChangeStatus[] | undefined): Map<string, ChangeStatus> {
  return new Map((statuses ?? []).map((status) => [status.changeName, status]))
}

export function ChangeList() {
  const {
    data: changes,
    isLoading,
    isUpdating,
    error: changesError,
    rowErrors = [],
    progress = null,
  } = useChangesSubscription()
  const listRef = useRef<HTMLDivElement>(null)
  const {
    data: statuses,
    isLoading: isStatusLoading,
    error: statusError,
  } = useOpsxStatusListSubscription((changes?.length ?? 0) > 0)
  const displayedChanges = useChangeListContinuity(changes, listRef)
  const statusMap = buildStatusMap(statuses)

  const hasCurrentEmptyChanges = changes?.length === 0 && !changesError && !isUpdating
  const showChangesFrame = (changes?.length ?? 0) > 0 || hasCurrentEmptyChanges
  const isInitialLoading = isLoading && !changes && !changesError

  if (isInitialLoading) {
    // Preserve page chrome (header/nav) and render a stable skeleton body rather than a full-tree
    // route-loading barrier, so the surrounding layout and navigation do not flash on first load.
    return (
      <div className="space-y-6 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-nav flex items-center gap-2 text-2xl font-bold">
            <GitBranch className="h-6 w-6 shrink-0" />
            Changes
          </h1>
          <button
            type="button"
            onClick={() => vtNavController.activatePop('/opsx-new')}
            className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium hover:opacity-90"
            title="Create a new OPSX change"
          >
            <Plus className="h-4 w-4" />
            New
          </button>
        </div>
        {progress && !changesError ? (
          <RealtimeProgress progress={progress} className="max-w-sm" />
        ) : null}
        <ChangeListSkeleton count={5} />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-nav flex items-center gap-2 text-2xl font-bold">
          <GitBranch className="h-6 w-6 shrink-0" />
          Changes
        </h1>
        <button
          type="button"
          onClick={() => vtNavController.activatePop('/opsx-new')}
          className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium hover:opacity-90"
          title="Create a new OPSX change"
        >
          <Plus className="h-4 w-4" />
          New
        </button>
      </div>

      <p className="text-muted-foreground">
        Active OPSX changes in the current writable Planning root. Completed changes are moved to{' '}
        <VTLink to="/archive" className="text-primary hover:underline">
          Archive
        </VTLink>
        .
      </p>

      {changesError ? (
        <div
          role="alert"
          className="border-destructive/40 bg-destructive/10 text-destructive flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
          <span className="break-words">{changesError.message}</span>
        </div>
      ) : null}

      {rowErrors.length > 0 ? (
        <div
          role="alert"
          className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
        >
          {rowErrors.map((rowError) => (
            <div key={rowError.changeId} className="break-words">
              {rowError.changeId}: {rowError.message}
            </div>
          ))}
        </div>
      ) : null}

      {progress && !changesError ? (
        <div className="text-muted-foreground text-sm" data-change-progress>
          Loaded {progress.completed}/{progress.total === 'unknown' ? 'unknown' : progress.total}{' '}
          changes
        </div>
      ) : null}

      {statusError ? (
        <div
          role="alert"
          className="border-destructive/40 bg-destructive/10 text-destructive flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
          <span className="break-words">{statusError.message}</span>
        </div>
      ) : null}

      {showChangesFrame ? (
        <RealtimeRevalidateCue active={isUpdating && Boolean(changes)}>
          <div
            ref={listRef}
            data-change-list-continuity
            className="border-border divide-border divide-y rounded-lg border"
          >
            {displayedChanges?.map((change) => {
              const status = statusMap.get(change.id)
              const doneArtifacts =
                status?.artifacts.filter((artifact) => artifact.status === 'done').length ?? 0
              const totalArtifacts = status?.artifacts.length ?? 0
              const phase = classifyChangeWorkflowPhase({
                hasStatus: Boolean(status),
                isPlanningComplete: status?.isPlanningComplete ?? false,
                trackedTaskPhase: change.trackedTaskProgress.phase,
                trackedArtifactStatus: inferTrackedArtifactStatus(
                  status?.artifacts.map((artifact) => artifact.status) ?? []
                ),
              })
              const sharedDescriptor = { family: 'changes', entityId: change.id } as const
              return (
                <VTLink
                  key={change.id}
                  to="/changes/$changeId"
                  params={{ changeId: change.id }}
                  state={(prev) => ({
                    ...prev,
                    __vtHandoff: {
                      family: 'changes',
                      entityId: change.id,
                      title: change.name,
                      subtitle: change.id,
                    },
                  })}
                  vt={{ sharedElements: sharedDescriptor }}
                  {...getSharedElementBinding(sharedDescriptor, 'container')}
                  className="hover:bg-muted/50 block px-4 py-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <GitBranch
                        {...getSharedElementBinding(sharedDescriptor, 'icon')}
                        className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0"
                      />
                      <div className="min-w-0">
                        <div
                          {...getSharedElementBinding(sharedDescriptor, 'title')}
                          className="truncate font-medium"
                        >
                          {change.name}
                        </div>
                        <div className="text-muted-foreground truncate text-sm">
                          {change.id}
                          {change.updatedAt > 0 && <> · {formatRelativeTime(change.updatedAt)}</>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-end gap-1 text-right text-sm">
                        <Badge
                          tone="custom"
                          size="sm"
                          shape="box"
                          className={`border ${phase.toneClass}`}
                        >
                          {phase.label}
                        </Badge>
                      </div>
                      <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
                    </div>
                  </div>

                  <div className="text-muted-foreground mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span>
                      {status?.isPlanningComplete === true
                        ? 'Planning complete'
                        : phase.label === 'In Execution'
                          ? 'Planning in progress'
                          : 'Planning status pending CLI status'}
                    </span>
                    {!statusError && status ? (
                      <span className="truncate">
                        {doneArtifacts}/{totalArtifacts} artifacts · {status.schemaName}
                      </span>
                    ) : !statusError && statuses === undefined && isStatusLoading ? (
                      <RealtimeSkeletonLine className="w-28" />
                    ) : (
                      <span>Workflow status unavailable</span>
                    )}
                  </div>
                </VTLink>
              )
            })}
            {hasCurrentEmptyChanges && (
              <div className="text-muted-foreground p-4 text-center">
                <div>No active changes.</div>
                <div className="mt-1 text-xs">Recommended workflow start: Quick Propose</div>
                <button
                  type="button"
                  onClick={() => vtNavController.activatePop('/opsx-propose')}
                  className="text-primary m-2 inline-flex items-center gap-1 hover:underline"
                  title="Open Quick Propose"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Start Propose
                </button>
                <button
                  type="button"
                  onClick={() => vtNavController.activatePop('/opsx-new')}
                  className="text-primary m-2 inline-flex items-center gap-1 hover:underline"
                  title="Open the advanced /opsx:new form"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Open advanced /opsx:new form
                </button>
              </div>
            )}
          </div>
        </RealtimeRevalidateCue>
      ) : null}
    </div>
  )
}
