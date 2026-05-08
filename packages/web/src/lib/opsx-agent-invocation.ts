import type { OpsxAgentInvocationMode } from '@openspecui/core'

export type { OpsxAgentInvocationMode } from '@openspecui/core'

export type OpsxAgentActionId = 'propose' | 'continue' | 'ff' | 'apply' | 'archive'

export interface OpsxInvocationModeResolution {
  requestedMode: OpsxAgentInvocationMode
  actualMode: OpsxAgentInvocationMode
  fallbackReason: string | null
}

export interface OpsxSlashCommandInput {
  action: OpsxAgentActionId
  changeId?: string
  text?: string
}

export const OPSX_AGENT_INVOCATION_MODE_OPTIONS = [
  { value: 'compose', label: 'Compose' },
  { value: 'command', label: 'Command' },
] as const satisfies readonly { value: OpsxAgentInvocationMode; label: string }[]

const COMMAND_CAPABLE_ACTIONS = new Set<OpsxAgentActionId>(['propose', 'apply', 'archive'])

const COMMAND_FALLBACK_REASONS: Partial<Record<OpsxAgentActionId, string>> = {
  continue: 'Continue uses the selected artifact context, so compose mode is required.',
  ff: 'Fast-forward from a change page uses the selected ready artifact, so compose mode is required.',
}

export function isOpsxAgentInvocationMode(value: string): value is OpsxAgentInvocationMode {
  return value === 'compose' || value === 'command'
}

export function resolveOpsxInvocationMode(
  action: OpsxAgentActionId,
  requestedMode: OpsxAgentInvocationMode
): OpsxInvocationModeResolution {
  if (requestedMode === 'compose' || COMMAND_CAPABLE_ACTIONS.has(action)) {
    return { requestedMode, actualMode: requestedMode, fallbackReason: null }
  }

  return {
    requestedMode,
    actualMode: 'compose',
    fallbackReason: COMMAND_FALLBACK_REASONS[action] ?? 'This action requires compose mode.',
  }
}

export function buildOpsxProposeComposePrompt(text: string): string {
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

export function buildOpsxSlashCommand(input: OpsxSlashCommandInput): string | null {
  switch (input.action) {
    case 'propose': {
      const normalized = input.text?.trim() ?? ''
      if (normalized.length === 0) return '/opsx:propose'
      if (normalized.startsWith('/opsx:')) return normalized
      return `/opsx:propose ${normalized}`
    }
    case 'apply':
    case 'archive': {
      const changeId = input.changeId?.trim()
      if (!changeId) return null
      return `/opsx:${input.action} ${changeId}`
    }
    case 'continue':
    case 'ff':
      return null
  }
}
