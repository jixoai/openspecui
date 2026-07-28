/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Summarize read-only Root compatibility, selection, and failed-attempt state with links to Context.
 * 2. Summarize Environment Global profile, delivery, drift, and data scope with a link to Config.
 * 3. Preserve settled diagnostic facts during revalidation and use stable skeleton geometry on admission.
 *
 * Original request (2026-07-20): "Settings diagnostics are read-only."
 * Original request (2026-07-27): "统一修复所有类似的问题（我们也没不多，各个页面都检查一下，特别是app 那边新增的页面）"
 * Original request (2026-07-28): Settings should stay concise and defer verbose OpenSpec evidence to its owning routes.
 */
import { InformationBadge } from '@/components/information-disclosure'
import { DetailPanelSkeleton, RealtimeRevalidateCue } from '@/components/realtime'
import { TocSection } from '@/components/toc'
import { selectRootContextSnapshot, useContextSubscription } from '@/lib/use-context-subscription'
import { VTLink } from '@/lib/view-transitions/navigation'
import type { EnvironmentGlobalConfig, RootContext, RootContextState } from '@openspecui/core'
import { classifyOpenSpecCliVersion } from '@openspecui/core/openspec-compat'
import { AlertCircle, ExternalLink } from 'lucide-react'
import { SettingsStatusLabel } from './settings-status-label'

/** Environment subscription facts rendered independently from Root Context. */
export interface SettingsEnvironmentDiagnostics {
  data: EnvironmentGlobalConfig | null | undefined
  isLoading: boolean
  refreshPending: boolean
  error: Error | null
}

function CompatibilityStatus({ context }: { context: RootContext | null }) {
  if (!context) {
    return (
      <div>
        <SettingsStatusLabel status="pending">CLI evidence pending</SettingsStatusLabel>
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
    <InformationBadge
      ariaLabel={`OpenSpec CLI compatibility ${visibleLabel}`}
      tooltip={
        availability.available
          ? compatibility.message
          : availability.error || 'OpenSpec CLI is explicitly unavailable.'
      }
      tone={visibleStatus === 'current' ? 'subtle' : 'muted'}
    >
      {visibleLabel}
    </InformationBadge>
  )
}

function RootFacts({ context }: { context: RootContext }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <InformationBadge ariaLabel="Launch project path" tooltip={context.launchProject.path}>
        Launch
      </InformationBadge>
      <InformationBadge
        ariaLabel={context.planningRoot ? 'Planning root selected' : 'Planning root unresolved'}
        tooltip={
          context.planningRoot
            ? `${context.planningRoot.path} · source ${context.planningRoot.source}${context.storeId ? ` · Store ${context.storeId}` : ''}`
            : 'No Planning root is selected.'
        }
      >
        {context.planningRoot ? 'Planning selected' : 'Planning unresolved'}
      </InformationBadge>
      <InformationBadge
        ariaLabel={`Inherited data scope source ${context.dataScope.source}`}
        tooltip={`${context.dataScope.path}${context.dataScope.environmentVariable ? ` · ${context.dataScope.environmentVariable}` : ''}`}
      >
        Data {context.dataScope.source}
      </InformationBadge>
      <InformationBadge
        ariaLabel="Root Context CLI command evidence"
        tooltip={`CLI ${context.cli.version ?? 'unavailable'} · doctor ${context.evidence.doctor?.exitCode ?? 'not run'} · context ${context.evidence.context?.exitCode ?? 'not run'}`}
      >
        CLI {context.cli.version ?? 'unavailable'}
      </InformationBadge>
    </div>
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
      <div className="flex flex-wrap gap-1.5">
        <InformationBadge
          ariaLabel="Failed Root attempt command exits"
          tooltip={`Doctor ${attempt.evidence.doctor?.exitCode ?? 'not run'} · Context ${attempt.evidence.context?.exitCode ?? 'not run'}`}
        >
          Command exits
        </InformationBadge>
        <InformationBadge
          ariaLabel={`${diagnostics.length} failed Root attempt diagnostics`}
          tooltip={
            diagnostics.length > 0
              ? diagnostics
                  .map(
                    (diagnostic) =>
                      `${diagnostic.severity}: ${diagnostic.code} - ${diagnostic.message}`
                  )
                  .join('\n')
              : 'No structured diagnostics.'
          }
        >
          Diagnostics {diagnostics.length}
        </InformationBadge>
      </div>
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">OpenSpec runtime</p>
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

      {selectedContext ? (
        <RealtimeRevalidateCue active={lifecycle === 'refreshing'}>
          <RootFacts context={selectedContext} />
        </RealtimeRevalidateCue>
      ) : null}
      {!selectedContext && lifecycle === 'loading' ? <DetailPanelSkeleton count={3} /> : null}
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
        <RealtimeRevalidateCue active={lifecycle === 'refreshing'}>
          <div className="flex flex-wrap gap-1.5">
            <InformationBadge
              ariaLabel={`Environment profile ${profile?.available ? profile.profile : 'Unavailable'}`}
              tooltip="Effective profile reported by OpenSpec environment-global config."
            >
              Profile {profile?.available ? profile.profile : 'Unavailable'}
            </InformationBadge>
            <InformationBadge
              ariaLabel={`Environment delivery ${profile?.available ? profile.delivery : 'Unavailable'}`}
              tooltip="Effective tool delivery reported by OpenSpec environment-global config."
            >
              Delivery {profile?.available ? profile.delivery : 'Unavailable'}
            </InformationBadge>
            <InformationBadge
              ariaLabel={`Environment drift ${profile?.driftStatus ?? 'unknown'}`}
              tooltip={profile?.warningText ?? 'No environment drift warning reported.'}
            >
              Drift {profile?.driftStatus ?? 'unknown'}
            </InformationBadge>
            <InformationBadge
              ariaLabel={`${profile?.workflows.length ?? 0} effective workflows`}
              tooltip={profile?.workflows.length ? profile.workflows.join(', ') : '(none)'}
            >
              Workflows {profile?.workflows.length ?? 0}
            </InformationBadge>
            <InformationBadge
              ariaLabel={`Environment data scope source ${config.owner.dataScope.source}`}
              tooltip={config.owner.dataScope.path}
            >
              Data {config.owner.dataScope.source}
            </InformationBadge>
          </div>
        </RealtimeRevalidateCue>
      ) : lifecycle === 'loading' ? (
        <DetailPanelSkeleton count={3} />
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
