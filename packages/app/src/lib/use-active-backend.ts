/**
 * Orthogonal intents (updated 2026-07-24 Asia/Shanghai):
 * 1. Derive Store authority from the exact persisted active tab and observation generation.
 * 2. Refuse offline, stale, incompatible, or missing selections without first-online fallback.
 * 3. Revalidate exact tab identity and generation synchronously before Store dispatch.
 * 4. Carry selected backend health and Root Context from the shared observation owner.
 *
 * Original request (2026-07-15): "app 模式提供了多标签管理。"
 * Section 9.5/9.6: an explicitly selected online environment is required before environment-scoped
 * operations and Store views render real data.
 */
import type { HostedBackendHealthResponse, RootContextState } from '@openspecui/core'
import {
  useConnectionObservationOwner,
  useConnectionObservations,
  type ConnectionObservation,
  type ConnectionObservationOwner,
} from './connection-observation'
import type { HostedShellState, HostedShellTab } from './shell-state'
import { getConnectionsSnapshot, useConnections } from './use-connections'

export interface ActiveBackend {
  tabId: string
  apiBaseUrl: string
  observationGeneration: number
  health: HostedBackendHealthResponse | null
  /** Project Root Context for the Context Matrix; null while loading or unavailable. */
  rootContext: RootContextState | null
  /** Revalidate this exact authority against the latest selection immediately before dispatch. */
  isCurrent(): boolean
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
  owner: Pick<ConnectionObservationOwner, 'isCurrentAuthority'>
  readConnections: () => HostedShellState
}

/** Resolve one exact tab/generation authority with a synchronous dispatch-time recheck. */
export function resolveActiveBackendAuthority({
  selectedTab,
  observation,
  owner,
  readConnections,
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
    apiBaseUrl: observation.apiBaseUrl,
    observationGeneration: observation.generation,
    health: observation.health,
    rootContext: observation.rootContext,
    isCurrent: () => {
      const latest = readConnections()
      const latestTab = latest.tabs.find((tab) => tab.id === selectedTab.id)
      if (
        latest.activeTabId !== selectedTab.id ||
        !latestTab ||
        latestTab.sessionId !== selectedTab.sessionId ||
        latestTab.apiBaseUrl !== selectedTab.apiBaseUrl ||
        latestTab.createdAt !== selectedTab.createdAt
      ) {
        return false
      }
      return owner.isCurrentAuthority({
        tabId: observation.tabId,
        apiBaseUrl: observation.apiBaseUrl,
        generation: observation.generation,
      })
    },
  }
}

/**
 * Select only `activeTabId`. Another online backend never substitutes for an unavailable selection.
 */
export function useActiveBackend(): UseActiveBackendResult {
  const connections = useConnections()
  const owner = useConnectionObservationOwner()
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
          owner,
          readConnections: getConnectionsSnapshot,
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
