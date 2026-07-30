/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Prove open-Workspace tab/session/frame identity is separate from candidate locator identity (3.4).
 * 2. Prove the pure open/focus/close/reorder transitions preserve stable ids so iframes never remount (3.6).
 * 3. Prove malformed persisted open-Workspace state is rejected as empty (3.5, no migration glue).
 *
 * Original request (2026-07-30): "Workspaces融合了Connections。"
 */
import { describe, expect, it } from 'vitest'
import {
  activateWorkspace,
  areOpenWorkspaceStatesEqual,
  closeWorkspace,
  createEmptyOpenWorkspaceState,
  hasOpenWorkspace,
  openOrFocusWorkspace,
  parseOpenWorkspaceState,
  reorderWorkspaces,
} from './open-workspace-state'

describe('open Workspace state identity (3.4/3.6)', () => {
  it('opens one Workspace per locator with a stable id/session reused on refocus', () => {
    const first = openOrFocusWorkspace(createEmptyOpenWorkspaceState(), 'http://127.0.0.1:3100', {
      now: 1,
      sessionId: 'sess-a',
      tabId: 'tab-a',
    })
    expect(first.tabs).toHaveLength(1)
    expect(first.activeTabId).toBe('tab-a')

    // Refocusing the same locator reuses the existing stable id/session (no new tab, no remount).
    const refocused = openOrFocusWorkspace(first, 'http://127.0.0.1:3100')
    expect(refocused.tabs).toEqual(first.tabs)
    expect(refocused.activeTabId).toBe('tab-a')
  })

  it('opens a second Workspace for a distinct locator without disturbing the first', () => {
    let state = openOrFocusWorkspace(createEmptyOpenWorkspaceState(), 'http://a', {
      sessionId: 's1',
      tabId: 't1',
    })
    state = openOrFocusWorkspace(state, 'http://b', { sessionId: 's2', tabId: 't2' })
    expect(state.tabs.map((t) => t.id)).toEqual(['t1', 't2'])
    expect(state.activeTabId).toBe('t2')
  })

  it('closing a Workspace preserves the stable ids of remaining tabs', () => {
    let state = openOrFocusWorkspace(createEmptyOpenWorkspaceState(), 'http://a', {
      sessionId: 's1',
      tabId: 't1',
    })
    state = openOrFocusWorkspace(state, 'http://b', { sessionId: 's2', tabId: 't2' })
    state = closeWorkspace(state, 't2')
    expect(state.tabs.map((t) => t.id)).toEqual(['t1'])
    // Active falls back to the previous tab.
    expect(state.activeTabId).toBe('t1')
  })

  it('reordering preserves every stable id/session so iframes do not remount', () => {
    let state = openOrFocusWorkspace(createEmptyOpenWorkspaceState(), 'http://a', {
      sessionId: 's1',
      tabId: 't1',
    })
    state = openOrFocusWorkspace(state, 'http://b', { sessionId: 's2', tabId: 't2' })
    const reordered = reorderWorkspaces(state, ['t2', 't1'])
    expect(reordered.tabs.map((t) => t.id)).toEqual(['t2', 't1'])
    // The same tab objects (stable identity) are reused.
    expect(reordered.tabs[0]).toEqual(state.tabs[1])
    expect(reordered.tabs[1]).toEqual(state.tabs[0])
    // A reorder referencing an unknown id is a no-op.
    expect(reorderWorkspaces(state, ['t2', 'x'])).toBe(state)
  })

  it('activate focuses an open Workspace without changing order or identity', () => {
    let state = openOrFocusWorkspace(createEmptyOpenWorkspaceState(), 'http://a', {
      sessionId: 's1',
      tabId: 't1',
    })
    state = openOrFocusWorkspace(state, 'http://b', { sessionId: 's2', tabId: 't2' })
    const focused = activateWorkspace(state, 't1')
    expect(focused.activeTabId).toBe('t1')
    expect(focused.tabs.map((t) => t.id)).toEqual(['t1', 't2'])
    // Activating an unknown id is a no-op.
    expect(activateWorkspace(state, 'x')).toBe(state)
  })

  it('hasOpenWorkspace reports only currently mounted locators', () => {
    const state = openOrFocusWorkspace(createEmptyOpenWorkspaceState(), 'http://a', {
      sessionId: 's1',
      tabId: 't1',
    })
    expect(hasOpenWorkspace(state, 'http://a')).toBe(true)
    expect(hasOpenWorkspace(state, 'http://b')).toBe(false)
  })
})

describe('open Workspace state persistence (3.5)', () => {
  it('rejects malformed persisted state as empty without migration glue', () => {
    expect(parseOpenWorkspaceState(null)).toEqual(createEmptyOpenWorkspaceState())
    expect(parseOpenWorkspaceState({ tabs: 'nope' })).toEqual(createEmptyOpenWorkspaceState())
    expect(
      parseOpenWorkspaceState({
        activeTabId: 'missing',
        tabs: [{ id: 't1', sessionId: 's1', apiBaseUrl: 'http://a', createdAt: 1 }],
      }).activeTabId
    ).toBe('t1')
  })

  it('drops malformed tabs and normalizes locators on parse', () => {
    const parsed = parseOpenWorkspaceState({
      activeTabId: 't1',
      tabs: [
        { id: 't1', sessionId: 's1', apiBaseUrl: 'http://a/', createdAt: 1 },
        { id: '', sessionId: 's2', apiBaseUrl: 'http://b', createdAt: 2 },
        { id: 't3', sessionId: '', apiBaseUrl: 'http://c', createdAt: 3 },
      ],
    })
    expect(parsed.tabs).toEqual([
      { id: 't1', sessionId: 's1', apiBaseUrl: 'http://a', createdAt: 1 },
    ])
  })

  it('areOpenWorkspaceStatesEqual detects identity/order changes', () => {
    const a = openOrFocusWorkspace(createEmptyOpenWorkspaceState(), 'http://a', {
      sessionId: 's1',
      tabId: 't1',
    })
    expect(areOpenWorkspaceStatesEqual(a, a)).toBe(true)
    const b = activateWorkspace(a, 't1')
    expect(areOpenWorkspaceStatesEqual(a, b)).toBe(true)
    const c = openOrFocusWorkspace(a, 'http://b', { sessionId: 's2', tabId: 't2' })
    expect(areOpenWorkspaceStatesEqual(a, c)).toBe(false)
  })
})
