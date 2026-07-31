/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Render one stable, keyboard-reachable Workspace browser action in the global tab action strip.
 * 2. Explain unavailable daemon authority without exposing backend targets.
 *
 * Original request (2026-07-29): "Workspaces 的 tab 可以提供一个 open in browser 的 icon-button。"
 * Owner correction (2026-07-31): Move Open in browser out of each tab and into the global project action slot.
 */
import { Tooltip } from '@openspecui/web-src/components/tooltip'
import { ExternalLink, LoaderCircle } from 'lucide-react'
import type { KeyboardEvent, MouseEvent } from 'react'

interface WorkspaceTabBrowserActionProps {
  label: string
  pending: boolean
  workspaceId: string | null
  onOpen(workspaceId: string): void
}

/** Render a global browser action that dispatches only an opaque daemon Workspace id. */
export function WorkspaceTabBrowserAction({
  label,
  pending,
  workspaceId,
  onOpen,
}: WorkspaceTabBrowserActionProps) {
  const available = workspaceId !== null && !pending
  const tooltip = workspaceId
    ? pending
      ? `Opening ${label} in browser`
      : `Open ${label} in browser`
    : 'Open in browser is available for daemon-registered Workspaces.'
  const activate = () => {
    if (available) onOpen(workspaceId)
  }
  const stopMouse = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    activate()
  }
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    event.stopPropagation()
    activate()
  }

  return (
    <Tooltip content={tooltip} delay={0}>
      <button
        type="button"
        tabIndex={available ? 0 : -1}
        aria-label={`Open ${label} in browser`}
        aria-disabled={!available}
        data-workspace-browser-action="true"
        onClick={stopMouse}
        onKeyDown={onKeyDown}
        className="border-border bg-terminal text-terminal-foreground hover:bg-background hover:text-foreground cursor-hover inline-flex items-center justify-center border-l p-4 text-sm transition-colors duration-200 aria-disabled:cursor-not-allowed aria-disabled:opacity-35"
      >
        {pending ? (
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ExternalLink className="h-3.5 w-3.5" />
        )}
      </button>
    </Tooltip>
  )
}
