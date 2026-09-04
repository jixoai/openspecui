/**
 * Orthogonal intents (updated 2026-09-04 Asia/Shanghai):
 * 1. Present the OpenSpec 1.12 `validate --report findings` document as typed CLI evidence.
 * 2. Attribute every item finding to its owning change: entries owned by the current change
 *    render as the primary "This change" list, while entries owned by other active changes
 *    stay in a clearly-labeled secondary disclosure with prominent change attribution — a
 *    finding never presents as this change's finding just because the scope is shared.
 * 3. Render INFO as a first-class informational class, distinct from warnings and errors.
 * 4. Show the filtered view honestly: `returnedItems` beside the preserved full-run totals,
 *    labeled as filtered, never presented as the complete validation result. Scope-level
 *    counts are never filtered to the current change.
 * 5. Gate the affordance behind the admitted line's `findingsReport` capability: non-admitted
 *    sessions get no findings action; static snapshots state the evidence is unavailable.
 * 6. Validate transport and findings payloads with the Core contract schemas, never shallow
 *    guards, and keep the CLI-owned request-error envelope on the direct plane.
 *
 * Original request (2026-09-03): "Openspec 1.12.0 刚刚放出来，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进"
 * Owner walkthrough correction (2026-09-04): findings must attribute their owning change; the Evidence detail panel styling follows the vision review.
 */
import { isStaticMode } from '@/lib/static-mode'
import { trpcClient } from '@/lib/trpc'
import { useRootActionState } from '@/lib/use-root-action-state'
import { cn } from '@/lib/utils'
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
import { AlertTriangle, Info, Loader2, OctagonAlert, RefreshCw } from 'lucide-react'
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

type FindingsItem = CliValidateFindings['itemFindings'][number]
type FindingsIssue = FindingsItem['issues'][number]

/** Semantic level chip: box-radius geometry, distinct glyph per class, tinted never flooded. */
const LEVEL_CHIP_CLASS: Record<FindingsIssue['level'], string> = {
  INFO: 'border-blue-600/40 bg-blue-500/5 text-blue-600 dark:text-blue-400',
  WARNING: 'border-amber-600/40 bg-amber-500/5 text-amber-600 dark:text-amber-400',
  ERROR: 'border-red-600/40 bg-red-500/5 text-red-600 dark:text-red-400',
}
const LEVEL_CHIP_GLYPH: Record<FindingsIssue['level'], typeof Info> = {
  INFO: Info,
  WARNING: AlertTriangle,
  ERROR: OctagonAlert,
}

function LevelChip({ level }: { level: FindingsIssue['level'] }) {
  const Glyph = LEVEL_CHIP_GLYPH[level]
  return (
    <span
      data-findings-level={level}
      className={`inline-flex shrink-0 items-center gap-1 border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${LEVEL_CHIP_CLASS[level]}`}
    >
      <Glyph className="h-3 w-3" aria-hidden />
      {level}
    </span>
  )
}

/**
 * One findings item as a header/body card. Each issue owns a header row (level chip, issue
 * path, item identity) and a neutral message body; multiple issues stack as divided rows.
 * The message itself never carries the level color — the chip is the only color carrier.
 */
function FindingCard({ item }: { item: FindingsItem }) {
  return (
    <article
      data-findings-item={item.id}
      className="border-border bg-card min-w-0 overflow-hidden rounded border"
    >
      <ul className="border-border/60 m-0 list-none divide-y p-0">
        {item.issues.map((issue, index) => (
          <li key={index} data-findings-issue={issue.level} className="min-w-0">
            <header className="border-border flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 border-b px-2.5 py-1.5">
              <LevelChip level={issue.level} />
              <span className="text-foreground min-w-0 flex-1 basis-[6rem] font-mono text-xs [overflow-wrap:anywhere]">
                {issue.path}
              </span>
              {index === 0 ? (
                <span className="text-muted-foreground max-w-full shrink-0 text-right font-mono text-[11px] [overflow-wrap:anywhere]">
                  {item.id} · {item.type} · {item.valid ? 'valid' : 'invalid'}
                </span>
              ) : null}
            </header>
            <p className="text-foreground/90 px-2.5 py-2 text-sm leading-relaxed [overflow-wrap:anywhere]">
              {issue.message}
            </p>
          </li>
        ))}
      </ul>
    </article>
  )
}

/** Compact count chip (box radius; pill geometry stays reserved for bare numeric counts). */
function CountChip({ label, tone }: { label: string; tone: 'passed' | 'failed' | 'muted' }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-xs font-medium',
        tone === 'passed' &&
          'border-emerald-600/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400',
        tone === 'failed' && 'border-red-600/40 bg-red-500/5 text-red-600 dark:text-red-400',
        tone === 'muted' && 'border-border bg-muted/50 text-muted-foreground'
      )}
    >
      {label}
    </span>
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
        <RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden />
      )}
      {label}
    </button>
  )
}

/**
 * Structure-agnostic section frame for the Evidence workspace detail pane: heading plus
 * summary facts stay on the record; the workspace, not a disclosure, owns reveal behavior.
 * The header follows the workspace's one header contract: rule, baseline padding, margin.
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
      <header className="border-border mb-4 flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b pb-2">
        <h3 className="min-w-0 text-xs font-semibold">Validation findings</h3>
        <span className="text-muted-foreground min-w-0 text-[11px]">{summary}</span>
      </header>
      <div className="min-w-0">{children}</div>
    </section>
  )
}

/**
 * On-demand, read-only validation findings evidence for the Change Evidence workspace.
 *
 * The findings report is a filtered view — only items with issues — over the same full-run
 * totals the complete validation report carries, so the section always presents
 * `returnedItems` beside the preserved totals and never claims to be the complete result.
 * The report covers the whole changes scope, so every item finding is attributed: the
 * current change's entries render as the primary list and other changes' entries stay in a
 * labeled secondary disclosure with the owning change id prominent.
 */
export function ValidationFindingsEvidence({
  changeId,
  onChip,
}: {
  /** Identity of the change whose Evidence tab owns this section; drives attribution. */
  changeId: string
  /** Receives the currently derived row-chip fact; `null` means "no fact, no chip". */
  onChip?: (chip: ValidationFindingsEvidenceChip | null) => void
}) {
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
      <ValidationFindingsSection summary="Not yet run">
        <div className="border-border bg-muted/20 max-w-[72ch] rounded-md border border-dashed p-6">
          {pending ? (
            <div className="flex items-center gap-2" role="status" data-findings-running="">
              <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" aria-hidden />
              <span className="text-sm font-medium">Running findings report…</span>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-semibold">No findings loaded</p>
              <p className="text-muted-foreground text-sm">
                Load the official CLI&apos;s validation findings to see advisory issues reported for
                the active changes in this scope — including archive-merge advisories. This is
                read-only evidence; nothing is repaired from here.
              </p>
              <div>
                <code className="border-border bg-muted rounded border px-1 py-0.5 font-mono text-[11px]">
                  openspec validate --report findings
                </code>
              </div>
              <RunButton
                pending={pending}
                label="Load validation findings"
                onRun={() => void run()}
              />
            </div>
          )}
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
            <span className="min-w-0 [overflow-wrap:anywhere]">
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
              <span className="min-w-0 [overflow-wrap:anywhere]">
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
  // Attribution split: the changes-scope document carries findings for every active change,
  // so entries are partitioned by owning id before rendering. Scope-level counts above stay
  // unfiltered — they describe the whole run, not the current change.
  const ownFindings = findings.itemFindings.filter((item) => item.id === changeId)
  const otherFindings = findings.itemFindings.filter((item) => item.id !== changeId)
  return (
    <ValidationFindingsSection
      summary={`Filtered view · ${findings.report.returnedItems} of ${findings.report.totalItems} items with findings`}
    >
      <div className="space-y-3">
        <p className="text-muted-foreground" data-findings-filtered-note>
          Filtered CLI evidence: only items that reported issues are listed. The complete validation
          result remains the full report; totals below are the full-run values the CLI preserved.
        </p>
        <dl
          data-findings-provenance=""
          className="@[28rem]:grid-cols-[150px_1fr] grid min-w-0 grid-cols-1 gap-x-3 gap-y-1"
        >
          <dt className="text-muted-foreground">Root</dt>
          <dd className="min-w-0 font-mono text-xs [overflow-wrap:anywhere]">
            {findings.root.path}
          </dd>
          <dt className="text-muted-foreground">Exit status</dt>
          <dd className="min-w-0 font-mono text-xs">
            {report?.exitCode === null || report?.exitCode === undefined ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              report.exitCode
            )}
          </dd>
          <dt className="text-muted-foreground">Items with findings</dt>
          <dd className="min-w-0 font-mono text-xs">
            {findings.report.returnedItems} of {findings.report.totalItems} ({findings.report.scope}{' '}
            scope)
          </dd>
        </dl>
        <div className="space-y-1.5">
          <div className="text-muted-foreground text-[11px]">Full-run totals</div>
          <div className="flex flex-wrap gap-1.5" data-findings-totals="">
            <CountChip label={`${totals.passed} passed`} tone="passed" />
            <CountChip
              label={`${totals.failed} failed`}
              tone={totals.failed > 0 ? 'failed' : 'muted'}
            />
            <CountChip label={`${totals.items} items`} tone="muted" />
          </div>
        </div>
        {findings.itemFindings.length === 0 ? (
          <p className="text-muted-foreground">
            No item in this scope reported an issue. This filtered view lists issues only — it is
            not the complete validation result.
          </p>
        ) : (
          <>
            <div className="space-y-2" data-findings-own="">
              <h4 className="text-xs font-semibold">This change</h4>
              {ownFindings.map((item) => (
                <FindingCard key={item.id} item={item} />
              ))}
              {ownFindings.length === 0 ? (
                <p className="text-muted-foreground" data-findings-own-empty="">
                  No findings for this change in the filtered scope. Other entries below belong to
                  other active changes.
                </p>
              ) : null}
            </div>
            {otherFindings.length > 0 ? (
              <details data-findings-other="" className="border-border rounded border">
                <summary className="cursor-pointer select-none px-2.5 py-2 text-xs font-medium">
                  Findings from other active changes ({otherFindings.length})
                </summary>
                <div className="border-border space-y-3 border-t px-2.5 py-2.5">
                  {otherFindings.map((item) => (
                    <div key={item.id} className="min-w-0 space-y-1" data-findings-other-item="">
                      <div className="text-foreground font-mono text-xs font-medium">{item.id}</div>
                      <FindingCard item={item} />
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
          </>
        )}
        <footer className="border-border mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t pt-3">
          <span className="text-muted-foreground font-mono text-[11px] [overflow-wrap:anywhere]">
            openspec validate --report findings · {findings.report.scope} scope
          </span>
          <RunButton pending={pending} label="Rerun" onRun={() => void run()} />
        </footer>
      </div>
    </ValidationFindingsSection>
  )
}
