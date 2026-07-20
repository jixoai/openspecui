/**
 * Orthogonal intents (updated 2026-07-20 Asia/Shanghai):
 * 1. Compose or generate the Quick Propose invocation payload.
 * 2. Persist invocation mode and dispatch to an existing or new terminal.
 * 3. Lock payload preparation and dispatch until Root Context is ready.
 * 4. Preserve and verify the Server-owned planning-root target before dispatch.
 *
 * Original request (2026-07-15): "Root-dependent actions remain locked until root selection succeeds."
 */
import { ButtonGroup } from '@/components/button-group'
import { CodeEditor } from '@/components/code-editor'
import { usePopAreaConfigContext, usePopAreaLifecycleContext } from '@/components/layout/pop-area'
import { WorkflowTargetNotice } from '@/components/opsx/workflow-target-notice'
import { RootActionNotice } from '@/components/root-action-notice'
import { TerminalDispatchActions } from '@/components/terminal/terminal-dispatch-actions'
import { navController } from '@/lib/nav-controller'
import {
  OPSX_AGENT_INVOCATION_MODE_OPTIONS,
  buildOpsxProposeComposePrompt,
  buildOpsxSlashCommand,
  type OpsxAgentInvocationMode,
} from '@/lib/opsx-agent-invocation'
import {
  isWorkflowTargetCurrent,
  prepareWorkflowInvocation,
  stringifyWorkflowInvocation,
  workflowDiagnosticsToText,
} from '@/lib/opsx-workflow-invocation'
import { trpcClient } from '@/lib/trpc'
import { useRootActionState } from '@/lib/use-root-action-state'
import { useConfigSubscription } from '@/lib/use-subscription'
import type { WorkflowActionEvidenceV2, WorkflowInvocationTargetV2 } from '@openspecui/core'
import { useMutation } from '@tanstack/react-query'
import { ArrowRight, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export function OpsxProposeRoute() {
  const { setConfig } = usePopAreaConfigContext()
  const { requestClose } = usePopAreaLifecycleContext()
  const { data: uiConfig } = useConfigSubscription()
  const rootAction = useRootActionState()
  const rootActionRef = useRef(rootAction)
  rootActionRef.current = rootAction
  const [draft, setDraft] = useState('')
  const [mode, setMode] = useState<OpsxAgentInvocationMode>('compose')
  const [sendError, setSendError] = useState<string | null>(null)
  const [workflowTarget, setWorkflowTarget] = useState<WorkflowInvocationTargetV2 | null>(null)
  const [workflowEvidence, setWorkflowEvidence] = useState<WorkflowActionEvidenceV2 | null>(null)
  const [preparedPayload, setPreparedPayload] = useState<string | null>(null)
  const [isPreparing, setIsPreparing] = useState(false)

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

  const workflowTargetCurrent =
    !rootAction.context?.planningRoot ||
    (workflowTarget !== null && isWorkflowTargetCurrent(workflowTarget, rootAction))

  useEffect(() => {
    setPreparedPayload(null)
    setWorkflowEvidence(null)
  }, [draft, mode])

  const prepareInvocation = async () => {
    const currentRootAction = rootActionRef.current
    if (currentRootAction.disabled) {
      throw new Error(currentRootAction.message)
    }
    setWorkflowTarget(null)
    setWorkflowEvidence(null)
    setPreparedPayload(null)
    setSendError(null)
    setIsPreparing(true)
    try {
      const result = await prepareWorkflowInvocation({
        requestedMode: mode,
        workflowInput: { action: 'propose', text: draft },
        staticFallback: () =>
          mode === 'command'
            ? {
                kind: 'agent-command',
                text: buildOpsxSlashCommand({ action: 'propose', text: draft }) ?? '/opsx:propose',
                mode: { requestedMode: mode, actualMode: mode, fallbackReason: null },
                target: null,
                evidence: null,
              }
            : {
                kind: 'agent-prompt',
                text: buildOpsxProposeComposePrompt(draft),
                format: 'markdown',
                mode: { requestedMode: mode, actualMode: mode, fallbackReason: null },
                target: null,
                evidence: null,
              },
      })
      setWorkflowTarget(result.target)
      setWorkflowEvidence(result.evidence)
      if (result.target && !isWorkflowTargetCurrent(result.target, rootActionRef.current)) {
        setWorkflowTarget(null)
        throw new Error('Planning root changed while preparing this workflow. Refresh and retry.')
      }
      const warning = workflowDiagnosticsToText(result)
      if (warning) setSendError(warning)
      setPreparedPayload(stringifyWorkflowInvocation(result))
    } finally {
      setIsPreparing(false)
    }
  }

  const preparePayload = async () => {
    if (!preparedPayload) throw new Error('Prepare this workflow before dispatching it.')
    if (workflowTarget && !isWorkflowTargetCurrent(workflowTarget, rootActionRef.current)) {
      throw new Error('Planning root changed before dispatch. Prepare this workflow again.')
    }
    return preparedPayload
  }

  const handleModeChange = (nextMode: OpsxAgentInvocationMode) => {
    setMode(nextMode)
    setPreparedPayload(null)
    setWorkflowTarget(null)
    setWorkflowEvidence(null)
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
        <RootActionNotice state={rootAction} />
        <WorkflowTargetNotice target={workflowTarget} stale={!workflowTargetCurrent} />
        {workflowEvidence ? (
          <details className="border-border bg-muted/20 max-h-40 overflow-auto rounded-md border p-2 text-xs">
            <summary className="cursor-pointer font-medium">CLI evidence</summary>
            <pre className="text-muted-foreground mt-2 whitespace-pre-wrap break-all font-mono">
              {JSON.stringify(workflowEvidence, null, 2)}
            </pre>
          </details>
        ) : null}

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
          onChange={(value) => {
            setDraft(value)
            setPreparedPayload(null)
            setWorkflowTarget(null)
            setWorkflowEvidence(null)
          }}
          filename="opsx-propose.md"
          placeholder="e.g. add workspace kanban support for active changes"
          editorMinHeight="180px"
        />
        <button
          type="button"
          onClick={() =>
            void prepareInvocation().catch((error: unknown) =>
              setSendError(error instanceof Error ? error.message : String(error))
            )
          }
          disabled={rootAction.disabled || isPreparing}
          className="bg-primary text-primary-foreground inline-flex h-9 items-center justify-center rounded-md px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPreparing ? 'Preparing...' : 'Prepare'}
        </button>
        <div className="bg-muted/30 border-border rounded-md border px-3 py-2 text-xs">
          <span className="text-muted-foreground mr-1">Invocation:</span>
          <code className="whitespace-pre-wrap break-words">
            {preparedPayload ?? 'Prepare to load the Server-owned invocation.'}
          </code>
        </div>
        {sendError && <div className="text-destructive text-xs">{sendError}</div>}
      </div>

      <div className="border-border flex flex-col gap-3 border-t px-4 py-3">
        <TerminalDispatchActions
          preparePayload={preparePayload}
          disabled={rootAction.disabled}
          actionsDisabled={preparedPayload === null || !workflowTargetCurrent}
          requiredCwdTarget={workflowTarget ? 'planning-root' : undefined}
          expectedRootGeneration={workflowTarget?.generation}
          disabledReason={
            rootAction.message ??
            (preparedPayload === null ? 'Prepare this workflow before dispatching it.' : undefined)
          }
          onDispatched={requestClose}
          onError={setSendError}
          size="sm"
          targetSelectTestId="opsx-propose-target-select"
        />
      </div>
    </div>
  )
}
