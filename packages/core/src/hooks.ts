/**
 * Orthogonal intents (updated 2026-07-20 Asia/Shanghai):
 * 1. Define the stable project document-read hook contract.
 * 2. Define the root-explicit OPSX workflow invocation hook v2 contract.
 * 3. Version document and workflow hooks independently after the workflow breaking change.
 * 4. Carry observed root generation on every Server-owned workflow target.
 *
 * Original request (2026-07-15): "sync、update 的完整交付链。"
 */
import type {
  CliApplyInstructions,
  CliArtifactInstructions,
  CliCommandResult,
  CliRootSelector,
  CliWorkflowOptions,
  CliWorkflowStatus,
} from './cli-contracts/index.js'
import type {
  OpsxArtifactInputAction,
  OpsxChangeInputAction,
  OpsxTextInputAction,
  OpsxWorkflowId,
} from './opsx-workflows.js'
import type { RootContext } from './root-context.js'

export const OPENSPECUI_DOCUMENT_HOOK_VERSION = 1
export const OPENSPECUI_WORKFLOW_HOOK_VERSION = 2

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
  version: typeof OPENSPECUI_DOCUMENT_HOOK_VERSION
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
export type WorkflowActionV1 = OpsxWorkflowId

/** Invocation mode requested by the UI before action-specific fallback resolution. */
export type WorkflowRequestedModeV1 = 'compose' | 'command' | 'direct'

/** Normalized OPSX workflow input passed to `onRunWorkflow`. */
export type RunWorkflowInputV1 =
  | { action: OpsxTextInputAction; text: string }
  | {
      action: 'new'
      changeId: string
      schema?: string
      description?: string
      extraArgs: string[]
    }
  | { action: OpsxArtifactInputAction; changeId: string; artifactId: string; schema?: string }
  | {
      action: OpsxChangeInputAction
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

/** Root and CLI evidence that fixes one workflow invocation to one writable planning root. */
export interface WorkflowInvocationTargetV2 {
  launchProject: RootContext['launchProject']
  planningRoot: NonNullable<RootContext['planningRoot']>
  storeId: string | null
  /** Opaque Server-owned generation for the active planning-root service lease. */
  generation: string
  /** Root Context observation that created this target; used to reject stale dispatch. */
  observedAt: RootContext['observedAt']
  rootSelector: CliRootSelector
  references: RootContext['references']
  diagnostics: RootContext['diagnostics']
  rootEvidence: RootContext['evidence']
}

/** Command-specific OpenSpec evidence used to prepare one change action. */
export type WorkflowActionEvidenceV2 =
  | {
      kind: 'workflow-status'
      options: CliWorkflowOptions
      result: CliCommandResult<CliWorkflowStatus>
    }
  | {
      kind: 'artifact-instructions'
      options: CliWorkflowOptions
      result: CliCommandResult<CliArtifactInstructions>
    }
  | {
      kind: 'apply-instructions'
      options: CliWorkflowOptions
      result: CliCommandResult<CliApplyInstructions>
    }

/** Context passed to `onRunWorkflow`. */
export interface RunWorkflowContextV2 {
  version: typeof OPENSPECUI_WORKFLOW_HOOK_VERSION
  target: WorkflowInvocationTargetV2
  action: WorkflowActionV1
  requestedMode: WorkflowRequestedModeV1
  input: RunWorkflowInputV1
  signal: AbortSignal
  lifecycle: HookLifecycleV1
}

interface RunWorkflowResultBaseV2 {
  /** Null only for static-mode fallbacks that have no backend Root Context. */
  target: WorkflowInvocationTargetV2 | null
  evidence: WorkflowActionEvidenceV2 | null
  mode?: WorkflowInvocationModeResolutionV1
  diagnostics?: HookDiagnosticV1[]
}

/** Final OPSX invocation payload produced by OpenSpecUI or `onRunWorkflow`. */
export type RunWorkflowResultV2 = RunWorkflowResultBaseV2 &
  (
    | {
        kind: 'agent-prompt'
        text: string
        format: 'markdown'
      }
    | {
        kind: 'agent-command'
        text: string
      }
    | {
        kind: 'cli-command'
        command: string
        args: string[]
      }
  )

/** Intercepts the final OPSX invocation payload before the UI runs it. */
export type OnRunWorkflowHookV2 = (
  ctx: RunWorkflowContextV2,
  run: () => Promise<RunWorkflowResultV2>
) => Promise<RunWorkflowResultV2>

/** Project hook module shape exported from `openspec/openspecui.hooks.ts`. */
export interface OpenSpecUIHooks {
  onReadDocument?: OnReadDocumentHookV1
  onRunWorkflow?: OnRunWorkflowHookV2
}
