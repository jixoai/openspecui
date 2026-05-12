export const OPENSPECUI_HOOKS_VERSION = 1

export type HookDiagnosticLevel = 'info' | 'warning' | 'error'

export interface HookDiagnosticV1 {
  level: HookDiagnosticLevel
  message: string
}

export interface HookLifecycleV1 {
  /**
   * Register cleanup work for the project hook runtime.
   *
   * This lifecycle is project-scoped, not call-scoped, so daemon-style hooks can
   * keep one process alive for the OpenSpecUI session.
   */
  onDispose(cleanup: () => void | Promise<void>): void
}

export type DocumentConsumerV1 = 'view' | 'search' | 'export'
export type DocumentReadModeV1 = 'source' | 'processed'

export interface DocumentRefV1 {
  stage: 'project' | 'main' | 'change' | 'archive'
  kind: 'project' | 'spec' | 'proposal' | 'design' | 'tasks' | 'delta-spec'
  relativePath: string
  absolutePath: string
  specId?: string
  changeId?: string
}

export interface ReadDocumentContextV1 {
  version: typeof OPENSPECUI_HOOKS_VERSION
  projectDir: string
  consumer: DocumentConsumerV1
  document: DocumentRefV1
  signal: AbortSignal
  lifecycle: HookLifecycleV1
}

export interface ReadDocumentResultV1 {
  markdown: string
  sourceLabel?: string
  title?: string
  diagnostics?: HookDiagnosticV1[]
  watchFiles?: string[]
}

export type OnReadDocumentHookV1 = (
  ctx: ReadDocumentContextV1,
  read: () => Promise<ReadDocumentResultV1>
) => Promise<ReadDocumentResultV1>

export type WorkflowActionV1 =
  | 'explore'
  | 'propose'
  | 'new'
  | 'continue'
  | 'ff'
  | 'apply'
  | 'verify'
  | 'sync'
  | 'archive'
  | 'bulk-archive'
  | 'onboard'

export type WorkflowRequestedModeV1 = 'compose' | 'command' | 'direct'

export type RunWorkflowInputV1 =
  | { action: 'explore' | 'propose'; text: string }
  | {
      action: 'new'
      changeId: string
      schema?: string
      description?: string
      extraArgs: string[]
    }
  | { action: 'continue' | 'ff'; changeId: string; artifactId: string; schema?: string }
  | {
      action: 'apply' | 'archive' | 'verify' | 'sync'
      changeId: string
      schema?: string
      strict?: boolean
    }
  | { action: 'bulk-archive'; changeIds?: string[]; schema?: string }
  | { action: 'onboard' }

export interface WorkflowInvocationModeResolutionV1 {
  requestedMode: WorkflowRequestedModeV1
  actualMode: WorkflowRequestedModeV1
  fallbackReason: string | null
}

export interface RunWorkflowContextV1 {
  version: typeof OPENSPECUI_HOOKS_VERSION
  projectDir: string
  action: WorkflowActionV1
  requestedMode: WorkflowRequestedModeV1
  input: RunWorkflowInputV1
  signal: AbortSignal
  lifecycle: HookLifecycleV1
}

export type RunWorkflowResultV1 =
  | {
      kind: 'agent-prompt'
      text: string
      format: 'markdown'
      mode?: WorkflowInvocationModeResolutionV1
      diagnostics?: HookDiagnosticV1[]
    }
  | {
      kind: 'agent-command'
      text: string
      mode?: WorkflowInvocationModeResolutionV1
      diagnostics?: HookDiagnosticV1[]
    }
  | {
      kind: 'cli-command'
      command: string
      args: string[]
      mode?: WorkflowInvocationModeResolutionV1
      diagnostics?: HookDiagnosticV1[]
    }

export type OnRunWorkflowHookV1 = (
  ctx: RunWorkflowContextV1,
  run: () => Promise<RunWorkflowResultV1>
) => Promise<RunWorkflowResultV1>

export interface OpenSpecUIHooksV1 {
  onReadDocument?: OnReadDocumentHookV1
  onRunWorkflow?: OnRunWorkflowHookV1
}
