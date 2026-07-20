/**
 * Orthogonal intents (created 2026-07-20 Asia/Shanghai):
 * 1. Prepare Server-owned OPSX workflow invocations and preserve typed evidence.
 * 2. Render diagnostics and invocation payloads without reconstructing CLI state.
 * 3. Guard prepared workflow targets against Root Context replacement before dispatch.
 *
 * Original request (2026-07-20): "New/Propose/Compose/Verify must use the returned target and stale guard."
 */
import type {
  RootContext,
  RunWorkflowInputV1,
  RunWorkflowResultV2,
  WorkflowInvocationTargetV2,
  WorkflowRequestedModeV1,
} from '@openspecui/core'
import { quoteShellToken } from './opsx-new-command'
import { isStaticMode } from './static-mode'
import { trpcClient } from './trpc'
import type { RootActionState } from './use-root-action-state'

export function stringifyWorkflowInvocation(result: RunWorkflowResultV2): string {
  switch (result.kind) {
    case 'agent-prompt':
    case 'agent-command':
      return result.text
    case 'cli-command':
      return [result.command, ...result.args].map(quoteShellToken).join(' ')
  }
}

export function workflowDiagnosticsToText(result: RunWorkflowResultV2): string | null {
  const diagnostics = result.diagnostics?.filter((item) => item.level !== 'info') ?? []
  if (diagnostics.length === 0) return null
  return diagnostics.map((item) => item.message).join('\n')
}

/** Compare one prepared target with the current ready Root Context owner. */
export function isWorkflowTargetCurrent(
  target: WorkflowInvocationTargetV2,
  rootAction: Pick<RootActionState, 'status' | 'context' | 'observedAt'>
): boolean {
  const context = rootAction.context
  const planningRoot = context?.planningRoot
  if (rootAction.status !== 'ready' || !context || !planningRoot) return false
  if (target.observedAt !== rootAction.observedAt || target.observedAt !== context.observedAt) {
    return false
  }
  if (context.generation !== undefined && target.generation !== context.generation) return false
  return (
    target.planningRoot.path === planningRoot.path &&
    target.planningRoot.source === planningRoot.source &&
    (target.planningRoot.store_id ?? null) === (planningRoot.store_id ?? null) &&
    target.storeId === context.storeId &&
    (target.rootSelector.store ?? null) ===
      (planningRoot.source === 'store' ? (context.storeId ?? null) : null)
  )
}

/** Return the target facts that are safe to show before an invocation dispatches. */
export function workflowTargetSummary(target: WorkflowInvocationTargetV2): {
  planningRoot: NonNullable<RootContext['planningRoot']>
  rootSource: string
  storeId: string | null
} {
  return {
    planningRoot: target.planningRoot,
    rootSource: target.planningRoot.source,
    storeId: target.storeId,
  }
}

export async function prepareWorkflowInvocation(input: {
  requestedMode: WorkflowRequestedModeV1
  workflowInput: RunWorkflowInputV1
  staticFallback: () => RunWorkflowResultV2
}): Promise<RunWorkflowResultV2> {
  if (isStaticMode()) {
    return input.staticFallback()
  }

  return trpcClient.opsx.runWorkflow.mutate({
    requestedMode: input.requestedMode,
    input: input.workflowInput,
  })
}
