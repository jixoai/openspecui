import {
  OPENSPECUI_HOOKS_VERSION,
  type HookDiagnosticV1,
  type RunWorkflowInputV1,
  type RunWorkflowResultV1,
  type WorkflowInvocationModeResolutionV1,
  type WorkflowRequestedModeV1,
} from '@openspecui/core'
import type { HookRuntime } from './hook-runtime.js'

const COMMAND_CAPABLE_ACTIONS = new Set<RunWorkflowInputV1['action']>([
  'propose',
  'apply',
  'archive',
])

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
  result: RunWorkflowResultV1,
  diagnostics: HookDiagnosticV1[]
): RunWorkflowResultV1 {
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

function buildProposeComposePrompt(text: string): string {
  const normalized = text.trim()
  if (normalized.length === 0) {
    return [
      'Propose a new OpenSpec change.',
      'Ask me what to build before creating files if the request is unclear.',
    ].join('\n')
  }

  return [
    `Propose a new OpenSpec change for: ${normalized}`,
    '',
    'Use the OpenSpec propose workflow. If an openspec-propose skill is available, follow it. Otherwise derive a kebab-case change name, run `openspec new change "<name>"`, inspect `openspec status --change "<name>" --json`, and create every apply-required artifact using `openspec instructions <artifact-id> --change "<name>" --json`.',
  ].join('\n')
}

function buildSlashCommand(input: RunWorkflowInputV1): string | null {
  switch (input.action) {
    case 'propose': {
      const normalized = input.text.trim()
      if (normalized.length === 0) return '/opsx:propose'
      if (normalized.startsWith('/opsx:')) return normalized
      return `/opsx:propose ${normalized}`
    }
    case 'apply':
    case 'archive':
      return `/opsx:${input.action} ${input.changeId.trim()}`
    default:
      return null
  }
}

async function captureCliText(
  execute: (
    args: string[]
  ) => Promise<{ success: boolean; stdout: string; stderr: string; exitCode: number | null }>,
  args: string[],
  fallback: string
): Promise<{ text: string; diagnostics?: HookDiagnosticV1[] }> {
  const result = await execute(args)
  const text = result.stdout.trim().length > 0 ? result.stdout.trim() : fallback
  if (result.success) return { text }

  return {
    text,
    diagnostics: [
      {
        level: 'warning',
        message: result.stderr || `openspec command exited with code ${result.exitCode ?? 'null'}`,
      },
    ],
  }
}

function buildFallbackPrompt(input: RunWorkflowInputV1): string {
  switch (input.action) {
    case 'continue':
      return `Continue artifact ${input.artifactId} for change ${input.changeId}.`
    case 'ff':
      return `Fast-forward artifact ${input.artifactId} for change ${input.changeId}.`
    case 'apply':
      return `Apply change ${input.changeId} based on current completed artifacts.`
    case 'archive':
      return `Archive change ${input.changeId} after verifying completion and risks.`
    case 'sync':
      return `Sync specs for change ${input.changeId}.`
    case 'verify':
      return `Verify change ${input.changeId}.`
    case 'bulk-archive':
      return `Archive completed changes${input.changeIds?.length ? `: ${input.changeIds.join(', ')}` : ''}.`
    case 'explore':
    case 'propose':
      return buildProposeComposePrompt(input.text)
    case 'new':
      return `Create OpenSpec change ${input.changeId}.`
    case 'onboard':
      return 'Start OpenSpec onboarding for this project.'
  }
}

function buildArchivePrompt(changeId: string, statusText: string): string {
  const normalized = statusText.trim()
  return [
    `Archive planning for change "${changeId}".`,
    '',
    'Current openspec status:',
    '```text',
    normalized.length > 0 ? normalized : '(no status output)',
    '```',
    '',
    'Please confirm archive readiness, highlight risks, and provide the exact next steps.',
  ].join('\n')
}

export interface WorkflowInvocationServiceOptions {
  projectDir: string
  hookRuntime: HookRuntime
  executeCli?: (args: string[]) => Promise<{
    success: boolean
    stdout: string
    stderr: string
    exitCode: number | null
  }>
}

export class WorkflowInvocationService {
  constructor(private readonly options: WorkflowInvocationServiceOptions) {}

  async runWorkflow(
    input: RunWorkflowInputV1,
    requestedMode: WorkflowRequestedModeV1,
    signal: AbortSignal = new AbortController().signal
  ): Promise<RunWorkflowResultV1> {
    const mode = resolveInvocationMode(input.action, requestedMode)
    const run = () => this.runDefault(input, mode)
    const hooks = await this.options.hookRuntime.load()

    if (!hooks.onRunWorkflow) {
      return run()
    }

    try {
      return await hooks.onRunWorkflow(
        {
          version: OPENSPECUI_HOOKS_VERSION,
          projectDir: this.options.projectDir,
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
    mode: WorkflowInvocationModeResolutionV1
  ): Promise<RunWorkflowResultV1> {
    if (mode.actualMode === 'command') {
      const text = buildSlashCommand(input)
      if (text) {
        return { kind: 'agent-command', text, mode }
      }
    }

    if (input.action === 'new') {
      const args = ['new', 'change', input.changeId.trim()]
      const schema = input.schema?.trim()
      const description = input.description?.trim()
      if (schema) args.push('--schema', schema)
      if (description) args.push('--description', description)
      args.push(...input.extraArgs.map((arg) => arg.trim()).filter((arg) => arg.length > 0))
      return { kind: 'cli-command', command: 'openspec', args, mode }
    }

    if (input.action === 'verify') {
      const args = ['validate', input.changeId, '--type', 'change']
      if (input.strict) args.push('--strict')
      return { kind: 'cli-command', command: 'openspec', args, mode }
    }

    if (input.action === 'propose' || input.action === 'explore') {
      return {
        kind: 'agent-prompt',
        text: buildProposeComposePrompt(input.text),
        format: 'markdown',
        mode,
      }
    }

    const executeCli = this.options.executeCli
    if (
      executeCli &&
      (input.action === 'continue' ||
        input.action === 'ff' ||
        input.action === 'apply' ||
        input.action === 'archive')
    ) {
      if ((input.action === 'continue' || input.action === 'ff') && !input.artifactId.trim()) {
        return {
          kind: 'agent-prompt',
          text: buildFallbackPrompt(input),
          format: 'markdown',
          mode,
          diagnostics: [{ level: 'warning', message: 'Artifact id is required for this action.' }],
        }
      }

      const args =
        input.action === 'continue' || input.action === 'ff'
          ? ['instructions', input.artifactId, '--change', input.changeId]
          : input.action === 'apply'
            ? ['instructions', 'apply', '--change', input.changeId]
            : ['status', '--change', input.changeId]
      const captured = await captureCliText(executeCli, args, buildFallbackPrompt(input))
      return {
        kind: 'agent-prompt',
        text:
          input.action === 'archive'
            ? buildArchivePrompt(input.changeId, captured.text)
            : captured.text,
        format: 'markdown',
        mode,
        diagnostics: captured.diagnostics,
      }
    }

    return {
      kind: 'agent-prompt',
      text: buildFallbackPrompt(input),
      format: 'markdown',
      mode,
    }
  }
}
