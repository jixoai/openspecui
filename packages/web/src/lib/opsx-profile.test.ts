/**
 * Orthogonal intents (created 2026-07-15 Asia/Shanghai):
 * 1. Lock Web profile controls to the official OpenSpec 1.6 workflow sets.
 *
 * Original request (2026-07-15): "sync、update 的完整交付链。"
 */
import { describe, expect, it } from 'vitest'
import {
  isOpsxCoreWorkflowSelection,
  OPSX_ALL_WORKFLOWS,
  OPSX_CORE_PROFILE_WORKFLOWS,
  OPSX_WORKFLOW_LABELS,
} from './opsx-profile'

describe('OPSX Web profile contract', () => {
  it('matches the OpenSpec 1.6 core profile exactly', () => {
    expect(OPSX_CORE_PROFILE_WORKFLOWS).toEqual([
      'propose',
      'explore',
      'apply',
      'update',
      'sync',
      'archive',
    ])
    expect(isOpsxCoreWorkflowSelection(OPSX_CORE_PROFILE_WORKFLOWS)).toBe(true)
  })

  it('offers update and sync as labeled workflows without classifying partial sets as core', () => {
    expect(OPSX_ALL_WORKFLOWS).toContain('update')
    expect(OPSX_ALL_WORKFLOWS).toContain('sync')
    expect(OPSX_WORKFLOW_LABELS.update).toBe('Update change')
    expect(OPSX_WORKFLOW_LABELS.sync).toBe('Sync specs')
    expect(isOpsxCoreWorkflowSelection(['propose', 'explore', 'apply', 'archive'])).toBe(false)
  })
})
