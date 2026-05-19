import { ButtonGroup } from '@/components/button-group'
import { CodeEditor } from '@/components/code-editor'
import { usePopAreaConfigContext, usePopAreaLifecycleContext } from '@/components/layout/pop-area'
import { TerminalDispatchActions } from '@/components/terminal/terminal-dispatch-actions'
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
import { trpcClient } from '@/lib/trpc'
import { useConfigSubscription } from '@/lib/use-subscription'
import { useMutation } from '@tanstack/react-query'
import { ArrowRight, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

export function OpsxProposeRoute() {
  const { setConfig } = usePopAreaConfigContext()
  const { requestClose } = usePopAreaLifecycleContext()
  const { data: uiConfig } = useConfigSubscription()
  const [draft, setDraft] = useState('')
  const [mode, setMode] = useState<OpsxAgentInvocationMode>('compose')
  const [sendError, setSendError] = useState<string | null>(null)

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
      onDismissRequest: null,
    })
  }, [setConfig])

  useEffect(() => {
    const nextMode = uiConfig?.opsx?.agentInvocationMode
    if (nextMode) {
      setMode(nextMode)
    }
  }, [uiConfig?.opsx?.agentInvocationMode])

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

      <div className="border-border flex flex-col gap-3 border-t px-4 py-3">
        <TerminalDispatchActions
          preparePayload={preparePayload}
          onDispatched={requestClose}
          onError={setSendError}
          size="sm"
          targetSelectTestId="opsx-propose-target-select"
        />
      </div>
    </div>
  )
}
