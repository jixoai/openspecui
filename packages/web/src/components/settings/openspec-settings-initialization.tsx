/**
 * Orthogonal intents (updated 2026-08-01 Asia/Shanghai):
 * 1. Project the Server-owned Agent delivery policy and physical inventory as a compact read-only Settings summary.
 * 2. Preserve live replacement and stale-error evidence while routing all Agent mutations to Config.
 *
 * Original request (2026-08-01): Settings only shows Agent status and navigates management to `/config/agents`.
 */
import { RealtimeSkeletonLine } from '@/components/realtime'
import { TocSection } from '@/components/toc'
import {
  useAgentIntegrations,
  type AgentIntegrationsProjection,
} from '@/lib/use-agent-integrations'
import { ArrowRight, Bot, CircleAlert } from 'lucide-react'
import { useMemo } from 'react'
import { SettingsStatusLabel } from './settings-status-label'

interface AgentDeliverySummary {
  configured: number
  partial: number
  drifted: number
  failed: number
  unavailable: number
  staleVersion: number
  cleanupNeeded: number
  migrationRequired: number
}

function summarizeAgentDelivery(
  projection: AgentIntegrationsProjection,
  failed: boolean
): AgentDeliverySummary {
  return {
    configured: projection.states.filter(
      (state) => state.readiness !== 'unavailable' && state.hasAnyArtifacts
    ).length,
    partial: projection.states.filter((state) => state.readiness === 'partial').length,
    drifted: projection.states.filter((state) => state.issues.length > 0).length,
    failed: failed ? 1 : 0,
    unavailable: projection.states.filter((state) => state.readiness === 'unavailable').length,
    staleVersion: projection.states.filter((state) => state.issues.includes('stale-version'))
      .length,
    cleanupNeeded: projection.states.filter((state) => state.issues.includes('cleanup-needed'))
      .length,
    migrationRequired: projection.states.filter((state) =>
      state.issues.includes('migration-required')
    ).length,
  }
}

function SummaryMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border-border bg-background min-w-0 rounded-md border px-3 py-2">
      <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
        {label}
      </p>
      <p className="text-foreground mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function AgentDeliveryEvidence({
  projection,
  failed,
}: {
  projection: AgentIntegrationsProjection
  failed: boolean
}) {
  const summary = useMemo(() => summarizeAgentDelivery(projection, failed), [failed, projection])
  const workflowLabel =
    projection.policy.workflows.length === 1
      ? '1 workflow'
      : `${projection.policy.workflows.length} workflows`
  const workflowVerb = projection.policy.workflows.length === 1 ? 'is' : 'are'
  const attentionCount = new Set(
    projection.states
      .filter((state) => state.readiness === 'partial' || state.issues.length > 0)
      .map((state) => state.toolId)
  ).size
  const attentionStatus =
    summary.failed > 0 ? 'failed' : attentionCount > 0 ? 'partial' : 'initialized'

  return (
    <div className="space-y-3">
      <div className="border-border bg-muted/20 @[42rem]:grid-cols-[minmax(0,1fr)_auto] @[42rem]:items-center grid min-w-0 gap-3 rounded-lg border p-3">
        <div className="min-w-0">
          <p className="text-foreground text-sm font-medium capitalize">
            {projection.policy.profile} profile · {projection.policy.delivery}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {workflowLabel} {workflowVerb} delivered under the Environment Global Agent policy.
          </p>
        </div>
        <SettingsStatusLabel status={attentionStatus}>
          {summary.failed > 0
            ? 'Agent projection failed'
            : attentionCount > 0
              ? `${attentionCount} integration${attentionCount === 1 ? '' : 's'} need attention`
              : 'Agent integrations are current'}
        </SettingsStatusLabel>
      </div>

      <div className="@[34rem]:grid-cols-3 @[54rem]:grid-cols-5 grid min-w-0 grid-cols-2 gap-2">
        <SummaryMetric label="Configured" value={summary.configured} />
        <SummaryMetric label="Partial" value={summary.partial} />
        <SummaryMetric label="Drifted" value={summary.drifted} />
        <SummaryMetric label="Failed" value={summary.failed} />
        <SummaryMetric label="Unavailable" value={summary.unavailable} />
      </div>
      <p className="text-muted-foreground text-[11px]">
        Physical-state counts overlap when one integration is both partial and drifted.
      </p>

      {summary.staleVersion > 0 || summary.cleanupNeeded > 0 || summary.migrationRequired > 0 ? (
        <div className="text-muted-foreground flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-xs">
          {summary.staleVersion > 0 ? <span>{summary.staleVersion} stale version</span> : null}
          {summary.cleanupNeeded > 0 ? <span>{summary.cleanupNeeded} cleanup needed</span> : null}
          {summary.migrationRequired > 0 ? (
            <span>{summary.migrationRequired} migration required</span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function AgentDeliveryUnavailableEvidence() {
  return (
    <div className="space-y-2">
      <div className="@[34rem]:grid-cols-3 @[54rem]:grid-cols-5 grid min-w-0 grid-cols-2 gap-2">
        <SummaryMetric label="Configured" value="—" />
        <SummaryMetric label="Partial" value="—" />
        <SummaryMetric label="Drifted" value="—" />
        <SummaryMetric label="Failed" value={1} />
        <SummaryMetric label="Unavailable" value="—" />
      </div>
      <p className="text-muted-foreground text-[11px]">
        Integration counts are unavailable until the failed projection is replaced.
      </p>
    </div>
  )
}

/** Render the read-only Agent Integrations summary owned by Settings. */
export function OpenSpecSettingsAgentIntegrationsSection({ index }: { index: number }) {
  const projection = useAgentIntegrations()

  return (
    <TocSection id="settings-agent-integrations" index={index} className="@container space-y-3">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Bot className="text-primary h-5 w-5 shrink-0" aria-hidden="true" />
            <h2 className="text-foreground text-lg font-semibold">Agent Integrations</h2>
          </div>
          <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
            Read-only delivery status for this project. Profile, workflow, initialization, update,
            repair, and migration controls live in Config.
          </p>
        </div>
        <a
          href="/config/agents"
          className="border-border bg-background text-foreground hover:bg-muted focus-visible:ring-primary inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-1"
        >
          Manage
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </div>

      {projection.isLoading && projection.data === null ? (
        <div
          className="border-border bg-muted/20 grid min-h-28 place-items-center rounded-lg border p-4"
          aria-label="Loading Agent Integrations"
        >
          <div className="w-full max-w-xl space-y-3" aria-hidden="true">
            <RealtimeSkeletonLine className="h-4 w-2/5" />
            <RealtimeSkeletonLine className="h-3 w-4/5" />
            <div className="grid grid-cols-3 gap-2">
              <RealtimeSkeletonLine className="h-12" />
              <RealtimeSkeletonLine className="h-12" />
              <RealtimeSkeletonLine className="h-12" />
            </div>
          </div>
        </div>
      ) : projection.data ? (
        <AgentDeliveryEvidence projection={projection.data} failed={projection.error !== null} />
      ) : projection.error ? (
        <AgentDeliveryUnavailableEvidence />
      ) : null}

      {projection.error ? (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive/5 text-destructive flex min-w-0 items-start gap-2 rounded-md border px-3 py-2 text-sm"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">
            {projection.data ? 'Agent status may be stale. ' : 'Agent status is unavailable. '}
            {projection.error.message}
          </span>
        </div>
      ) : null}
    </TocSection>
  )
}
