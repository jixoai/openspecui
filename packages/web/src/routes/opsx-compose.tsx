import { CodeEditor } from '@/components/code-editor'
import { usePopAreaConfigContext, usePopAreaLifecycleContext } from '@/components/layout/pop-area'
import { TerminalDispatchActions } from '@/components/terminal/terminal-dispatch-actions'
import {
  resolveOpsxInvocationMode,
  type OpsxAgentInvocationMode,
} from '@/lib/opsx-agent-invocation'
import { buildOpsxComposeFallbackPrompt, parseOpsxComposeLocationSearch } from '@/lib/opsx-compose'
import {
  prepareWorkflowInvocation,
  stringifyWorkflowInvocation,
  workflowDiagnosticsToText,
} from '@/lib/opsx-workflow-invocation'
import { sanitizeTerminalDispatchPayload, toErrorMessage } from '@/lib/terminal-dispatch'
import { useConfigSubscription } from '@/lib/use-subscription'
import { useLocation } from '@tanstack/react-router'
import { AlertCircle, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

const ACTION_LABELS = {
  continue: 'Continue',
  ff: 'Fast-forward',
  apply: 'Apply',
  archive: 'Archive',
} as const

export function OpsxComposeRoute() {
  const location = useLocation()
  const { setConfig } = usePopAreaConfigContext()
  const { requestClose } = usePopAreaLifecycleContext()
  const { data: uiConfig } = useConfigSubscription()

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
        setDraftError('Invalid compose parameters.')
        setIsLoadingDraft(false)
        return
      }

      setSendError(null)
      setIsLoadingDraft(true)
      setDraftError(null)

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
          }),
        })
        if (canceled) return

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
  }, [composeInput, invocationMode, requestedInvocationMode])

  const actionLabel = composeInput ? ACTION_LABELS[composeInput.action] : 'Compose'

  const preparePayload = async () => draft

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
        {invocationMode && (
          <div className="bg-muted/40 border-border rounded-md border p-2 text-xs">
            <span className="text-muted-foreground">Invocation:</span>{' '}
            <span className="font-medium capitalize">{invocationMode.actualMode}</span>
            {invocationMode.fallbackReason && (
              <span className="text-muted-foreground"> · {invocationMode.fallbackReason}</span>
            )}
          </div>
        )}

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
