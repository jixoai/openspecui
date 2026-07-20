/**
 * Orthogonal intents (updated 2026-07-20 Asia/Shanghai):
 * 1. Prepare and dispatch change-scoped OPSX workflow prompts or commands.
 * 2. Preserve invocation diagnostics and action identity in the compose dialog.
 * 3. Verify the Server-owned planning-root target before terminal dispatch.
 *
 * Original request (2026-07-15): "sync、update 的完整交付链。"
 */
import { CodeEditor } from '@/components/code-editor'
import { usePopAreaConfigContext, usePopAreaLifecycleContext } from '@/components/layout/pop-area'
import { WorkflowTargetNotice } from '@/components/opsx/workflow-target-notice'
import { RootActionNotice } from '@/components/root-action-notice'
import { TerminalDispatchActions } from '@/components/terminal/terminal-dispatch-actions'
import {
  resolveOpsxInvocationMode,
  type OpsxAgentInvocationMode,
} from '@/lib/opsx-agent-invocation'
import { buildOpsxComposeFallbackPrompt, parseOpsxComposeLocationSearch } from '@/lib/opsx-compose'
import {
  isWorkflowTargetCurrent,
  prepareWorkflowInvocation,
  stringifyWorkflowInvocation,
  workflowDiagnosticsToText,
} from '@/lib/opsx-workflow-invocation'
import { sanitizeTerminalDispatchPayload, toErrorMessage } from '@/lib/terminal-dispatch'
import { useRootActionState } from '@/lib/use-root-action-state'
import { useConfigSubscription } from '@/lib/use-subscription'
import type { WorkflowActionEvidenceV2, WorkflowInvocationTargetV2 } from '@openspecui/core'
import { OPSX_WORKFLOW_LABELS } from '@openspecui/core/opsx-workflows'
import { useLocation } from '@tanstack/react-router'
import { AlertCircle, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

export function OpsxComposeRoute() {
  const location = useLocation()
  const { setConfig } = usePopAreaConfigContext()
  const { requestClose } = usePopAreaLifecycleContext()
  const { data: uiConfig } = useConfigSubscription()
  const rootAction = useRootActionState()
  const rootActionRef = useRef(rootAction)
  rootActionRef.current = rootAction

  const composeInput = useMemo(
    () => parseOpsxComposeLocationSearch(location.search),
    [location.search]
  )

  const requestedInvocationMode: OpsxAgentInvocationMode =
    uiConfig?.opsx?.agentInvocationMode ?? 'compose'
  const invocationMode = useMemo(
    () =>
      composeInput ? resolveOpsxInvocationMode(composeInput.action, requestedInvocationMode) : null,
    [composeInput, requestedInvocationMode]
  )

  const [draft, setDraft] = useState('')
  const [isLoadingDraft, setIsLoadingDraft] = useState(false)
  const [draftError, setDraftError] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [workflowTarget, setWorkflowTarget] = useState<WorkflowInvocationTargetV2 | null>(null)
  const [workflowEvidence, setWorkflowEvidence] = useState<WorkflowActionEvidenceV2 | null>(null)
  const workflowTargetCurrent =
    !rootAction.context?.planningRoot ||
    (workflowTarget !== null && isWorkflowTargetCurrent(workflowTarget, rootAction))

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
      maxHeight: 'min(86dvh,920px)',
      onDismissRequest: null,
    })
  }, [setConfig])

  useEffect(() => {
    let canceled = false
    const loadPrompt = async () => {
      if (!composeInput) {
        setDraft('')
        setWorkflowTarget(null)
        setWorkflowEvidence(null)
        setDraftError('Invalid compose parameters.')
        setIsLoadingDraft(false)
        return
      }

      if (rootAction.disabled) {
        setDraft('')
        setWorkflowTarget(null)
        setWorkflowEvidence(null)
        setDraftError(null)
        setIsLoadingDraft(false)
        return
      }

      setSendError(null)
      setIsLoadingDraft(true)
      setDraftError(null)
      setWorkflowTarget(null)
      setWorkflowEvidence(null)

      try {
        const result = await prepareWorkflowInvocation({
          requestedMode: requestedInvocationMode,
          workflowInput:
            composeInput.action === 'continue' || composeInput.action === 'ff'
              ? {
                  action: composeInput.action,
                  changeId: composeInput.changeId,
                  artifactId: composeInput.artifactId ?? '',
                }
              : {
                  action: composeInput.action,
                  changeId: composeInput.changeId,
                },
          staticFallback: () => ({
            kind: 'agent-prompt',
            text: buildOpsxComposeFallbackPrompt(composeInput),
            format: 'markdown',
            mode: invocationMode ?? {
              requestedMode: requestedInvocationMode,
              actualMode: requestedInvocationMode,
              fallbackReason: null,
            },
            target: null,
            evidence: null,
          }),
        })
        if (canceled) return

        setWorkflowTarget(result.target)
        setWorkflowEvidence(result.evidence)
        const sanitized = sanitizeTerminalDispatchPayload(stringifyWorkflowInvocation(result))
        setDraft(sanitized.text)
        const diagnostics = workflowDiagnosticsToText(result)
        if (diagnostics) {
          setDraftError(diagnostics)
        } else if (sanitized.modified) {
          setDraftError('ANSI/control characters were stripped from generated prompt for safety.')
        }
      } catch (error) {
        if (canceled) return
        setWorkflowEvidence(null)
        setDraft(buildOpsxComposeFallbackPrompt(composeInput))
        setDraftError(toErrorMessage(error))
      } finally {
        if (!canceled) {
          setIsLoadingDraft(false)
        }
      }
    }

    void loadPrompt()

    return () => {
      canceled = true
    }
  }, [
    composeInput,
    invocationMode,
    requestedInvocationMode,
    rootAction.disabled,
    rootAction.observedAt,
  ])

  const actionLabel = composeInput ? OPSX_WORKFLOW_LABELS[composeInput.action] : 'Compose'

  const preparePayload = async () => {
    if (!workflowTarget) {
      if (rootActionRef.current.context?.planningRoot) {
        throw new Error('Workflow preparation has not completed. Wait and retry.')
      }
      return draft
    }
    if (!workflowTargetCurrent || !isWorkflowTargetCurrent(workflowTarget, rootActionRef.current)) {
      throw new Error('Planning root changed while preparing this workflow. Refresh and retry.')
    }
    return draft
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="border-border flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <h2 className="font-nav truncate text-base tracking-[0.04em]">{actionLabel} Prompt</h2>
          <p className="text-muted-foreground truncate text-xs">
            {composeInput ? `change: ${composeInput.changeId}` : 'missing change context'}
          </p>
        </div>
      </div>

      <div className="flex max-h-full min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden p-4">
        <RootActionNotice state={rootAction} />

        {invocationMode && (
          <div className="bg-muted/40 border-border rounded-md border p-2 text-xs">
            <span className="text-muted-foreground">Invocation:</span>{' '}
            <span className="font-medium capitalize">{invocationMode.actualMode}</span>
            {invocationMode.fallbackReason && (
              <span className="text-muted-foreground"> · {invocationMode.fallbackReason}</span>
            )}
          </div>
        )}

        <WorkflowTargetNotice target={workflowTarget} stale={!workflowTargetCurrent} />

        {workflowEvidence ? (
          <details className="border-border bg-muted/20 max-h-40 min-w-0 overflow-auto rounded-md border p-2 text-xs">
            <summary className="cursor-pointer font-medium">CLI evidence</summary>
            <pre className="text-muted-foreground mt-2 whitespace-pre-wrap break-all font-mono">
              {JSON.stringify(workflowEvidence, null, 2)}
            </pre>
          </details>
        ) : null}

        {isLoadingDraft && (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating prompt...
          </div>
        )}

        {draftError && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700">
            <div className="flex items-center gap-2 font-medium">
              <AlertCircle className="h-4 w-4" />
              Prompt source warning
            </div>
            <p className="mt-1 whitespace-pre-wrap break-words">{draftError}</p>
          </div>
        )}

        <label className="flex max-h-full min-h-0 min-w-0 flex-1 flex-col gap-1.5 overflow-hidden">
          <span className="text-sm font-medium">Prompt</span>
          <CodeEditor
            value={draft}
            onChange={setDraft}
            language="markdown"
            lineNumbers={false}
            lineWrapping
            className="scrollbar-thin scrollbar-track-transparent min-h-0 flex-1 overflow-auto border"
            editorMinHeight="0px"
            placeholder="Compose prompt..."
          />
        </label>
      </div>
      <div className="border-border mt-1 border-t p-4">
        <TerminalDispatchActions
          preparePayload={preparePayload}
          disabled={rootAction.disabled}
          actionsDisabled={isLoadingDraft || !workflowTargetCurrent}
          requiredCwdTarget={workflowTarget ? 'planning-root' : undefined}
          expectedRootGeneration={workflowTarget?.generation}
          disabledReason={
            rootAction.message ??
            (!workflowTargetCurrent
              ? 'Planning root changed. Prepare this workflow again.'
              : undefined)
          }
          onDispatched={requestClose}
          onError={setSendError}
        />
      </div>

      {sendError && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600">
          {sendError}
        </div>
      )}
    </div>
  )
}
