/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Define strong open-Workspace identity (tab/session/frame/order/active) separate from candidate identity (3.4).
 * 2. Replace the old dual-ownership shape with pure open/focus/close/reorder transitions (3.5/3.6).
 * 3. Preserve stable Workspace and iframe keys across transitions so navigation never remounts iframe Documents.
 *
 * Original request (2026-07-30): "Workspaces融合了Connections。"
 * Implementation decision (2026-07-30): a connection candidate and an open Workspace have separate identity,
 *   lifecycle, and persistence contracts. Open-Workspace tab/session/frame identity is independent of the
 *   candidate locator it was opened from.
 *
 * This module owns ONLY the open-Workspace presentation state. Candidate identity lives in
 * `workspace-candidate-catalog.ts`; credential binding lives in the locator-owned runtime memory owner.
 */

import { normalizeHostedApiBaseUrl } from './shell-state'

/** One open Workspace tab bound to a stable session/frame identity. */
export interface OpenWorkspaceTab {
  /** Stable tab id; the iframe key derives from this so navigation never remounts the Document. */
  readonly id: string
  /** Stable session id shared with the embedded Project Web session query param. */
  readonly sessionId: string
  /** Backend API locator this Workspace was opened from (credential-free). */
  readonly apiBaseUrl: string
  /** Creation order timestamp; stable identity independent of reorder. */
  readonly createdAt: number
}

/** Open-Workspace presentation state: ordered tabs plus the active id. Credential-free persistence. */
export interface OpenWorkspaceState {
  readonly activeTabId: string | null
  readonly tabs: readonly OpenWorkspaceTab[]
}

export function createEmptyOpenWorkspaceState(): OpenWorkspaceState {
  return { activeTabId: null, tabs: [] }
}

interface PersistedOpenWorkspaceState {
  activeTabId?: unknown
  tabs?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isOpenWorkspaceTab(value: unknown): value is OpenWorkspaceTab {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.sessionId === 'string' &&
    value.sessionId.length > 0 &&
    typeof value.apiBaseUrl === 'string' &&
    normalizeHostedApiBaseUrl(value.apiBaseUrl) !== null &&
    typeof value.createdAt === 'number' &&
    Number.isFinite(value.createdAt)
  )
}

/** Runtime-parse untrusted persisted open-Workspace state; reject malformed storage as empty (no repair). */
export function parseOpenWorkspaceState(raw: unknown): OpenWorkspaceState {
  if (!isRecord(raw)) return createEmptyOpenWorkspaceState()
  const persisted = raw as PersistedOpenWorkspaceState
  const tabs = Array.isArray(persisted.tabs)
    ? persisted.tabs.filter(isOpenWorkspaceTab).map((tab) => ({
        ...tab,
        apiBaseUrl: normalizeHostedApiBaseUrl(tab.apiBaseUrl) ?? tab.apiBaseUrl,
      }))
    : []
  const activeTabId =
    typeof persisted.activeTabId === 'string' &&
    tabs.some((tab) => tab.id === persisted.activeTabId)
      ? persisted.activeTabId
      : (tabs[0]?.id ?? null)
  return { activeTabId, tabs }
}

export function areOpenWorkspaceStatesEqual(
  left: OpenWorkspaceState,
  right: OpenWorkspaceState
): boolean {
  if (left.activeTabId !== right.activeTabId || left.tabs.length !== right.tabs.length) return false
  return left.tabs.every((tab, index) => {
    const other = right.tabs[index]
    return (
      other !== undefined &&
      tab.id === other.id &&
      tab.sessionId === other.sessionId &&
      tab.apiBaseUrl === other.apiBaseUrl &&
      tab.createdAt === other.createdAt
    )
  })
}

/** Stable session id generator. */
export function generateOpenWorkspaceSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `ws-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Focus an existing Workspace for the locator if one is open; otherwise open exactly one new Workspace.
 * Reuses the existing stable id/session so the iframe Document is preserved, never remounted.
 */
export function openOrFocusWorkspace(
  state: OpenWorkspaceState,
  apiBaseUrl: string,
  options?: { now?: number; sessionId?: string; tabId?: string }
): OpenWorkspaceState {
  const normalized = normalizeHostedApiBaseUrl(apiBaseUrl)
  if (!normalized) return state
  const existingIndex = state.tabs.findIndex((tab) => tab.apiBaseUrl === normalized)
  if (existingIndex >= 0) {
    const existing = state.tabs[existingIndex]!
    if (state.activeTabId === existing.id) return state
    return { ...state, activeTabId: existing.id }
  }
  const sessionId = options?.sessionId ?? generateOpenWorkspaceSessionId()
  const id = options?.tabId ?? sessionId
  const tab: OpenWorkspaceTab = {
    id,
    sessionId,
    apiBaseUrl: normalized,
    createdAt: options?.now ?? Date.now(),
  }
  return { activeTabId: tab.id, tabs: [...state.tabs, tab] }
}

/** Close one open Workspace by tab id; preserves the iframe-stable identity of all remaining tabs. */
export function closeWorkspace(state: OpenWorkspaceState, tabId: string): OpenWorkspaceState {
  const removedIndex = state.tabs.findIndex((tab) => tab.id === tabId)
  if (removedIndex < 0) return state
  const tabs = state.tabs.filter((tab) => tab.id !== tabId)
  if (state.activeTabId !== tabId) return { activeTabId: state.activeTabId, tabs }
  const nextActive = tabs[removedIndex]?.id ?? tabs[removedIndex - 1]?.id ?? null
  return { activeTabId: nextActive, tabs }
}

/** Activate (focus) one open Workspace by tab id without changing order or identity. */
export function activateWorkspace(state: OpenWorkspaceState, tabId: string): OpenWorkspaceState {
  if (!state.tabs.some((tab) => tab.id === tabId) || state.activeTabId === tabId) return state
  return { ...state, activeTabId: tabId }
}

/** Reorder open Workspaces by id; preserves every stable id/session so iframes do not remount. */
export function reorderWorkspaces(
  state: OpenWorkspaceState,
  orderedTabIds: readonly string[]
): OpenWorkspaceState {
  if (orderedTabIds.length !== state.tabs.length) return state
  const byId = new Map(state.tabs.map((tab) => [tab.id, tab] as const))
  if (orderedTabIds.some((id) => !byId.has(id))) return state
  const tabs = orderedTabIds.map((id) => byId.get(id)!)
  if (tabs.every((tab, index) => tab.id === state.tabs[index]?.id)) return state
  return { ...state, tabs }
}

/** Whether any open Workspace currently mounts the given locator. */
export function hasOpenWorkspace(state: OpenWorkspaceState, apiBaseUrl: string): boolean {
  const normalized = normalizeHostedApiBaseUrl(apiBaseUrl)
  if (!normalized) return false
  return state.tabs.some((tab) => tab.apiBaseUrl === normalized)
}
