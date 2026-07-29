/**
 * Orthogonal intents (updated 2026-07-30 Asia/Shanghai):
 * 1. Render one stable, keyboard-reachable Workspace browser action inside a tab trigger.
 * 2. Explain unavailable daemon authority without exposing backend targets.
 *
 * Original request (2026-07-29): "Workspaces 的 tab 可以提供一个 open in browser 的 icon-button。"
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

/** Render a tab-local browser action that dispatches only an opaque daemon Workspace id. */
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
        className="text-terminal-foreground/65 hover:bg-terminal-foreground/10 hover:text-terminal-foreground inline-flex h-6 w-6 shrink-0 items-center justify-center rounded transition aria-disabled:cursor-not-allowed aria-disabled:opacity-35"
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
