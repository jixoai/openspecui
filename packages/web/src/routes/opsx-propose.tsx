import { ButtonGroup } from '@/components/button-group'
import { CodeEditor } from '@/components/code-editor'
import { usePopAreaConfigContext, usePopAreaLifecycleContext } from '@/components/layout/pop-area'
import { Select, type SelectOptionGroup } from '@/components/select'
import { TerminalSpawnCommandDialog } from '@/components/terminal/terminal-spawn-command-dialog'
import { navController } from '@/lib/nav-controller'
import {
  OPSX_AGENT_INVOCATION_MODE_OPTIONS,
  buildOpsxProposeComposePrompt,
  buildOpsxSlashCommand,
  type OpsxAgentInvocationMode,
} from '@/lib/opsx-agent-invocation'
import {
  prepareWorkflowInvocation,
  stringifyWorkflowInvocation,
  workflowDiagnosticsToText,
} from '@/lib/opsx-workflow-invocation'
import { useTerminalContext } from '@/lib/terminal-context'
import { terminalController } from '@/lib/terminal-controller'
import { trpcClient } from '@/lib/trpc'
import { useConfigSubscription } from '@/lib/use-subscription'
import { useTerminalInvocationConfig } from '@/lib/use-terminal-invocation-config'
import type {
  TerminalCommandFieldValues,
  TerminalSpawnCommand,
} from '@openspecui/core/terminal-invocation'
import { useMutation } from '@tanstack/react-query'
import { ArrowRight, Copy, Save, Send, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

type ExistingTerminalTarget = `terminal:${string}`
type CreateTerminalTarget = `create:${string}`
type DispatchTarget = ExistingTerminalTarget | CreateTerminalTarget
type TargetSelectValue = DispatchTarget | ''

const TERMINAL_TARGET_PREFIX = 'terminal:'
const CREATE_TARGET_PREFIX = 'create:'

function parseTerminalTarget(target: string | null | undefined): string | null {
  if (!target?.startsWith(TERMINAL_TARGET_PREFIX)) return null
  return target.slice(TERMINAL_TARGET_PREFIX.length)
}

function parseCreateTarget(target: string | null | undefined): string | null {
  if (!target?.startsWith(CREATE_TARGET_PREFIX)) return null
  return target.slice(CREATE_TARGET_PREFIX.length)
}

export function OpsxProposeRoute() {
  const { setConfig } = usePopAreaConfigContext()
  const { requestClose } = usePopAreaLifecycleContext()
  const { sessions, activeSessionId } = useTerminalContext()
  const { spawnCommands } = useTerminalInvocationConfig()
  const { data: uiConfig } = useConfigSubscription()
  const liveSessions = useMemo(() => sessions.filter((session) => !session.isExited), [sessions])
  const [draft, setDraft] = useState('')
  const [mode, setMode] = useState<OpsxAgentInvocationMode>('compose')
  const [target, setTarget] = useState<DispatchTarget | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [spawnDialogOpen, setSpawnDialogOpen] = useState(false)
  const [spawnPresetValues, setSpawnPresetValues] = useState<TerminalCommandFieldValues>({})

  const defaultSpawnCommand = spawnCommands[0] ?? null

  const targetGroups = useMemo<SelectOptionGroup<TargetSelectValue>[]>(
    () => [
      {
        label: 'Shell Instances',
        options:
          liveSessions.length > 0
            ? liveSessions.map((session) => ({
                value: `terminal:${session.id}` as ExistingTerminalTarget,
                label: session.displayTitle,
              }))
            : [{ value: '', label: 'No shell instances available', disabled: true }],
      },
      {
        label: 'Create Shell Instance',
        options:
          spawnCommands.length > 0
            ? spawnCommands.map((command) => ({
                value: `create:${command.id}` as CreateTerminalTarget,
                label: `Create ${command.label}`,
              }))
            : [{ value: '', label: 'No spawn commands configured', disabled: true }],
      },
    ],
    [liveSessions, spawnCommands]
  )
  const selectedSpawnCommand = useMemo<TerminalSpawnCommand | null>(() => {
    if (!target) return defaultSpawnCommand
    const commandId = parseCreateTarget(target)
    if (!commandId) return defaultSpawnCommand
    return spawnCommands.find((command) => command.id === commandId) ?? defaultSpawnCommand
  }, [defaultSpawnCommand, spawnCommands, target])

  const firstCreateTarget = useMemo<DispatchTarget | null>(
    () => (defaultSpawnCommand ? `create:${defaultSpawnCommand.id}` : null),
    [defaultSpawnCommand]
  )

  const saveModeMutation = useMutation({
    mutationFn: (agentInvocationMode: OpsxAgentInvocationMode) =>
      trpcClient.config.update.mutate({ opsx: { agentInvocationMode } }),
  })

  useEffect(() => {
    setConfig({
      layout: {
        alignY: 'start',
        width: 'wide',
        topGap: 'comfortable',
      },
      dialogClassName: 'overflow-hidden',
      panelClassName: 'w-full',
      bodyClassName: 'p-0',
      maxHeight: 'min(86dvh,900px)',
    })
  }, [setConfig])

  useEffect(() => {
    const nextMode = uiConfig?.opsx?.agentInvocationMode
    if (nextMode) {
      setMode(nextMode)
    }
  }, [uiConfig?.opsx?.agentInvocationMode])

  const preferredTarget = useMemo<DispatchTarget | null>(() => {
    if (activeSessionId && liveSessions.some((session) => session.id === activeSessionId)) {
      return `terminal:${activeSessionId}`
    }
    return liveSessions[0] ? `terminal:${liveSessions[0].id}` : firstCreateTarget
  }, [activeSessionId, firstCreateTarget, liveSessions])

  useEffect(() => {
    setTarget((prev) => {
      if (!prev) return preferredTarget
      if (
        parseCreateTarget(prev) &&
        spawnCommands.some((command) => `create:${command.id}` === prev)
      ) {
        return prev
      }
      const sessionId = parseTerminalTarget(prev)
      if (sessionId && liveSessions.some((session) => session.id === sessionId)) {
        return prev
      }
      return preferredTarget
    })
  }, [liveSessions, preferredTarget, spawnCommands])

  const payload = useMemo(() => {
    if (mode === 'command') {
      return buildOpsxSlashCommand({ action: 'propose', text: draft }) ?? '/opsx:propose'
    }
    return buildOpsxProposeComposePrompt(draft)
  }, [draft, mode])

  const preparePayload = async () => {
    const result = await prepareWorkflowInvocation({
      requestedMode: mode,
      workflowInput: { action: 'propose', text: draft },
      staticFallback: () =>
        mode === 'command'
          ? {
              kind: 'agent-command',
              text: buildOpsxSlashCommand({ action: 'propose', text: draft }) ?? '/opsx:propose',
              mode: { requestedMode: mode, actualMode: mode, fallbackReason: null },
            }
          : {
              kind: 'agent-prompt',
              text: buildOpsxProposeComposePrompt(draft),
              format: 'markdown',
              mode: { requestedMode: mode, actualMode: mode, fallbackReason: null },
            },
    })
    const warning = workflowDiagnosticsToText(result)
    if (warning) setSendError(warning)
    return stringifyWorkflowInvocation(result)
  }

  const handleModeChange = (nextMode: OpsxAgentInvocationMode) => {
    setMode(nextMode)
    saveModeMutation.mutate(nextMode)
  }

  const handleSend = async () => {
    if (!target) {
      setSendError('No live terminal session is available.')
      return
    }
    setSendError(null)
    setIsSending(true)
    try {
      const createCommandId = parseCreateTarget(target)
      if (createCommandId) {
        const preparedPayload = await preparePayload()
        setSpawnPresetValues({ prompt: preparedPayload })
        setSpawnDialogOpen(true)
        return
      }
      const sessionId = parseTerminalTarget(target)
      if (!sessionId) throw new Error('Invalid terminal target.')
      const preparedPayload = await preparePayload()
      const wrote = terminalController.writeToSession(sessionId, `${preparedPayload}\n`)
      if (!wrote) {
        throw new Error('Terminal session is not ready. Wait a moment and retry.')
      }
      requestClose()
    } catch (error) {
      setSendError(error instanceof Error ? error.message : String(error))
    } finally {
      setIsSending(false)
    }
  }

  const handleCopy = async () => {
    setSendError(null)
    await navigator.clipboard.writeText(await preparePayload())
    setCopySuccess(true)
    window.setTimeout(() => setCopySuccess(false), 900)
  }

  const handleSave = async () => {
    setSendError(null)
    await terminalController.addInputHistory(await preparePayload())
    setSaveSuccess(true)
    window.setTimeout(() => setSaveSuccess(false), 900)
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="border-border flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="text-primary h-4 w-4" />
          <h2 className="font-nav text-base tracking-[0.04em]">Quick Propose</h2>
        </div>
        <button
          type="button"
          onClick={() => navController.activatePop('/opsx-new')}
          className="border-border hover:bg-muted inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs"
          title="Open advanced /opsx:new form"
        >
          Advanced
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 p-4">
        <p className="text-muted-foreground text-sm">
          Enter your idea, then send it to the selected terminal.
        </p>
        <ButtonGroup<OpsxAgentInvocationMode>
          value={mode}
          onChange={handleModeChange}
          options={OPSX_AGENT_INVOCATION_MODE_OPTIONS}
        />
        <CodeEditor
          value={draft}
          onChange={setDraft}
          filename="opsx-propose.md"
          placeholder="e.g. add workspace kanban support for active changes"
          editorMinHeight="180px"
        />
        <div className="bg-muted/30 border-border rounded-md border px-3 py-2 text-xs">
          <span className="text-muted-foreground mr-1">Invocation:</span>
          <code className="whitespace-pre-wrap break-words">{payload}</code>
        </div>
        {sendError && <div className="text-destructive text-xs">{sendError}</div>}
      </div>

      <div className="border-border flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleCopy()}
            className={`border-border inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs ${
              copySuccess ? 'text-emerald-600' : 'hover:bg-muted'
            }`}
          >
            <Copy className="h-3.5 w-3.5" />
            {copySuccess ? 'Copied' : 'Copy'}
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            className={`border-border inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs ${
              saveSuccess ? 'text-emerald-600' : 'hover:bg-muted'
            }`}
          >
            <Save className="h-3.5 w-3.5" />
            {saveSuccess ? 'Saved' : 'Save'}
          </button>
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex min-w-0 flex-1 flex-col gap-1 sm:w-56 sm:flex-none">
            <span className="text-xs font-medium">Target</span>
            <Select
              value={target ?? ''}
              groups={targetGroups}
              onValueChange={(nextTarget) => setTarget(nextTarget || null)}
              ariaLabel="Target"
              data-testid="opsx-propose-target-select"
              className="h-8 w-full py-1.5 text-xs"
            />
          </label>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={requestClose}
              className="border-border hover:bg-muted rounded-md border px-3 py-1.5 text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={isSending || target === null}
              className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {isSending ? 'Sending...' : parseCreateTarget(target ?? '') ? 'Create' : 'Send'}
            </button>
          </div>
        </div>
      </div>
      <TerminalSpawnCommandDialog
        open={spawnDialogOpen}
        command={selectedSpawnCommand}
        presetValues={spawnPresetValues}
        onClose={() => setSpawnDialogOpen(false)}
        onCreated={requestClose}
      />
    </div>
  )
}
