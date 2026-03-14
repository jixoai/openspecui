import type { ToolInitState } from '@openspecui/core'

export type InitToolsMode = 'auto' | 'selected' | 'all'
export type InitProfileOverride = 'default' | 'core' | 'custom'
export interface SettingsInitActionState {
  label: string
  disabled: boolean
  title?: string
  helperText: string
}

export function buildSettingsInitArgs(options: {
  mode: InitToolsMode
  selectedToolIds: readonly string[]
  cliSupportedToolIds: ReadonlySet<string>
  profileOverride: InitProfileOverride
  force: boolean
}): string[] {
  const args = ['init']

  if (options.mode === 'selected') {
    const selectedCliTools = options.selectedToolIds.filter((toolId) =>
      options.cliSupportedToolIds.has(toolId)
    )
    args.push('--tools', selectedCliTools.length > 0 ? selectedCliTools.join(',') : 'none')
  } else if (options.mode === 'all') {
    args.push('--tools', 'all')
  }

  if (options.profileOverride !== 'default') {
    args.push('--profile', options.profileOverride)
  }
  if (options.force) {
    args.push('--force')
  }

  return args
}

export function getToolInitStatus(
  toolStateById: ReadonlyMap<string, ToolInitState>,
  toolId: string
): ToolInitState['status'] {
  return toolStateById.get(toolId)?.status ?? 'uninitialized'
}

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

export function canAutoInit(detectedToolIds: readonly string[]): boolean {
  return detectedToolIds.length > 0
}

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
