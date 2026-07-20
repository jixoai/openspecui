/**
 * Orthogonal intents (updated 2026-07-20 Asia/Shanghai):
 * 1. Render the explicit launch-project versus planning-root terminal cwd choice.
 * 2. Keep unavailable planning-root state visible and non-interactive.
 * 3. Show the selected server-observed path without accepting arbitrary client paths.
 * 4. Lock the control to a Server-owned workflow target when dispatch requires it.
 *
 * Original request (2026-07-16): "Terminal shows selected cwd/root identity in creation controls."
 */
import {
  getTerminalCwdTargetOption,
  type TerminalCwdTargetState,
} from '@/lib/use-terminal-cwd-target'
import type { TerminalCwdTarget } from '@openspecui/core'
import { FolderOpen, Waypoints } from 'lucide-react'

interface TerminalCwdTargetControlProps {
  value: TerminalCwdTarget
  state: TerminalCwdTargetState
  onValueChange: (target: TerminalCwdTarget) => void
  showPath?: boolean
  lockedTarget?: TerminalCwdTarget
  className?: string
}

const TARGETS: readonly TerminalCwdTarget[] = ['launch-project', 'planning-root']

/** Select launch-project or Planning-root cwd while displaying its explicit identity. */
export function TerminalCwdTargetControl({
  value,
  state,
  onValueChange,
  showPath = false,
  lockedTarget,
  className,
}: TerminalCwdTargetControlProps) {
  const selected = getTerminalCwdTargetOption(state, value)

  return (
    <div className={className}>
      <div
        role="radiogroup"
        aria-label="Terminal working directory"
        className="border-border bg-muted/20 grid grid-cols-2 rounded-md border p-0.5"
      >
        {TARGETS.map((target) => {
          const option = getTerminalCwdTargetOption(state, target)
          const checked = value === target
          const Icon = target === 'launch-project' ? FolderOpen : Waypoints
          const title = option.available
            ? `${option.label}: ${option.path ?? 'resolved by backend'}`
            : (option.unavailableReason ?? option.label)

          return (
            <button
              key={target}
              type="button"
              role="radio"
              aria-checked={checked}
              disabled={
                !option.available || (lockedTarget !== undefined && target !== lockedTarget)
              }
              title={title}
              onClick={() => onValueChange(target)}
              className={[
                'inline-flex h-7 min-w-0 items-center justify-center gap-1.5 rounded-sm px-2 text-xs transition-colors',
                checked ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
                'hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45',
              ].join(' ')}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">
                {target === 'launch-project' ? 'Launch' : 'Planning'}
              </span>
            </button>
          )
        })}
      </div>
      {showPath ? (
        <p
          className="text-muted-foreground mt-1 min-w-0 truncate text-[11px]"
          title={selected.path ?? selected.unavailableReason ?? undefined}
        >
          {selected.path ??
            (selected.available
              ? 'Absolute path will be resolved by the backend.'
              : selected.unavailableReason)}
        </p>
      ) : null}
    </div>
  )
}
