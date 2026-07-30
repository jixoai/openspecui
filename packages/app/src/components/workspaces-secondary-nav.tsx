/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Project every current backend into Workspaces secondary navigation (8.1a).
 * 2. Selecting one focuses or opens the exact Workspace without deriving identity from port.
 * 3. Pure presentation: path-first labels (no port), source- and lifecycle-aware.
 *
 * Original request (2026-07-30): "所有正在运行中的backend都会显示在这里。"
 * Owner direction (2026-07-30): Workspaces is the only expandable primary; running backends project into its
 *   secondary navigation without turning Settings/Connections/Environment/Task Manager into primary domains.
 * Spec: hosted-app-distribution › "Browse running backends from Workspaces navigation".
 */
import { ChevronDown, ChevronRight, Circle } from 'lucide-react'
import { useState } from 'react'
import type { RunningBackendEntry } from '../lib/running-backend-projection'

export interface WorkspacesSecondaryNavProps {
  readonly entries: readonly RunningBackendEntry[]
  /** Stable id of the currently active/open Workspace, if any. */
  readonly activeId?: string | null
  /** Focus or open the exact Workspace for one entry. */
  onSelect: (entryId: string) => void
}

/**
 * Workspaces secondary navigation. Renders every current backend as a path-first item under the expandable
 * Workspaces primary. Selecting one focuses/opens its exact Workspace (no port identity).
 */
export function WorkspacesSecondaryNav({
  entries,
  activeId,
  onSelect,
}: WorkspacesSecondaryNavProps) {
  const [expanded, setExpanded] = useState(true)
  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="text-muted-foreground hover:text-foreground flex w-full items-center gap-1 px-2 py-1 text-xs font-semibold uppercase tracking-wide"
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        Running ({entries.length})
      </button>
      {expanded && entries.length > 0 ? (
        <ul role="list" className="mt-0.5 space-y-0.5">
          {entries.map((entry) => {
            const active = entry.id === activeId
            return (
              <li key={entry.id} className="min-w-0">
                <button
                  type="button"
                  onClick={() => onSelect(entry.id)}
                  title={entry.label.detail}
                  className={`flex w-full min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm transition-colors ${
                    active
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <RunningHealthDot health={entry.health} />
                  <span className="min-w-0">
                    <span className="block truncate">{entry.label.title}</span>
                    {entry.label.subtitle ? (
                      <span
                        className={`block truncate text-xs ${active ? 'text-primary-foreground/70' : 'text-muted-foreground/70'}`}
                      >
                        {entry.label.subtitle}
                      </span>
                    ) : null}
                  </span>
                  {entry.ownership === 'external' ? (
                    <span
                      className={`ml-auto shrink-0 rounded px-1 text-[10px] ${
                        active ? 'bg-primary-foreground/20' : 'bg-muted'
                      }`}
                      aria-label="external backend"
                    >
                      ext
                    </span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

function RunningHealthDot({ health }: { health: RunningBackendEntry['health'] }) {
  const color =
    health === 'ready'
      ? 'text-emerald-500'
      : health === 'failed'
        ? 'text-red-500'
        : health === 'starting'
          ? 'text-amber-500'
          : 'text-muted-foreground/40'
  return <Circle className={`h-2 w-2 shrink-0 fill-current ${color}`} aria-hidden />
}
