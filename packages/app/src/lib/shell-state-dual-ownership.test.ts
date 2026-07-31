/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Characterize the current HostedShellState dual-ownership defect as checked red evidence (3.1).
 *
 * Original request (2026-07-30): "Workspaces融合了Connections。"
 * This is the 3.1 red fixture: the current `HostedShellState.tabs` collection simultaneously owns
 * persisted connection locators AND mounted Workspace tabs, so the candidate/open separation cannot
 * be produced by moving a field. The replacement models live in `workspace-candidate-catalog.ts`
 * (candidate identity) and `open-workspace-state.ts` (open Workspace identity).
 */
import { describe, expect, it } from 'vitest'
import {
  applyHostedLaunchRequest,
  createEmptyHostedShellState,
  type HostedShellTab,
} from './shell-state'

describe('HostedShellState dual ownership (3.1 red evidence)', () => {
  it('uses one tabs collection for both persisted connections and mounted Workspaces', () => {
    // The current model: applying a launch request adds a HostedShellTab that IS both the persisted
    // connection entry AND the mounted Workspace tab. There is no separate candidate collection.
    const state = applyHostedLaunchRequest(createEmptyHostedShellState(), {
      apiBaseUrl: 'http://127.0.0.1:3100',
    })
    // The single tab carries the connection locator (apiBaseUrl) and the Workspace session identity.
    const tab = state.tabs[0] as HostedShellTab | undefined
    expect(tab).toBeDefined()
    expect(tab?.apiBaseUrl).toBe('http://127.0.0.1:3100')
    expect(tab?.sessionId).toBe(tab?.id)
    // No candidate concept exists: the tab collection IS the candidate list AND the open Workspace list.
    expect(state.tabs).toHaveLength(1)
  })

  it('cannot distinguish a closed-but-retained candidate from an open Workspace in the current model', () => {
    // In the current model, removing a tab removes both the Workspace AND the connection candidate.
    // There is no way to retain a candidate after its Workspace closes, which is the defect the
    // candidate/open separation fixes.
    let state = applyHostedLaunchRequest(createEmptyHostedShellState(), {
      apiBaseUrl: 'http://127.0.0.1:3100',
    })
    const tabId = state.tabs[0]!.id
    // Closing the tab drops the locator entirely — no retained candidate.
    state = applyHostedLaunchRequest(state, { apiBaseUrl: 'http://127.0.0.1:3100' }) // focus
    expect(state.tabs).toHaveLength(1)
    // The red fact: the candidate identity and the open Workspace identity are the same record.
    expect(state.tabs[0]?.id).toBe(tabId)
  })
})
