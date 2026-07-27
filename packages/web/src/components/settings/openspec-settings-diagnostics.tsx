/**
 * Orthogonal intents (created 2026-07-20 Asia/Shanghai):
 * 1. Present read-only Root Context compatibility, selection, and failed-attempt evidence.
 * 2. Present the independent Environment Global profile, delivery, drift, and data-scope lifecycle.
 *
 * Original request (2026-07-20): "Settings diagnostics are read-only."
 */
import { CopyablePath } from '@/components/copyable-path'
import { TocSection } from '@/components/toc'
import { selectRootContextSnapshot, useContextSubscription } from '@/lib/use-context-subscription'
import { VTLink } from '@/lib/view-transitions/navigation'
import type { EnvironmentGlobalConfig, RootContext, RootContextState } from '@openspecui/core'
import {
  classifyOpenSpecCliVersion,
  OPENSPEC_CLI_TARGET_SERIES,
  OPENSPECUI_TARGET_MAJOR,
} from '@openspecui/core/openspec-compat'
import { AlertCircle, ExternalLink, Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { SettingsStatusLabel } from './settings-status-label'

/** Environment subscription facts rendered independently from Root Context. */
export interface SettingsEnvironmentDiagnostics {
  data: EnvironmentGlobalConfig | null | undefined
  isLoading: boolean
  refreshPending: boolean
  error: Error | null
}

function DiagnosticField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 border-t py-2 first:border-t-0 sm:border-l sm:border-t-0 sm:px-3 sm:first:border-l-0 sm:first:pl-0">
      <dt className="text-muted-foreground text-[11px] font-medium">{label}</dt>
      <dd className="mt-1 min-w-0 text-sm">{children}</dd>
    </div>
  )
}

function CompatibilityStatus({ context }: { context: RootContext | null }) {
  if (!context) {
    return (
      <div className="space-y-1">
        <SettingsStatusLabel status="pending">CLI evidence pending</SettingsStatusLabel>
        <p className="text-muted-foreground text-xs">
          Waiting for the Root Context availability and version projection.
        </p>
      </div>
    )
  }

  const availability = context.cli
  const compatibility = classifyOpenSpecCliVersion(
    availability.available ? availability.version : undefined
  )
  const visibleStatus = availability.available ? compatibility.status : 'unavailable'
  const visibleLabel =
    visibleStatus === 'current'
      ? 'Current 1.6 line'
      : visibleStatus === 'legacy-compatible'
        ? 'Legacy-compatible 1.5 line'
        : visibleStatus === 'unavailable'
          ? 'CLI unavailable'
          : visibleStatus === 'unknown'
            ? 'Version unparseable'
            : 'Unsupported CLI line'

  return (
    <div className="space-y-1">
      <SettingsStatusLabel status={visibleStatus}>{visibleLabel}</SettingsStatusLabel>
      <p className="text-muted-foreground text-xs">
        {availability.available
          ? compatibility.message
          : availability.error || 'OpenSpec CLI is explicitly unavailable.'}
      </p>
    </div>
  )
}

function RootFacts({ context }: { context: RootContext }) {
  return (
    <dl className="grid min-w-0 border-y sm:grid-cols-2 lg:grid-cols-4">
      <DiagnosticField label="Launch project">
        <CopyablePath path={context.launchProject.path} />
      </DiagnosticField>
      <DiagnosticField label="Planning root">
        {context.planningRoot ? (
          <div className="space-y-1">
            <CopyablePath path={context.planningRoot.path} />
            <span className="text-muted-foreground block text-xs">
              source: {context.planningRoot.source}
              {context.storeId ? ` | Store ${context.storeId}` : ''}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground">Unresolved</span>
        )}
      </DiagnosticField>
      <DiagnosticField label="Inherited data scope">
        <div className="space-y-1">
          <CopyablePath path={context.dataScope.path} />
          <span className="text-muted-foreground block text-xs">
            {context.dataScope.source}
            {context.dataScope.environmentVariable
              ? ` | ${context.dataScope.environmentVariable}`
              : ''}
          </span>
        </div>
      </DiagnosticField>
      <DiagnosticField label="CLI evidence">
        <div className="space-y-1">
          <span className="font-mono text-xs">
            {context.cli.version ?? (context.cli.available ? 'version unavailable' : 'unavailable')}
          </span>
          <span className="text-muted-foreground block text-xs">
            doctor {context.evidence.doctor?.exitCode ?? 'not run'} | context{' '}
            {context.evidence.context?.exitCode ?? 'not run'}
          </span>
        </div>
      </DiagnosticField>
    </dl>
  )
}

function FailedAttemptEvidence({
  state,
}: {
  state: Extract<RootContextState, { state: 'error' }>
}) {
  const attempt = state.attempt
  const diagnostics = [
    ...attempt.diagnostics.root,
    ...attempt.diagnostics.doctor,
    ...attempt.diagnostics.context,
  ]

  return (
    <div className="border-destructive/40 bg-destructive/5 space-y-2 border-l-2 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SettingsStatusLabel status="failed">
          Failed attempt: {state.error.code}
        </SettingsStatusLabel>
        <span className="text-muted-foreground text-[11px]">observed {state.observedAt}</span>
      </div>
      <p className="text-destructive text-xs">{state.error.message}</p>
      <p className="text-muted-foreground break-all text-xs">
        Attempted root: {attempt.planningRoot?.path ?? 'unresolved'}
        {attempt.storeId ? ` | Store ${attempt.storeId}` : ''}
      </p>
      <p className="text-muted-foreground text-xs">
        Doctor exit {attempt.evidence.doctor?.exitCode ?? 'not run'} | Context exit{' '}
        {attempt.evidence.context?.exitCode ?? 'not run'}
      </p>
      {attempt.evidence.doctor?.stderr || attempt.evidence.context?.stderr ? (
        <pre className="bg-muted/50 max-h-28 overflow-auto whitespace-pre-wrap rounded px-2 py-1 text-[11px]">
          {attempt.evidence.doctor?.stderr || attempt.evidence.context?.stderr}
        </pre>
      ) : null}
      {diagnostics.length > 0 ? (
        <ul className="space-y-1 text-[11px]">
          {diagnostics.map((diagnostic, index) => (
            <li key={`${diagnostic.code}-${index}`}>
              {diagnostic.severity}: {diagnostic.code} - {diagnostic.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function RootDiagnostics() {
  const { data: projection, isLoading, error: transportError } = useContextSubscription()
  const selectedContext = selectRootContextSnapshot(projection)
  const failedState = projection?.state === 'error' ? projection : null
  const compatibilityContext = failedState?.attempt ?? selectedContext
  const lifecycle = transportError
    ? 'transport-error'
    : isLoading || !projection || projection.state === 'loading'
      ? 'loading'
      : projection.state === 'refreshing'
        ? 'refreshing'
        : projection.state === 'error'
          ? projection.data
            ? 'stale'
            : 'failed'
          : 'ready'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">
            OpenSpecUI {OPENSPECUI_TARGET_MAJOR}.x targets OpenSpec CLI {OPENSPEC_CLI_TARGET_SERIES}
            .x
          </p>
          <CompatibilityStatus context={compatibilityContext} />
        </div>
        <SettingsStatusLabel status={lifecycle}>
          {lifecycle === 'ready'
            ? 'Root current'
            : lifecycle === 'refreshing'
              ? 'Root refreshing'
              : lifecycle === 'stale'
                ? 'Stale Root snapshot'
                : lifecycle === 'transport-error'
                  ? 'Root transport error'
                  : lifecycle === 'failed'
                    ? 'Root resolution failed'
                    : 'Root loading'}
        </SettingsStatusLabel>
      </div>

      {transportError ? (
        <div className="text-destructive flex items-start gap-2 text-xs" role="alert">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {transportError.message}
        </div>
      ) : null}

      {selectedContext ? <RootFacts context={selectedContext} /> : null}
      {!selectedContext && lifecycle === 'loading' ? (
        <div className="text-muted-foreground flex items-center gap-2 text-sm" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Resolving launch and planning roots...
        </div>
      ) : null}
      {failedState ? <FailedAttemptEvidence state={failedState} /> : null}
    </div>
  )
}

function EnvironmentDiagnostics({ environment }: { environment: SettingsEnvironmentDiagnostics }) {
  const config = environment.data
  const stale = environment.error !== null && config !== null && config !== undefined
  const lifecycle = environment.error
    ? stale
      ? 'stale'
      : 'failed'
    : environment.isLoading || environment.refreshPending
      ? config
        ? 'refreshing'
        : 'loading'
      : config
        ? 'current'
        : 'failed'
  const profile = config?.profileState
  const evidenceError =
    config && !config.evidence.path.success
      ? config.evidence.path.stderr || 'OpenSpec config path failed.'
      : config && !config.evidence.config.success
        ? config.evidence.config.stderr || 'OpenSpec config list failed.'
        : config?.evidence.config.contractError
          ? `OpenSpec global config contract drift: ${config.evidence.config.contractError}`
          : profile?.error

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SettingsStatusLabel status={lifecycle}>
          {lifecycle === 'current'
            ? 'Environment current'
            : lifecycle === 'refreshing'
              ? 'Environment refreshing'
              : lifecycle === 'stale'
                ? 'Stale environment projection'
                : lifecycle === 'loading'
                  ? 'Environment loading'
                  : 'Environment unavailable'}
        </SettingsStatusLabel>
        <VTLink
          to="/config"
          search={{ configTab: 'environment-global' }}
          className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
        >
          Environment Global config
          <ExternalLink className="h-3 w-3" aria-hidden />
        </VTLink>
      </div>

      {environment.error || evidenceError ? (
        <div className="text-destructive flex items-start gap-2 text-xs" role="alert">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {environment.error?.message ?? evidenceError}
        </div>
      ) : null}

      {config ? (
        <>
          <dl className="grid min-w-0 border-y sm:grid-cols-2 lg:grid-cols-4">
            <DiagnosticField label="Profile">
              {profile?.available ? profile.profile : 'Unavailable'}
            </DiagnosticField>
            <DiagnosticField label="Delivery">
              {profile?.available ? profile.delivery : 'Unavailable'}
            </DiagnosticField>
            <DiagnosticField label="Drift">
              <SettingsStatusLabel status={profile?.driftStatus ?? 'unknown'}>
                {profile?.driftStatus ?? 'unknown'}
              </SettingsStatusLabel>
            </DiagnosticField>
            <DiagnosticField label="Environment data scope">
              <div className="space-y-1">
                <CopyablePath path={config.owner.dataScope.path} />
                <span className="text-muted-foreground block text-xs">
                  {config.owner.dataScope.source}
                </span>
              </div>
            </DiagnosticField>
          </dl>
          <div>
            <p className="text-muted-foreground mb-1 text-[11px] font-medium">
              Effective workflows
            </p>
            <div className="flex flex-wrap gap-1.5">
              {profile?.workflows.length ? (
                profile.workflows.map((workflow) => (
                  <span
                    key={workflow}
                    className="border-border bg-muted rounded border px-1.5 py-0.5 text-xs"
                  >
                    {workflow}
                  </span>
                ))
              ) : (
                <span className="text-muted-foreground text-xs">(none)</span>
              )}
            </div>
            {profile?.warningText ? (
              <p className="text-muted-foreground mt-2 text-xs">{profile.warningText}</p>
            ) : null}
          </div>
        </>
      ) : lifecycle === 'loading' ? (
        <div className="text-muted-foreground flex items-center gap-2 text-sm" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading Environment Global projection...
        </div>
      ) : null}
    </div>
  )
}

/** Render the read-only Settings diagnostics section. */
export function OpenSpecSettingsDiagnosticsSection({
  index,
  environment,
}: {
  index: number
  environment: SettingsEnvironmentDiagnostics
}) {
  return (
    <TocSection id="settings-openspec-diagnostics" index={index} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">OpenSpec Diagnostics</h2>
        <VTLink to="/context" className="text-primary text-xs hover:underline">
          Root / Doctor / Context details
        </VTLink>
      </div>
      <div className="border-border space-y-5 rounded-lg border p-4">
        <RootDiagnostics />
        <div className="border-border border-t pt-4">
          <EnvironmentDiagnostics environment={environment} />
        </div>
      </div>
    </TocSection>
  )
}
