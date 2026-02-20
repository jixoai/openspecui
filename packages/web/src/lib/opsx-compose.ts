export type OpsxComposeActionId = 'continue' | 'ff' | 'apply' | 'verify' | 'archive'

export interface OpsxComposeInput {
  action: OpsxComposeActionId
  changeId: string
  artifactId?: string
}

interface OpsxPromptSource {
  command: string
  args: string[]
}

const ACTION_QUERY_KEY = 'action'
const CHANGE_QUERY_KEY = 'change'
const ARTIFACT_QUERY_KEY = 'artifact'

const ACTION_SET = new Set<OpsxComposeActionId>(['continue', 'ff', 'apply', 'verify', 'archive'])

export function isOpsxComposeActionId(value: string): value is OpsxComposeActionId {
  return ACTION_SET.has(value as OpsxComposeActionId)
}

export function buildOpsxComposeHref(input: OpsxComposeInput): string {
  const params = new URLSearchParams()
  params.set(ACTION_QUERY_KEY, input.action)
  params.set(CHANGE_QUERY_KEY, input.changeId)
  if (input.artifactId) {
    params.set(ARTIFACT_QUERY_KEY, input.artifactId)
  }
  return `/opsx-compose?${params.toString()}`
}

export function parseOpsxComposeLocationSearch(search: string): OpsxComposeInput | null {
  const params = new URLSearchParams(search)
  const action = params.get(ACTION_QUERY_KEY)
  const changeId = params.get(CHANGE_QUERY_KEY)?.trim() ?? ''
  const artifactId = params.get(ARTIFACT_QUERY_KEY)?.trim() || undefined

  if (!action || !isOpsxComposeActionId(action) || changeId.length === 0) {
    return null
  }

  return {
    action,
    changeId,
    artifactId,
  }
}

export function resolveOpsxPromptSource(input: OpsxComposeInput): OpsxPromptSource | null {
  switch (input.action) {
    case 'continue':
    case 'ff': {
      if (!input.artifactId) return null
      return {
        command: 'openspec',
        args: ['instructions', input.artifactId, '--change', input.changeId],
      }
    }
    case 'apply':
      return {
        command: 'openspec',
        args: ['instructions', 'apply', '--change', input.changeId],
      }
    case 'verify':
      return {
        command: 'openspec',
        args: ['validate', '--type', 'change', '--strict', input.changeId],
      }
    case 'archive':
      return {
        command: 'openspec',
        args: ['status', '--change', input.changeId],
      }
    default:
      return null
  }
}

export function buildOpsxComposeFallbackPrompt(input: OpsxComposeInput): string {
  switch (input.action) {
    case 'continue':
      return `Continue artifact ${input.artifactId ?? '<missing-artifact>'} for change ${input.changeId}.`
    case 'ff':
      return `Fast-forward artifact ${input.artifactId ?? '<missing-artifact>'} for change ${input.changeId}.`
    case 'apply':
      return `Apply change ${input.changeId} based on current completed artifacts.`
    case 'verify':
      return `Verify change ${input.changeId} with strict validation and summarize blockers.`
    case 'archive':
      return `Archive change ${input.changeId} after verifying completion and risks.`
  }
}

export function buildOpsxComposeDraft(input: OpsxComposeInput, stdout: string): string {
  const normalized = stdout.trim()

  if (input.action !== 'archive') {
    return normalized.length > 0 ? normalized : buildOpsxComposeFallbackPrompt(input)
  }

  const statusText = normalized.length > 0 ? normalized : '(no status output)'
  return [
    `Archive planning for change "${input.changeId}".`,
    '',
    'Current openspec status:',
    '```text',
    statusText,
    '```',
    '',
    'Please confirm archive readiness, highlight risks, and provide the exact next steps.',
  ].join('\n')
}
