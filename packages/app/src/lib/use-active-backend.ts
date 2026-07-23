/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Select the first online backend connection for Store Manager / Environment views.
 * 2. Carry its health-derived envUri/capabilities to capability-gated routes.
 *
 * Original request (2026-07-15): "app 模式提供了多标签管理。"
 * Section 9.5/9.6: an explicitly selected online environment is required before environment-scoped
 * operations and Store views render real data.
 */
import type { HostedBackendHealthResponse } from '@openspecui/core'
import { useEffect, useState } from 'react'
import { probeHostedBackend } from './reachability'
import { useConnectionReachability, useConnections } from './use-connections'

export interface ActiveBackend {
  apiBaseUrl: string
  health: HostedBackendHealthResponse | null
}

export interface UseActiveBackendResult {
  /** The first online backend, or null when none are online yet. */
  active: ActiveBackend | null
  /** Whether any backend connection exists. */
  hasConnections: boolean
}

/**
 * Select the first online backend and refresh its health. Environment-scoped operations require an
 * explicitly online environment; while none is online the Store Manager renders its empty/loading state.
 */
export function useActiveBackend(): UseActiveBackendResult {
  const connections = useConnections()
  const tabs = connections.tabs
  const reachability = useConnectionReachability(tabs)
  const firstOnlineUrl =
    tabs.find((tab) => reachability[tab.apiBaseUrl] === 'online')?.apiBaseUrl ?? null

  const [health, setHealth] = useState<HostedBackendHealthResponse | null>(null)

  useEffect(() => {
    if (!firstOnlineUrl) {
      setHealth(null)
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
    return () => {
      cancelled = true
    }
  }, [firstOnlineUrl])

  return {
    active: firstOnlineUrl ? { apiBaseUrl: firstOnlineUrl, health } : null,
    hasConnections: tabs.length > 0,
  }
}
