import {
  classifyChangeWorkflowPhase,
  inferTrackedArtifactStatus,
} from '@/lib/change-workflow-phase'
import { formatRelativeTime } from '@/lib/format-time'
import { useOpsxStatusListSubscription } from '@/lib/use-opsx'
import { useChangesSubscription } from '@/lib/use-subscription'
import { VTLink, vtNavController } from '@/lib/view-transitions/navigation'
import { getSharedElementBinding } from '@/lib/view-transitions/shared-elements'
import type { ChangeStatus } from '@openspecui/core'
import { ChevronRight, GitBranch, Sparkles } from 'lucide-react'

function buildStatusMap(statuses: ChangeStatus[] | undefined): Map<string, ChangeStatus> {
  return new Map((statuses ?? []).map((status) => [status.changeName, status]))
}

export function ChangeList() {
  const { data: changes, isLoading } = useChangesSubscription()
  const { data: statuses } = useOpsxStatusListSubscription()
  const statusMap = buildStatusMap(statuses)

  if (isLoading && !changes) {
    return <div className="route-loading animate-pulse">Loading changes...</div>
  }

  return (
    <div className="space-y-6 p-4">
      <h1 className="font-nav flex items-center gap-2 text-2xl font-bold">
        <GitBranch className="h-6 w-6 shrink-0" />
        Changes
      </h1>

      <p className="text-muted-foreground">
        Active OPSX changes. Completed changes are moved to{' '}
        <VTLink to="/archive" className="text-primary hover:underline">
          Archive
        </VTLink>
        .
      </p>

      <div className="border-border divide-border divide-y rounded-lg border">
        {changes?.map((change) => {
          const status = statusMap.get(change.id)
          const doneArtifacts =
            status?.artifacts.filter((artifact) => artifact.status === 'done').length ?? 0
          const totalArtifacts = status?.artifacts.length ?? 0
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
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${phase.toneClass}`}
                    >
                      {phase.label}
                    </span>
                    <div className="font-medium">
                      {change.progress.completed}/{change.progress.total}
                    </div>
                    <div className="text-muted-foreground text-xs">tasks</div>
                  </div>
                  <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
                </div>
              </div>

              <div className="bg-muted h-1.5 rounded-full">
                <div
                  className="bg-primary h-full rounded-full transition-all"
                  style={{ width: `${taskPercent}%` }}
                />
              </div>

              <div className="text-muted-foreground mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span>{taskPercent}% task completion</span>
                {status ? (
                  <span className="truncate">
                    {doneArtifacts}/{totalArtifacts} artifacts · {status.schemaName}
                  </span>
                ) : (
                  <span>Loading workflow status…</span>
                )}
              </div>
            </VTLink>
          )
        })}
        {changes?.length === 0 && (
          <div className="text-muted-foreground p-4 text-center">
            <div>No active changes.</div>
            <div className="mt-1 text-xs">Recommended workflow start: /opsx:propose</div>
            <button
              type="button"
              onClick={() => vtNavController.activatePop('/opsx-propose')}
              className="text-primary mt-2 inline-flex items-center gap-1 hover:underline"
              title="Open quick /opsx:propose input"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Start /opsx:propose
            </button>
            <button
              type="button"
              onClick={() => vtNavController.activatePop('/opsx-new')}
              className="text-primary mt-2 inline-flex items-center gap-1 hover:underline"
              title="Open the advanced /opsx:new form"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Open advanced /opsx:new form
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
