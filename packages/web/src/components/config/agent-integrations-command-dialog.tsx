/**
 * Orthogonal intents (created 2026-08-01 Asia/Shanghai):
 * 1. Present Agent Init, Update, and Repair command evidence in one native Dialog Terminal.
 * 2. Lock implicit dismissal while running and expose explicit cancellation.
 * 3. Separate destructive Repair confirmation from transport execution ownership.
 *
 * Original request (2026-08-01): Agent operations require Terminal evidence, loading locks, and cancel.
 */
import { CliTerminal } from '@/components/cli-terminal'
import { Dialog } from '@/components/dialog'
import type { CliRunnerLine, OverallStatus } from '@/lib/use-cli-runner'
import { AlertTriangle, TerminalSquare } from 'lucide-react'

export type AgentCommandKind = 'init' | 'repair' | 'update'

const COMMAND_TITLE: Record<AgentCommandKind, string> = {
  init: 'Initialize selected Agents',
  repair: 'Repair Agent delivery',
  update: 'Update Agent delivery',
}

/** Pure command lifecycle Dialog; the Config route owns the actual CLI runner. */
export function AgentIntegrationsCommandDialog({
  kind,
  status,
  hasStarted,
  lines,
  onRun,
  onCancel,
  onClose,
}: {
  kind: AgentCommandKind | null
  status: OverallStatus
  hasStarted: boolean
  lines: CliRunnerLine[]
  onRun(): void
  onCancel(): void
  onClose(): void
}) {
  const running = status === 'running'
  return (
    <Dialog
      open={kind !== null}
      onClose={onClose}
      onDismissRequest={running ? null : onClose}
      title={
        <div className="flex items-center gap-2">
          <TerminalSquare className="h-4 w-4" aria-hidden />
          <span className="text-sm font-semibold">{kind ? COMMAND_TITLE[kind] : ''}</span>
        </div>
      }
      bodyClassName="space-y-3"
      borderVariant={status === 'success' ? 'success' : status === 'error' ? 'error' : 'default'}
      footer={
        <div className="flex items-center gap-2">
          {running ? (
            <button
              type="button"
              onClick={onCancel}
              className="border-destructive/50 text-destructive hover:bg-destructive/10 rounded-md border px-3 py-1.5 text-xs font-medium"
            >
              Cancel
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="border-border hover:bg-muted rounded-md border px-3 py-1.5 text-xs font-medium"
            >
              Close
            </button>
          )}
          {!hasStarted ? (
            <button
              type="button"
              onClick={onRun}
              className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium"
            >
              <TerminalSquare className="h-3.5 w-3.5" aria-hidden />
              Run command
            </button>
          ) : null}
        </div>
      }
    >
      {kind === 'repair' ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            Repair runs <span className="font-mono">openspec update --force</span>. Review migration
            and cleanup evidence before continuing.
          </span>
        </div>
      ) : null}
      <CliTerminal lines={lines} maxHeight="52vh" />
    </Dialog>
  )
}
