/**
 * Orthogonal intents (updated 2026-07-21 Asia/Shanghai):
 * 1. Prepare and dispatch change-scoped OPSX workflow prompts or commands.
 * 2. Preserve invocation diagnostics and action identity in the compose dialog.
 * 3. Verify the Server-owned planning-root target before terminal dispatch.
 * 4. Preserve explicit operator edits while re-preparing target evidence after Root replacement.
 * 5. Track dirty draft ownership by Root Context generation and require explicit recovery.
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
  assertComposeDraftDispatchable,
  captureComposeDraftOwnership,
  EMPTY_COMPOSE_DRAFT_OWNERSHIP,
  getComposeRootIdentity,
  requiresComposeDraftRecovery,
  type ComposeDraftOwnership,
} from '@/lib/opsx-compose-draft'
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

const COMPOSE_DRAFT_RECOVERY_REASON =
  'Confirm the edited prompt for the current root or regenerate it before dispatch.'

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
  const [latestGeneratedDraft, setLatestGeneratedDraft] = useState<string | null>(null)
  const [retryPreparationNonce, setRetryPreparationNonce] = useState(0)
  const [draftOwnership, setDraftOwnership] = useState<ComposeDraftOwnership>(
    EMPTY_COMPOSE_DRAFT_OWNERSHIP
  )
  const draftOwnershipRef = useRef(draftOwnership)
  draftOwnershipRef.current = draftOwnership
  const draftRequestKeyRef = useRef<string | null>(null)
  const planningRoot = rootAction.context?.planningRoot
  const rootIdentityKey = useMemo(
    () =>
      JSON.stringify([
        planningRoot?.path ?? null,
        planningRoot?.source ?? null,
        planningRoot?.store_id ?? null,
        rootAction.context?.storeId ?? null,
        rootAction.context?.generation ?? null,
      ]),
    [
      planningRoot?.path,
      planningRoot?.source,
      planningRoot?.store_id,
      rootAction.context?.generation,
      rootAction.context?.storeId,
    ]
  )
  const composeRequestKey = useMemo(
    () =>
      composeInput
        ? JSON.stringify([
            composeInput.action,
            composeInput.changeId,
            composeInput.artifactId ?? null,
            requestedInvocationMode,
            invocationMode?.actualMode ?? null,
          ])
        : null,
    [composeInput, invocationMode?.actualMode, requestedInvocationMode]
  )
  const currentRootIdentity = useMemo(
    () => getComposeRootIdentity(rootAction.context),
    [
      planningRoot?.path,
      planningRoot?.source,
      planningRoot?.store_id,
      rootAction.context?.generation,
      rootAction.context?.storeId,
    ]
  )
  const currentRootIdentityRef = useRef(currentRootIdentity)
  currentRootIdentityRef.current = currentRootIdentity
  const draftRequiresRecovery = requiresComposeDraftRecovery(draftOwnership, currentRootIdentity)
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
    if (draftRequestKeyRef.current !== composeRequestKey) {
      draftOwnershipRef.current = EMPTY_COMPOSE_DRAFT_OWNERSHIP
      setDraftOwnership(EMPTY_COMPOSE_DRAFT_OWNERSHIP)
    }
    draftRequestKeyRef.current = composeRequestKey

    const loadPrompt = async () => {
      if (!composeInput) {
        draftOwnershipRef.current = EMPTY_COMPOSE_DRAFT_OWNERSHIP
        setDraftOwnership(EMPTY_COMPOSE_DRAFT_OWNERSHIP)
        setDraft('')
        setWorkflowTarget(null)
        setWorkflowEvidence(null)
        setLatestGeneratedDraft(null)
        setDraftError('Invalid compose parameters.')
        setIsLoadingDraft(false)
        return
      }

      if (rootActionRef.current.disabled) {
        if (!draftOwnershipRef.current.dirty) {
          draftOwnershipRef.current = EMPTY_COMPOSE_DRAFT_OWNERSHIP
          setDraftOwnership(EMPTY_COMPOSE_DRAFT_OWNERSHIP)
          setDraft('')
        }
        setWorkflowTarget(null)
        setWorkflowEvidence(null)
        setLatestGeneratedDraft(null)
        setDraftError(null)
        setIsLoadingDraft(false)
        return
      }

      setSendError(null)
      setIsLoadingDraft(true)
      setDraftError(null)
      setWorkflowTarget(null)
      setWorkflowEvidence(null)
      setLatestGeneratedDraft(null)

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
        setLatestGeneratedDraft(sanitized.text)
        if (!draftOwnershipRef.current.dirty) {
          setDraft(sanitized.text)
        }
        const diagnostics = workflowDiagnosticsToText(result)
        if (diagnostics) {
          setDraftError(diagnostics)
        } else if (sanitized.modified) {
          setDraftError('ANSI/control characters were stripped from generated prompt for safety.')
        }
      } catch (error) {
        if (canceled) return
        setWorkflowEvidence(null)
        setLatestGeneratedDraft(null)
        if (!draftOwnershipRef.current.dirty) {
          setDraft(buildOpsxComposeFallbackPrompt(composeInput))
        }
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
    rootIdentityKey,
    composeRequestKey,
    retryPreparationNonce,
    rootAction.status,
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
    assertComposeDraftDispatchable(draftOwnershipRef.current, currentRootIdentityRef.current)
    return draft
  }

  const confirmRebindPrompt = () => {
    if (!workflowTarget || !workflowTargetCurrent || !currentRootIdentityRef.current) return
    const confirmedOwnership: ComposeDraftOwnership = {
      dirty: true,
      root: currentRootIdentityRef.current,
    }
    draftOwnershipRef.current = confirmedOwnership
    setDraftOwnership(confirmedOwnership)
    setDraftError(null)
  }

  const regenerateRebindPrompt = () => {
    if (!latestGeneratedDraft || !workflowTarget || !workflowTargetCurrent) return
    draftOwnershipRef.current = EMPTY_COMPOSE_DRAFT_OWNERSHIP
    setDraftOwnership(EMPTY_COMPOSE_DRAFT_OWNERSHIP)
    setDraft(latestGeneratedDraft)
    setDraftError(null)
  }

  const retryPreparation = () => {
    if (workflowTarget || !currentRootIdentityRef.current) return
    setDraftError(null)
    setLatestGeneratedDraft(null)
    setRetryPreparationNonce((value) => value + 1)
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

        {draftRequiresRecovery && (
          <div className="border-primary/40 bg-primary/5 rounded-md border p-3 text-sm">
            <p className="font-medium">Planning root changed</p>
            <p className="text-muted-foreground mt-1">
              {workflowTarget && workflowTargetCurrent
                ? 'Your edited prompt is preserved for inspection. Confirm it for the current planning root or regenerate it before dispatching.'
                : 'Your edited prompt is preserved, but preparation for the current planning root did not complete. Retry before confirming or regenerating it.'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={confirmRebindPrompt}
                disabled={!workflowTarget || !workflowTargetCurrent}
                className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
              >
                Use edited prompt for current root
              </button>
              <button
                type="button"
                onClick={regenerateRebindPrompt}
                disabled={
                  latestGeneratedDraft === null || !workflowTarget || !workflowTargetCurrent
                }
                className="border-border hover:bg-muted rounded-md border px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
              >
                Regenerate for current root
              </button>
              {!workflowTarget && (
                <button
                  type="button"
                  onClick={retryPreparation}
                  disabled={isLoadingDraft}
                  className="border-border hover:bg-muted rounded-md border px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Retry preparation
                </button>
              )}
            </div>
          </div>
        )}

        <label className="flex max-h-full min-h-0 min-w-0 flex-1 flex-col gap-1.5 overflow-hidden">
          <span className="text-sm font-medium">Prompt</span>
          <CodeEditor
            value={draft}
            onChange={(value) => {
              const nextOwnership = captureComposeDraftOwnership(
                draftOwnershipRef.current,
                currentRootIdentityRef.current
              )
              draftOwnershipRef.current = nextOwnership
              setDraftOwnership(nextOwnership)
              setDraft(value)
            }}
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
        <fieldset
          aria-label="Compose dispatch actions"
          disabled={draftRequiresRecovery}
          title={draftRequiresRecovery ? COMPOSE_DRAFT_RECOVERY_REASON : undefined}
          className="m-0 min-w-0 border-0 p-0"
        >
          <TerminalDispatchActions
            key={rootIdentityKey}
            preparePayload={preparePayload}
            disabled={rootAction.disabled}
            actionsDisabled={isLoadingDraft || !workflowTargetCurrent}
            requiredCwdTarget={workflowTarget ? 'planning-root' : undefined}
            expectedRootGeneration={workflowTarget?.generation}
            disabledReason={
              rootAction.message ??
              (!workflowTargetCurrent
                ? 'Planning root changed. Prepare this workflow again.'
                : draftRequiresRecovery
                  ? COMPOSE_DRAFT_RECOVERY_REASON
                  : undefined)
            }
            onDispatched={requestClose}
            onError={setSendError}
          />
        </fieldset>
      </div>

      {sendError && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600">
          {sendError}
        </div>
      )}
    </div>
  )
}
