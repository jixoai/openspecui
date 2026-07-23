/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Select the first online backend connection for Store Manager / Environment views.
 * 2. Carry its health-derived envUri/capabilities to capability-gated routes.
 *
 * Original request (2026-07-15): "app 模式提供了多标签管理。"
 * Section 9.5/9.6: an explicitly selected online environment is required before environment-scoped
 * operations and Store views render real data.
 */
import type { HostedBackendHealthResponse, RootContextState } from '@openspecui/core'
import { useEffect, useState } from 'react'
import { fetchBackendRootContext } from './backend-client'
import { readLaunchCredential } from './launch-credential'
import { probeHostedBackend } from './reachability'
import { useConnectionReachability, useConnections } from './use-connections'

export interface ActiveBackend {
  apiBaseUrl: string
  health: HostedBackendHealthResponse | null
  /** Project Root Context for the Context Matrix; null while loading or unavailable. */
  rootContext: RootContextState | null
  /** Session-memory Access Gate credential (never persisted). */
  credential: string | null
}

export interface UseActiveBackendResult {
  /** The first online backend, or null when none are online yet. */
  active: ActiveBackend | null
  /** Whether any backend connection exists. */
  hasConnections: boolean
}

/**
 * Select the first online backend and refresh its health + Root Context. Environment-scoped operations
 * require an explicitly online environment; while none is online the Store Manager renders its empty state.
 */
export function useActiveBackend(): UseActiveBackendResult {
  const connections = useConnections()
  const tabs = connections.tabs
  const reachability = useConnectionReachability(tabs)
  const firstOnlineUrl =
    tabs.find((tab) => reachability[tab.apiBaseUrl] === 'online')?.apiBaseUrl ?? null
  // Access Gate credential held in session memory only (never query params/localStorage/persisted tabs).
  const credential = readLaunchCredential()

  const [health, setHealth] = useState<HostedBackendHealthResponse | null>(null)
  const [rootContext, setRootContext] = useState<RootContextState | null>(null)

  useEffect(() => {
    if (!firstOnlineUrl) {
      setHealth(null)
      setRootContext(null)
      return
    }
    let cancelled = false
    probeHostedBackend(firstOnlineUrl)
      .then((result) => {
        if (!cancelled) setHealth(result.health)
      })
      .catch(() => {
        if (!cancelled) setHealth(null)
      })
    fetchBackendRootContext({ apiBaseUrl: firstOnlineUrl, credential })
      .then((context) => {
        if (!cancelled) setRootContext(context)
      })
      .catch(() => {
        if (!cancelled) setRootContext(null)
      })
    return () => {
      cancelled = true
    }
  }, [firstOnlineUrl, credential])

  return {
    active: firstOnlineUrl ? { apiBaseUrl: firstOnlineUrl, health, rootContext, credential } : null,
    hasConnections: tabs.length > 0,
  }
}
