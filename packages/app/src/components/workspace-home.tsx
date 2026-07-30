/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Fixed, non-closeable, non-reorderable Workspace Home surface (4.0a).
 * 2. Favorites above, path-input launch form in the middle, Recent below, Task Manager entry.
 * 3. Pure presentation composed by the future Workspace shell; callbacks stay owned by the caller.
 *
 * Original request (2026-07-30): "Workspace需要记住曾经打开的目录，并且支持收藏。关键是，支持直接从目录直接启动 openspecui 服务。"
 * Spec: hosted-app-distribution › "Open the fixed Workspace Home" and "Start a project from a local directory".
 *
 * Home is the repeat-use entry. It owns no daemon authority or subscription: the caller binds path submission
 * to the current local-daemon authority and supplies the catalog view. The form locks while pending and surfaces
 * concrete errors without fabricating a running Workspace.
 */
import { Clock, Folder, ListTodo, Loader2, Star } from 'lucide-react'
import { useState } from 'react'
import type { WorkspaceDirectoryCatalogView } from '../lib/workspace-directory-catalog'
import { selectWorkspacePathLabel, type WorkspacePathLabel } from '../lib/workspace-path-label'

/** Presentation row for one directory (favorite or recent). */
export interface WorkspaceHomeDirectoryRow {
  readonly canonicalPath: string
  readonly favorite: boolean
  readonly lastOpenedAt: number
  /** Optional Git facts for the path-first label; absent facts fall back to the basename. */
  readonly git?: { githubRemote?: string | null; branch?: string | null } | null
}

export interface WorkspaceHomeProps {
  /** Catalog view (Favorites first, then Recent recency-desc). */
  readonly catalog: WorkspaceDirectoryCatalogView
  /** Submit a local project directory to start/focus one managed backend. */
  readonly onSubmitPath: (projectDir: string) => void
  /** Toggle favorite on a canonical directory (independent of runtime state). */
  readonly onToggleFavorite: (canonicalPath: string, favorite: boolean) => void
  /** Open a directory row (favorite or recent) to focus/restore its Workspace. */
  readonly onOpenDirectory: (canonicalPath: string) => void
  /** Ask the route owner to open the running-backend Task Manager. */
  readonly onOpenTaskManager?: () => void
  /** Whether a path submission is currently pending (form loading lock). */
  readonly pending?: boolean
  /** Concrete error from the last submission; cleared by the caller. */
  readonly error?: string | null
  /** Whether directory launch is supported (local daemon authority present). */
  readonly launchSupported: boolean
}

function toRowLabel(row: WorkspaceHomeDirectoryRow): WorkspacePathLabel {
  return selectWorkspacePathLabel({
    projectPath: row.canonicalPath,
    git: row.git ?? null,
  })
}

function DirectoryRow({
  row,
  onOpen,
  onToggleFavorite,
}: {
  row: WorkspaceHomeDirectoryRow
  onOpen: () => void
  onToggleFavorite: (next: boolean) => void
}) {
  const label = toRowLabel(row)
  return (
    <div className="hover:bg-muted/40 flex items-center justify-between gap-3 rounded-md px-3 py-2">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        aria-label={`Open ${label.detail}`}
      >
        <Folder className="text-muted-foreground h-4 w-4 shrink-0" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{label.title}</span>
          {label.subtitle ? (
            <span className="text-muted-foreground block truncate text-xs">{label.subtitle}</span>
          ) : null}
          <span className="text-muted-foreground/70 block truncate text-xs">{label.detail}</span>
        </span>
      </button>
      <button
        type="button"
        onClick={() => onToggleFavorite(!row.favorite)}
        aria-label={`${row.favorite ? 'Unfavorite' : 'Favorite'} ${label.detail}`}
        aria-pressed={row.favorite}
        className="text-muted-foreground hover:text-foreground rounded-md p-1.5"
      >
        <Star className={`h-4 w-4 ${row.favorite ? 'fill-current text-amber-500' : ''}`} />
      </button>
    </div>
  )
}

/**
 * Fixed Workspace Home. Cannot be closed or reordered by contract; the caller must mount it as the first tab
 * and never replace it with a project iframe.
 */
export function WorkspaceHome({
  catalog,
  onSubmitPath,
  onToggleFavorite,
  onOpenDirectory,
  onOpenTaskManager = () => {},
  pending = false,
  error = null,
  launchSupported,
}: WorkspaceHomeProps) {
  const [path, setPath] = useState('')

  const submit = () => {
    const trimmed = path.trim()
    if (!trimmed || pending) return
    onSubmitPath(trimmed)
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-nav flex items-center gap-2 text-2xl font-bold">
          <Folder className="h-6 w-6 shrink-0" />
          Workspaces
        </h1>
        <button
          type="button"
          onClick={onOpenTaskManager}
          className="hover:bg-muted inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium"
        >
          <ListTodo className="h-4 w-4" />
          Task Manager
        </button>
      </div>

      {/* Path-input launch form: the repeat-use entry. Locks while pending. */}
      <section className="order-2 space-y-1.5">
        <label htmlFor="workspace-home-path" className="text-sm font-medium">
          Start from path
        </label>
        {launchSupported ? (
          <div className="flex gap-2">
            <input
              id="workspace-home-path"
              type="text"
              value={path}
              disabled={pending}
              onChange={(event) => setPath(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submit()
              }}
              placeholder="/Users/you/projects/your-project"
              className="border-border bg-background focus:border-primary flex-1 rounded-md border px-3 py-2 text-sm outline-none disabled:opacity-50"
            />
            <button
              type="button"
              onClick={submit}
              disabled={pending || path.trim().length === 0}
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Start
            </button>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            Directory launch is unsupported in this App delivery. Use the launcher to connect a
            backend.
          </p>
        )}
        {error ? <p className="text-destructive text-xs">{error}</p> : null}
      </section>

      {/* Favorites above. */}
      <section className="order-1 space-y-2">
        <h2 className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
          <Star className="h-3.5 w-3.5" />
          Favorites
        </h2>
        {catalog.favorites.length === 0 ? (
          <p className="text-muted-foreground px-3 text-sm">No favorite directories yet.</p>
        ) : (
          <div className="space-y-1">
            {catalog.favorites.map((entry) => (
              <DirectoryRow
                key={entry.canonicalPath}
                row={entry}
                onOpen={() => onOpenDirectory(entry.canonicalPath)}
                onToggleFavorite={(next) => onToggleFavorite(entry.canonicalPath, next)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Recent below (recency-desc, excluding favorites). */}
      <section className="order-3 space-y-2">
        <h2 className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
          <Clock className="h-3.5 w-3.5" />
          Recent
        </h2>
        {catalog.recent.length === 0 ? (
          <p className="text-muted-foreground px-3 text-sm">No recent directories yet.</p>
        ) : (
          <div className="space-y-1">
            {catalog.recent.map((entry) => (
              <DirectoryRow
                key={entry.canonicalPath}
                row={entry}
                onOpen={() => onOpenDirectory(entry.canonicalPath)}
                onToggleFavorite={(next) => onToggleFavorite(entry.canonicalPath, next)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
