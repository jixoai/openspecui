/**
 * Orthogonal intents (updated 2026-07-24 Asia/Shanghai):
 * 1. Derive Store authority from the exact persisted active tab.
 * 2. Refuse offline, stale, incompatible, or missing selections without first-online fallback.
 * 3. Carry selected backend health and Root Context from the shared observation owner.
 *
 * Original request (2026-07-15): "app 模式提供了多标签管理。"
 * Section 9.5/9.6: an explicitly selected online environment is required before environment-scoped
 * operations and Store views render real data.
 */
import type { HostedBackendHealthResponse, RootContextState } from '@openspecui/core'
import { useConnectionObservations } from './connection-observation'
import { useConnections } from './use-connections'

export interface ActiveBackend {
  apiBaseUrl: string
  health: HostedBackendHealthResponse | null
  /** Project Root Context for the Context Matrix; null while loading or unavailable. */
  rootContext: RootContextState | null
}

export interface UseActiveBackendResult {
  /** The exact selected current backend, or null when that selection is unavailable. */
  active: ActiveBackend | null
  /** Whether any backend connection exists. */
  hasConnections: boolean
  /** Why the selected tab cannot currently authorize an environment-scoped operation. */
  unavailableReason:
    | 'missing-selection'
    | 'checking'
    | 'offline'
    | 'unsupported'
    | 'authentication-required'
    | null
}

/**
 * Select only `activeTabId`. Another online backend never substitutes for an unavailable selection.
 */
export function useActiveBackend(): UseActiveBackendResult {
  const connections = useConnections()
  const { observations } = useConnectionObservations()
  const selectedTab = connections.tabs.find((tab) => tab.id === connections.activeTabId) ?? null
  const selected = selectedTab
    ? (observations.find((observation) => observation.apiBaseUrl === selectedTab.apiBaseUrl) ??
      null)
    : null
  const available =
    selected?.current === true && selected.reachability === 'online' && selected.health
  const unavailableReason = !selected
    ? 'missing-selection'
    : selected.reachability === 'online' && !selected.current
      ? 'checking'
      : selected.reachability === 'online'
        ? null
        : selected.reachability

  return {
    active: available
      ? {
          apiBaseUrl: selected.apiBaseUrl,
          health: selected.health,
          rootContext: selected.rootContext,
        }
      : null,
    hasConnections: connections.tabs.length > 0,
    unavailableReason,
  }
}
