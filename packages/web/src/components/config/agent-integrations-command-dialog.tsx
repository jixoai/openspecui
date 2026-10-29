/**
 * Orthogonal intents (updated 2026-10-29 Asia/Shanghai):
 * 1. Present Agent Init, Update, and Repair command evidence in one native Dialog Terminal.
 * 2. Lock implicit dismissal while running and expose explicit cancellation.
 * 3. Separate destructive Repair confirmation from transport execution ownership.
 * 4. Render the 1.15-gated dry-run plan preview beside the Run control as verbatim CLI
 *    evidence: action chips and wrapped paths, closed note codes, per-tool failures as
 *    amber data rows (never an error banner), and the failed-command envelope as the only
 *    destructive row; preview absence never gates the real mutation.
 *
 * Original request (2026-08-01): Agent operations require Terminal evidence, loading locks, and cancel.
 * Original request (2026-10-29): "检查一下上游openspec是否发布新版本，如果我们按照规范跟进更新" — update plan preview evidence (target-openspec-cli-115-line).
 */
import { CliTerminal } from '@/components/cli-terminal'
import { Dialog } from '@/components/dialog'
import type { CliRunnerLine, OverallStatus } from '@/lib/use-cli-runner'
import { AlertTriangle, TerminalSquare } from 'lucide-react'

export type AgentCommandKind = 'init' | 'repair' | 'update'

/**
 * Display-facing shape of the 1.15 `update --dry-run --json` evidence.
 *
 * The route maps the typed transport result into this shape; the dialog renders it
 * verbatim and never derives readiness, gating, or a synthesized `move` action from it —
 * a legacy directory move stays the CLI's delete+add pair.
 */
export interface AgentUpdatePlanPreview {
  kind: 'loading' | 'unavailable' | 'executed'
  reason?: string
  plan?: {
    changes: ReadonlyArray<{ path: string; action: 'add' | 'update' | 'delete'; tool: string }>
    notes: ReadonlyArray<{ code: 'legacy-tool-directories' | 'legacy-artifacts'; message: string }>
    failures: ReadonlyArray<{ tool: string; error: string }>
  } | null
  exitCode?: number | null
  diagnostics?: ReadonlyArray<{ severity: string; code?: string; message: string }>
  contractError?: string | null
}

const COMMAND_TITLE: Record<AgentCommandKind, string> = {
  init: 'Initialize selected Agents',
  repair: 'Repair Agent delivery',
  update: 'Update Agent delivery',
}

const PLAN_ACTION_BADGE: Record<'add' | 'update' | 'delete', string> = {
  add: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200',
  update: 'border-sky-500/40 bg-sky-500/10 text-sky-800 dark:text-sky-200',
  delete: 'border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-200',
}

function PlanPreviewSection({ preview }: { preview: AgentUpdatePlanPreview }) {
  if (preview.kind === 'loading') {
    return (
      <div
        className="border-border bg-muted/40 rounded-md border p-3 text-xs"
        aria-label="Loading update plan"
      >
        <span className="bg-muted inline-block h-3 w-48 animate-pulse rounded" />
      </div>
    )
  }
  if (preview.kind === 'unavailable') {
    return (
      <p className="text-muted-foreground border-border rounded-md border border-dashed p-3 text-xs">
        Plan preview unavailable: {preview.reason} The real run below is unaffected.
      </p>
    )
  }
  const failedCommand =
    preview.contractError ??
    (preview.exitCode !== null && preview.exitCode !== undefined && preview.exitCode !== 0
      ? `update --dry-run exited with code ${preview.exitCode}.`
      : null)
  if (failedCommand) {
    return (
      <div
        role="alert"
        className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-3 text-xs"
      >
        <p className="font-medium">The plan command itself failed; nothing was written.</p>
        <p className="mt-1">{failedCommand}</p>
        {(preview.diagnostics ?? []).map((diagnostic, index) => (
          <p key={index} className="mt-1">
            {diagnostic.code ? <span className="font-mono">{diagnostic.code}</span> : null}{' '}
            {diagnostic.message}
          </p>
        ))}
      </div>
    )
  }
  const plan = preview.plan
  if (!plan) return null
  if (plan.changes.length === 0 && plan.failures.length === 0 && plan.notes.length === 0) {
    return (
      <p className="text-muted-foreground border-border rounded-md border border-dashed p-3 text-xs">
        The plan expects no artifact changes.
      </p>
    )
  }
  return (
    <div className="border-border rounded-md border p-3 text-xs">
      <p className="text-muted-foreground mb-2">
        Planned by <span className="font-mono">openspec update --dry-run</span>
        {preview.exitCode === 0 ? '' : ` (exit ${preview.exitCode})`}: {plan.changes.length}{' '}
        artifact change(s), {plan.failures.length} would fail.
      </p>
      {plan.changes.length > 0 ? (
        <ul className="max-h-40 space-y-1 overflow-y-auto" aria-label="Planned changes">
          {plan.changes.map((change) => (
            <li key={`${change.action}:${change.path}`} className="flex items-start gap-2">
              <span
                className={`inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 font-medium ${PLAN_ACTION_BADGE[change.action]}`}
              >
                {change.action}
              </span>
              <span className="min-w-0">
                <span className="break-all font-mono">{change.path}</span>
                <span className="text-muted-foreground"> — {change.tool}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {plan.notes.map((note) => (
        <p key={note.code} className="text-muted-foreground mt-2">
          <span className="border-border bg-muted inline-flex items-center rounded border px-1.5 py-0.5 font-medium">
            {note.code}
          </span>{' '}
          {note.message}
        </p>
      ))}
      {plan.failures.map((failure) => (
        <p
          key={failure.tool}
          className="mt-2 flex items-start gap-2 rounded border border-amber-500/40 bg-amber-500/10 p-2 text-amber-800 dark:text-amber-200"
        >
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          <span>
            <span className="font-mono">{failure.tool}</span> would fail: {failure.error} Later
            changes stop at this point, exactly as the real run would.
          </span>
        </p>
      ))}
    </div>
  )
}

/** Pure command lifecycle Dialog; the Config route owns the actual CLI runner. */
export function AgentIntegrationsCommandDialog({
  kind,
  status,
  hasStarted,
  lines,
  planPreview,
  onRun,
  onCancel,
  onClose,
}: {
  kind: AgentCommandKind | null
  status: OverallStatus
  hasStarted: boolean
  lines: CliRunnerLine[]
  planPreview?: AgentUpdatePlanPreview | null
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
      {kind === 'update' || kind === 'repair' ? (
        <PlanPreviewSection preview={planPreview ?? { kind: 'loading' }} />
      ) : null}
      <CliTerminal lines={lines} maxHeight="52vh" />
    </Dialog>
  )
}
