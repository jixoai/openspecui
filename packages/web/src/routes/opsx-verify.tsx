/**
 * Orthogonal intents (updated 2026-07-20 Asia/Shanghai):
 * 1. Prepare and stream strict OpenSpec change validation.
 * 2. Preserve command diagnostics and explicit rerun lifecycle.
 * 3. Lock preparation, options, and rerun until Root Context is ready.
 * 4. Queue direct validation through one typed transport without duplicate argv evidence.
 * 5. Preserve and verify the Server-owned planning-root target before the runner starts.
 *
 * Original request (2026-07-15): "Root-dependent actions remain locked until root selection succeeds."
 * Original request (2026-07-17): "CliStreamTransport is the single execution and display truth."
 * Original request (2026-07-28): supporting workflow evidence should remain available on demand.
 */
import { CliTerminal } from '@/components/cli-terminal'
import { usePopAreaConfigContext, usePopAreaLifecycleContext } from '@/components/layout/pop-area'
import { WorkflowEvidenceDisclosure } from '@/components/opsx/workflow-evidence-disclosure'
import { WorkflowTargetNotice } from '@/components/opsx/workflow-target-notice'
import { RootActionNotice } from '@/components/root-action-notice'
import { Switch } from '@/components/switch'
import {
  isWorkflowTargetCurrent,
  prepareWorkflowInvocation,
  workflowDiagnosticsToText,
} from '@/lib/opsx-workflow-invocation'
import { useCliRunner } from '@/lib/use-cli-runner'
import { useRootActionState } from '@/lib/use-root-action-state'
import type { WorkflowActionEvidenceV2, WorkflowInvocationTargetV2 } from '@openspecui/core'
import { useLocation } from '@tanstack/react-router'
import { CheckCircle, Loader2, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

/** Render the root-aware OPSX verification workflow route. */
export function OpsxVerifyRoute() {
  const location = useLocation()
  const { setConfig } = usePopAreaConfigContext()
  const { requestClose } = usePopAreaLifecycleContext()
  const runner = useCliRunner()
  const rootAction = useRootActionState()
  const rootActionRef = useRef(rootAction)
  rootActionRef.current = rootAction
  const { lines, status, commands, hasStarted, reset, cancel } = runner
  const [strict, setStrict] = useState(true)
  const [commandError, setCommandError] = useState<string | null>(null)
  const [workflowTarget, setWorkflowTarget] = useState<WorkflowInvocationTargetV2 | null>(null)
  const [workflowEvidence, setWorkflowEvidence] = useState<WorkflowActionEvidenceV2 | null>(null)
  const workflowTargetCurrent =
    !rootAction.context?.planningRoot ||
    (workflowTarget !== null && isWorkflowTargetCurrent(workflowTarget, rootAction))

  const changeId = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return params.get('change')?.trim() ?? ''
  }, [location.search])

  useEffect(() => {
    setConfig({
      layout: {
        alignY: 'start',
        width: 'normal',
        topGap: 'comfortable',
      },
      panelClassName: 'w-full',
      bodyClassName: 'p-0',
      maxHeight: 'min(82dvh,760px)',
      onDismissRequest: null,
    })
  }, [setConfig])

  useEffect(() => {
    if (!changeId || hasStarted || rootAction.disabled) return
    const prepareAndRun = async () => {
      setCommandError(null)
      setWorkflowTarget(null)
      setWorkflowEvidence(null)
      try {
        const fallbackArgs = ['validate', changeId, '--type', 'change']
        if (strict) fallbackArgs.push('--strict')
        const result = await prepareWorkflowInvocation({
          requestedMode: 'direct',
          workflowInput: { action: 'verify', changeId, strict },
          staticFallback: () => ({
            kind: 'cli-command',
            command: 'openspec',
            args: fallbackArgs,
            mode: { requestedMode: 'direct', actualMode: 'direct', fallbackReason: null },
            target: null,
            evidence: null,
          }),
        })
        if (result.kind !== 'cli-command') {
          throw new Error('Verify workflow must return a CLI command.')
        }
        setWorkflowTarget(result.target)
        setWorkflowEvidence(result.evidence)
        if (result.target && !isWorkflowTargetCurrent(result.target, rootActionRef.current)) {
          setWorkflowTarget(null)
          throw new Error('Planning root changed while preparing this workflow. Refresh and retry.')
        }
        const diagnostics = workflowDiagnosticsToText(result)
        if (diagnostics) setCommandError(diagnostics)
        commands.replaceAll([
          {
            type: 'validate',
            input: {
              id: changeId,
              type: 'change',
              strict,
              ...(result.target?.generation
                ? { expectedRootGeneration: result.target.generation }
                : {}),
            },
            displayArgs: result.args,
          },
        ])
        if (result.target && !isWorkflowTargetCurrent(result.target, rootActionRef.current)) {
          setWorkflowTarget(null)
          throw new Error('Planning root changed before validation started. Refresh and retry.')
        }
        void commands.runAll()
      } catch (error) {
        setCommandError(error instanceof Error ? error.message : String(error))
      }
    }
    void prepareAndRun()
  }, [changeId, commands, hasStarted, rootAction.disabled, rootAction.observedAt, strict])

  const rerun = () => {
    if (!changeId || rootAction.disabled) return
    reset()
  }

  const handleClose = () => {
    cancel()
    reset()
    requestClose()
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="border-border flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-primary h-4 w-4" />
          <h2 className="font-nav text-base tracking-[0.04em]">Verify Change</h2>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <Switch
            checked={strict}
            onCheckedChange={setStrict}
            ariaLabel="Strict"
            disabled={rootAction.disabled || status === 'running'}
          />
          Strict
        </label>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 p-4">
        <RootActionNotice state={rootAction} />
        <WorkflowTargetNotice target={workflowTarget} stale={!workflowTargetCurrent} />
        <WorkflowEvidenceDisclosure evidence={workflowEvidence} />

        {changeId ? (
          <p className="text-muted-foreground text-sm">
            Running validation for <code className="bg-muted rounded px-1">{changeId}</code>.
          </p>
        ) : (
          <p className="text-destructive text-sm">
            Missing change id. Open Verify from a change page.
          </p>
        )}
        {commandError && <p className="text-destructive text-sm">{commandError}</p>}
        <CliTerminal lines={lines} maxHeight="56vh" />
      </div>

      <div className="border-border flex items-center justify-between gap-2 border-t px-4 py-3">
        <div className="text-xs">
          {status === 'success' ? (
            <span className="inline-flex items-center gap-1 text-emerald-600">
              <CheckCircle className="h-3.5 w-3.5" />
              Verification completed
            </span>
          ) : status === 'running' ? (
            <span className="text-muted-foreground inline-flex items-center gap-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Running...
            </span>
          ) : (
            <span className="text-muted-foreground">Ready</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="border-border hover:bg-muted rounded-md border px-3 py-1.5 text-xs"
          >
            Close
          </button>
          <button
            type="button"
            onClick={rerun}
            disabled={
              !changeId || rootAction.disabled || !workflowTargetCurrent || status === 'running'
            }
            className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs disabled:opacity-50"
          >
            Re-run
          </button>
        </div>
      </div>
    </div>
  )
}
