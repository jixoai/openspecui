/**
 * Orthogonal intents (created 2026-08-15 Asia/Shanghai):
 * 1. Present OpenSpec 1.9 `validate --archived --json` as typed CLI evidence.
 * 2. Preserve item issues, totals, root, and exit/failure evidence without repair actions.
 * 3. Identify the evidence as unavailable in static snapshots instead of fabricating it.
 * 4. Derive the capability from the detected admitted CLI and hide the action on 1.8.
 * 5. Validate report payloads with the Core contract schema, never shallow shape guards.
 *
 * Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"
 */
import { EvidenceDisclosure } from '@/components/information-disclosure'
import { isStaticMode } from '@/lib/static-mode'
import { trpcClient } from '@/lib/trpc'
import { useRootActionState } from '@/lib/use-root-action-state'
import {
  CliCommandTransportSchema,
  CliValidateReportSchema,
  type CliCommandResult,
  type CliValidateReport,
} from '@openspecui/core'
import {
  deriveOpenSpecCliCapabilities,
  parseOpenSpecCliVersion,
} from '@openspecui/core/openspec-compat'
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react'
import { useState } from 'react'

type ArchivedValidationReport = CliValidateReport

/**
 * Parse a report payload at the evidence boundary with the Core contract schema.
 *
 * A shallow `{ items, summary, root }` shape check would accept malformed nested totals and
 * item structures and then crash while rendering them; `safeParse` keeps every rendered
 * field contract-true. The schema's inferred report type is used directly after a successful
 * parse — no assertion cast sits at this external-evidence boundary.
 */
function parseValidationReport(value: unknown): ArchivedValidationReport | null {
  const parsed = CliValidateReportSchema.safeParse(value)
  return parsed.success ? parsed.data : null
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

/** On-demand, read-only archived-task validation evidence for the Change Evidence tab. */
export function ArchivedValidationEvidence() {
  const [report, setReport] = useState<CliCommandResult<unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const rootAction = useRootActionState()
  const cli = rootAction.context?.cli
  // `validate --archived` exists only on OpenSpec 1.9+. A supported 1.8 session must see
  // the capability as unavailable here, never a button that spawns a failing command.
  const capabilities = deriveOpenSpecCliCapabilities(
    cli?.available ? parseOpenSpecCliVersion(cli.version) : null
  )

  if (isStaticMode()) {
    return (
      <EvidenceDisclosure title="Archived validation" summary="Unavailable in static snapshot">
        <p className="text-muted-foreground">
          Archived-task validation is live CLI evidence and is not captured in this static snapshot.
        </p>
      </EvidenceDisclosure>
    )
  }

  // Only a detected, admitted CLI decides availability; while CLI evidence is still
  // pending the run UI stays and the Server's typed capability check remains the guard.
  if (cli?.available === true && !capabilities.archivedValidation) {
    const detected = cli.version ? ` (detected ${cli.version.trim()})` : ''
    return (
      <EvidenceDisclosure title="Archived validation" summary="Unavailable on this CLI line">
        <p className="text-muted-foreground">
          Archived-task validation requires the OpenSpec 1.9 line{detected}. This session&apos;s CLI
          does not declare the capability, so no command is offered.
        </p>
      </EvidenceDisclosure>
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
        setReport({ ...transport.data, data: transport.data.data ?? null, payload: null })
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
      <EvidenceDisclosure
        title="Archived validation"
        summary="OpenSpec 1.9 archived-task validation"
      >
        <div className="space-y-2">
          <p className="text-muted-foreground">
            Run the official CLI&apos;s archived-task validation and keep its typed report as
            evidence. OpenSpecUI never repairs or archives from here.
          </p>
          <RunButton pending={pending} label="Validate archived tasks" onRun={() => void run()} />
        </div>
      </EvidenceDisclosure>
    )
  }

  // A typed report is valid evidence even when the CLI exits non-zero: archived-task
  // failures are report content, not a transport or contract failure. Only a missing
  // report shape (transport error, contract drift) renders as failure evidence.
  const validationReport = report ? parseValidationReport(report.data) : null
  if (error || !validationReport) {
    return (
      <EvidenceDisclosure title="Archived validation" summary="CLI failure evidence">
        <div className="space-y-2">
          <div className="text-destructive flex items-start gap-2 break-words" role="alert">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 break-all">
              {error ??
                report?.contractError ??
                report?.stderr.trim() ??
                'The archived validation command failed.'}
            </span>
          </div>
          <RunButton pending={pending} label="Rerun" onRun={() => void run()} />
        </div>
      </EvidenceDisclosure>
    )
  }

  const validation = validationReport
  const failed = validation.summary.totals.failed
  return (
    <EvidenceDisclosure
      title="Archived validation"
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
    </EvidenceDisclosure>
  )
}
