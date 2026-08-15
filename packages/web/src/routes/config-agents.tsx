/**
 * Orthogonal intents (updated 2026-08-15 Asia/Shanghai):
 * 1. Own the live Agent policy draft and present current registry, readiness, drift, cleanup, and migration evidence.
 * 2. Own Agent selection plus cancellable Init, Update, and Repair command execution with global pending locks.
 * 3. Promote loading and failed authority directly without publishing this surface to static mode.
 * 4. Participate in shared Config navigation and publish existing Agent lifecycle facts to the Guide.
 * 5. Render version-scoped command-surface unavailability evidence.
 *
 * Original request (2026-08-01): move Agent delivery into a Config secondary page and keep Settings read-only.
 * Review correction (2026-08-02): replacement inventory Push must not discard an unsaved Agent policy draft.
 * Owner visual direction (2026-08-02): use compact box-radius geometry for semantic status and issue labels.

 * Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"
 */
import {
  AgentIntegrationsCommandDialog,
  type AgentCommandKind,
} from '@/components/config/agent-integrations-command-dialog'
import { AgentIntegrationsHeader } from '@/components/config/agent-integrations-header'
import { useConfigGuideAnchor } from '@/components/config/config-guide'
import { ConfigWorkbenchPage } from '@/components/config/config-workbench'
import { Select, type SelectOption } from '@/components/select'
import { selectAgentDeliveryGuideSignal } from '@/lib/config-guide-signals'
import { OPSX_ALL_WORKFLOWS, OPSX_WORKFLOW_LABELS, type OpsxWorkflowId } from '@/lib/opsx-profile'
import { trpcClient } from '@/lib/trpc'
import { useAgentIntegrations } from '@/lib/use-agent-integrations'
import { useCliRunner, type CliStreamTransport } from '@/lib/use-cli-runner'
import type {
  AgentDeliveryMode,
  AgentDeliveryPolicy,
  AgentDeliveryProfile,
  ToolConfig,
  ToolInitIssue,
  ToolInitReadiness,
  ToolInitState,
} from '@openspecui/core'
import {
  AlertTriangle,
  Check,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  TerminalSquare,
  Wrench,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const PROFILE_OPTIONS: SelectOption<AgentDeliveryProfile>[] = [
  { value: 'core', label: 'Core workflows' },
  { value: 'custom', label: 'Custom workflows' },
]

const DELIVERY_OPTIONS: SelectOption<AgentDeliveryMode>[] = [
  { value: 'both', label: 'Skills and commands' },
  { value: 'skills', label: 'Skills only' },
  { value: 'commands', label: 'Commands only' },
]

const READINESS_CLASS: Record<ToolInitReadiness, string> = {
  unavailable: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-600 dark:text-zinc-300',
  uninitialized: 'border-border bg-muted/50 text-muted-foreground',
  partial: 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200',
  initialized: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
}

const ISSUE_LABEL: Record<ToolInitIssue, string> = {
  'cleanup-needed': 'Cleanup needed',
  'migration-required': 'Migration required',
  'stale-version': 'Stale version',
}

function statusLabel(readiness: ToolInitReadiness): string {
  return readiness === 'uninitialized'
    ? 'Not initialized'
    : readiness.charAt(0).toUpperCase() + readiness.slice(1)
}

function StatusBadge({ state }: { state: ToolInitState }) {
  return (
    <span
      className={`inline-flex min-h-6 items-center rounded border px-2 py-0.5 text-[11px] font-medium ${READINESS_CLASS[state.readiness]}`}
    >
      {statusLabel(state.readiness)}
    </span>
  )
}

function WorkflowInventoryLine({
  label,
  workflows,
}: {
  label: string
  workflows: readonly OpsxWorkflowId[]
}) {
  return (
    <p className="grid min-w-0 grid-cols-[minmax(0,8rem)_minmax(0,1fr)] gap-2">
      <span className="text-muted-foreground">{label}:</span>
      <span className="min-w-0 break-words font-mono">
        {workflows.length > 0 ? workflows.join(', ') : 'None'}
      </span>
    </p>
  )
}

function AgentEvidence({ tool, state }: { tool: ToolConfig; state: ToolInitState }) {
  const deliverySummary = [
    tool.skillsDir ? `Skills: ${tool.skillsDir}` : null,
    tool.globalSkillsDir ? `Global skills: ~/${tool.globalSkillsDir}/skills` : null,
    tool.command ? `Commands: ${tool.command.pathTemplate}` : null,
  ].filter((value): value is string => value !== null)

  return (
    <details className="border-border/70 bg-muted/20 rounded-md border px-3 py-2 text-xs">
      <summary className="text-muted-foreground cursor-pointer select-none font-medium">
        Registry and artifact evidence
      </summary>
      <div className="@[42rem]:grid-cols-2 mt-2 grid min-w-0 gap-2">
        <div className="min-w-0 space-y-1">
          <p>
            <span className="text-muted-foreground">Capability:</span> {tool.capability}
          </p>
          {deliverySummary.map((line) => (
            <p key={line} className="break-all font-mono">
              {line}
            </p>
          ))}
          {tool.legacySkillsDirs?.length ? (
            <p className="break-all font-mono">
              <span className="text-muted-foreground font-sans">Legacy skills:</span>{' '}
              {tool.legacySkillsDirs.join(', ')}
            </p>
          ) : null}
          {state.commandSurfaceUnavailableReason ? (
            <p className="text-muted-foreground" data-testid="command-surface-unavailable">
              <span className="text-muted-foreground">Command surface:</span>{' '}
              {state.commandSurfaceUnavailableReason}
            </p>
          ) : null}
          {state.requiresIdeRestart ? (
            <p>
              <span className="text-muted-foreground">IDE restart:</span> required to load
              regenerated artifacts
            </p>
          ) : null}
          {tool.command ? (
            <p>
              <span className="text-muted-foreground">Invocation:</span>{' '}
              <span className="font-mono">
                {tool.command.invocation.prefix}
                {tool.command.invocation.style === 'namespaced'
                  ? 'opsx:{workflow}'
                  : 'opsx-{workflow}'}
              </span>
            </p>
          ) : null}
          {tool.aliases?.length ? (
            <p>
              <span className="text-muted-foreground">Aliases:</span> {tool.aliases.join(', ')}
            </p>
          ) : null}
          {tool.setupNote ? <p>{tool.setupNote}</p> : null}
        </div>
        <div className="min-w-0 space-y-1">
          <p>
            <span className="text-muted-foreground">Skills scope:</span>{' '}
            {state.skillsScope.kind === 'user-global'
              ? `user-global ~/${state.skillsScope.globalSkillsDir}/skills`
              : state.skillsScope.kind === 'project'
                ? `project ${state.skillsScope.skillsDir}/skills`
                : 'none'}
          </p>
          <p>
            Skills {state.presentExpectedSkillCount}/{state.expectedSkillCount} · Commands{' '}
            {state.presentExpectedCommandCount}/{state.expectedCommandCount}
          </p>
          {state.generatedByVersion ? (
            <p>
              <span className="text-muted-foreground">Generated by:</span>{' '}
              {state.generatedByVersion}
            </p>
          ) : null}
          {state.cleanup ? (
            <p className="break-all">
              <span className="text-muted-foreground">Cleanup:</span>{' '}
              {state.cleanup.paths.join(', ')}
            </p>
          ) : null}
          {state.migration ? (
            <p>
              <span className="text-muted-foreground">Migration:</span> {state.migration.from} →{' '}
              {state.migration.to}
              {state.migration.needsConsent ? ' (consent required)' : ''}
            </p>
          ) : null}
        </div>
        <div className="border-border/60 @[42rem]:col-span-2 @[42rem]:grid-cols-2 grid min-w-0 gap-x-4 gap-y-2 border-t pt-2">
          <WorkflowInventoryLine
            label="Installed skills"
            workflows={state.installedSkillWorkflows}
          />
          <WorkflowInventoryLine label="Missing skills" workflows={state.missingSkillWorkflows} />
          <WorkflowInventoryLine
            label="Unexpected skills"
            workflows={state.unexpectedSkillWorkflows}
          />
          <WorkflowInventoryLine
            label="Installed commands"
            workflows={state.installedCommandWorkflows}
          />
          <WorkflowInventoryLine
            label="Missing commands"
            workflows={state.missingCommandWorkflows}
          />
          <WorkflowInventoryLine
            label="Unexpected commands"
            workflows={state.unexpectedCommandWorkflows}
          />
          <WorkflowInventoryLine label="Legacy commands" workflows={state.legacyCommandWorkflows} />
        </div>
      </div>
    </details>
  )
}

function AgentInventoryRow({
  tool,
  state,
  selected,
  disabled,
  onToggle,
}: {
  tool: ToolConfig
  state: ToolInitState
  selected: boolean
  disabled: boolean
  onToggle(): void
}) {
  return (
    <li className="border-border @container min-w-0 space-y-3 rounded-lg border p-3">
      <div className="flex min-w-0 items-start gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={selected}
          aria-label={`Select ${tool.name}`}
          disabled={disabled || !tool.available}
          onClick={onToggle}
          className={`focus-visible:ring-primary mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-40 ${
            selected
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-background'
          }`}
        >
          {selected ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{tool.name}</p>
              <p className="text-muted-foreground font-mono text-[11px]">{tool.value}</p>
            </div>
            <StatusBadge state={state} />
          </div>
          {state.issues.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {state.issues.map((issue) => (
                <span
                  key={issue}
                  className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-800 dark:text-amber-200"
                >
                  <AlertTriangle className="h-3 w-3" aria-hidden />
                  {ISSUE_LABEL[issue]}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <AgentEvidence tool={tool} state={state} />
    </li>
  )
}

function commandTransport(
  kind: AgentCommandKind,
  selectedTools: readonly string[]
): CliStreamTransport {
  if (kind === 'init') {
    return { type: 'agent-init', input: { tools: [...selectedTools] } }
  }
  return kind === 'repair' ? { type: 'agent-repair' } : { type: 'agent-update' }
}

function copyPolicy(policy: AgentDeliveryPolicy): AgentDeliveryPolicy {
  return { ...policy, workflows: [...policy.workflows] }
}

function isSamePolicy(left: AgentDeliveryPolicy | null, right: AgentDeliveryPolicy): boolean {
  return (
    left !== null &&
    left.profile === right.profile &&
    left.delivery === right.delivery &&
    left.workflows.length === right.workflows.length &&
    left.workflows.every((workflow) => right.workflows.includes(workflow))
  )
}

/** Live-only Config workbench for official OpenSpec Agent delivery. */
export function ConfigAgents() {
  const projection = useAgentIntegrations()
  const runner = useCliRunner()
  const [profile, setProfile] = useState<AgentDeliveryProfile>('core')
  const [delivery, setDelivery] = useState<AgentDeliveryMode>('both')
  const [workflows, setWorkflows] = useState<OpsxWorkflowId[]>([])
  const [policyBaseline, setPolicyBaseline] = useState<AgentDeliveryPolicy | null>(null)
  const [policyConflict, setPolicyConflict] = useState(false)
  const [selectedTools, setSelectedTools] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [policyPending, setPolicyPending] = useState(false)
  const [policyError, setPolicyError] = useState<string | null>(null)
  const [commandKind, setCommandKind] = useState<AgentCommandKind | null>(null)
  const previousRunnerStatusRef = useRef(runner.status)

  const draftPolicy = useMemo<AgentDeliveryPolicy>(
    () => ({ profile, delivery, workflows }),
    [delivery, profile, workflows]
  )
  const policyDirty = policyBaseline !== null && !isSamePolicy(policyBaseline, draftPolicy)

  const replacePolicyDraft = useCallback((policy: AgentDeliveryPolicy) => {
    setProfile(policy.profile)
    setDelivery(policy.delivery)
    setWorkflows([...policy.workflows])
  }, [])

  useEffect(() => {
    if (!projection.data || policyPending) return
    const upstreamPolicy = projection.data.policy
    if (!policyBaseline) {
      const nextBaseline = copyPolicy(upstreamPolicy)
      setPolicyBaseline(nextBaseline)
      replacePolicyDraft(nextBaseline)
      setPolicyConflict(false)
      return
    }

    const upstreamChanged = !isSamePolicy(policyBaseline, upstreamPolicy)
    const draftDirtyFromBaseline = !isSamePolicy(policyBaseline, draftPolicy)
    if (!upstreamChanged) {
      if (!draftDirtyFromBaseline) setPolicyConflict(false)
      return
    }

    const nextBaseline = copyPolicy(upstreamPolicy)
    setPolicyBaseline(nextBaseline)
    if (!draftDirtyFromBaseline || isSamePolicy(draftPolicy, upstreamPolicy)) {
      replacePolicyDraft(nextBaseline)
      setPolicyConflict(false)
      return
    }
    setPolicyConflict(true)
  }, [draftPolicy, policyBaseline, policyPending, projection.data, replacePolicyDraft])

  useEffect(() => {
    const previous = previousRunnerStatusRef.current
    previousRunnerStatusRef.current = runner.status
    if (runner.status !== 'success' || previous === 'success') return
    void projection.refresh().catch(() => undefined)
  }, [projection, runner.status])

  const stateByToolId = useMemo(
    () => new Map(projection.data?.states.map((state) => [state.toolId, state]) ?? []),
    [projection.data]
  )
  const filteredRegistry = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    if (!projection.data) return []
    if (!normalizedSearch) return projection.data.registry
    return projection.data.registry.filter(
      (tool) =>
        tool.name.toLowerCase().includes(normalizedSearch) ||
        tool.value.toLowerCase().includes(normalizedSearch) ||
        tool.aliases?.some((alias) => alias.toLowerCase().includes(normalizedSearch))
    )
  }, [projection.data, search])

  const counts = useMemo(() => {
    const states = projection.data?.states ?? []
    return {
      initialized: states.filter((state) => state.readiness === 'initialized').length,
      partial: states.filter((state) => state.readiness === 'partial').length,
      issues: states.filter((state) => state.issues.length > 0).length,
      unavailable: states.filter((state) => state.readiness === 'unavailable').length,
    }
  }, [projection.data])

  const interactionLocked = policyPending || projection.isRefreshing || runner.status === 'running'
  const hasRepairWork = (projection.data?.states ?? []).some(
    (state) => state.readiness === 'partial' || state.issues.length > 0
  )
  const guideSignal = selectAgentDeliveryGuideSignal({
    available: projection.data !== null && projection.data !== undefined,
    loading: projection.isLoading,
    transportError: projection.error?.message ?? null,
    activeEdit: policyPending || policyDirty || runner.status === 'running' || commandKind !== null,
    conflict: policyConflict,
    policyError,
    refreshing: projection.isRefreshing,
    repairRequired: hasRepairWork,
  })
  const guideAnchor = useConfigGuideAnchor('agent-delivery', guideSignal)

  const toggleWorkflow = useCallback((workflow: OpsxWorkflowId) => {
    setWorkflows((current) =>
      current.includes(workflow)
        ? current.filter((candidate) => candidate !== workflow)
        : OPSX_ALL_WORKFLOWS.filter(
            (candidate): candidate is OpsxWorkflowId =>
              candidate === workflow || current.includes(candidate)
          )
    )
  }, [])

  const savePolicy = useCallback(async () => {
    setPolicyPending(true)
    setPolicyError(null)
    try {
      const next = await trpcClient.agentIntegrations.updatePolicy.mutate({
        profile,
        delivery,
        workflows,
      })
      const nextBaseline = copyPolicy(next.policy)
      setPolicyBaseline(nextBaseline)
      replacePolicyDraft(nextBaseline)
      setPolicyConflict(false)
      projection.accept(next)
    } catch (cause: unknown) {
      setPolicyError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setPolicyPending(false)
    }
  }, [delivery, profile, projection, replacePolicyDraft, workflows])

  const useCurrentPolicy = useCallback(() => {
    if (!policyBaseline) return
    replacePolicyDraft(policyBaseline)
    setPolicyConflict(false)
    setPolicyError(null)
  }, [policyBaseline, replacePolicyDraft])

  const prepareCommand = useCallback(
    (kind: AgentCommandKind) => {
      runner.reset()
      runner.commands.replaceAll([commandTransport(kind, selectedTools)])
      previousRunnerStatusRef.current = 'idle'
      setCommandKind(kind)
    },
    [runner, selectedTools]
  )

  const closeCommand = useCallback(() => {
    if (runner.status === 'running') return
    setCommandKind(null)
  }, [runner.status])

  return (
    <ConfigWorkbenchPage current="agents" header={<AgentIntegrationsHeader />}>
      <div {...guideAnchor} className="space-y-6">
        {projection.error ? (
          <div
            role="alert"
            className="text-destructive border-destructive/40 bg-destructive/10 flex items-start gap-2 rounded-lg border p-4 text-sm"
          >
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div>
              <p className="font-medium">Agent Integrations authority is unavailable.</p>
              <p>{projection.error.message}</p>
            </div>
          </div>
        ) : null}

        {projection.isLoading && !projection.data ? (
          <div
            className="border-border bg-card grid gap-3 rounded-lg border p-4"
            aria-label="Loading Agent Integrations"
          >
            <div className="bg-muted h-5 w-44 animate-pulse rounded" />
            <div className="bg-muted h-20 animate-pulse rounded" />
            <div className="bg-muted h-40 animate-pulse rounded" />
          </div>
        ) : null}

        {projection.data ? (
          <>
            <section className="border-border bg-card space-y-4 rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">Delivery Policy</h2>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Writes only official profile, delivery, and workflow fields. Raw Environment
                    JSON remains the escape hatch for team extensions.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void projection.refresh()}
                  disabled={interactionLocked}
                  className="border-border hover:bg-muted inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {projection.isRefreshing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  )}
                  Refresh
                </button>
              </div>

              <div className="@[42rem]:grid-cols-2 grid gap-3">
                <label className="space-y-1.5 text-xs font-medium">
                  <span>Profile</span>
                  <Select
                    value={profile}
                    options={PROFILE_OPTIONS}
                    onValueChange={setProfile}
                    ariaLabel="Agent delivery profile"
                    disabled={interactionLocked}
                    className="w-full"
                  />
                </label>
                <label className="space-y-1.5 text-xs font-medium">
                  <span>Delivery</span>
                  <Select
                    value={delivery}
                    options={DELIVERY_OPTIONS}
                    onValueChange={setDelivery}
                    ariaLabel="Agent delivery mode"
                    disabled={interactionLocked}
                    className="w-full"
                  />
                </label>
              </div>

              <div className={profile === 'custom' ? 'space-y-2' : 'space-y-2 opacity-60'}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-medium">Workflows</p>
                  <span className="text-muted-foreground text-[11px]">
                    {profile === 'core'
                      ? 'Core profile is CLI-defined'
                      : `${workflows.length} selected`}
                  </span>
                </div>
                <div className="@[36rem]:grid-cols-2 @[64rem]:grid-cols-3 grid gap-2">
                  {OPSX_ALL_WORKFLOWS.map((workflow) => {
                    const selected = workflows.includes(workflow)
                    return (
                      <button
                        key={workflow}
                        type="button"
                        aria-pressed={selected}
                        disabled={interactionLocked || profile !== 'custom'}
                        onClick={() => toggleWorkflow(workflow)}
                        className={`min-w-0 rounded-md border px-3 py-2 text-left text-xs disabled:cursor-not-allowed ${
                          selected
                            ? 'border-primary/50 bg-primary/10 text-foreground'
                            : 'border-border hover:bg-muted text-muted-foreground'
                        }`}
                      >
                        {OPSX_WORKFLOW_LABELS[workflow]}
                      </button>
                    )
                  })}
                </div>
              </div>

              {policyConflict ? (
                <div
                  role="alert"
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-100"
                >
                  <span>
                    Agent delivery policy changed outside this page. Your unsaved draft is
                    preserved.
                  </span>
                  <button
                    type="button"
                    onClick={useCurrentPolicy}
                    disabled={interactionLocked}
                    className="border-current/30 rounded-md border px-2.5 py-1 font-medium disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Use current policy
                  </button>
                </div>
              ) : null}
              {policyError ? (
                <p role="alert" className="text-destructive text-xs">
                  {policyError}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void savePolicy()}
                  disabled={interactionLocked || (profile === 'custom' && workflows.length === 0)}
                  className="bg-primary text-primary-foreground inline-flex h-9 items-center gap-2 rounded-md px-3 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {policyPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  )}
                  Save policy
                </button>
                {policyDirty ? (
                  <span className="text-muted-foreground text-xs">Unsaved policy changes</span>
                ) : null}
              </div>
            </section>

            <section className="border-border bg-card space-y-4 rounded-lg border p-4">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">Agent Inventory</h2>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {projection.data.registry.length} official entries · {counts.initialized}{' '}
                    initialized · {counts.partial} partial · {counts.issues} with issues ·{' '}
                    {counts.unavailable} unavailable
                  </p>
                </div>
                <label className="border-border bg-background flex h-9 min-w-48 items-center gap-2 rounded-md border px-3">
                  <Search className="text-muted-foreground h-3.5 w-3.5" aria-hidden />
                  <span className="sr-only">Search Agent inventory</span>
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search Agents"
                    className="min-w-0 flex-1 bg-transparent text-xs outline-none"
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={interactionLocked}
                  onClick={() =>
                    setSelectedTools(
                      (projection.data?.registry ?? [])
                        .filter((tool) => tool.available)
                        .map((tool) => tool.value)
                    )
                  }
                  className="border-border hover:bg-muted rounded-md border px-2.5 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Select available
                </button>
                <button
                  type="button"
                  disabled={interactionLocked || selectedTools.length === 0}
                  onClick={() => setSelectedTools([])}
                  className="border-border hover:bg-muted rounded-md border px-2.5 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Clear selection
                </button>
                <span className="text-muted-foreground text-xs">
                  {selectedTools.length} selected
                </span>
              </div>

              <ul className="@[64rem]:grid-cols-2 grid gap-3">
                {filteredRegistry.map((tool) => {
                  const state = stateByToolId.get(tool.value)
                  if (!state) return null
                  return (
                    <AgentInventoryRow
                      key={tool.value}
                      tool={tool}
                      state={state}
                      selected={selectedTools.includes(tool.value)}
                      disabled={interactionLocked}
                      onToggle={() =>
                        setSelectedTools((current) =>
                          current.includes(tool.value)
                            ? current.filter((toolId) => toolId !== tool.value)
                            : [...current, tool.value]
                        )
                      }
                    />
                  )
                })}
              </ul>

              <div className="border-border flex flex-wrap gap-2 border-t pt-4">
                <button
                  type="button"
                  onClick={() => prepareCommand('init')}
                  disabled={interactionLocked || selectedTools.length === 0}
                  className="bg-primary text-primary-foreground inline-flex h-9 items-center gap-2 rounded-md px-3 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <TerminalSquare className="h-3.5 w-3.5" aria-hidden />
                  Init selected
                </button>
                <button
                  type="button"
                  onClick={() => prepareCommand('update')}
                  disabled={interactionLocked}
                  className="border-border hover:bg-muted inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  Update
                </button>
                <button
                  type="button"
                  onClick={() => prepareCommand('repair')}
                  disabled={interactionLocked || !hasRepairWork}
                  title={
                    hasRepairWork
                      ? undefined
                      : 'No partial, stale, cleanup, or migration work detected.'
                  }
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 text-xs font-medium text-amber-800 hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:text-amber-200"
                >
                  <Wrench className="h-3.5 w-3.5" aria-hidden />
                  Repair
                </button>
              </div>
            </section>
          </>
        ) : null}

        <AgentIntegrationsCommandDialog
          kind={commandKind}
          status={runner.status}
          hasStarted={runner.hasStarted}
          lines={runner.lines}
          onRun={() => void runner.commands.runAll()}
          onCancel={runner.cancel}
          onClose={closeCommand}
        />
      </div>
    </ConfigWorkbenchPage>
  )
}
