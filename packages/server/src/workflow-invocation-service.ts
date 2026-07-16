/**
 * Orthogonal intents (updated 2026-07-16 Asia/Shanghai):
 * 1. Resolve OPSX compose/command/direct invocation modes.
 * 2. Bind every invocation to the CLI-selected Root Context and Store selector.
 * 3. Preserve command-specific Status/Instructions evidence through hooks and clients.
 * 4. Generate Agent/CLI payloads without reconstructing planning paths.
 *
 * Original request (2026-07-15): "sync、update 的完整交付链。"
 */
import {
  getRootContextCliSelector,
  OPENSPECUI_WORKFLOW_HOOK_VERSION,
  OPSX_COMMAND_CAPABLE_WORKFLOWS,
  type CliRootSelector,
  type CliWorkflowOptions,
  type HookDiagnosticV1,
  type OpenSpecCliContractExecutor,
  type RootContext,
  type RunWorkflowInputV1,
  type RunWorkflowResultV2,
  type WorkflowActionEvidenceV2,
  type WorkflowInvocationModeResolutionV1,
  type WorkflowInvocationTargetV2,
  type WorkflowRequestedModeV1,
} from '@openspecui/core'
import type { HookRuntime } from './hook-runtime.js'

const COMMAND_CAPABLE_ACTIONS = new Set<RunWorkflowInputV1['action']>(
  OPSX_COMMAND_CAPABLE_WORKFLOWS
)

const COMMAND_FALLBACK_REASONS: Partial<Record<RunWorkflowInputV1['action'], string>> = {
  continue: 'Continue uses the selected artifact context, so compose mode is required.',
  ff: 'Fast-forward from a change page uses the selected ready artifact, so compose mode is required.',
}

function toErrorDiagnostic(error: unknown): HookDiagnosticV1 {
  return {
    level: 'error',
    message: error instanceof Error ? error.message : String(error),
  }
}

function withDiagnostics(
  result: RunWorkflowResultV2,
  diagnostics: HookDiagnosticV1[]
): RunWorkflowResultV2 {
  return {
    ...result,
    diagnostics: [...(result.diagnostics ?? []), ...diagnostics],
  }
}

function resolveInvocationMode(
  action: RunWorkflowInputV1['action'],
  requestedMode: WorkflowRequestedModeV1
): WorkflowInvocationModeResolutionV1 {
  if (requestedMode !== 'command' || COMMAND_CAPABLE_ACTIONS.has(action)) {
    return { requestedMode, actualMode: requestedMode, fallbackReason: null }
  }

  return {
    requestedMode,
    actualMode: 'compose',
    fallbackReason: COMMAND_FALLBACK_REASONS[action] ?? 'This action requires compose mode.',
  }
}

function targetContextLines(target: WorkflowInvocationTargetV2): string[] {
  return [
    'OpenSpec target:',
    `- launch project (command cwd only): ${target.launchProject.path}`,
    `- planning root (OpenSpec write root): ${target.planningRoot.path}`,
    `- root source: ${target.planningRoot.source}`,
    ...(target.storeId ? [`- Store: ${target.storeId}`] : []),
    ...(target.rootSelector.store !== undefined
      ? [`- CLI selector: --store ${target.rootSelector.store}`]
      : []),
    '',
    'Treat the planning root and CLI-resolved paths below as authoritative. Never reconstruct `<launch-project>/openspec`; keep any Store selector shown above on every supported follow-up command.',
  ]
}

function buildProposeComposePrompt(text: string, target: WorkflowInvocationTargetV2): string {
  const normalized = text.trim()
  if (normalized.length === 0) {
    return [
      'Propose a new OpenSpec change.',
      'Ask me what to build before creating files if the request is unclear.',
      '',
      ...targetContextLines(target),
    ].join('\n')
  }

  return [
    `Propose a new OpenSpec change for: ${normalized}`,
    '',
    ...targetContextLines(target),
    '',
    'Use the OpenSpec propose workflow. If an openspec-propose skill is available, follow it. Otherwise derive a kebab-case change name, run `openspec new change "<name>"`, inspect `openspec status --change "<name>" --json`, and create every apply-required artifact using `openspec instructions <artifact-id> --change "<name>" --json`.',
  ].join('\n')
}

function appendStoreFlag(text: string, selector: CliRootSelector): string {
  return selector.store !== undefined ? `${text} --store ${selector.store}` : text
}

function appendStoreArg(args: string[], selector: CliRootSelector): string[] {
  if (selector.store !== undefined) args.push('--store', selector.store)
  return args
}

function buildSlashCommand(
  input: RunWorkflowInputV1,
  target: WorkflowInvocationTargetV2
): string | null {
  switch (input.action) {
    case 'propose': {
      const normalized = input.text.trim()
      if (normalized.length === 0) return appendStoreFlag('/opsx:propose', target.rootSelector)
      if (normalized.startsWith('/opsx:')) return appendStoreFlag(normalized, target.rootSelector)
      return appendStoreFlag(`/opsx:propose ${normalized}`, target.rootSelector)
    }
    case 'apply':
    case 'update':
    case 'sync':
    case 'archive':
      return appendStoreFlag(`/opsx:${input.action} ${input.changeId.trim()}`, target.rootSelector)
    default:
      return null
  }
}

function evidenceDiagnostics(evidence: WorkflowActionEvidenceV2 | null): HookDiagnosticV1[] {
  if (!evidence) return []
  const result = evidence.result
  const diagnostics: HookDiagnosticV1[] = result.diagnostics.map((diagnostic) => ({
    level:
      diagnostic.severity === 'error'
        ? 'error'
        : diagnostic.severity === 'warning'
          ? 'warning'
          : 'info',
    message: diagnostic.message,
  }))
  if (result.contractError) {
    diagnostics.push({ level: 'error', message: result.contractError })
  }
  if (result.stderr.trim()) {
    diagnostics.push({ level: result.success ? 'warning' : 'error', message: result.stderr })
  }
  if (!result.success && diagnostics.length === 0) {
    diagnostics.push({
      level: 'error',
      message: `openspec command exited with code ${result.exitCode ?? 'null'}`,
    })
  }
  return diagnostics
}

function buildEvidencePrompt(evidence: WorkflowActionEvidenceV2, fallback: string): string {
  const stdout = evidence.result.stdout.trim()
  if (stdout.length === 0) return fallback
  return [fallback, '', `CLI-owned ${evidence.kind} evidence:`, '```json', stdout, '```'].join('\n')
}

function buildFallbackPrompt(
  input: RunWorkflowInputV1,
  target: WorkflowInvocationTargetV2
): string {
  const targetLines = ['', ...targetContextLines(target)]
  switch (input.action) {
    case 'continue':
      return [
        `Continue artifact ${input.artifactId} for change ${input.changeId}.`,
        ...targetLines,
      ].join('\n')
    case 'ff':
      return [
        `Fast-forward artifact ${input.artifactId} for change ${input.changeId}.`,
        ...targetLines,
      ].join('\n')
    case 'apply':
      return [
        `Apply change ${input.changeId} based on current completed artifacts.`,
        ...targetLines,
      ].join('\n')
    case 'update':
      return [
        `Update the existing planning artifacts for change ${input.changeId} without creating missing artifacts or editing implementation code.`,
        ...targetLines,
      ].join('\n')
    case 'archive':
      return [
        `Archive change ${input.changeId} after verifying completion and risks.`,
        ...targetLines,
      ].join('\n')
    case 'sync':
      return [`Sync specs for change ${input.changeId}.`, ...targetLines].join('\n')
    case 'verify':
      return [`Verify change ${input.changeId}.`, ...targetLines].join('\n')
    case 'bulk-archive':
      return [
        `Archive completed changes${input.changeIds?.length ? `: ${input.changeIds.join(', ')}` : ''}.`,
        ...targetLines,
      ].join('\n')
    case 'explore':
    case 'propose':
      return buildProposeComposePrompt(input.text, target)
    case 'new':
      return [`Create OpenSpec change ${input.changeId}.`, ...targetLines].join('\n')
    case 'onboard':
      return ['Start OpenSpec onboarding for this project.', ...targetLines].join('\n')
  }
}

function buildArchivePrompt(
  changeId: string,
  evidence: WorkflowActionEvidenceV2,
  target: WorkflowInvocationTargetV2
): string {
  const normalized = evidence.result.stdout.trim()
  return [
    `Archive planning for change "${changeId}".`,
    '',
    ...targetContextLines(target),
    '',
    'CLI-owned workflow-status evidence:',
    '```json',
    normalized.length > 0 ? normalized : '(no status output)',
    '```',
    '',
    'Please confirm archive readiness, highlight risks, and provide the exact next steps.',
  ].join('\n')
}

export interface WorkflowInvocationServiceOptions {
  getRootContext: () => RootContext
  hookRuntime: HookRuntime
  contracts: Pick<
    OpenSpecCliContractExecutor,
    'workflowStatus' | 'artifactInstructions' | 'applyInstructions'
  >
}

export class WorkflowInvocationService {
  constructor(private readonly options: WorkflowInvocationServiceOptions) {}

  async runWorkflow(
    input: RunWorkflowInputV1,
    requestedMode: WorkflowRequestedModeV1,
    signal: AbortSignal = new AbortController().signal
  ): Promise<RunWorkflowResultV2> {
    const target = this.createTarget(this.options.getRootContext())
    const mode = resolveInvocationMode(input.action, requestedMode)
    const evidence = await this.loadActionEvidence(input, target)
    const run = () => this.runDefault(input, mode, target, evidence)
    const hooks = await this.options.hookRuntime.load()

    if (!hooks.onRunWorkflow) {
      return run()
    }

    try {
      return await hooks.onRunWorkflow(
        {
          version: OPENSPECUI_WORKFLOW_HOOK_VERSION,
          target,
          action: input.action,
          requestedMode,
          input,
          signal,
          lifecycle: this.options.hookRuntime,
        },
        run
      )
    } catch (error) {
      return withDiagnostics(await run(), [toErrorDiagnostic(error)])
    }
  }

  private async runDefault(
    input: RunWorkflowInputV1,
    mode: WorkflowInvocationModeResolutionV1,
    target: WorkflowInvocationTargetV2,
    evidence: WorkflowActionEvidenceV2 | null
  ): Promise<RunWorkflowResultV2> {
    const base = {
      target,
      evidence,
      mode,
      diagnostics: evidenceDiagnostics(evidence),
    }
    if (mode.actualMode === 'command') {
      const text = buildSlashCommand(input, target)
      if (text) {
        return { kind: 'agent-command', text, ...base }
      }
    }

    if (input.action === 'new') {
      const args = ['new', 'change', input.changeId.trim()]
      const schema = input.schema?.trim()
      const description = input.description?.trim()
      if (schema) args.push('--schema', schema)
      if (description) args.push('--description', description)
      args.push(...input.extraArgs.map((arg) => arg.trim()).filter((arg) => arg.length > 0))
      appendStoreArg(args, target.rootSelector)
      return { kind: 'cli-command', command: 'openspec', args, ...base }
    }

    if (input.action === 'verify') {
      const args = ['validate', input.changeId, '--type', 'change']
      if (input.strict) args.push('--strict')
      appendStoreArg(args, target.rootSelector)
      return { kind: 'cli-command', command: 'openspec', args, ...base }
    }

    if (input.action === 'propose' || input.action === 'explore') {
      return {
        kind: 'agent-prompt',
        text: buildProposeComposePrompt(input.text, target),
        format: 'markdown',
        ...base,
      }
    }

    if ((input.action === 'continue' || input.action === 'ff') && !input.artifactId.trim()) {
      return {
        kind: 'agent-prompt',
        text: buildFallbackPrompt(input, target),
        format: 'markdown',
        ...base,
        diagnostics: [
          ...base.diagnostics,
          { level: 'warning', message: 'Artifact id is required for this action.' },
        ],
      }
    }

    if (evidence) {
      const text = buildEvidencePrompt(evidence, buildFallbackPrompt(input, target))
      return {
        kind: 'agent-prompt',
        text:
          input.action === 'archive' ? buildArchivePrompt(input.changeId, evidence, target) : text,
        format: 'markdown',
        ...base,
      }
    }

    return {
      kind: 'agent-prompt',
      text: buildFallbackPrompt(input, target),
      format: 'markdown',
      ...base,
    }
  }

  private createTarget(rootContext: RootContext): WorkflowInvocationTargetV2 {
    const planningRoot = rootContext.planningRoot
    if (!planningRoot) {
      throw new Error('Cannot prepare a workflow invocation without a resolved planning root.')
    }
    const rootSelector = getRootContextCliSelector(rootContext)
    return {
      launchProject: rootContext.launchProject,
      planningRoot,
      storeId: rootContext.storeId,
      rootSelector,
      references: rootContext.references,
      diagnostics: rootContext.diagnostics,
      rootEvidence: rootContext.evidence,
    }
  }

  private actionOptions(
    input: RunWorkflowInputV1,
    target: WorkflowInvocationTargetV2
  ): CliWorkflowOptions {
    return {
      ...target.rootSelector,
      ...('schema' in input && input.schema?.trim() ? { schema: input.schema.trim() } : {}),
    }
  }

  private async loadActionEvidence(
    input: RunWorkflowInputV1,
    target: WorkflowInvocationTargetV2
  ): Promise<WorkflowActionEvidenceV2 | null> {
    const options = this.actionOptions(input, target)
    switch (input.action) {
      case 'continue':
      case 'ff':
        if (!input.artifactId.trim()) return null
        return {
          kind: 'artifact-instructions',
          options,
          result: await this.options.contracts.artifactInstructions(
            input.changeId,
            input.artifactId,
            options
          ),
        }
      case 'apply':
        return {
          kind: 'apply-instructions',
          options,
          result: await this.options.contracts.applyInstructions(input.changeId, options),
        }
      case 'update':
      case 'verify':
      case 'sync':
      case 'archive':
        return {
          kind: 'workflow-status',
          options,
          result: await this.options.contracts.workflowStatus(input.changeId, options),
        }
      case 'explore':
      case 'propose':
      case 'new':
      case 'bulk-archive':
      case 'onboard':
        return null
    }
  }
}
