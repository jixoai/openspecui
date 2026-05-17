export const OPENSPECUI_HOOKS_VERSION = 1

/** Severity level for diagnostics returned by project hooks. */
export type HookDiagnosticLevel = 'info' | 'warning' | 'error'

/** Non-fatal hook diagnostic surfaced with the processed result. */
export interface HookDiagnosticV1 {
  level: HookDiagnosticLevel
  message: string
}

/** Project-scoped lifecycle helpers available to hooks. */
export interface HookLifecycleV1 {
  /**
   * Register cleanup work for the project hook runtime.
   *
   * This lifecycle is project-scoped, not call-scoped, so daemon-style hooks can
   * keep one process alive for the OpenSpecUI session.
   */
  onDispose(cleanup: () => void | Promise<void>): void
}

/** OpenSpecUI consumer requesting a processed document projection. */
export type DocumentConsumerV1 = 'view' | 'search' | 'export'

/** Document read mode; source reads bypass hooks and stay audit-safe. */
export type DocumentReadModeV1 = 'source' | 'processed'

/** Stable identity for the OpenSpec document currently being read. */
export interface DocumentRefV1 {
  stage: 'project' | 'main' | 'change' | 'archive'
  kind: 'project' | 'spec' | 'proposal' | 'design' | 'tasks' | 'delta-spec' | 'artifact'
  relativePath: string
  absolutePath: string
  specId?: string
  changeId?: string
  schemaName?: string
  artifactId?: string
  artifactOutputPath?: string
}

/** Context passed to `onReadDocument`. */
export interface ReadDocumentContextV1 {
  version: typeof OPENSPECUI_HOOKS_VERSION
  projectDir: string
  consumer: DocumentConsumerV1
  document: DocumentRefV1
  signal: AbortSignal
  lifecycle: HookLifecycleV1
}

/** Markdown projection returned by document reads and `onReadDocument`. */
export interface ReadDocumentResultV1 {
  markdown: string
  sourceLabel?: string
  title?: string
  diagnostics?: HookDiagnosticV1[]
  watchFiles?: string[]
}

/** Intercepts processed OpenSpec markdown reads for view, search, and export. */
export type OnReadDocumentHookV1 = (
  ctx: ReadDocumentContextV1,
  read: () => Promise<ReadDocumentResultV1>
) => Promise<ReadDocumentResultV1>

/** OPSX workflow action names that can be customized by `onRunWorkflow`. */
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

/** Invocation mode requested by the UI before action-specific fallback resolution. */
export type WorkflowRequestedModeV1 = 'compose' | 'command' | 'direct'

/** Normalized OPSX workflow input passed to `onRunWorkflow`. */
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

/** Actual invocation mode after OpenSpecUI applies action capability rules. */
export interface WorkflowInvocationModeResolutionV1 {
  requestedMode: WorkflowRequestedModeV1
  actualMode: WorkflowRequestedModeV1
  fallbackReason: string | null
}

/** Context passed to `onRunWorkflow`. */
export interface RunWorkflowContextV1 {
  version: typeof OPENSPECUI_HOOKS_VERSION
  projectDir: string
  action: WorkflowActionV1
  requestedMode: WorkflowRequestedModeV1
  input: RunWorkflowInputV1
  signal: AbortSignal
  lifecycle: HookLifecycleV1
}

/** Final OPSX invocation payload produced by OpenSpecUI or `onRunWorkflow`. */
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

/** Intercepts the final OPSX invocation payload before the UI runs it. */
export type OnRunWorkflowHookV1 = (
  ctx: RunWorkflowContextV1,
  run: () => Promise<RunWorkflowResultV1>
) => Promise<RunWorkflowResultV1>

/** Project hook module shape exported from `openspec/openspecui.hooks.ts`. */
export interface OpenSpecUIHooksV1 {
  onReadDocument?: OnReadDocumentHookV1
  onRunWorkflow?: OnRunWorkflowHookV1
}
