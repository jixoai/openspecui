/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Render every current daemon lease as path-first Task Manager evidence.
 * 2. Expose exact managed Stop, presentation Close, and canonical-path favorite actions.
 * 3. Bind destructive commands to pending/error states without presenting port as identity.
 *
 * Original request (2026-07-30): "任务管理器，打开后，可以看到所有正在运行中backend的详情，并可以杀掉Workspace，或者收藏、取消收藏"
 */
import { Link } from '@tanstack/react-router'
import { ArrowLeft, Loader2, Square, Star, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAppDaemonWorkspace } from '../components/app-daemon-workspace-owner'
import {
  projectDaemonRunningBackends,
  resolveRunningBackendCommands,
} from '../lib/running-backend-projection'
import {
  useWorkspaceDirectoryCatalog,
  useWorkspaceDirectoryCatalogActions,
} from '../lib/use-workspace-directory-catalog'

/** Home-owned running backend manager. */
export function WorkspaceTaskManagerRoute() {
  const daemon = useAppDaemonWorkspace()
  const entries = useMemo(
    () => projectDaemonRunningBackends(daemon.workspaces),
    [daemon.workspaces]
  )
  const catalog = useWorkspaceDirectoryCatalog()
  const catalogActions = useWorkspaceDirectoryCatalogActions()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const toggleFavorite = (projectPath: string, favorite: boolean) => {
    catalogActions.setFavorite(projectPath, favorite)
  }

  return (
    <div className="@container min-w-0 space-y-5 p-4 md:p-6">
      <header className="flex items-center gap-3">
        <Link
          to="/workspaces"
          className="hover:bg-muted inline-flex h-8 w-8 items-center justify-center rounded-md"
          aria-label="Back to Workspaces"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="font-nav text-xl font-bold">Task Manager</h1>
          <p className="text-muted-foreground text-xs">{entries.length} running backends</p>
        </div>
      </header>

      {error ? (
        <p
          role="alert"
          className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border p-3 text-sm"
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
            const externalStop = commands.some((command) => command.kind === 'stop-external')
            return (
              <li
                key={entry.id}
                className="@lg:grid-cols-[minmax(0,1fr)_auto] grid min-w-0 gap-3 py-4"
              >
                <button
                  type="button"
                  className="min-w-0 text-left"
                  onClick={() => daemon.focusWorkspace(entry.id)}
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
                      : 'External owner'}
                    {' · '}
                    {entry.health}
                    {entry.startedAt
                      ? ` · started ${new Date(entry.startedAt).toLocaleString()}`
                      : ''}
                  </span>
                </button>
                <div className="flex items-center gap-1 self-center">
                  {projectPath ? (
                    <button
                      type="button"
                      onClick={() => toggleFavorite(projectPath, !favorite)}
                      aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
                      className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex h-8 w-8 items-center justify-center rounded-md"
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
                          className="hover:bg-muted h-8 rounded-md px-2 text-xs"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmingId(entry.id)}
                        className="text-destructive hover:bg-destructive/10 inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs"
                      >
                        <Square className="h-3.5 w-3.5" />
                        Stop
                      </button>
                    )
                  ) : externalStop ? (
                    <>
                      <span
                        title="The foreground serve owner has not exposed a callable shutdown channel to the App."
                        className="text-muted-foreground px-2 text-xs"
                      >
                        Stop via owner unavailable
                      </span>
                      <button
                        type="button"
                        onClick={() => daemon.closeWorkspace(entry.id)}
                        className="text-muted-foreground hover:bg-muted inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs"
                      >
                        <X className="h-3.5 w-3.5" />
                        Close Workspace
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => daemon.closeWorkspace(entry.id)}
                      className="text-muted-foreground hover:bg-muted inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs"
                    >
                      <X className="h-3.5 w-3.5" />
                      Close Workspace
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
