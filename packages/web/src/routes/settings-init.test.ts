import type { ToolInitState } from '@openspecui/core'
import { describe, expect, it } from 'vitest'
import {
  buildSettingsInitArgs,
  canAutoInit,
  countSelectedToolActions,
  formatSelectedInitLabel,
  getSettingsInitActionState,
  getToolInitStatus,
} from './settings-init'

function createToolState(toolId: string, status: ToolInitState['status']): ToolInitState {
  return {
    toolId,
    toolName: toolId,
    status,
    hasAnyArtifacts: status !== 'uninitialized',
    expectedSkillCount: 0,
    presentExpectedSkillCount: 0,
    detectedSkillCount: 0,
    expectedCommandCount: 0,
    presentExpectedCommandCount: 0,
    detectedCommandCount: 0,
    missingSkillWorkflows: [],
    missingCommandWorkflows: [],
    unexpectedSkillWorkflows: [],
    unexpectedCommandWorkflows: [],
  }
}

describe('settings-init helpers', () => {
  it('builds selected init args with --force by default', () => {
    expect(
      buildSettingsInitArgs({
        mode: 'selected',
        selectedToolIds: ['claude'],
        cliSupportedToolIds: new Set(['claude', 'cursor']),
        profileOverride: 'default',
        force: true,
      })
    ).toEqual(['init', '--tools', 'claude', '--force'])
  })

  it('drops unsupported tool ids when building selected args', () => {
    expect(
      buildSettingsInitArgs({
        mode: 'selected',
        selectedToolIds: ['unsupported-tool'],
        cliSupportedToolIds: new Set(['claude', 'cursor']),
        profileOverride: 'core',
        force: true,
      })
    ).toEqual(['init', '--tools', 'none', '--profile', 'core', '--force'])
  })

  it('counts new and repair selections separately', () => {
    const stateById = new Map([
      ['claude', createToolState('claude', 'uninitialized')],
      ['cursor', createToolState('cursor', 'partial')],
      ['codex', createToolState('codex', 'initialized')],
    ])

    expect(countSelectedToolActions(stateById, ['claude', 'cursor', 'codex'])).toEqual({
      newCount: 1,
      repairCount: 1,
    })
  })

  it('formats mixed selected labels', () => {
    expect(formatSelectedInitLabel({ newCount: 2, repairCount: 1 })).toBe(
      'Initialize selected (2 new, 1 repair)'
    )
    expect(formatSelectedInitLabel({ newCount: 0, repairCount: 2 })).toBe(
      'Initialize selected (2 repair)'
    )
  })

  it('defaults missing tool state to uninitialized', () => {
    expect(getToolInitStatus(new Map(), 'claude')).toBe('uninitialized')
  })

  it('only enables auto init when detected project tools exist', () => {
    expect(canAutoInit([])).toBe(false)
    expect(canAutoInit(['claude'])).toBe(true)
  })

  it('derives a disabled auto action when no detected project tools exist', () => {
    expect(
      getSettingsInitActionState({
        mode: 'auto',
        selectedLabel: 'Initialize selected',
        autoInitDisabled: true,
        hasSelectedToolActions: false,
      })
    ).toEqual({
      label: 'Initialize (auto-detect)',
      disabled: true,
      title: 'No project tool directories detected yet. Use selected or all instead.',
      helperText:
        'Auto-detect only works when this project already contains tool directories such as .claude or .cursor. No project tool directories are currently detected.',
    })
  })

  it('derives selected mode action state from the current selection counts', () => {
    expect(
      getSettingsInitActionState({
        mode: 'selected',
        selectedLabel: 'Initialize selected (2 new, 1 repair)',
        autoInitDisabled: false,
        hasSelectedToolActions: true,
      })
    ).toEqual({
      label: 'Initialize selected (2 new, 1 repair)',
      disabled: false,
      helperText:
        'Selected mode only includes the tools marked above. Exact-match tools are not reselected because they already match the current OpenSpec profile state.',
    })
  })

  it('derives all-tools action state with a single primary button label', () => {
    expect(
      getSettingsInitActionState({
        mode: 'all',
        selectedLabel: 'Initialize selected',
        autoInitDisabled: false,
        hasSelectedToolActions: false,
      })
    ).toEqual({
      label: 'Initialize with all tools',
      disabled: false,
      helperText:
        'All mode initializes every OpenSpec-supported provider and repairs stale artifacts for the current profile when possible.',
    })
  })
})
