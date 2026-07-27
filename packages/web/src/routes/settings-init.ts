/**
 * Orthogonal intents (updated 2026-07-16 Asia/Shanghai):
 * 1. Normalize Settings initialization choices into typed Server input.
 * 2. Derive display argv from the same normalized initialization input.
 * 3. Project tool initialization state into concise Settings actions.
 *
 * Original request (2026-07-14): "openspec 1.6.0 已经放出，我们需要开始进行适配。"
 */
import type { ToolInitState } from '@openspecui/core'

/** Tool-selection mode exposed by the Settings initialization surface. */
export type InitToolsMode = 'auto' | 'selected' | 'all'
/** Optional workflow-profile override for initialization. */
export type InitProfileOverride = 'default' | 'core' | 'custom'
/** Derived label and availability for the current initialization choice. */
export interface SettingsInitActionState {
  label: string
  disabled: boolean
  title?: string
  helperText: string
}

/** Settings choices required to construct one typed Init request. */
export interface SettingsInitOptions {
  mode: InitToolsMode
  selectedToolIds: readonly string[]
  cliSupportedToolIds: ReadonlySet<string>
  profileOverride: InitProfileOverride
  force: boolean
}

/** Structured input accepted by the Server-owned Init transport. */
export interface SettingsInitInput {
  tools?: string[] | 'all' | 'none'
  profile?: 'core' | 'custom'
  force?: boolean
}

/** Normalize Settings choices without exposing raw CLI argv to the mutation owner. */
export function buildSettingsInitInput(options: SettingsInitOptions): SettingsInitInput {
  const input: SettingsInitInput = { force: options.force }

  if (options.mode === 'selected') {
    const selectedCliTools = options.selectedToolIds.filter((toolId) =>
      options.cliSupportedToolIds.has(toolId)
    )
    input.tools = selectedCliTools.length > 0 ? selectedCliTools : 'none'
  } else if (options.mode === 'all') {
    input.tools = 'all'
  }

  if (options.profileOverride !== 'default') {
    input.profile = options.profileOverride
  }

  return input
}

/** Derive display-only OpenSpec argv from the normalized typed Init request. */
export function buildSettingsInitArgs(options: SettingsInitOptions): string[] {
  const input = buildSettingsInitInput(options)
  const args = ['init']

  if (input.tools) {
    args.push('--tools', Array.isArray(input.tools) ? input.tools.join(',') : input.tools)
  }
  if (input.profile) {
    args.push('--profile', input.profile)
  }
  if (input.force) {
    args.push('--force')
  }

  return args
}

/** Return the effective initialization state for one tool. */
export function getToolInitStatus(
  toolStateById: ReadonlyMap<string, ToolInitState>,
  toolId: string
): ToolInitState['status'] {
  return toolStateById.get(toolId)?.status ?? 'uninitialized'
}

/** Count new and repair actions represented by the selected tools. */
export function countSelectedToolActions(
  toolStateById: ReadonlyMap<string, ToolInitState>,
  selectedToolIds: readonly string[]
): { newCount: number; repairCount: number } {
  let newCount = 0
  let repairCount = 0

  for (const toolId of selectedToolIds) {
    const status = getToolInitStatus(toolStateById, toolId)
    if (status === 'partial') {
      repairCount += 1
    } else if (status === 'uninitialized') {
      newCount += 1
    }
  }

  return { newCount, repairCount }
}

/** Format the selected-tools action label from its normalized counts. */
export function formatSelectedInitLabel(counts: { newCount: number; repairCount: number }): string {
  if (counts.newCount > 0 && counts.repairCount > 0) {
    return `Initialize selected (${counts.newCount} new, ${counts.repairCount} repair)`
  }
  if (counts.newCount > 0) {
    return `Initialize selected (${counts.newCount} new)`
  }
  if (counts.repairCount > 0) {
    return `Initialize selected (${counts.repairCount} repair)`
  }
  return 'Initialize selected'
}

/** Report whether automatic tool detection produced an actionable selection. */
export function canAutoInit(detectedToolIds: readonly string[]): boolean {
  return detectedToolIds.length > 0
}

/** Derive the primary initialization action for the current selection mode. */
export function getSettingsInitActionState(options: {
  mode: InitToolsMode
  selectedLabel: string
  autoInitDisabled: boolean
  hasSelectedToolActions: boolean
}): SettingsInitActionState {
  if (options.mode === 'auto') {
    if (options.autoInitDisabled) {
      return {
        label: 'Initialize (auto-detect)',
        disabled: true,
        title: 'No project tool directories detected yet. Use selected or all instead.',
        helperText:
          'Auto-detect only works when this project already contains tool directories such as .claude or .cursor. No project tool directories are currently detected.',
      }
    }
    return {
      label: 'Initialize (auto-detect)',
      disabled: false,
      helperText:
        'Auto-detect uses the tool directories already present in this project, such as .claude or .cursor.',
    }
  }

  if (options.mode === 'selected') {
    return {
      label: options.selectedLabel,
      disabled: !options.hasSelectedToolActions,
      title: options.hasSelectedToolActions
        ? undefined
        : 'Select at least one uninitialized or repairable tool first.',
      helperText:
        'Selected mode only includes the tools marked above. Exact-match tools are not reselected because they already match the current OpenSpec profile state.',
    }
  }

  return {
    label: 'Initialize with all tools',
    disabled: false,
    helperText:
      'All mode initializes every OpenSpec-supported provider and repairs stale artifacts for the current profile when possible.',
  }
}
