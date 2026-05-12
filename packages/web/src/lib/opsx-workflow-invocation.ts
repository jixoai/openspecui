import type {
  RunWorkflowInputV1,
  RunWorkflowResultV1,
  WorkflowRequestedModeV1,
} from '@openspecui/core'
import { quoteShellToken } from './opsx-new-command'
import { isStaticMode } from './static-mode'
import { trpcClient } from './trpc'

export function stringifyWorkflowInvocation(result: RunWorkflowResultV1): string {
  switch (result.kind) {
    case 'agent-prompt':
    case 'agent-command':
      return result.text
    case 'cli-command':
      return [result.command, ...result.args].map(quoteShellToken).join(' ')
  }
}

export function workflowDiagnosticsToText(result: RunWorkflowResultV1): string | null {
  const diagnostics = result.diagnostics?.filter((item) => item.level !== 'info') ?? []
  if (diagnostics.length === 0) return null
  return diagnostics.map((item) => item.message).join('\n')
}

export async function prepareWorkflowInvocation(input: {
  requestedMode: WorkflowRequestedModeV1
  workflowInput: RunWorkflowInputV1
  staticFallback: () => RunWorkflowResultV1
}): Promise<RunWorkflowResultV1> {
  if (isStaticMode()) {
    return input.staticFallback()
  }

  return trpcClient.opsx.runWorkflow.mutate({
    requestedMode: input.requestedMode,
    input: input.workflowInput,
  })
}
