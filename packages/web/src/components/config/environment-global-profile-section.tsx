/**
 * Orthogonal intents (created 2026-07-18 Asia/Shanghai):
 * 1. Project the reactive environment-global profile, delivery, workflow, and drift facts.
 * 2. Own profile drafts and the typed environment-global save handoff.
 * 3. Own Planning-root Update, Apply auto-Update, runner output, and readiness gating.
 *
 * Original request (2026-07-15): "Config ownership separates launch-project binding, active-root config, and environment-global config."
 * Original request (2026-07-18): "Environment Global profile/drift must remain reactive and Update must use the Root action gate."
 */
import { Button } from '@/components/button'
import { ButtonGroup } from '@/components/button-group'
import { CliTerminal } from '@/components/cli-terminal'
import { Dialog } from '@/components/dialog'
import { RootActionNotice } from '@/components/root-action-notice'
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
import { useCliRunner, type CliRunnerLine } from '@/lib/use-cli-runner'
import { useRootActionState } from '@/lib/use-root-action-state'
import { vtNavController } from '@/lib/view-transitions/navigation'
import type { CliJsonValue, EnvironmentGlobalConfig } from '@openspecui/core'
import { Check, Loader2, RefreshCw, TerminalSquare } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { isRecordObject, normalizeWorkflowList } from './environment-global-config-utils'

type ProfileEditMode = 'both' | 'delivery' | 'workflows'
type DeliveryMode = 'both' | 'skills' | 'commands'

const DELIVERY_MODE_OPTIONS: SelectOption<DeliveryMode>[] = [
  { value: 'both', label: 'both' },
  { value: 'skills', label: 'skills' },
  { value: 'commands', label: 'commands' },
]

function createRunnerLineId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
}

/** Props for the profile and Planning-root Update ownership slice. */
export interface EnvironmentGlobalProfileSectionProps {
  config: Record<string, CliJsonValue>
  profileState: EnvironmentGlobalConfig['profileState'] | null
  isSaving: boolean
  projectionLocked: boolean
  saveConfig: (config: Record<string, CliJsonValue>) => Promise<unknown>
  onRefresh: () => void
}

/** Render reactive profile controls and the typed Planning-root Update procedure. */
export function EnvironmentGlobalProfileSection({
  config,
  profileState,
  isSaving,
  projectionLocked,
  saveConfig,
  onRefresh,
}: EnvironmentGlobalProfileSectionProps) {
  const [profileEditMode, setProfileEditMode] = useState<ProfileEditMode>('both')
  const [profileDelivery, setProfileDelivery] = useState<DeliveryMode>('both')
  const [profileWorkflows, setProfileWorkflows] = useState<string[]>([
    ...OPSX_CORE_PROFILE_WORKFLOWS,
  ])
  const [autoUpdateAfterProfileChange, setAutoUpdateAfterProfileChange] = useState(true)
  const [pendingCommandKind, setPendingCommandKind] = useState<'apply' | 'update' | null>(null)
  const [isExecutingPendingCommand, setIsExecutingPendingCommand] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [applyRunnerLines, setApplyRunnerLines] = useState<CliRunnerLine[]>([])
  const [shouldScrollRunner, setShouldScrollRunner] = useState(false)
  const runnerOutputRef = useRef<HTMLDivElement | null>(null)
  const { createDedicatedSession } = useTerminalContext()
  const rootAction = useRootActionState()
  const configRunner = useCliRunner()
  const {
    lines: configRunnerLines,
    status: configRunnerStatus,
    commands: configRunnerCommands,
    reset: resetConfigRunner,
  } = configRunner

  useEffect(() => {
    const delivery = config.delivery
    setProfileDelivery(
      delivery === 'skills' || delivery === 'commands' || delivery === 'both' ? delivery : 'both'
    )
    setProfileWorkflows(normalizeWorkflowList(config.workflows))
  }, [config])

  useEffect(() => {
    if (configRunnerStatus !== 'success') return
    onRefresh()
  }, [configRunnerStatus, onRefresh])

  useEffect(() => {
    if (!shouldScrollRunner) return
    if (configRunnerStatus !== 'running' && configRunnerLines.length === 0) return
    const frame = window.requestAnimationFrame(() => {
      runnerOutputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
    setShouldScrollRunner(false)
    return () => window.cancelAnimationFrame(frame)
  }, [configRunnerLines.length, configRunnerStatus, shouldScrollRunner])

  const selectedWorkflowSet = useMemo(() => new Set(profileWorkflows), [profileWorkflows])
  const activeWorkflowSet = useMemo(
    () => new Set(normalizeWorkflowList(config.workflows)),
    [config.workflows]
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
    profileEditMode === 'workflows' || config.delivery === profileDelivery
  const profileWorkflowsSaved =
    profileEditMode === 'delivery' ||
    (selectedWorkflowList.length === activeWorkflowSet.size &&
      selectedWorkflowList.every((workflow) => activeWorkflowSet.has(workflow)))
  const profileApplySaved = profileDeliverySaved && profileWorkflowsSaved
  const isPendingCommandRunning = isExecutingPendingCommand || configRunnerStatus === 'running'
  const mutationLocked = isSaving || isPendingCommandRunning || projectionLocked
  const canApplyProfile =
    isRecordObject(config) &&
    !mutationLocked &&
    !profileApplySaved &&
    (!profileRequiresWorkflowSelection || profileWorkflows.length > 0)
  const pendingCommandLines =
    pendingCommandKind === 'update'
      ? ['openspec update']
      : pendingCommandKind === 'apply'
        ? [
            'apply profile settings to global config',
            ...(autoUpdateAfterProfileChange ? ['openspec update'] : []),
          ]
        : []
  const pendingCommandOutputLines =
    pendingCommandKind === 'apply' ? [...applyRunnerLines, ...configRunnerLines] : configRunnerLines

  const runConfigCommands = (commands: Parameters<typeof configRunnerCommands.replaceAll>[0]) => {
    if (
      commands.some((command) => command.type === 'planning-root-update') &&
      rootAction.disabled
    ) {
      setProfileError(rootAction.message)
      return false
    }
    setShouldScrollRunner(true)
    configRunnerCommands.replaceAll(commands)
    void configRunnerCommands.runAll()
    return true
  }

  const executeApplyProfile = async () => {
    const nextConfig: Record<string, CliJsonValue> = { ...config }
    if (profileEditMode === 'both' || profileEditMode === 'delivery') {
      nextConfig.delivery = profileDelivery
    }
    if (profileEditMode === 'both' || profileEditMode === 'workflows') {
      nextConfig.workflows = [...profileWorkflows]
      nextConfig.profile = isOpsxCoreWorkflowSelection(profileWorkflows) ? 'core' : 'custom'
    }

    setProfileError(null)
    setApplyRunnerLines((previous) => [
      ...previous,
      {
        id: createRunnerLineId(),
        kind: 'ascii',
        text: 'Applying profile settings to global config...',
      },
    ])
    try {
      await saveConfig(nextConfig)
      setApplyRunnerLines((previous) => [
        ...previous,
        {
          id: createRunnerLineId(),
          kind: 'ascii',
          text: 'Profile settings applied successfully.',
          tone: 'success',
        },
      ])
      if (autoUpdateAfterProfileChange && !rootAction.disabled) {
        setApplyRunnerLines((previous) => [
          ...previous,
          { id: createRunnerLineId(), kind: 'ascii', text: 'Starting openspec update...' },
        ])
        runConfigCommands([{ type: 'planning-root-update' }])
      } else if (autoUpdateAfterProfileChange) {
        setApplyRunnerLines((previous) => [
          ...previous,
          {
            id: createRunnerLineId(),
            kind: 'ascii',
            text: rootAction.message ?? 'Planning-root Update was not started.',
            tone: 'error',
          },
        ])
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
    }
  }

  const handleConfirmPendingCommand = async () => {
    if (!pendingCommandKind) return
    if (pendingCommandKind === 'update' && rootAction.disabled) {
      setProfileError(rootAction.message)
      return
    }
    setIsExecutingPendingCommand(true)
    setShouldScrollRunner(true)
    try {
      if (pendingCommandKind === 'apply') await executeApplyProfile()
      else runConfigCommands([{ type: 'planning-root-update' }])
    } finally {
      setIsExecutingPendingCommand(false)
    }
  }

  const pendingCommandTitle = pendingCommandKind === 'apply' ? 'Apply profile' : 'Run update'
  const pendingCommandActionLabel = pendingCommandKind === 'apply' ? 'Apply profile' : 'Run command'

  return (
    <>
      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden xl:grid-cols-[minmax(18rem,0.9fr)_minmax(0,1.1fr)]">
        <section className="min-h-0 space-y-4 overflow-auto pr-1">
          <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
            <div className="border-border rounded-md border px-3 py-2 text-xs">
              <div className="text-muted-foreground">Profile</div>
              <div className="mt-1 font-medium">{profileState?.profile ?? 'N/A'}</div>
            </div>
            <div className="border-border rounded-md border px-3 py-2 text-xs">
              <div className="text-muted-foreground">Delivery</div>
              <div className="mt-1 font-medium">{profileState?.delivery ?? 'N/A'}</div>
            </div>
            <div className="border-border rounded-md border px-3 py-2 text-xs">
              <div className="text-muted-foreground">Drift</div>
              <div className="mt-1 font-medium">{profileState?.driftStatus ?? 'unknown'}</div>
            </div>
          </div>
          {profileState?.warningText ? (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
              {profileState.warningText}
            </div>
          ) : null}
          {rootAction.disabled ? <RootActionNotice state={rootAction} /> : null}
          {profileError ? (
            <div role="alert" className="text-destructive text-xs">
              {profileError}
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
                setProfileError(null)
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
              disabled={mutationLocked || rootAction.disabled}
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
          </div>
          <button
            type="button"
            onClick={() => {
              createDedicatedSession('openspec', ['config', 'profile'], {
                cwdTarget: 'launch-project',
              })
              const terminalArea = navController.getAreaForPath('/terminal')
              void vtNavController.push(terminalArea, '/terminal', null)
            }}
            disabled={mutationLocked}
            className="border-border hover:bg-muted inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          >
            <TerminalSquare className="h-3.5 w-3.5" />
            Interactive
          </button>
        </section>
      </div>

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
