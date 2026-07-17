/**
 * Orthogonal intents (created 2026-07-17 Asia/Shanghai):
 * 1. Project CLI-owned environment-global config, data-scope provenance, and raw command evidence.
 * 2. Own JSON/profile drafts and preserve unknown fields through typed global-config writes.
 * 3. Own refresh, pending/error locks, interactive profile launch, and typed Planning-root Update execution.
 * 4. State static unavailability without synthesizing runtime-environment facts.
 *
 * Original request (2026-07-15): "Config ownership separates launch-project binding, active-root config, and environment-global config."
 * Original request (2026-07-17): "CliStreamTransport is the single execution and display truth."
 */
import { Button } from '@/components/button'
import { ButtonGroup } from '@/components/button-group'
import { CliTerminal } from '@/components/cli-terminal'
import { CodeEditor } from '@/components/code-editor'
import { Dialog } from '@/components/dialog'
import { Select, type SelectOption } from '@/components/select'
import { Switch } from '@/components/switch'
import { navController } from '@/lib/nav-controller'
import {
  isOpsxCoreWorkflowSelection,
  OPSX_ALL_WORKFLOWS,
  OPSX_CORE_PROFILE_WORKFLOWS,
  OPSX_WORKFLOW_LABELS,
} from '@/lib/opsx-profile'
import { useTerminalContext } from '@/lib/terminal-context'
import { queryClient, trpc, trpcClient } from '@/lib/trpc'
import { useCliRunner, type CliRunnerLine } from '@/lib/use-cli-runner'
import { useEnvironmentGlobalConfigSubscription } from '@/lib/use-planning-config'
import { vtNavController } from '@/lib/view-transitions/navigation'
import type { CliJsonValue } from '@openspecui/core'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Check, Loader2, RefreshCw, Save, TerminalSquare } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type ProfileEditMode = 'both' | 'delivery' | 'workflows'
type DeliveryMode = 'both' | 'skills' | 'commands'
type GlobalConfigTab = 'preview' | 'editor' | 'profile'

const DELIVERY_MODE_OPTIONS: SelectOption<DeliveryMode>[] = [
  { value: 'both', label: 'both' },
  { value: 'skills', label: 'skills' },
  { value: 'commands', label: 'commands' },
]

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isCliJsonValue(value: unknown): value is CliJsonValue {
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return true
  if (Array.isArray(value)) return value.every(isCliJsonValue)
  return isRecordObject(value) && Object.values(value).every(isCliJsonValue)
}

function isCliJsonObject(value: unknown): value is Record<string, CliJsonValue> {
  return isRecordObject(value) && Object.values(value).every(isCliJsonValue)
}

function normalizeWorkflowList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0)
}

function createRunnerLineId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
}

function JsonStructuredValue({ value }: { value: unknown }) {
  if (value === null) {
    return <span className="text-muted-foreground font-mono text-xs">null</span>
  }
  if (typeof value === 'string') {
    return <code className="bg-muted rounded px-1.5 py-0.5 text-xs">{value}</code>
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return <span className="font-mono text-xs">{String(value)}</span>
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-muted-foreground text-xs">[]</span>
    }
    return (
      <div className="space-y-1">
        {value.map((item, index) => (
          <div key={`json-array-${index}`} className="border-border/60 rounded-md border px-2 py-1">
            <div className="text-muted-foreground mb-1 font-mono text-[10px]">[{index}]</div>
            <JsonStructuredValue value={item} />
          </div>
        ))}
      </div>
    )
  }
  if (isRecordObject(value)) {
    const entries = Object.entries(value)
    if (entries.length === 0) {
      return <span className="text-muted-foreground text-xs">{'{}'}</span>
    }
    return (
      <div className="space-y-1.5">
        {entries.map(([key, item]) => (
          <div key={`json-object-${key}`} className="border-border/60 rounded-md border px-2 py-1">
            <div className="mb-1 font-mono text-[10px] font-semibold">{key}</div>
            <JsonStructuredValue value={item} />
          </div>
        ))}
      </div>
    )
  }
  return <span className="font-mono text-xs">{String(value)}</span>
}

/** Render and mutate only the backend runtime's CLI-owned global OpenSpec config. */
export function EnvironmentGlobalConfigSection({ isStatic }: { isStatic: boolean }) {
  const [globalConfigTab, setGlobalConfigTab] = useState<GlobalConfigTab>('preview')
  const [globalConfigDraft, setGlobalConfigDraft] = useState('{}')
  const [globalConfigDraftDirty, setGlobalConfigDraftDirty] = useState(false)
  const [globalConfigError, setGlobalConfigError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [autoUpdateAfterProfileChange, setAutoUpdateAfterProfileChange] = useState(true)
  const [profileEditMode, setProfileEditMode] = useState<ProfileEditMode>('both')
  const [profileDelivery, setProfileDelivery] = useState<DeliveryMode>('both')
  const [profileWorkflows, setProfileWorkflows] = useState<string[]>([
    ...OPSX_CORE_PROFILE_WORKFLOWS,
  ])
  const [pendingCommandKind, setPendingCommandKind] = useState<'apply' | 'update' | null>(null)
  const [isExecutingPendingCommand, setIsExecutingPendingCommand] = useState(false)
  const [applyRunnerLines, setApplyRunnerLines] = useState<CliRunnerLine[]>([])
  const [shouldScrollRunner, setShouldScrollRunner] = useState(false)
  const runnerOutputRef = useRef<HTMLDivElement | null>(null)

  const { createDedicatedSession } = useTerminalContext()
  const configRunner = useCliRunner()
  const {
    lines: configRunnerLines,
    status: configRunnerStatus,
    commands: configRunnerCommands,
    reset: resetConfigRunner,
  } = configRunner
  const {
    data: environmentGlobalConfig,
    isLoading,
    error: subscriptionError,
    refresh,
  } = useEnvironmentGlobalConfigSubscription()
  const globalConfigData = environmentGlobalConfig?.config
  const {
    data: opsxProfileState,
    isLoading: isLoadingOpsxProfileState,
    refetch: refetchOpsxProfileState,
  } = useQuery({
    ...trpc.cli.getProfileState.queryOptions(),
    enabled: !isStatic,
  })

  useEffect(() => {
    if (!isRecordObject(globalConfigData)) return
    const nextDelivery = globalConfigData.delivery
    setProfileDelivery(
      nextDelivery === 'skills' || nextDelivery === 'commands' || nextDelivery === 'both'
        ? nextDelivery
        : 'both'
    )
    setProfileWorkflows(normalizeWorkflowList(globalConfigData.workflows))
  }, [globalConfigData])

  useEffect(() => {
    if (!isRecordObject(globalConfigData) || globalConfigDraftDirty) return
    setGlobalConfigDraft(JSON.stringify(globalConfigData, null, 2))
  }, [globalConfigData, globalConfigDraftDirty])

  useEffect(() => {
    if (!shouldScrollRunner) return
    if (configRunnerStatus !== 'running' && configRunnerLines.length === 0) return
    const frame = window.requestAnimationFrame(() => {
      runnerOutputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
    setShouldScrollRunner(false)
    return () => window.cancelAnimationFrame(frame)
  }, [configRunnerLines.length, configRunnerStatus, shouldScrollRunner])

  const handleRefresh = useCallback(async () => {
    if (isStatic) return
    setIsRefreshing(true)
    try {
      refresh()
      await queryClient.invalidateQueries(trpc.cli.getProfileState.queryFilter())
      await refetchOpsxProfileState()
    } finally {
      setIsRefreshing(false)
    }
  }, [isStatic, refresh, refetchOpsxProfileState])

  const saveMutation = useMutation({
    mutationFn: (config: Record<string, CliJsonValue>) =>
      trpcClient.planningConfig.writeEnvironmentGlobal.mutate({ config }),
    onSuccess: async () => {
      setGlobalConfigDraftDirty(false)
      setGlobalConfigError(null)
      refresh()
      await queryClient.invalidateQueries(trpc.cli.getProfileState.queryFilter())
      await refetchOpsxProfileState()
    },
    onError: (error) => {
      setGlobalConfigError(error instanceof Error ? error.message : String(error))
    },
  })

  const runConfigCommands = useCallback(
    (commands: Parameters<typeof configRunnerCommands.replaceAll>[0]) => {
      if (isStatic) return
      setShouldScrollRunner(true)
      configRunnerCommands.replaceAll(commands)
      void configRunnerCommands.runAll()
    },
    [configRunnerCommands, isStatic]
  )

  const executeApplyProfile = useCallback(async () => {
    if (!isCliJsonObject(globalConfigData)) return
    const nextConfig: Record<string, CliJsonValue> = { ...globalConfigData }

    if (profileEditMode === 'both' || profileEditMode === 'delivery') {
      nextConfig.delivery = profileDelivery
    }
    if (profileEditMode === 'both' || profileEditMode === 'workflows') {
      nextConfig.workflows = [...profileWorkflows]
      nextConfig.profile = isOpsxCoreWorkflowSelection(profileWorkflows) ? 'core' : 'custom'
    }

    setGlobalConfigError(null)
    setApplyRunnerLines((previous) => [
      ...previous,
      {
        id: createRunnerLineId(),
        kind: 'ascii',
        text: 'Applying profile settings to global config...',
      },
    ])
    try {
      await saveMutation.mutateAsync(nextConfig)
      setApplyRunnerLines((previous) => [
        ...previous,
        {
          id: createRunnerLineId(),
          kind: 'ascii',
          text: 'Profile settings applied successfully.',
          tone: 'success',
        },
      ])
      if (autoUpdateAfterProfileChange) {
        setApplyRunnerLines((previous) => [
          ...previous,
          {
            id: createRunnerLineId(),
            kind: 'ascii',
            text: 'Starting openspec update...',
          },
        ])
        runConfigCommands([{ type: 'planning-root-update' }])
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setApplyRunnerLines((previous) => [
        ...previous,
        {
          id: createRunnerLineId(),
          kind: 'ascii',
          text: `Apply failed: ${message}`,
          tone: 'error',
        },
      ])
      throw error
    }
  }, [
    autoUpdateAfterProfileChange,
    globalConfigData,
    profileDelivery,
    profileEditMode,
    profileWorkflows,
    runConfigCommands,
    saveMutation,
  ])

  const handleSaveEditor = useCallback(() => {
    let parsed: unknown
    try {
      parsed = JSON.parse(globalConfigDraft)
    } catch (error) {
      setGlobalConfigError(error instanceof Error ? error.message : String(error))
      return
    }
    if (!isCliJsonObject(parsed)) {
      setGlobalConfigError('Global config must be a JSON object.')
      return
    }
    setGlobalConfigError(null)
    saveMutation.mutate(parsed, {
      onSuccess: () => setGlobalConfigTab('preview'),
    })
  }, [globalConfigDraft, saveMutation])

  const handleLaunchInteractiveProfile = useCallback(() => {
    createDedicatedSession('openspec', ['config', 'profile'], { cwdTarget: 'launch-project' })
    const terminalArea = navController.getAreaForPath('/terminal')
    void vtNavController.push(terminalArea, '/terminal', null)
  }, [createDedicatedSession])

  useEffect(() => {
    if (configRunnerStatus !== 'success') return
    void handleRefresh()
  }, [configRunnerStatus, handleRefresh])

  const evidenceError = useMemo(() => {
    if (!environmentGlobalConfig) return null
    const pathEvidence = environmentGlobalConfig.evidence.path
    if (!pathEvidence.success) {
      return (
        pathEvidence.stderr ||
        `openspec config path failed with exit status ${pathEvidence.exitCode ?? 'unknown'}.`
      )
    }
    const configEvidence = environmentGlobalConfig.evidence.config
    if (!configEvidence.success) {
      return (
        configEvidence.stderr ||
        `openspec config list failed with exit status ${configEvidence.exitCode ?? 'unknown'}.`
      )
    }
    return configEvidence.contractError
      ? `OpenSpec global config contract drift: ${configEvidence.contractError}`
      : null
  }, [environmentGlobalConfig])

  const globalConfigOtherFields = useMemo(() => {
    if (!isRecordObject(globalConfigData)) return {}
    return Object.fromEntries(
      Object.entries(globalConfigData).filter(
        ([key]) => !['profile', 'delivery', 'workflows', 'featureFlags', 'telemetry'].includes(key)
      )
    )
  }, [globalConfigData])
  const selectedWorkflowSet = useMemo(() => new Set(profileWorkflows), [profileWorkflows])
  const activeWorkflowSet = useMemo(
    () => new Set(normalizeWorkflowList(globalConfigData?.workflows)),
    [globalConfigData]
  )
  const selectedWorkflowList = useMemo(
    () => OPSX_ALL_WORKFLOWS.filter((workflow) => selectedWorkflowSet.has(workflow)),
    [selectedWorkflowSet]
  )
  const unselectedWorkflowList = useMemo(
    () => OPSX_ALL_WORKFLOWS.filter((workflow) => !selectedWorkflowSet.has(workflow)),
    [selectedWorkflowSet]
  )
  const profileRequiresWorkflowSelection =
    profileEditMode === 'both' || profileEditMode === 'workflows'
  const profileDeliverySaved =
    profileEditMode === 'workflows' ||
    (isRecordObject(globalConfigData) && globalConfigData.delivery === profileDelivery)
  const profileWorkflowsSaved =
    profileEditMode === 'delivery' ||
    (selectedWorkflowList.length === activeWorkflowSet.size &&
      selectedWorkflowList.every((workflow) => activeWorkflowSet.has(workflow)))
  const profileApplySaved = profileDeliverySaved && profileWorkflowsSaved
  const isPendingCommandRunning = isExecutingPendingCommand || configRunnerStatus === 'running'
  const mutationLocked = saveMutation.isPending || isPendingCommandRunning
  const canApplyProfile =
    isCliJsonObject(globalConfigData) &&
    !mutationLocked &&
    !profileApplySaved &&
    (!profileRequiresWorkflowSelection || profileWorkflows.length > 0)
  const pendingCommandLines = useMemo(() => {
    if (pendingCommandKind === 'update') return ['openspec update']
    if (pendingCommandKind === 'apply') {
      const lines = ['apply profile settings to global config']
      if (autoUpdateAfterProfileChange) lines.push('openspec update')
      return lines
    }
    return []
  }, [autoUpdateAfterProfileChange, pendingCommandKind])
  const pendingCommandOutputLines = useMemo(
    () =>
      pendingCommandKind === 'apply'
        ? [...applyRunnerLines, ...configRunnerLines]
        : configRunnerLines,
    [applyRunnerLines, configRunnerLines, pendingCommandKind]
  )

  const handleConfirmPendingCommand = useCallback(async () => {
    if (!pendingCommandKind) return
    setIsExecutingPendingCommand(true)
    setShouldScrollRunner(true)
    try {
      if (pendingCommandKind === 'apply') {
        await executeApplyProfile()
      } else {
        runConfigCommands([{ type: 'planning-root-update' }])
      }
    } catch {
      // Mutation and runner state retain the exact error evidence.
    } finally {
      setIsExecutingPendingCommand(false)
    }
  }, [executeApplyProfile, pendingCommandKind, runConfigCommands])

  if (isStatic) {
    return (
      <section className="border-border bg-card flex min-h-0 flex-1 flex-col gap-4 overflow-hidden rounded-lg border p-4">
        <h2 className="text-sm font-semibold">Environment Global Config</h2>
        <div className="text-muted-foreground rounded-md border border-dashed p-4 text-sm">
          Environment Global Config is unavailable in static export mode.
        </div>
      </section>
    )
  }

  const visibleError = subscriptionError?.message ?? globalConfigError ?? evidenceError
  const pendingCommandTitle = pendingCommandKind === 'apply' ? 'Apply profile' : 'Run update'
  const pendingCommandActionLabel = pendingCommandKind === 'apply' ? 'Apply profile' : 'Run command'
  const tabOptions = [
    { value: 'preview' as const, label: 'Preview', disabled: saveMutation.isPending },
    { value: 'editor' as const, label: 'Editor', disabled: saveMutation.isPending },
    { value: 'profile' as const, label: 'Profile', disabled: saveMutation.isPending },
  ]

  return (
    <>
      <section className="border-border bg-card flex min-h-0 flex-1 flex-col gap-4 overflow-hidden rounded-lg border p-4">
        <header className="flex flex-none flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Environment Global Config</h2>
            <div className="text-muted-foreground mt-1 break-all text-xs">
              <span className="mr-1">Path:</span>
              <code className="bg-muted rounded px-1">
                {environmentGlobalConfig?.file.path ?? 'Unavailable'}
              </code>
            </div>
            {environmentGlobalConfig ? (
              <div className="text-muted-foreground mt-1 break-all text-[11px]">
                OpenSpec data scope:{' '}
                <code className="bg-muted rounded px-1">
                  {environmentGlobalConfig.owner.dataScope.path}
                </code>{' '}
                · {environmentGlobalConfig.owner.dataScope.source}
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLaunchInteractiveProfile}
              disabled={mutationLocked}
              className="border-border hover:bg-muted inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              <TerminalSquare className="h-3.5 w-3.5" />
              Interactive
            </button>
            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={isRefreshing || mutationLocked}
              className="border-border hover:bg-muted inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRefreshing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Refresh
            </button>
          </div>
        </header>

        <div className="text-muted-foreground flex-none text-xs">
          Reads from <code>openspec config list --json</code> and writes to the global config file.
        </div>

        <ButtonGroup<GlobalConfigTab>
          value={globalConfigTab}
          onChange={setGlobalConfigTab}
          options={tabOptions}
        />

        {visibleError ? (
          <div
            role="alert"
            className="text-destructive border-destructive/40 bg-destructive/10 rounded-md border px-3 py-2 text-xs"
          >
            {visibleError}
          </div>
        ) : null}

        {environmentGlobalConfig ? (
          <details className="border-border/70 rounded-md border px-3 py-2 text-xs">
            <summary className="cursor-pointer font-medium">CLI evidence</summary>
            <dl className="mt-2 grid gap-x-3 gap-y-1 sm:grid-cols-[auto_minmax(0,1fr)]">
              <dt className="text-muted-foreground">config path exit</dt>
              <dd>{environmentGlobalConfig.evidence.path.exitCode ?? 'unknown'}</dd>
              <dt className="text-muted-foreground">config path stdout</dt>
              <dd className="whitespace-pre-wrap break-all font-mono">
                {environmentGlobalConfig.evidence.path.stdout || '(empty)'}
              </dd>
              <dt className="text-muted-foreground">config path stderr</dt>
              <dd className="whitespace-pre-wrap break-all font-mono">
                {environmentGlobalConfig.evidence.path.stderr || '(empty)'}
              </dd>
              <dt className="text-muted-foreground">config list exit</dt>
              <dd>{environmentGlobalConfig.evidence.config.exitCode ?? 'unknown'}</dd>
              <dt className="text-muted-foreground">config list stdout</dt>
              <dd className="whitespace-pre-wrap break-all font-mono">
                {environmentGlobalConfig.evidence.config.stdout || '(empty)'}
              </dd>
              <dt className="text-muted-foreground">config list stderr</dt>
              <dd className="whitespace-pre-wrap break-all font-mono">
                {environmentGlobalConfig.evidence.config.stderr || '(empty)'}
              </dd>
              <dt className="text-muted-foreground">contract</dt>
              <dd className="break-all">
                {environmentGlobalConfig.evidence.config.contractError ?? 'compatible'}
              </dd>
            </dl>
          </details>
        ) : null}

        {globalConfigTab === 'preview' ? (
          isLoading && !environmentGlobalConfig ? (
            <div className="route-loading animate-pulse">Loading Environment Global config...</div>
          ) : isRecordObject(globalConfigData) ? (
            <div className="min-h-0 flex-1 space-y-3 overflow-auto pr-1">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="border-border rounded-md border px-3 py-2 text-xs">
                  <div className="text-muted-foreground">profile</div>
                  <div className="mt-1 font-medium">
                    {typeof globalConfigData.profile === 'string'
                      ? globalConfigData.profile
                      : 'N/A'}
                  </div>
                </div>
                <div className="border-border rounded-md border px-3 py-2 text-xs">
                  <div className="text-muted-foreground">delivery</div>
                  <div className="mt-1 font-medium">
                    {typeof globalConfigData.delivery === 'string'
                      ? globalConfigData.delivery
                      : 'N/A'}
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground text-xs">workflows</div>
                {normalizeWorkflowList(globalConfigData.workflows).length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {normalizeWorkflowList(globalConfigData.workflows).map((workflow) => (
                      <span key={workflow} className="bg-muted rounded px-2 py-0.5 text-[10px]">
                        {workflow}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-muted-foreground text-xs">—</div>
                )}
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground text-xs">featureFlags</div>
                <JsonStructuredValue value={globalConfigData.featureFlags ?? {}} />
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground text-xs">telemetry</div>
                <JsonStructuredValue value={globalConfigData.telemetry ?? {}} />
              </div>
              {Object.keys(globalConfigOtherFields).length > 0 ? (
                <div className="space-y-1">
                  <div className="text-muted-foreground text-xs">other fields</div>
                  <JsonStructuredValue value={globalConfigOtherFields} />
                </div>
              ) : null}
            </div>
          ) : (
            <div className="text-muted-foreground text-sm">Global config unavailable.</div>
          )
        ) : globalConfigTab === 'editor' ? (
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
            <CodeEditor
              value={globalConfigDraft}
              onChange={(value) => {
                setGlobalConfigDraft(value)
                setGlobalConfigDraftDirty(true)
                setGlobalConfigError(null)
              }}
              onSaveShortcut={() => {
                if (globalConfigDraftDirty && !saveMutation.isPending) handleSaveEditor()
              }}
              readOnly={saveMutation.isPending}
              filename="openspec.global.config.json"
              language="json"
              className="min-h-0 flex-1"
              editorMinHeight="0px"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={saveMutation.isPending}
                onClick={() => {
                  if (!isRecordObject(globalConfigData)) return
                  setGlobalConfigDraft(JSON.stringify(globalConfigData, null, 2))
                  setGlobalConfigDraftDirty(false)
                  setGlobalConfigError(null)
                }}
                className="border-border hover:bg-muted rounded-md border px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
              >
                Revert
              </button>
              <Button
                size="sm"
                disabled={
                  saveMutation.isPending ||
                  !globalConfigDraftDirty ||
                  !isRecordObject(globalConfigData)
                }
                onClick={handleSaveEditor}
                activity={!globalConfigDraftDirty && isRecordObject(globalConfigData)}
              >
                <Save className="h-3.5 w-3.5" />
                {saveMutation.isPending ? 'Saving...' : globalConfigDraftDirty ? 'Save' : 'Saved'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 gap-4 overflow-hidden xl:grid-cols-[minmax(18rem,0.9fr)_minmax(0,1.1fr)]">
            <section className="min-h-0 space-y-4 overflow-auto pr-1">
              <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
                <div className="border-border rounded-md border px-3 py-2 text-xs">
                  <div className="text-muted-foreground">Profile</div>
                  <div className="mt-1 font-medium">
                    {isLoadingOpsxProfileState
                      ? 'Loading...'
                      : (opsxProfileState?.profile ?? 'N/A')}
                  </div>
                </div>
                <div className="border-border rounded-md border px-3 py-2 text-xs">
                  <div className="text-muted-foreground">Delivery</div>
                  <div className="mt-1 font-medium">
                    {isLoadingOpsxProfileState
                      ? 'Loading...'
                      : (opsxProfileState?.delivery ?? 'N/A')}
                  </div>
                </div>
                <div className="border-border rounded-md border px-3 py-2 text-xs">
                  <div className="text-muted-foreground">Drift</div>
                  <div className="mt-1 font-medium">
                    {isLoadingOpsxProfileState
                      ? 'Loading...'
                      : (opsxProfileState?.driftStatus ?? 'unknown')}
                  </div>
                </div>
              </div>
              {opsxProfileState?.warningText ? (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
                  {opsxProfileState.warningText}
                </div>
              ) : null}
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="text-muted-foreground text-xs">Apply mode</div>
                  <ButtonGroup<ProfileEditMode>
                    value={profileEditMode}
                    onChange={setProfileEditMode}
                    options={[
                      { value: 'both', label: 'Delivery + Workflows', disabled: mutationLocked },
                      { value: 'delivery', label: 'Delivery only', disabled: mutationLocked },
                      { value: 'workflows', label: 'Workflows only', disabled: mutationLocked },
                    ]}
                  />
                </div>
                {profileEditMode === 'both' || profileEditMode === 'delivery' ? (
                  <label className="space-y-1">
                    <div className="text-muted-foreground text-xs">Delivery</div>
                    <Select
                      value={profileDelivery}
                      options={DELIVERY_MODE_OPTIONS}
                      onValueChange={setProfileDelivery}
                      ariaLabel="Delivery"
                      disabled={mutationLocked}
                      className="w-full"
                    />
                  </label>
                ) : null}
                <label className="border-border flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-xs">
                  <span>
                    Run <code>openspec update</code> automatically after apply
                  </span>
                  <Switch
                    checked={autoUpdateAfterProfileChange}
                    onCheckedChange={setAutoUpdateAfterProfileChange}
                    ariaLabel="Run openspec update automatically after apply"
                    disabled={mutationLocked}
                  />
                </label>
              </div>
            </section>

            <section className="space-y-3 overflow-auto pr-1">
              {profileEditMode === 'both' || profileEditMode === 'workflows' ? (
                <>
                  <div className="text-muted-foreground text-xs">Workflows</div>
                  <div className="border-border/70 bg-muted/20 rounded-md border border-dashed px-3 py-2">
                    <div className="text-muted-foreground mb-1 text-[10px] font-medium uppercase tracking-wide">
                      Reference
                    </div>
                    <div className="text-muted-foreground space-y-0.5 font-mono text-[11px] leading-relaxed">
                      <div>selected: [{selectedWorkflowList.join(', ')}]</div>
                      <div>unselected: [{unselectedWorkflowList.join(', ')}]</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-2">
                    {OPSX_ALL_WORKFLOWS.map((workflow) => {
                      const isSelected = selectedWorkflowSet.has(workflow)
                      const isActive = activeWorkflowSet.has(workflow)
                      const isDirty = isSelected !== isActive
                      return (
                        <button
                          type="button"
                          key={workflow}
                          disabled={mutationLocked}
                          onClick={() =>
                            setProfileWorkflows((previous) =>
                              previous.includes(workflow)
                                ? previous.filter((item) => item !== workflow)
                                : [...previous, workflow]
                            )
                          }
                          className={`flex items-center justify-between gap-2 rounded border px-2.5 py-1.5 text-left text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                            isSelected && !isDirty
                              ? 'border-primary bg-primary/10 text-primary'
                              : !isSelected && !isDirty
                                ? 'border-border hover:bg-muted'
                                : isSelected
                                  ? 'rounded border border-amber-500/60 bg-amber-500/15 text-amber-700 dark:text-amber-200'
                                  : 'rounded border border-amber-500/50 bg-amber-500/5 text-amber-700/90 dark:text-amber-200'
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            {isSelected ? <Check className="h-3 w-3 shrink-0" /> : null}
                            <span>{OPSX_WORKFLOW_LABELS[workflow]}</span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </>
              ) : (
                <div className="text-muted-foreground rounded-md border border-dashed px-3 py-4 text-xs">
                  Switch apply mode to include workflows to edit the workflow set.
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  size="sm"
                  disabled={!canApplyProfile}
                  onClick={() => {
                    setGlobalConfigError(null)
                    resetConfigRunner()
                    setApplyRunnerLines([])
                    setPendingCommandKind('apply')
                  }}
                  activity={profileApplySaved}
                >
                  <Check className="h-3.5 w-3.5" />
                  {profileApplySaved ? 'Applied' : 'Apply'}
                </Button>
                <button
                  type="button"
                  disabled={mutationLocked}
                  onClick={() => {
                    resetConfigRunner()
                    setApplyRunnerLines([])
                    setPendingCommandKind('update')
                  }}
                  className="border-border hover:bg-muted inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Run update
                </button>
                {saveMutation.isPending ? (
                  <span className="text-muted-foreground text-xs">Saving...</span>
                ) : null}
              </div>
            </section>
          </div>
        )}
      </section>

      <Dialog
        open={pendingCommandKind !== null}
        onClose={() => {
          if (!isPendingCommandRunning) setPendingCommandKind(null)
        }}
        bodyClassName="space-y-3"
        title={
          <div className="flex items-center gap-2">
            <TerminalSquare className="h-4 w-4" />
            <span className="text-sm font-semibold">{pendingCommandTitle}</span>
          </div>
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => setPendingCommandKind(null)}
              disabled={isPendingCommandRunning}
              className="border-border hover:bg-muted inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
            >
              Close
            </button>
            <button
              type="button"
              disabled={isPendingCommandRunning || !pendingCommandKind}
              onClick={() => void handleConfirmPendingCommand()}
              className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPendingCommandRunning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              {isPendingCommandRunning ? 'Running...' : pendingCommandActionLabel}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <div>
            <div className="text-muted-foreground mb-1 text-xs">Command plan</div>
            <div className="bg-muted rounded-md px-3 py-2">
              {pendingCommandLines.map((line, index) => (
                <div key={`${line}-${index}`} className="font-mono text-xs">
                  {line}
                </div>
              ))}
            </div>
          </div>
          <div ref={runnerOutputRef}>
            <CliTerminal lines={pendingCommandOutputLines} maxHeight="42vh" />
          </div>
        </div>
      </Dialog>
    </>
  )
}
