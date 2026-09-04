/**
 * Orthogonal intents (updated 2026-09-03 Asia/Shanghai):
 * 1. Present OpenSpec `validate --archived --json` as typed CLI evidence.
 * 2. Preserve item issues, totals, root, and exit/failure evidence without repair actions.
 * 3. Identify the evidence as unavailable in static snapshots instead of fabricating it.
 * 4. Derive the capability from the detected admitted CLI; the admitted 1.12 line declares
 *    it, so the unavailable branch names the accepted range, not one series.
 * 5. Validate report payloads with the Core contract schema, never shallow shape guards.
 * 6. Mount directly inside the Evidence workspace detail pane: the Accordion shell is gone, the
 *    section header keeps the title and summary facts, and `onChip` reports only derived facts
 *    (pass/fail from the typed report, typed unavailable) for the workspace rows.
 *
 * Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"
 * Original request (2026-08-28): "直接将 0.10.0 和 0.11.0 一起适配，然后发布 v11。"
 * Original request (2026-08-28): "使用移动端的 list-detail 思维……分成两栏，左侧 list，右侧详情。这种结构替代手风琴会更好"
 * Original request (2026-09-03): "Openspec 1.12.0 刚刚放出来，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进"
 * Owner walkthrough correction (2026-09-04): every Evidence detail layer renders the shared EvidenceLayerHeader contract (title dominant over body, house-standard border padding); this replaces each layer's local weak header.
 */
import { EvidenceLayerHeader } from '@/components/evidence-layer-header'
import { isStaticMode } from '@/lib/static-mode'
import { trpcClient } from '@/lib/trpc'
import { useRootActionState } from '@/lib/use-root-action-state'
// Types may come from the barrel (erased at build); runtime schemas must come from the
// browser-safe subpath — the Core barrel re-exports Node-bound values (reactive-fs), and a
// value import from it drags AsyncLocalStorage into the browser bundle.
import type { CliCommandResult, CliValidateReport } from '@openspecui/core'
import {
  CliCommandTransportSchema,
  CliValidateReportSchema,
  deriveOpenSpecCliCapabilities,
  OPENSPEC_CLI_ACCEPTED_RANGE,
  parseOpenSpecCliVersion,
} from '@openspecui/core/openspec-compat'
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'

type ArchivedValidationReport = CliValidateReport

/**
 * Parse a report payload at the evidence boundary with the Core contract schema.
 *
 * A shallow `{ items, summary, root }` shape check would accept malformed nested totals and
 * item structures and then crash while rendering them; `safeParse` keeps every rendered
 * field contract-true. The schema's inferred report type is used directly after a successful
 * parse — no assertion cast sits at this external-evidence boundary.
 */
/** Schema-parse outcome for a report payload: the typed report or its typed diagnostic. */
export interface ParsedArchivedValidationReport {
  report: ArchivedValidationReport | null
  /** `path: message` entries from CliValidateReportSchema when the payload is malformed. */
  schemaIssues: readonly string[]
}

function parseValidationReport(value: unknown): ParsedArchivedValidationReport {
  const parsed = CliValidateReportSchema.safeParse(value)
  if (parsed.success) return { report: parsed.data, schemaIssues: [] }
  return {
    report: null,
    schemaIssues: parsed.error.issues.map(
      (issue) => `${issue.path.length > 0 ? issue.path.join('.') : '<root>'}: ${issue.message}`
    ),
  }
}

/**
 * Row-chip fact derived only from settled evidence. `positive`/`negative` come exclusively
 * from the typed report totals or failure evidence; `unavailable` names a typed degradation.
 * An unexecuted session reports no chip (`null`) — no fabricated verdict.
 */
export interface ArchivedValidationEvidenceChip {
  label: string
  tone: 'positive' | 'negative' | 'unavailable'
}

function IssueList({ issues }: { issues: ArchivedValidationReport['items'][number]['issues'] }) {
  if (issues.length === 0) {
    return <p className="text-muted-foreground">No CLI issue reported.</p>
  }
  return (
    <ul className="text-muted-foreground space-y-0.5">
      {issues.map((issue, index) => (
        <li key={index} className="break-words">
          {issue.level} · {issue.path} · {issue.message}
        </li>
      ))}
    </ul>
  )
}

function RunButton({ pending, label, onRun }: { pending: boolean; label: string; onRun(): void }) {
  return (
    <button
      type="button"
      onClick={onRun}
      disabled={pending}
      aria-busy={pending || undefined}
      className="border-border hover:bg-muted inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : (
        <RefreshCw className="h-3.5 w-3.5" aria-hidden />
      )}
      {label}
    </button>
  )
}

/**
 * Structure-agnostic section frame for the Evidence workspace detail pane. The heading and
 * summary line preserve the facts the former Accordion trigger carried; the content is
 * presented directly — the workspace, not a disclosure, owns reveal behavior.
 */
function ArchivedValidationSection({
  summary,
  children,
}: {
  summary: ReactNode
  children: ReactNode
}) {
  return (
    <section
      data-evidence-section="archived-validation"
      aria-label="Archived validation"
      className="min-w-0"
    >
      <EvidenceLayerHeader title="Archived validation" summary={summary} />
      <div className="min-w-0 text-xs">{children}</div>
    </section>
  )
}

/** On-demand, read-only archived-task validation evidence for the Change Evidence workspace. */
export function ArchivedValidationEvidence({
  onChip,
}: {
  /** Receives the currently derived row-chip fact; `null` means "no fact, no chip". */
  onChip?: (chip: ArchivedValidationEvidenceChip | null) => void
} = {}) {
  const [report, setReport] = useState<CliCommandResult<unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const rootAction = useRootActionState()
  const cli = rootAction.context?.cli
  const staticMode = isStaticMode()
  // `validate --archived` exists on OpenSpec 1.9+ and the admitted 1.12 line declares it.
  // An available-but-out-of-range session (e.g. a bypassed 1.11 CLI) must see the
  // capability as unavailable here, never a button that spawns a failing command.
  const capabilities = deriveOpenSpecCliCapabilities(
    cli?.available ? parseOpenSpecCliVersion(cli.version) : null
  )

  // Row-chip fact for the workspace list — derived from the same settled states the section
  // renders. Before a run there is no verdict to project, so no chip is fabricated.
  const chip = useMemo<ArchivedValidationEvidenceChip | null>(() => {
    if (staticMode) return { label: 'unavailable', tone: 'unavailable' }
    if (cli?.available === true && !capabilities.archivedValidation) {
      return { label: 'unavailable', tone: 'unavailable' }
    }
    if (!report && !error) return null
    const parsed = report ? parseValidationReport(report.data) : { report: null, schemaIssues: [] }
    if (error || !parsed.report) return { label: 'fail', tone: 'negative' }
    return parsed.report.summary.totals.failed > 0
      ? { label: 'fail', tone: 'negative' }
      : { label: 'pass', tone: 'positive' }
  }, [capabilities.archivedValidation, cli?.available, error, report, staticMode])

  useEffect(() => {
    onChip?.(chip)
  }, [chip, onChip])

  if (staticMode) {
    return (
      <ArchivedValidationSection summary="Unavailable in static snapshot">
        <p className="text-muted-foreground">
          Archived-task validation is live CLI evidence and is not captured in this static snapshot.
        </p>
      </ArchivedValidationSection>
    )
  }

  // Only a detected, admitted CLI decides availability; while CLI evidence is still
  // pending the run UI stays and the Server's typed capability check remains the guard.
  if (cli?.available === true && !capabilities.archivedValidation) {
    const detected = cli.version ? ` (detected ${cli.version.trim()})` : ''
    return (
      <ArchivedValidationSection summary="Unavailable on this CLI line">
        <p className="text-muted-foreground">
          Archived-task validation requires an admitted OpenSpec CLI line (
          {OPENSPEC_CLI_ACCEPTED_RANGE}){detected}. This session&apos;s CLI does not declare the
          capability, so no command is offered.
        </p>
      </ArchivedValidationSection>
    )
  }

  const run = async () => {
    setPending(true)
    setError(null)
    setReport(null)
    try {
      const result = await trpcClient.cli.validate.mutate({ kind: 'archived' })
      // Validate the transport envelope with the same contract schema family as the report
      // payload — no shallow key-presence guard at this evidence boundary. An unrecognized
      // shape becomes typed failure evidence instead of a cast assumption.
      const transport = CliCommandTransportSchema.safeParse(result)
      if (transport.success) {
        // The envelope is contract-validated; `data` stays raw here and is parsed with
        // CliValidateReportSchema at the render boundary, so no cast is needed for state.
        // The CLI-supplied payload is retained exactly as delivered — nulling it would
        // discard verified evidence the operator may need to audit the failure.
        setReport({
          ...transport.data,
          data: transport.data.data ?? null,
          payload: transport.data.payload ?? null,
        })
      } else {
        setError('The archived validation transport returned an unrecognized result shape.')
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setPending(false)
    }
  }

  if (!report && !error) {
    return (
      <ArchivedValidationSection summary="OpenSpec archived-task validation">
        <div className="space-y-2">
          <p className="text-muted-foreground">
            Run the official CLI&apos;s archived-task validation and keep its typed report as
            evidence. OpenSpecUI never repairs or archives from here.
          </p>
          <RunButton pending={pending} label="Validate archived tasks" onRun={() => void run()} />
        </div>
      </ArchivedValidationSection>
    )
  }

  // A typed report is valid evidence even when the CLI exits non-zero: archived-task
  // failures are report content, not a transport or contract failure. Only a missing
  // report shape (transport error, contract drift) renders as failure evidence.
  const parsed = report ? parseValidationReport(report.data) : { report: null, schemaIssues: [] }
  const validationReport = parsed.report
  if (error || !validationReport) {
    const schemaDiagnostic = parsed.schemaIssues.length > 0 ? parsed.schemaIssues.join('; ') : null
    return (
      <ArchivedValidationSection summary="CLI failure evidence">
        <div className="space-y-2">
          <div className="text-destructive flex items-start gap-2 break-words" role="alert">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 break-all">
              {error ??
                report?.contractError ??
                schemaDiagnostic ??
                report?.stderr.trim() ??
                'The archived validation command failed.'}
            </span>
          </div>
          <RunButton pending={pending} label="Rerun" onRun={() => void run()} />
        </div>
      </ArchivedValidationSection>
    )
  }

  const validation = validationReport
  const failed = validation.summary.totals.failed
  return (
    <ArchivedValidationSection
      summary={`${validation.summary.totals.passed} passed · ${failed} failed`}
    >
      <div className="space-y-3">
        <dl className="@[32rem]:grid-cols-[auto_minmax(0,1fr)] grid min-w-0 gap-x-3 gap-y-1">
          <dt className="text-muted-foreground">Root</dt>
          <dd className="min-w-0 break-all font-mono">{validation.root.path}</dd>
          <dt className="text-muted-foreground">Exit</dt>
          <dd>{report?.exitCode ?? 'unknown'}</dd>
          <dt className="text-muted-foreground">Totals</dt>
          <dd>
            {validation.summary.totals.passed} passed · {failed} failed ·{' '}
            {validation.summary.totals.items} archived changes
          </dd>
        </dl>
        <div className="space-y-2">
          {validation.items.map((item) => (
            <div key={item.id} className="border-border/60 rounded border p-2">
              <div className="flex min-w-0 items-center gap-2">
                {item.valid ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />
                )}
                <span className="min-w-0 break-all font-mono text-[11px]">{item.id}</span>
              </div>
              <div className="mt-1">
                <IssueList issues={item.issues} />
              </div>
            </div>
          ))}
        </div>
        <RunButton pending={pending} label="Rerun" onRun={() => void run()} />
      </div>
    </ArchivedValidationSection>
  )
}
