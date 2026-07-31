/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Project favorite project directories directly beneath Workspaces without an accordion or section heading.
 * 2. Selecting one delegates canonical-path start/focus to the App owner.
 * 3. Preserve path-first labels and stable status-light geometry without route-selection highlighting.
 *
 * Original request (2026-07-30): "所有正在运行中的backend都会显示在这里。"
 * Owner correction (2026-07-31): "runnings 这个列表的子元素，直接改成 Favorites，没有 Favorites 手风琴折叠，直接二级罗列"
 * Owner correction (2026-07-31): Workspace secondary rows never highlight; a right-side signal reports Running.
 */
import type { WorkspaceDirectoryEntry } from '@openspecui/core/workspace-directory-catalog'
import { Circle } from 'lucide-react'
import { selectWorkspacePathLabel } from '../lib/workspace-path-label'

export interface WorkspacesSecondaryNavProps {
  readonly favorites: readonly WorkspaceDirectoryEntry[]
  /** Canonical paths whose backends have current Health + WebSocket Running evidence. */
  readonly runningPaths?: readonly string[]
  /** Canonical path currently joining/starting through the daemon owner. */
  readonly pendingPath?: string | null
  /** Focus or start the exact favorite directory. */
  onSelect: (canonicalPath: string) => void
}

/**
 * Workspaces secondary navigation. Favorites are already contextualized by the Workspaces parent, so this
 * component renders only direct second-level rows and adds no redundant Favorites/Running disclosure.
 */
export function WorkspacesSecondaryNav({
  favorites,
  runningPaths = [],
  pendingPath,
  onSelect,
}: WorkspacesSecondaryNavProps) {
  if (favorites.length === 0) return null
  const runningPathSet = new Set(runningPaths)
  return (
    <ul role="list" className="space-y-0.5">
      {favorites.map((favorite) => {
        const label = selectWorkspacePathLabel({ projectPath: favorite.canonicalPath })
        const running = runningPathSet.has(favorite.canonicalPath)
        const pending = favorite.canonicalPath === pendingPath
        const signalLabel = pending
          ? 'Workspace starting'
          : running
            ? 'Workspace running'
            : 'Workspace stopped'
        return (
          <li key={favorite.canonicalPath} className="min-w-0">
            <button
              type="button"
              disabled={pendingPath !== null && pendingPath !== undefined}
              onClick={() => onSelect(favorite.canonicalPath)}
              title={label.detail}
              className="text-muted-foreground hover:bg-muted hover:text-foreground flex w-full min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm transition-colors disabled:opacity-50"
            >
              <span className="min-w-0 truncate">{label.title}</span>
              <span
                aria-label={signalLabel}
                className="ml-auto flex h-4 w-4 shrink-0 items-center justify-center"
                title={signalLabel}
              >
                <Circle
                  aria-hidden="true"
                  className={`h-2 w-2 fill-current ${
                    pending
                      ? 'animate-pulse text-amber-500'
                      : running
                        ? 'text-emerald-500'
                        : 'text-muted-foreground/30'
                  }`}
                />
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
