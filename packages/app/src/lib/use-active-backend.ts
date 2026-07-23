/**
 * Orthogonal intents (updated 2026-07-24 Asia/Shanghai):
 * 1. Derive Store authority from the exact persisted active tab and observation generation.
 * 2. Refuse offline, stale, incompatible, or missing selections without first-online fallback.
 * 3. Capture exact tab identity and generation for synchronous Store dispatch revalidation.
 * 4. Carry selected backend health and Root Context from the shared observation owner.
 *
 * Original request (2026-07-15): "app 模式提供了多标签管理。"
 * Section 9.5/9.6: an explicitly selected online environment is required before environment-scoped
 * operations and Store views render real data.
 */
import type { HostedBackendHealthResponse, RootContextState } from '@openspecui/core'
import { useConnectionObservations, type ConnectionObservation } from './connection-observation'
import type { HostedShellTab } from './shell-state'
import type { StoreActionAuthority } from './store-action'
import { useConnections } from './use-connections'

export interface ActiveBackend extends StoreActionAuthority {
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

interface ResolveActiveBackendAuthorityOptions {
  selectedTab: HostedShellTab
  observation: ConnectionObservation
}

/** Resolve one exact tab/generation authority with a synchronous dispatch-time recheck. */
export function resolveActiveBackendAuthority({
  selectedTab,
  observation,
}: ResolveActiveBackendAuthorityOptions): ActiveBackend | null {
  if (
    observation.tabId !== selectedTab.id ||
    observation.apiBaseUrl !== selectedTab.apiBaseUrl ||
    !observation.current ||
    observation.reachability !== 'online' ||
    !observation.health
  ) {
    return null
  }

  return {
    tabId: observation.tabId,
    sessionId: selectedTab.sessionId,
    apiBaseUrl: observation.apiBaseUrl,
    tabCreatedAt: selectedTab.createdAt,
    observationGeneration: observation.generation,
    health: observation.health,
    rootContext: observation.rootContext,
  }
}

/**
 * Select only `activeTabId`. Another online backend never substitutes for an unavailable selection.
 */
export function useActiveBackend(): UseActiveBackendResult {
  const connections = useConnections()
  const { observations } = useConnectionObservations()
  const selectedTab = connections.tabs.find((tab) => tab.id === connections.activeTabId) ?? null
  const selected = selectedTab
    ? (observations.find((observation) => observation.tabId === selectedTab.id) ?? null)
    : null
  const active =
    selectedTab && selected
      ? resolveActiveBackendAuthority({
          selectedTab,
          observation: selected,
        })
      : null
  const unavailableReason = !selectedTab
    ? 'missing-selection'
    : !selected
      ? 'checking'
      : selected.reachability === 'online' && !selected.current
        ? 'checking'
        : selected.reachability === 'online'
          ? null
          : selected.reachability

  return {
    active,
    hasConnections: connections.tabs.length > 0,
    unavailableReason,
  }
}
