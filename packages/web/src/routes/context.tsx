/**
 * Orthogonal intents (updated 2026-07-29 Asia/Shanghai):
 * 1. Project one launch project's CLI-selected root as Config-owned Resolved Context.
 * 2. Present current, stale, terminal-error, and failed-attempt authority without hiding failures.
 * 3. Present the inherited Store registry/data scope as read-only environment evidence.
 * 4. Expose each Root Context command-evidence envelope through on-demand disclosure.
 * 5. Route static mode to publication-safe Context facts without starting the live owner.
 *
 * Original request (2026-07-15): "我们这个项目本身只是 OpenSpec 的一个可视化投影，所以保持客观中立很重要。"
 * Derived requirement (2026-07-18): Checkpoint 6.9 replaces the project Stores route with Context.
 * Original request (2026-07-27): "统一修复所有类似的问题（我们也没不多，各个页面都检查一下，特别是app 那边新增的页面）"
 * Owner acceptance feedback (2026-07-28): "Static 导出后的 /context 页面没数据。"
 * Original request (2026-07-28): Context remains the evidence owner but should default to a concise OPSX-first hierarchy.
 * Owner correction (2026-07-29): Context must answer Planning root, Launch project, Store/References, and action readiness before machine evidence.
 * Owner same-root direction (2026-07-29): consolidate Launch and Planning identity without hiding ignored-pointer evidence.
 * Owner Context direction (2026-07-29): move to `/config/context`, add a Config return, and separate direct facts from evidence.
 */
import {
  ResolvedContextHeader,
  type ResolvedContextStatus,
} from '@/components/config/resolved-context-header'
import { EvidenceDisclosure, InformationBadge } from '@/components/information-disclosure'
import { DetailPanelSkeleton, RealtimeRevalidateCue } from '@/components/realtime'
import { selectRootTopology } from '@/lib/root-topology'
import { isStaticMode } from '@/lib/static-mode'
import { selectRootContextSnapshot, useContextSubscription } from '@/lib/use-context-subscription'
import type { RootContext, RootContextCommandEvidence } from '@openspecui/core'
import { AlertCircle } from 'lucide-react'
import { StaticContextView } from './context-static'

/** Render project Root, observed References, registry diagnostics, and raw CLI evidence. */
export function ContextView() {
  return isStaticMode() ? <StaticContextView /> : <LiveContextView />
}

function LiveContextView() {
  const { data: projection, isLoading, error: transportError, authority } = useContextSubscription()
  const context = selectRootContextSnapshot(projection)
  const projectionError = projection?.state === 'error' ? projection.error : null
  const loading =
    !transportError &&
    !projectionError &&
    (isLoading || projection?.state === 'loading') &&
    context === null
  const staleContext = projection?.state === 'error' ? projection.data : null
  const failedAttempt = projection?.state === 'error' ? projection.attempt : null
  const pageStatus: ResolvedContextStatus =
    transportError || projectionError || authority.state === 'failed'
      ? 'blocked'
      : loading
        ? 'resolving'
        : projection?.state === 'refreshing' || authority.state !== 'current'
          ? 'refreshing'
          : 'ready'

  return (
    <div className="space-y-6 p-4">
      <ResolvedContextHeader status={pageStatus} />

      {loading ? <DetailPanelSkeleton count={4} /> : null}

      {transportError || projectionError ? (
        <div
          role="alert"
          className="text-destructive border-destructive/40 bg-destructive/10 flex items-start gap-2 rounded-lg border p-4 text-sm"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">Root Context is not ready.</p>
            <p>{transportError?.message ?? projectionError?.message}</p>
            {projection?.state === 'error' && projection.data ? (
              <p className="text-muted-foreground mt-1 text-xs">
                Showing the last successful observation while retaining the failed CLI attempt.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {!loading && staleContext && failedAttempt ? (
        <div className="space-y-6">
          <ContextObservation label="Last successful Context (stale)" context={staleContext} />
          <ContextObservation
            label="Current failed attempt"
            context={failedAttempt}
            rootHeading="Attempted planning root"
          />
        </div>
      ) : !loading && failedAttempt ? (
        <ContextObservation
          label="Current failed attempt"
          context={failedAttempt}
          rootHeading="Attempted planning root"
        />
      ) : !loading && context ? (
        <RealtimeRevalidateCue active={projection?.state === 'refreshing'}>
          <ContextBody
            context={context}
            actionStatus={
              projection?.state === 'ready' && authority.state === 'current'
                ? 'ready'
                : authority.state === 'failed'
                  ? 'blocked'
                  : 'checking'
            }
          />
        </RealtimeRevalidateCue>
      ) : null}
    </div>
  )
}

function ContextObservation({
  context,
  label,
  rootHeading,
}: {
  context: RootContext
  label: string
  rootHeading?: string
}) {
  return (
    <section aria-label={label} className="space-y-3">
      <h2 className="text-muted-foreground text-xs font-semibold uppercase">{label}</h2>
      <ContextBody context={context} rootHeading={rootHeading} />
    </section>
  )
}

function ContextBody({
  actionStatus = 'blocked',
  context,
  rootHeading = 'Active planning root',
}: {
  actionStatus?: 'ready' | 'checking' | 'blocked'
  context: RootContext
  rootHeading?: string
}) {
  const planningRoot = context.planningRoot
  const diagnostics = [
    ...context.diagnostics.root,
    ...context.diagnostics.doctor,
    ...context.diagnostics.context,
  ]
  const referenceErrors = context.references.flatMap((reference) =>
    reference.status
      .filter((diagnostic) => diagnostic.severity === 'error')
      .map((diagnostic) => `${reference.store_id}: ${diagnostic.message}`)
  )
  const commandContractErrors = [
    context.evidence.doctor?.contractError
      ? `Doctor contract drift: ${context.evidence.doctor.contractError}`
      : null,
    context.evidence.context?.contractError
      ? `Context contract drift: ${context.evidence.context.contractError}`
      : null,
  ].filter((error): error is string => error !== null)
  const referenceDiagnosticCount = context.references.reduce(
    (count, reference) => count + reference.status.length,
    0
  )
  const rootTopology = selectRootTopology(context)
  const ignoredStorePointerWarnings = diagnostics.filter(
    (diagnostic) => diagnostic.severity === 'warning' && diagnostic.code === 'root_pointer_ignored'
  )
  const errorDiagnostics = diagnostics.filter((diagnostic) => diagnostic.severity === 'error')
  const supportingDiagnostics = diagnostics.filter((diagnostic) => diagnostic.severity !== 'error')
  const topologyContent =
    rootTopology === 'collapsed'
      ? {
          label: 'Single project root',
          tooltip: 'Launch and Planning resolve to the same physical project root.',
        }
      : rootTopology === 'distinct'
        ? {
            label: 'Separate roots',
            tooltip: 'Launch and Planning resolve to different physical roots.',
          }
        : {
            label: 'Relationship unresolved',
            tooltip:
              'The server has not observed enough physical identity evidence to compare the roots.',
          }

  return (
    <div className="@container min-w-0 space-y-4">
      <section aria-label="Operational Context" className="border-border min-w-0 divide-y border-y">
        <div className="flex min-w-0 flex-wrap items-start gap-2 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-muted-foreground text-xs">
              {rootTopology === 'collapsed' ? 'Project root' : rootHeading}
            </div>
            <div className="mt-1 min-w-0 break-all font-mono text-sm font-medium">
              {planningRoot?.path ?? 'No planning root resolved.'}
            </div>
          </div>
          {planningRoot ? (
            <InformationBadge
              ariaLabel={`Planning root source ${planningRoot.source}`}
              tooltip={`OpenSpec selected this root from source: ${planningRoot.source}.`}
            >
              {planningRoot.source}
            </InformationBadge>
          ) : null}
          {context.storeId ? (
            <InformationBadge
              ariaLabel={`Planning Store ${context.storeId}`}
              tooltip={`The CLI-selected Planning root uses Store ${context.storeId}.`}
            >
              Store {context.storeId}
            </InformationBadge>
          ) : null}
          <InformationBadge
            ariaLabel={`Root relationship ${topologyContent.label.toLowerCase()}`}
            tooltip={topologyContent.tooltip}
          >
            {topologyContent.label}
          </InformationBadge>
          {ignoredStorePointerWarnings.length > 0 ? (
            <InformationBadge
              ariaLabel="Ignored Store declaration warning"
              tooltip="OpenSpec ignored the Store declaration because a real project root takes precedence. See CLI diagnostics for the reported fix."
              tone="custom"
              className="border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200"
            >
              Store declaration ignored
            </InformationBadge>
          ) : null}
        </div>
        <div
          className={`grid min-w-0 gap-4 py-3 ${
            rootTopology === 'collapsed' ? '' : '@[36rem]:grid-cols-2'
          }`}
        >
          {rootTopology !== 'collapsed' ? (
            <ContextSummaryFact label="Launch project" value={context.launchProject.path} mono />
          ) : null}
          <ContextSummaryFact
            label="References"
            value={`${context.references.length} observed`}
            detail={`${referenceDiagnosticCount} CLI diagnostics`}
          />
        </div>
      </section>

      {context.cli.error ? (
        <div className="text-destructive flex items-start gap-2 text-sm" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {context.cli.error}
        </div>
      ) : null}

      {referenceErrors.length > 0 ? (
        <div className="text-destructive flex items-start gap-2 text-sm" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {referenceErrors.join(' ')}
        </div>
      ) : null}

      {commandContractErrors.length > 0 ? (
        <div className="text-destructive flex items-start gap-2 text-sm" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {commandContractErrors.join(' ')}
        </div>
      ) : null}

      {errorDiagnostics.length > 0 ? (
        <div className="text-destructive flex items-start gap-2 text-sm" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            {errorDiagnostics
              .map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`)
              .join(' ')}
          </span>
        </div>
      ) : null}

      <EvidenceDisclosure
        title="Referenced context"
        summary={`${context.references.length} References · ${context.contextMembers.length} members`}
      >
        <div className="space-y-4">
          {context.references.length === 0 ? (
            <p className="text-muted-foreground">No reference currently observed.</p>
          ) : (
            <ul className="divide-border divide-y">
              {context.references.map((reference) => (
                <li key={reference.store_id} className="space-y-1 py-2 first:pt-0 last:pb-0">
                  <p className="break-all font-mono">{reference.store_id}</p>
                  {reference.status.length === 0 ? (
                    <p className="text-muted-foreground">No CLI diagnostic reported.</p>
                  ) : (
                    reference.status.map((diagnostic) => (
                      <p key={`${diagnostic.code}:${diagnostic.message}`} className="break-words">
                        <span className="font-medium">{diagnostic.code}</span>: {diagnostic.message}
                      </p>
                    ))
                  )}
                </li>
              ))}
            </ul>
          )}
          <EvidenceJson label="Context members" value={context.contextMembers} />
        </div>
      </EvidenceDisclosure>

      <ResolutionDetails context={context} actionStatus={actionStatus} />

      <EvidenceDisclosure
        title="CLI diagnostics"
        summary={
          supportingDiagnostics.length === 0
            ? 'No supporting diagnostics'
            : `${supportingDiagnostics.length} supporting`
        }
      >
        {supportingDiagnostics.length === 0 ? (
          <p className="text-muted-foreground">No supporting CLI diagnostics were reported.</p>
        ) : (
          <ul className="space-y-3">
            {supportingDiagnostics.map((diagnostic) => (
              <li
                key={`${diagnostic.code}:${diagnostic.message}`}
                className="space-y-1 break-words"
              >
                <p className="font-medium">
                  {diagnostic.severity} · {diagnostic.code}
                  {diagnostic.target ? ` · ${diagnostic.target}` : ''}
                </p>
                <p>{diagnostic.message}</p>
                {diagnostic.fix ? (
                  <p className="text-muted-foreground">Fix: {diagnostic.fix}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </EvidenceDisclosure>

      <EvidenceDisclosure
        title="CLI evidence"
        summary={`doctor + context · CLI ${context.cli.version ?? 'unavailable'}`}
      >
        <div className="space-y-5">
          <CommandEvidence label="Doctor command" evidence={context.evidence.doctor} />
          <CommandEvidence label="Context command" evidence={context.evidence.context} />
        </div>
      </EvidenceDisclosure>
    </div>
  )
}

function ContextSummaryFact({
  label,
  value,
  detail,
  mono = false,
}: {
  label: string
  value: string
  detail?: string
  mono?: boolean
}) {
  return (
    <div className="min-w-0">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className={`mt-1 min-w-0 break-all text-sm ${mono ? 'font-mono' : 'font-medium'}`}>
        {value}
      </div>
      {detail ? <div className="text-muted-foreground mt-0.5 text-[11px]">{detail}</div> : null}
    </div>
  )
}

function ResolutionDetails({
  actionStatus,
  context,
}: {
  actionStatus: 'ready' | 'checking' | 'blocked'
  context: RootContext
}) {
  return (
    <EvidenceDisclosure title="Resolution details" summary={`Authority ${actionStatus}`}>
      <dl className="text-muted-foreground grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
        <dt>root authority</dt>
        <dd>{actionStatus}</dd>
        <dt>observed at</dt>
        <dd>{new Date(context.observedAt).toISOString()}</dd>
        <dt>CLI available</dt>
        <dd>{String(context.cli.available)}</dd>
        <dt>CLI version</dt>
        <dd>{context.cli.version ?? 'unavailable'}</dd>
        <dt>effective command</dt>
        <dd className="break-all">{context.cli.effectiveCommand ?? 'unavailable'}</dd>
        <dt>data scope</dt>
        <dd className="break-all">{context.dataScope.path}</dd>
        <dt>data source</dt>
        <dd>
          {context.dataScope.source}
          {context.dataScope.environmentVariable
            ? ` · ${context.dataScope.environmentVariable}`
            : ''}
        </dd>
        <dt>Store registry</dt>
        <dd>Read-only from this project workspace</dd>
      </dl>
    </EvidenceDisclosure>
  )
}

function EvidenceJson({ label, value }: { label: string; value: unknown }) {
  const content = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold">{label}</h3>
      <pre className="bg-muted scrollbar-thin scrollbar-track-transparent max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md p-3 text-xs">
        {content}
      </pre>
    </div>
  )
}

function CommandEvidence({
  label,
  evidence,
}: {
  label: string
  evidence: RootContextCommandEvidence | null
}) {
  if (!evidence) {
    return (
      <div className="space-y-1">
        <h3 className="text-xs font-semibold">{label}</h3>
        <p className="text-muted-foreground text-xs">No command evidence observed.</p>
      </div>
    )
  }

  return (
    <section className="border-border border-t pt-3">
      <h3 className="text-xs font-semibold">{label}</h3>
      <dl className="text-muted-foreground mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt>process success</dt>
        <dd>{String(evidence.success)}</dd>
        <dt>exit status</dt>
        <dd>{evidence.exitCode ?? 'unknown'}</dd>
        {evidence.contractError ? (
          <>
            <dt>contract drift</dt>
            <dd className="text-destructive break-words">{evidence.contractError}</dd>
          </>
        ) : null}
      </dl>
      {evidence.stderr ? <EvidenceJson label="stderr" value={evidence.stderr} /> : null}
      <EvidenceJson label="diagnostics" value={evidence.diagnostics} />
      <EvidenceJson label="stdout" value={evidence.stdout} />
    </section>
  )
}
