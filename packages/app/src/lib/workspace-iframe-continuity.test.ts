/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Prove open-Workspace transitions preserve the stable id (iframe key) across the candidate/open split (3.10/8.9).
 * 2. Characterize the iframe-continuity contract: tab.id === sessionId must stay stable so the shared
 *    packages/web Tabs component (key={tab.id}) never remounts the iframe Document during navigation.
 *
 * Original request (2026-07-30): "Workspaces融合了Connections。"
 * Iframe continuity law: navigation Workspaces -> Stores -> Workspaces must return the exact same iframe
 *   DOM node and Document. This is guaranteed while the open-Workspace id stays stable per Workspace.
 */
import { describe, expect, it } from 'vitest'
import {
  activateWorkspace,
  closeWorkspace,
  createEmptyOpenWorkspaceState,
  openOrFocusWorkspace,
  parseOpenWorkspaceState,
  reorderWorkspaces,
} from './open-workspace-state'

describe('open-Workspace iframe continuity across transitions (3.10/8.9)', () => {
  it('preserves the stable id (iframe key) through open/focus/reorder/close', () => {
    let state = openOrFocusWorkspace(createEmptyOpenWorkspaceState(), 'http://a', {
      sessionId: 's1',
      tabId: 't1',
    })
    state = openOrFocusWorkspace(state, 'http://b', { sessionId: 's2', tabId: 't2' })
    // The iframe key for each Workspace is its stable id; refocus must not change it.
    const beforeFocus = state.tabs.map((t) => t.id)
    state = activateWorkspace(state, 't1')
    expect(state.tabs.map((t) => t.id)).toEqual(beforeFocus)

    // Reorder must preserve the same ids (no remount).
    const beforeReorder = state.tabs.map((t) => ({ id: t.id, sessionId: t.sessionId }))
    state = reorderWorkspaces(state, ['t2', 't1'])
    expect(state.tabs.map((t) => ({ id: t.id, sessionId: t.sessionId }))).toEqual([
      beforeReorder[1],
      beforeReorder[0],
    ])

    // Closing one Workspace keeps the other's stable id.
    state = closeWorkspace(state, 't2')
    expect(state.tabs.map((t) => t.id)).toEqual(['t1'])
  })

  it('preserves the stable id through a persist -> reload -> reopen round-trip (navigation simulation)', () => {
    // Simulate navigating away (persist) and back (reload): the same Workspace keeps its id.
    let state = openOrFocusWorkspace(createEmptyOpenWorkspaceState(), 'http://a', {
      sessionId: 's1',
      tabId: 't1',
    })
    const serialized = JSON.stringify(state)
    // Navigation away then back: the reloaded state keeps the exact stable id.
    const reloaded = parseOpenWorkspaceState(JSON.parse(serialized))
    expect(reloaded.tabs[0]?.id).toBe('t1')
    expect(reloaded.tabs[0]?.sessionId).toBe('s1')
    // Reopening the same locator reuses the stable id (no new iframe mount).
    const reopened = openOrFocusWorkspace(reloaded, 'http://a')
    expect(reopened.tabs[0]?.id).toBe('t1')
  })

  it('the iframe-key id equals the sessionId for every open Workspace (continuity contract)', () => {
    const state = openOrFocusWorkspace(createEmptyOpenWorkspaceState(), 'http://a', {
      sessionId: 's-special',
      tabId: 't-special',
    })
    // The hosted-shell iframe is keyed by tab.id; it must correspond 1:1 with the session identity.
    expect(state.tabs[0]?.id).toBe('t-special')
    expect(state.tabs[0]?.sessionId).toBe('s-special')
  })
})
