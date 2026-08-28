/**
 * Orthogonal intents (created 2026-08-28 Asia/Shanghai):
 * 1. Present OpenSpec `validate --specs` and `validate <id> --type spec --json` as typed CLI evidence.
 * 2. Share one on-demand, read-only surface for the all-specs toolbar action and the owned-spec
 *    detail action; OpenSpecUI never repairs or rewrites anything from here.
 * 3. Identify the evidence as unavailable in static snapshots instead of fabricating it.
 * 4. Validate transport and report payloads with the Core contract schemas, never shallow guards.
 *
 * Original request (2026-08-28): Specifications 列表右上角提供"校验全部 specs"，单 spec 详情右上角提供单项校验。
 */
import { isStaticMode } from '@/lib/static-mode'
import { trpcClient } from '@/lib/trpc'
// Types may come from the barrel (erased at build); runtime schemas must come from the
// browser-safe subpath — the Core barrel re-exports Node-bound values (reactive-fs), and a
// value import from it drags AsyncLocalStorage into the browser bundle.
import type { CliCommandResult, CliValidateReport } from '@openspecui/core'
import {
  CliCommandTransportSchema,
  CliValidateReportSchema,
} from '@openspecui/core/openspec-compat'
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react'
import { useState } from 'react'

/** What the official CLI validates: every planning-root main spec, or one spec by id. */
export type SpecValidationTarget = { kind: 'specs' } | { kind: 'spec'; specId: string }

type SpecValidationReport = CliValidateReport

function parseValidationReport(value: unknown): {
  report: SpecValidationReport | null
  schemaIssues: readonly string[]
} {
  const parsed = CliValidateReportSchema.safeParse(value)
  if (parsed.success) return { report: parsed.data, schemaIssues: [] }
  return {
    report: null,
    schemaIssues: parsed.error.issues.map(
      (issue) => `${issue.path.length > 0 ? issue.path.join('.') : '<root>'}: ${issue.message}`
    ),
  }
}

function IssueList({ issues }: { issues: SpecValidationReport['items'][number]['issues'] }) {
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

function RunButton({
  pending,
  label,
  onRun,
}: {
  pending: boolean
  label: string
  onRun: () => void
}) {
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
 * On-demand spec-scope validation evidence. Mounts with its trigger aligned to the inline-end
 * of a page header; the typed report panel unfolds beneath it only after a run, so unexecuted
 * sessions render no verdict at all.
 */
export function SpecValidationEvidence({ target }: { target: SpecValidationTarget }) {
  const [report, setReport] = useState<CliCommandResult<unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const staticMode = isStaticMode()
  const label = target.kind === 'specs' ? 'Validate specs' : 'Validate this spec'

  if (staticMode) {
    return (
      <p className="text-muted-foreground max-w-xs text-right text-xs">
        Spec validation is live CLI evidence and is not captured in this static snapshot.
      </p>
    )
  }

  const run = async () => {
    setPending(true)
    setError(null)
    setReport(null)
    try {
      const input =
        target.kind === 'specs'
          ? ({ kind: 'scope', scope: 'specs' } as const)
          : ({ kind: 'item', id: target.specId, type: 'spec' } as const)
      const result = await trpcClient.cli.validate.mutate(input)
      // Validate the transport envelope with the contract schema — a shallow key-presence
      // guard would accept malformed evidence shapes at this boundary.
      const transport = CliCommandTransportSchema.safeParse(result)
      if (transport.success) {
        setReport({
          ...transport.data,
          data: transport.data.data ?? null,
          payload: transport.data.payload ?? null,
        })
      } else {
        setError('The spec validation transport returned an unrecognized result shape.')
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setPending(false)
    }
  }

  if (!report && !error) {
    return <RunButton pending={pending} label={label} onRun={() => void run()} />
  }

  const parsed = report ? parseValidationReport(report.data) : { report: null, schemaIssues: [] }
  const validationReport = parsed.report
  if (error || !validationReport) {
    const schemaDiagnostic = parsed.schemaIssues.length > 0 ? parsed.schemaIssues.join('; ') : null
    return (
      <div className="border-border/60 w-full max-w-2xl self-end rounded border p-3 text-left">
        <div className="text-destructive flex items-start gap-2 break-words" role="alert">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 break-all">
            {error ??
              report?.contractError ??
              schemaDiagnostic ??
              report?.stderr.trim() ??
              'The spec validation command failed.'}
          </span>
        </div>
        <div className="mt-2">
          <RunButton pending={pending} label="Rerun" onRun={() => void run()} />
        </div>
      </div>
    )
  }

  const failed = validationReport.summary.totals.failed
  return (
    <div className="border-border/60 w-full max-w-2xl self-end rounded border p-3 text-left">
      <div className="space-y-3">
        <dl className="grid min-w-0 gap-x-3 gap-y-1">
          <dt className="text-muted-foreground">Root</dt>
          <dd className="min-w-0 break-all font-mono">{validationReport.root.path}</dd>
          <dt className="text-muted-foreground">Exit</dt>
          <dd>{report?.exitCode ?? 'unknown'}</dd>
          <dt className="text-muted-foreground">Totals</dt>
          <dd>
            {validationReport.summary.totals.passed} passed · {failed} failed ·{' '}
            {validationReport.summary.totals.items} specs
          </dd>
        </dl>
        <div className="space-y-2">
          {validationReport.items.map((item) => (
            <div key={item.id} className="border-border/60 rounded border p-2">
              <div className="flex min-w-0 items-center gap-2">
                {item.valid && item.issues.length === 0 ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
                ) : (
                  <AlertTriangle
                    className={`h-3.5 w-3.5 shrink-0 ${item.valid ? 'text-amber-600' : 'text-destructive'}`}
                    aria-hidden
                  />
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
    </div>
  )
}
