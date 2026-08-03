/**
 * Orthogonal intents (created 2026-08-01 Asia/Shanghai):
 * 1. Own the live Agent Integrations Pull plus retained replacement subscription.
 * 2. Preserve the last current projection while refresh or transport replacement is pending.
 * 3. Expose explicit refresh and mutation-settlement replacement without static publication.
 *
 * Original request (2026-08-01): move complete Agent delivery ownership to a live-only Config surface.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { trpcClient } from './trpc'

export type AgentIntegrationsProjection = Awaited<
  ReturnType<typeof trpcClient.agentIntegrations.get.query>
>

export interface AgentIntegrationsState {
  data: AgentIntegrationsProjection | null
  error: Error | null
  isLoading: boolean
  isRefreshing: boolean
  refresh(): Promise<AgentIntegrationsProjection>
  accept(projection: AgentIntegrationsProjection): void
}

function toError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause))
}

/** Consume the Server-owned Agent policy, registry, and physical-state projection. */
export function useAgentIntegrations(): AgentIntegrationsState {
  const [data, setData] = useState<AgentIntegrationsProjection | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const mountedRef = useRef(false)
  const transportErrorRef = useRef<Error | null>(null)

  const accept = useCallback((projection: AgentIntegrationsProjection) => {
    if (!mountedRef.current) return
    setData(projection)
    setError(transportErrorRef.current)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    mountedRef.current = true
    let receivedPush = false
    transportErrorRef.current = null
    const subscription = trpcClient.agentIntegrations.subscribe.subscribe(undefined, {
      onData(projection) {
        receivedPush = true
        transportErrorRef.current = null
        accept(projection)
      },
      onError(cause) {
        if (!mountedRef.current) return
        transportErrorRef.current = toError(cause)
        setError(transportErrorRef.current)
        setIsLoading(false)
      },
    })

    void trpcClient.agentIntegrations.get
      .query()
      .then((projection) => {
        if (!mountedRef.current || receivedPush) return
        setData(projection)
        setError(transportErrorRef.current)
        setIsLoading(false)
      })
      .catch((cause: unknown) => {
        if (!mountedRef.current || receivedPush) return
        setError(toError(cause))
        setIsLoading(false)
      })

    return () => {
      mountedRef.current = false
      subscription.unsubscribe()
    }
  }, [accept])

  const refresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const projection = await trpcClient.agentIntegrations.refresh.query()
      accept(projection)
      return projection
    } catch (cause: unknown) {
      const nextError = toError(cause)
      if (mountedRef.current) setError(nextError)
      throw nextError
    } finally {
      if (mountedRef.current) setIsRefreshing(false)
    }
  }, [accept])

  return { data, error, isLoading, isRefreshing, refresh, accept }
}
