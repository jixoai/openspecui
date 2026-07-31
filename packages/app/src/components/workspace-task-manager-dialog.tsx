/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Render every daemon registration with independent Health API + WebSocket runtime evidence.
 * 2. Expose exact managed Stop and canonical-path favorite actions without fake external lifecycle controls.
 * 3. Bind destructive commands and Dialog dismissal to one pending/error lifecycle without presenting port as identity.
 * 4. Preserve physical continuity while daemon backend rows enter, leave, or reorder.
 *
 * Original request (2026-07-30): "任务管理器，打开后，可以看到所有正在运行中backend的详情，并可以杀掉Workspace，或者收藏、取消收藏"
 * Owner correction (2026-07-31): "TaskManagerPage 改成 TaskManagerDialog"
 * Owner correction (2026-07-31): external close-only rows must not expose Close/Remove/Delete; Running requires
 *   Health API plus an established WebSocket.
 */
import { Dialog } from '@openspecui/web-src/components/dialog'
import { Loader2, Square, Star } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useRunningBackendObservations } from '../lib/running-backend-observation-provider'
import {
  projectDaemonRunningBackends,
  resolveRunningBackendCommands,
  type RunningBackendEntry,
} from '../lib/running-backend-projection'
import { useListFlowAnimation } from '../lib/use-list-flow-animation'
import { useAppDaemonWorkspace } from './app-daemon-workspace-owner'

export interface WorkspaceTaskManagerDialogProps {
  readonly open: boolean
  readonly onClose: () => void
}

/** App-owned running backend manager. */
export function WorkspaceTaskManagerDialog({ open, onClose }: WorkspaceTaskManagerDialogProps) {
  const daemon = useAppDaemonWorkspace()
  const runtime = useRunningBackendObservations()
  const entries = useMemo(
    () => projectDaemonRunningBackends(daemon.workspaces, runtime.observations),
    [daemon.workspaces, runtime.observations, runtime.revision]
  )
  const runningCount = entries.filter((entry) => entry.health === 'running').length
  const entryIds = useMemo(() => entries.map((entry) => entry.id), [entries])
  const listItemRef = useListFlowAnimation(entryIds)
  const catalog = daemon.directoryCatalog
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const requestClose = () => {
    if (pendingId === null) onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={requestClose}
      onDismissRequest={pendingId === null ? requestClose : null}
      title={
        <div>
          <h2 className="font-nav text-lg font-bold">Task Manager</h2>
          <p className="text-muted-foreground text-xs">
            {runningCount} running · {entries.length} registered
          </p>
        </div>
      }
      className="w-full max-w-3xl"
      bodyClassName="@container min-w-0 overscroll-contain"
      maxHeight="min(86vh, 48rem)"
    >
      {error ? (
        <p
          role="alert"
          className="border-destructive/40 bg-destructive/5 text-destructive mb-4 rounded-md border p-3 text-sm"
        >
          {error}
        </p>
      ) : null}

      {entries.length === 0 ? (
        <p className="text-muted-foreground text-sm">No running backends.</p>
      ) : (
        <ul className="border-border divide-border min-w-0 divide-y border-y">
          {entries.map((entry) => {
            const favorite = catalog.entries.find(
              (candidate) => candidate.canonicalPath === entry.projectPath
            )?.favorite
            const pending = pendingId === entry.id
            const confirming = confirmingId === entry.id
            const projectPath = entry.projectPath
            const commands = resolveRunningBackendCommands(entry)
            const managedStop = commands.find((command) => command.kind === 'stop-managed')
            return (
              <li
                ref={listItemRef(entry.id)}
                key={entry.id}
                className="@lg:grid-cols-[minmax(0,1fr)_auto] grid min-w-0 gap-3 py-4"
              >
                <button
                  type="button"
                  disabled={pendingId !== null}
                  className="min-w-0 text-left disabled:opacity-50"
                  onClick={() => {
                    daemon.focusWorkspace(entry.id)
                    onClose()
                  }}
                >
                  <span className="block truncate text-sm font-semibold">{entry.label.title}</span>
                  {entry.label.subtitle ? (
                    <span className="text-muted-foreground block truncate text-xs">
                      {entry.label.subtitle}
                    </span>
                  ) : null}
                  <span className="text-muted-foreground/70 block break-all font-mono text-xs">
                    {entry.label.detail}
                  </span>
                  <span className="text-muted-foreground mt-1 block text-xs">
                    {entry.ownership === 'daemon-managed'
                      ? 'Managed by App daemon'
                      : 'External foreground owner'}
                    {' · '}
                    {formatBackendState(entry.health)}
                    {entry.startedAt
                      ? ` · started ${new Date(entry.startedAt).toLocaleString()}`
                      : ''}
                  </span>
                </button>
                <div className="flex flex-wrap items-center gap-1 self-center">
                  {projectPath ? (
                    <button
                      type="button"
                      disabled={pendingId !== null}
                      onClick={() => {
                        setPendingId(entry.id)
                        setError(null)
                        void daemon
                          .setDirectoryFavorite(projectPath, !favorite)
                          .catch((caught: unknown) =>
                            setError(caught instanceof Error ? caught.message : 'Favorite failed.')
                          )
                          .finally(() => setPendingId(null))
                      }}
                      aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
                      className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex h-8 w-8 items-center justify-center rounded-md disabled:opacity-50"
                    >
                      <Star
                        className={`h-4 w-4 ${favorite ? 'fill-current text-amber-500' : ''}`}
                      />
                    </button>
                  ) : null}
                  {managedStop?.kind === 'stop-managed' ? (
                    confirming ? (
                      <>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            setPendingId(entry.id)
                            setError(null)
                            void daemon
                              .stopManagedProject(managedStop.generation)
                              .then(() => setConfirmingId(null))
                              .catch((caught: unknown) =>
                                setError(caught instanceof Error ? caught.message : 'Stop failed.')
                              )
                              .finally(() => setPendingId(null))
                          }}
                          className="bg-destructive text-destructive-foreground inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs disabled:opacity-50"
                        >
                          {pending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Square className="h-3.5 w-3.5" />
                          )}
                          Confirm Stop
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => setConfirmingId(null)}
                          className="hover:bg-muted h-8 rounded-md px-2 text-xs disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={pendingId !== null}
                        onClick={() => setConfirmingId(entry.id)}
                        className="text-destructive hover:bg-destructive/10 inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs disabled:opacity-50"
                      >
                        <Square className="h-3.5 w-3.5" />
                        Stop
                      </button>
                    )
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Dialog>
  )
}

function formatBackendState(state: RunningBackendEntry['health']): string {
  if (state === 'running') return 'Running'
  if (state === 'checking') return 'Checking Health + realtime'
  if (state === 'realtime-unavailable') return 'Realtime unavailable'
  if (state === 'authentication-required') return 'Authentication required'
  if (state === 'unsupported') return 'Unsupported backend'
  if (state === 'offline') return 'Offline'
  return 'Not yet observed'
}
