/**
 * Orthogonal intents (created 2026-09-03 Asia/Shanghai):
 * 1. Present the OpenSpec 1.12 `validate --report findings` document as typed CLI evidence.
 * 2. Render INFO as a first-class informational class, distinct from warnings and errors.
 * 3. Show the filtered view honestly: `returnedItems` beside the preserved full-run totals,
 *    labeled as filtered, never presented as the complete validation result.
 * 4. Gate the affordance behind the admitted line's `findingsReport` capability: non-admitted
 *    sessions get no findings action; static snapshots state the evidence is unavailable.
 * 5. Validate transport and findings payloads with the Core contract schemas, never shallow
 *    guards, and keep the CLI-owned request-error envelope on the direct plane.
 *
 * Original request (2026-09-03): "Openspec 1.12.0 刚刚放出来，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进"
 */
import { isStaticMode } from '@/lib/static-mode'
import { trpcClient } from '@/lib/trpc'
import { useRootActionState } from '@/lib/use-root-action-state'
// Types may come from the barrel (erased at build); runtime schemas must come from the
// browser-safe subpath — the Core barrel re-exports Node-bound values (reactive-fs), and a
// value import from it drags AsyncLocalStorage into the browser bundle.
import type {
  CliCommandResult,
  CliValidateFindings,
  CliValidateFindingsResult,
} from '@openspecui/core'
import {
  CliCommandTransportSchema,
  CliValidateFindingsResultSchema,
  CliValidateFindingsSchema,
  deriveOpenSpecCliCapabilities,
  isCliValidateFindings,
  OPENSPEC_CLI_ACCEPTED_RANGE,
  parseOpenSpecCliVersion,
} from '@openspecui/core/openspec-compat'
import { AlertTriangle, CheckCircle2, Info, Loader2, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'

/**
 * Schema-parse outcome for a findings payload, as one self-narrowing union: the typed
 * findings document, the typed request-failure envelope, or the schema diagnostic when the
 * payload is malformed.
 */
export type ParsedValidationFindings =
  | { kind: 'findings'; findings: CliValidateFindings }
  | { kind: 'request-failure'; failure: Exclude<CliValidateFindingsResult, CliValidateFindings> }
  | { kind: 'malformed'; schemaIssues: readonly string[] }

function parseFindingsPayload(value: unknown): ParsedValidationFindings {
  const parsed = CliValidateFindingsResultSchema.safeParse(value)
  if (parsed.success) {
    return isCliValidateFindings(parsed.data)
      ? { kind: 'findings', findings: parsed.data }
      : { kind: 'request-failure', failure: parsed.data }
  }
  // The union alone reports a root-level "Invalid input" that hides which field drifted;
  // the document schema carries the path-precise diagnostic for the same payload.
  const document = CliValidateFindingsSchema.safeParse(value)
  const source = document.success ? parsed.error : document.error
  return {
    kind: 'malformed',
    schemaIssues: source.issues.map(
      (issue) => `${issue.path.length > 0 ? issue.path.join('.') : '<root>'}: ${issue.message}`
    ),
  }
}

/**
 * Row-chip fact derived only from settled evidence. `neutral` carries the filtered
 * findings count; `negative` carries CLI-reported full-run failures; `unavailable` names a
 * typed degradation. An unexecuted session reports no chip — no fabricated verdict.
 */
export interface ValidationFindingsEvidenceChip {
  label: string
  tone: 'neutral' | 'negative' | 'unavailable'
}

const ISSUE_LEVEL_CLASS: Record<
  CliValidateFindings['itemFindings'][number]['issues'][number]['level'],
  string
> = {
  INFO: 'text-sky-700 dark:text-sky-300',
  WARNING: 'text-amber-700 dark:text-amber-300',
  ERROR: 'text-destructive',
}

function IssueList({ issues }: { issues: CliValidateFindings['itemFindings'][number]['issues'] }) {
  if (issues.length === 0) {
    return <p className="text-muted-foreground">No CLI issue reported.</p>
  }
  return (
    <ul className="space-y-0.5">
      {issues.map((issue, index) => (
        <li
          key={index}
          data-findings-level={issue.level}
          className={`flex items-start gap-1.5 break-words ${ISSUE_LEVEL_CLASS[issue.level]}`}
        >
          {issue.level === 'INFO' ? (
            <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          ) : (
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          )}
          <span className="min-w-0 break-all">
            {issue.level} · {issue.path} · {issue.message}
          </span>
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
 * Structure-agnostic section frame for the Evidence workspace detail pane: heading plus
 * summary facts stay on the record; the workspace, not a disclosure, owns reveal behavior.
 */
function ValidationFindingsSection({
  summary,
  children,
}: {
  summary: ReactNode
  children: ReactNode
}) {
  return (
    <section
      data-evidence-section="validation-findings"
      aria-label="Validation findings"
      className="min-w-0"
    >
      <header className="border-border/60 flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b pb-2">
        <h3 className="min-w-0 text-xs font-semibold">Validation findings</h3>
        <span className="text-muted-foreground min-w-0 text-[11px]">{summary}</span>
      </header>
      <div className="min-w-0 pt-3">{children}</div>
    </section>
  )
}

/**
 * On-demand, read-only validation findings evidence for the Change Evidence workspace.
 *
 * The findings report is a filtered view — only items with issues — over the same full-run
 * totals the complete validation report carries, so the section always presents
 * `returnedItems` beside the preserved totals and never claims to be the complete result.
 */
export function ValidationFindingsEvidence({
  onChip,
}: {
  /** Receives the currently derived row-chip fact; `null` means "no fact, no chip". */
  onChip?: (chip: ValidationFindingsEvidenceChip | null) => void
} = {}) {
  const [report, setReport] = useState<CliCommandResult<unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const rootAction = useRootActionState()
  const cli = rootAction.context?.cli
  const staticMode = isStaticMode()
  // `validate --report findings` exists on OpenSpec 1.12 only. A detected-but-retired
  // session (for example a bypassed 1.11 CLI) must see no findings action here, never a
  // button that spawns a command the CLI rejects.
  const capabilities = deriveOpenSpecCliCapabilities(
    cli?.available ? parseOpenSpecCliVersion(cli.version) : null
  )

  // Row-chip fact for the workspace list — derived from the same settled states the
  // section renders. Before a run there is no verdict to project, so no chip is fabricated.
  const chip = useMemo<ValidationFindingsEvidenceChip | null>(() => {
    if (staticMode) return { label: 'unavailable', tone: 'unavailable' }
    if (cli?.available === true && !capabilities.findingsReport) {
      return { label: 'unavailable', tone: 'unavailable' }
    }
    if (!report && !error) return null
    const parsed = report ? parseFindingsPayload(report.data) : null
    if (error || !parsed || parsed.kind === 'malformed') {
      return { label: 'fail', tone: 'negative' }
    }
    if (parsed.kind === 'request-failure') return { label: 'fail', tone: 'negative' }
    const findings = parsed.findings
    return findings.summary.totals.failed > 0
      ? { label: `${findings.summary.totals.failed} failed`, tone: 'negative' }
      : { label: `${findings.report.returnedItems} findings`, tone: 'neutral' }
  }, [capabilities.findingsReport, cli?.available, error, report, staticMode])

  useEffect(() => {
    onChip?.(chip)
  }, [chip, onChip])

  if (staticMode) {
    return (
      <ValidationFindingsSection summary="Unavailable in static snapshot">
        <p className="text-muted-foreground">
          Validation findings are live CLI evidence and are not captured in this static snapshot.
        </p>
      </ValidationFindingsSection>
    )
  }

  // Only a detected, admitted CLI decides availability; while CLI evidence is still pending
  // the run UI stays and the Server's typed capability check remains the guard.
  if (cli?.available === true && !capabilities.findingsReport) {
    const detected = cli.version ? ` (detected ${cli.version.trim()})` : ''
    return (
      <ValidationFindingsSection summary="Unavailable on this CLI line">
        <p className="text-muted-foreground">
          Validation findings require the admitted OpenSpec CLI line ({OPENSPEC_CLI_ACCEPTED_RANGE})
          {detected}. This session&apos;s CLI does not declare the findings-report capability, so no
          command is offered.
        </p>
      </ValidationFindingsSection>
    )
  }

  const run = async () => {
    setPending(true)
    setError(null)
    setReport(null)
    try {
      const result = await trpcClient.cli.validate.mutate({ kind: 'findings', scope: 'changes' })
      // Validate the transport envelope with the same contract schema family as the
      // findings payload — no shallow key-presence guard at this evidence boundary.
      const transport = CliCommandTransportSchema.safeParse(result)
      if (transport.success) {
        setReport({
          ...transport.data,
          data: transport.data.data ?? null,
          payload: transport.data.payload ?? null,
        })
      } else {
        setError('The validation findings transport returned an unrecognized result shape.')
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setPending(false)
    }
  }

  if (!report && !error) {
    return (
      <ValidationFindingsSection summary="Filtered CLI findings for active changes">
        <div className="space-y-2">
          <p className="text-muted-foreground">
            Run the official CLI&apos;s findings report (`validate --report findings`) and keep its
            typed document as evidence, including advisory archive-merge findings. OpenSpecUI never
            repairs anything from here.
          </p>
          <RunButton pending={pending} label="Load validation findings" onRun={() => void run()} />
        </div>
      </ValidationFindingsSection>
    )
  }

  const parsed = report ? parseFindingsPayload(report.data) : null
  // The CLI-owned request-error envelope is failure evidence on the direct plane — the
  // route passed it through verbatim, and so does this surface.
  if (error || !parsed || parsed.kind === 'malformed') {
    const schemaDiagnostic =
      parsed?.kind === 'malformed' && parsed.schemaIssues.length > 0
        ? parsed.schemaIssues.join('; ')
        : null
    return (
      <ValidationFindingsSection summary="CLI failure evidence">
        <div className="space-y-2">
          <div className="text-destructive flex items-start gap-2 break-words" role="alert">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 break-all">
              {error ??
                report?.contractError ??
                schemaDiagnostic ??
                report?.stderr.trim() ??
                'The validation findings command failed.'}
            </span>
          </div>
          <RunButton pending={pending} label="Rerun" onRun={() => void run()} />
        </div>
      </ValidationFindingsSection>
    )
  }

  if (parsed.kind === 'request-failure') {
    const entries = parsed.failure.status
    return (
      <ValidationFindingsSection summary="CLI request failure">
        <div className="space-y-2">
          {entries.map((entry, index) => (
            <div
              key={index}
              data-findings-request-error={entry.code}
              className="text-destructive flex items-start gap-2 break-words"
              role="alert"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="min-w-0 break-all">
                {entry.code}: {entry.message}
              </span>
            </div>
          ))}
          {entries.some((entry) => entry.fix !== undefined) ? (
            <p className="break-words" data-findings-request-fix>
              CLI fix suggestion: {entries.find((entry) => entry.fix !== undefined)?.fix}
            </p>
          ) : null}
          <RunButton pending={pending} label="Rerun" onRun={() => void run()} />
        </div>
      </ValidationFindingsSection>
    )
  }

  const findings = parsed.findings
  const totals = findings.summary.totals
  return (
    <ValidationFindingsSection
      summary={`Filtered view · ${findings.report.returnedItems} of ${findings.report.totalItems} items with findings`}
    >
      <div className="space-y-3">
        <p className="text-muted-foreground" data-findings-filtered-note>
          Filtered CLI evidence: only items that reported issues are listed. The complete validation
          result remains the full report; totals below are the full-run values the CLI preserved.
        </p>
        <dl className="@[32rem]:grid-cols-[auto_minmax(0,1fr)] grid min-w-0 gap-x-3 gap-y-1">
          <dt className="text-muted-foreground">Root</dt>
          <dd className="min-w-0 break-all font-mono">{findings.root.path}</dd>
          <dt className="text-muted-foreground">Exit</dt>
          <dd>{report?.exitCode ?? 'unknown'}</dd>
          <dt className="text-muted-foreground">Items with findings</dt>
          <dd>
            {findings.report.returnedItems} of {findings.report.totalItems} ({findings.report.scope}{' '}
            scope)
          </dd>
          <dt className="text-muted-foreground">Full-run totals</dt>
          <dd>
            {totals.passed} passed · {totals.failed} failed · {totals.items} items
          </dd>
        </dl>
        <div className="space-y-2">
          {findings.itemFindings.map((item) => (
            <div key={item.id} className="border-border/60 rounded border p-2">
              <div className="flex min-w-0 items-center gap-2">
                {item.valid ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />
                )}
                <span className="min-w-0 break-all font-mono text-[11px]">{item.id}</span>
                <span className="text-muted-foreground shrink-0 text-[10px]">{item.type}</span>
              </div>
              <div className="mt-1">
                <IssueList issues={item.issues} />
              </div>
            </div>
          ))}
          {findings.itemFindings.length === 0 ? (
            <p className="text-muted-foreground">
              No item in this scope reported an issue. This filtered view lists issues only — it is
              not the complete validation result.
            </p>
          ) : null}
        </div>
        <RunButton pending={pending} label="Rerun" onRun={() => void run()} />
      </div>
    </ValidationFindingsSection>
  )
}
