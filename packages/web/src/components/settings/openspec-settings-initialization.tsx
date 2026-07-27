/**
 * Orthogonal intents (updated 2026-07-20 Asia/Shanghai):
 * 1. Present reactive launch-local skill and physically scoped command delivery evidence.
 * 2. Own OpenSpec Init selection, pending lock, stream output, and cancellation lifecycle.
 *
 * Original request (2026-07-14): "openspec 1.6.0 已经放出，我们需要开始进行适配。"
 * Independent review correction (2026-07-20): Environment-global Codex commands must retain physical scope.
 */
import { CliTerminal } from '@/components/cli-terminal'
import { Dialog } from '@/components/dialog'
import { Select, type SelectOption } from '@/components/select'
import { Switch } from '@/components/switch'
import { TocSection } from '@/components/toc'
import { trpc } from '@/lib/trpc'
import { useCliRunner } from '@/lib/use-cli-runner'
import {
  buildSettingsInitInput,
  canAutoInit,
  countSelectedToolActions,
  formatSelectedInitLabel,
  getSettingsInitActionState,
  getToolInitStatus,
  type InitProfileOverride,
  type InitToolsMode,
} from '@/routes/settings-init'
import type { AIToolOption, ToolInitDelivery, ToolInitState } from '@openspecui/core'
import { useQuery } from '@tanstack/react-query'
import { Check, FolderPlus, Loader2, Terminal } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { SettingsStatusLabel } from './settings-status-label'
import {
  useDetectedProjectToolsSubscription,
  useToolInitStatesSubscription,
} from './use-settings-tool-subscriptions'

const INIT_TOOLS_MODE_OPTIONS: SelectOption<InitToolsMode>[] = [
  { value: 'auto', label: 'Auto-detect tools (recommended)' },
  { value: 'selected', label: 'Use selected tools' },
  { value: 'all', label: 'Use all tools' },
]

const INIT_PROFILE_OVERRIDE_OPTIONS: SelectOption<InitProfileOverride>[] = [
  { value: 'default', label: 'Use global default' },
  { value: 'core', label: 'core' },
  { value: 'custom', label: 'custom' },
]

/** Current Environment Global contract required to interpret generated tool artifacts. */
export interface SettingsToolDeliveryInput {
  delivery: ToolInitDelivery
  workflows: string[]
}

function ToolArtifactDetails({ state }: { state: ToolInitState }) {
  const details = [
    state.missingSkillWorkflows.length
      ? `missing skills: ${state.missingSkillWorkflows.join(', ')}`
      : null,
    state.missingCommandWorkflows.length
      ? `missing commands: ${state.missingCommandWorkflows.join(', ')}`
      : null,
    state.unexpectedSkillWorkflows.length
      ? `unexpected skills: ${state.unexpectedSkillWorkflows.join(', ')}`
      : null,
    state.unexpectedCommandWorkflows.length
      ? `unexpected commands: ${state.unexpectedCommandWorkflows.join(', ')}`
      : null,
    state.legacyCommandWorkflows.length
      ? `legacy commands: ${state.legacyCommandWorkflows.join(', ')}`
      : null,
  ].filter((detail): detail is string => detail !== null)

  return (
    <div className="text-muted-foreground mt-1 space-y-0.5 text-[11px] leading-4">
      <p>
        Skills {state.presentExpectedSkillCount}/{state.expectedSkillCount} | Commands{' '}
        {state.presentExpectedCommandCount}/{state.expectedCommandCount}
      </p>
      {details.map((detail) => (
        <p key={detail}>{detail}</p>
      ))}
    </div>
  )
}

function ToolSelectionRow({
  tool,
  state,
  selected,
  disabled,
  onToggle,
}: {
  tool: AIToolOption
  state: ToolInitState | undefined
  selected: boolean
  disabled: boolean
  onToggle: () => void
}) {
  const status = state?.status ?? 'uninitialized'
  return (
    <li className="border-border min-w-0 border-b py-2 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={selected}
        className="hover:bg-muted/50 flex w-full min-w-0 items-start justify-between gap-3 rounded px-1 py-1 text-left disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="min-w-0">
          <span className="block truncate text-xs font-medium">{tool.name}</span>
          {state ? (
            <ToolArtifactDetails state={state} />
          ) : (
            <span className="text-muted-foreground mt-1 block text-[11px]">
              No artifacts detected.
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <SettingsStatusLabel status={status}>{status}</SettingsStatusLabel>
          {selected ? <Check className="text-primary h-3.5 w-3.5" aria-label="Selected" /> : null}
        </span>
      </button>
    </li>
  )
}

function ReactiveToolInitialization({
  input,
  allTools,
  allToolsLoading,
  detectedTools,
  detectedLoading,
  detectedError,
}: {
  input: SettingsToolDeliveryInput
  allTools: AIToolOption[] | undefined
  allToolsLoading: boolean
  detectedTools: AIToolOption[] | undefined
  detectedLoading: boolean
  detectedError: Error | null
}) {
  const [manualSelectedTools, setManualSelectedTools] = useState<string[]>([])
  const [showInitModal, setShowInitModal] = useState(false)
  const [initToolsMode, setInitToolsMode] = useState<InitToolsMode>('auto')
  const [initProfileOverride, setInitProfileOverride] = useState<InitProfileOverride>('default')
  const [initForce, setInitForce] = useState(true)
  const initRunner = useCliRunner()
  const { lines, status, commands, cancel, reset } = initRunner
  const toolStates = useToolInitStatesSubscription(input)
  const nativeTools = useMemo(() => allTools?.filter((tool) => tool.available) ?? [], [allTools])
  const supportedToolIds = useMemo(() => nativeTools.map((tool) => tool.value), [nativeTools])
  const supportedTools = useMemo(() => new Set(supportedToolIds), [supportedToolIds])
  const toolStateById = useMemo(
    () => new Map((toolStates.data ?? []).map((state) => [state.toolId, state])),
    [toolStates.data]
  )
  const initializedToolIds = useMemo(
    () =>
      supportedToolIds.filter(
        (toolId) => getToolInitStatus(toolStateById, toolId) === 'initialized'
      ),
    [supportedToolIds, toolStateById]
  )
  const initializedToolSet = useMemo(() => new Set(initializedToolIds), [initializedToolIds])
  const selectableToolIds = useMemo(
    () => supportedToolIds.filter((toolId) => !initializedToolSet.has(toolId)),
    [initializedToolSet, supportedToolIds]
  )
  const selectedTools = useMemo(
    () =>
      manualSelectedTools.filter(
        (toolId) => supportedTools.has(toolId) && !initializedToolSet.has(toolId)
      ),
    [initializedToolSet, manualSelectedTools, supportedTools]
  )
  const detectedToolIds = useMemo(
    () => detectedTools?.map((tool) => tool.value) ?? [],
    [detectedTools]
  )
  const interactionLocked =
    allToolsLoading || toolStates.isLoading || toolStates.error !== null || status === 'running'

  useEffect(() => {
    setManualSelectedTools((previous) => {
      const next = previous.filter(
        (toolId) => supportedTools.has(toolId) && !initializedToolSet.has(toolId)
      )
      return previous.length === next.length &&
        previous.every((toolId, index) => toolId === next[index])
        ? previous
        : next
    })
  }, [initializedToolSet, supportedTools])

  const selectedCounts = useMemo(
    () => countSelectedToolActions(toolStateById, selectedTools),
    [selectedTools, toolStateById]
  )
  const selectedInitLabel = formatSelectedInitLabel(selectedCounts)
  const hasSelectedToolActions = selectedCounts.newCount + selectedCounts.repairCount > 0
  const action = getSettingsInitActionState({
    mode: initToolsMode,
    selectedLabel: selectedInitLabel,
    autoInitDisabled: detectedLoading || detectedError !== null || !canAutoInit(detectedToolIds),
    hasSelectedToolActions,
  })
  const initInput = useMemo(
    () =>
      buildSettingsInitInput({
        mode: initToolsMode,
        selectedToolIds: selectedTools,
        cliSupportedToolIds: supportedTools,
        profileOverride: initProfileOverride,
        force: initForce,
      }),
    [initForce, initProfileOverride, initToolsMode, selectedTools, supportedTools]
  )

  useEffect(() => {
    if (!showInitModal) {
      cancel()
      reset()
      return
    }
    commands.replaceAll([{ type: 'init', input: initInput }])
  }, [cancel, commands, initInput, reset, showInitModal])

  const toggleTool = (toolId: string) => {
    if (interactionLocked || !supportedTools.has(toolId) || initializedToolSet.has(toolId)) return
    setManualSelectedTools((previous) =>
      previous.includes(toolId)
        ? previous.filter((candidate) => candidate !== toolId)
        : [...previous, toolId]
    )
  }
  const toggleAllTools = () => {
    if (interactionLocked) return
    const allSelected =
      selectableToolIds.length > 0 &&
      selectableToolIds.every((toolId) => manualSelectedTools.includes(toolId))
    setManualSelectedTools(allSelected ? [] : [...selectableToolIds])
  }
  const closeInit = () => {
    if (status === 'running') cancel()
    setShowInitModal(false)
    reset()
  }
  const borderVariant = status === 'error' ? 'error' : status === 'success' ? 'success' : 'default'
  const initializedCount = (toolStates.data ?? []).filter(
    (state) => state.status === 'initialized'
  ).length
  const partialCount = (toolStates.data ?? []).filter((state) => state.status === 'partial').length

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-muted-foreground text-xs">
            Tool artifact contract: {input.delivery} | {input.workflows.length} workflows
          </p>
          {toolStates.isLoading ? (
            <SettingsStatusLabel status="loading">Tool state loading</SettingsStatusLabel>
          ) : toolStates.error ? (
            <SettingsStatusLabel status="failed">Tool subscription failed</SettingsStatusLabel>
          ) : (
            <SettingsStatusLabel status="current">Tool state current</SettingsStatusLabel>
          )}
        </div>
        {toolStates.error ? (
          <p className="text-destructive text-xs" role="alert">
            {toolStates.error.message}
          </p>
        ) : null}
        {detectedError ? (
          <p className="text-destructive text-xs" role="alert">
            {detectedError.message}
          </p>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Init Mode</span>
            <Select
              value={initToolsMode}
              options={INIT_TOOLS_MODE_OPTIONS}
              onValueChange={setInitToolsMode}
              ariaLabel="Init Mode"
              className="w-full"
              disabled={interactionLocked}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Profile Override</span>
            <Select
              value={initProfileOverride}
              options={INIT_PROFILE_OVERRIDE_OPTIONS}
              onValueChange={setInitProfileOverride}
              ariaLabel="Profile Override"
              className="w-full"
              disabled={interactionLocked}
            />
          </label>
        </div>

        <div className={initToolsMode === 'selected' ? '' : 'opacity-60'}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-sm font-medium">AI tool delivery</p>
            <button
              type="button"
              onClick={toggleAllTools}
              disabled={interactionLocked || initToolsMode !== 'selected'}
              className="text-primary text-xs hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            >
              {selectedTools.length > 0 && selectedTools.length === selectableToolIds.length
                ? 'Deselect All'
                : 'Select All'}
            </button>
          </div>
          <ul className="grid gap-x-4 sm:grid-cols-2">
            {nativeTools.map((tool) => (
              <ToolSelectionRow
                key={tool.value}
                tool={tool}
                state={toolStateById.get(tool.value)}
                selected={selectedTools.includes(tool.value)}
                disabled={
                  interactionLocked ||
                  initToolsMode !== 'selected' ||
                  initializedToolSet.has(tool.value)
                }
                onToggle={() => toggleTool(tool.value)}
              />
            ))}
          </ul>
        </div>

        <div className="text-muted-foreground flex flex-wrap gap-4 text-xs">
          <span>{initializedCount} initialized</span>
          <span>{partialCount} repair needed</span>
          <span>{selectedTools.length} selected</span>
          <span>{detectedToolIds.length} detected in launch project</span>
        </div>

        <div className="border-border flex flex-wrap items-start gap-2.5 border-t pt-3">
          <button
            type="button"
            onClick={() => setShowInitModal(true)}
            disabled={interactionLocked || action.disabled}
            title={action.title}
            className="bg-primary text-primary-foreground inline-flex min-h-9 items-center gap-2 rounded-md px-3.5 py-2 text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === 'running' ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <FolderPlus className="h-4 w-4" aria-hidden />
            )}
            {action.label}
          </button>
          <label className="border-border bg-background/50 flex min-w-0 flex-col gap-1 rounded-md border px-3 py-2">
            <span className="flex items-center justify-between gap-3 text-xs font-medium">
              Force non-interactive init
              <Switch
                checked={initForce}
                onCheckedChange={setInitForce}
                ariaLabel="Force non-interactive init"
                disabled={interactionLocked}
              />
            </span>
          </label>
        </div>
        <p className="text-muted-foreground text-xs">{action.helperText}</p>
      </div>

      <Dialog
        open={showInitModal}
        onClose={closeInit}
        bodyClassName="max-h-[70vh]"
        borderVariant={borderVariant}
        title={
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4" aria-hidden />
            <span className="font-semibold">Initialize OpenSpec</span>
          </div>
        }
        footer={
          <div className="flex items-center gap-2">
            {status === 'running' ? (
              <button
                type="button"
                onClick={cancel}
                className="border-border hover:bg-muted rounded-md border px-4 py-2"
              >
                Cancel
              </button>
            ) : (
              <button
                type="button"
                onClick={closeInit}
                className="bg-muted hover:bg-muted/80 rounded-md px-4 py-2"
              >
                Close
              </button>
            )}
            {status !== 'success' ? (
              <button
                type="button"
                onClick={() => commands.runAll()}
                className="bg-primary text-primary-foreground rounded-md px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={
                  interactionLocked || (initToolsMode === 'selected' && !hasSelectedToolActions)
                }
              >
                {status === 'running' ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-label="Initializing" />
                ) : (
                  'Run init'
                )}
              </button>
            ) : null}
          </div>
        }
      >
        <CliTerminal lines={lines} />
      </Dialog>
    </>
  )
}

/** Render the reactive tool initialization section. */
export function OpenSpecSettingsInitializationSection({
  index,
  input,
  environmentWaiting,
  environmentError,
}: {
  index: number
  input: SettingsToolDeliveryInput | null
  environmentWaiting: boolean
  environmentError: Error | null
}) {
  const detectedTools = useDetectedProjectToolsSubscription()
  const allTools = useQuery(trpc.cli.getAllTools.queryOptions())

  return (
    <TocSection id="settings-init-openspec" index={index} className="space-y-4">
      <h2 className="text-lg font-semibold">Initialize OpenSpec</h2>
      <div className="border-border space-y-4 rounded-lg border p-4">
        {input ? (
          <ReactiveToolInitialization
            input={input}
            allTools={allTools.data}
            allToolsLoading={allTools.isLoading}
            detectedTools={detectedTools.data}
            detectedLoading={detectedTools.isLoading}
            detectedError={detectedTools.error}
          />
        ) : (
          <div className="space-y-2">
            <SettingsStatusLabel status={environmentError ? 'failed' : 'loading'}>
              {environmentError
                ? 'Initialization locked by stale Environment Global state'
                : environmentWaiting
                  ? 'Waiting for current Environment Global delivery'
                  : 'Environment Global delivery unavailable'}
            </SettingsStatusLabel>
            <p className="text-muted-foreground text-xs">
              Initialization requires the current CLI-owned delivery and effective workflow set.
            </p>
          </div>
        )}
      </div>
    </TocSection>
  )
}
