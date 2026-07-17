/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Project ownership-specific planning-config facets into reactive Web state.
 * 2. Keep static Active Root content available without inventing owner provenance.
 * 3. Let Environment Global consumers explicitly refresh the CLI-owned reactive projection.
 *
 * Original request (2026-07-15): "Config ownership separates launch-project binding, active-root config, and environment-global config."
 */
import type {
  ActiveRootConfig,
  EnvironmentGlobalConfig,
  ProjectBindingConfig,
} from '@openspecui/core'
import { useCallback, useEffect, useRef, useState } from 'react'
import * as StaticProvider from './static-data-provider'
import { trpcClient } from './trpc'
import { useSubscription, type SubscriptionState } from './use-subscription'

/** Active-root configuration subscription with its current Root Context state. */
export interface ActiveRootConfigView {
  content: string | null
  exists: boolean
  filePath: string | null
  owner: ActiveRootConfig['owner'] | null
}

/** Subscription state that exposes an explicit invalidation-driven refresh action. */
export interface RefreshableSubscriptionState<T> extends SubscriptionState<T> {
  refresh: () => Promise<void>
  refreshPending: boolean
}

function toActiveRootConfigView(config: ActiveRootConfig): ActiveRootConfigView {
  return {
    content: config.file.content,
    exists: config.file.exists,
    filePath: config.file.path,
    owner: config.owner,
  }
}

/** Subscribe to launch-project Store/Reference declarations and their Root Context preview. */
export function useProjectBindingSubscription(): SubscriptionState<ProjectBindingConfig | null> {
  const subscribe = useCallback(
    (callbacks: {
      onData: (data: ProjectBindingConfig | null) => void
      onError: (error: Error) => void
    }) =>
      trpcClient.planningConfig.subscribeProjectBinding.subscribe(undefined, {
        onData: callbacks.onData,
        onError: callbacks.onError,
      }),
    []
  )

  return useSubscription<ProjectBindingConfig | null>(
    subscribe,
    async () => null,
    [],
    'planningConfig.subscribeProjectBinding'
  )
}

/** Subscribe to the selected writable root's config while preserving owner provenance in live mode. */
export function useActiveRootConfigViewSubscription(): SubscriptionState<ActiveRootConfigView> {
  const subscribe = useCallback(
    (callbacks: {
      onData: (data: ActiveRootConfigView) => void
      onError: (error: Error) => void
    }) =>
      trpcClient.planningConfig.subscribeActiveRoot.subscribe(undefined, {
        onData: (data) => callbacks.onData(toActiveRootConfigView(data)),
        onError: callbacks.onError,
      }),
    []
  )

  return useSubscription<ActiveRootConfigView>(
    subscribe,
    async () => {
      const content = await StaticProvider.getOpsxProjectConfig()
      return { content, exists: content !== null, filePath: null, owner: null }
    },
    [],
    'planningConfig.subscribeActiveRootView'
  )
}

/** Subscribe to the backend runtime environment's CLI-selected global config file. */
export function useEnvironmentGlobalConfigSubscription(): RefreshableSubscriptionState<EnvironmentGlobalConfig | null> {
  const [refreshKey, setRefreshKey] = useState(0)
  const [refreshPending, setRefreshPending] = useState(false)
  const refreshGenerationRef = useRef(0)
  const refreshPendingRef = useRef(false)
  const refreshWaiterRef = useRef<{
    generation: number
    promise: Promise<void>
    resolve: () => void
  } | null>(null)
  const refreshResultRef = useRef<number | null>(null)
  const subscribe = useCallback(
    (callbacks: {
      onData: (data: EnvironmentGlobalConfig | null) => void
      onError: (error: Error) => void
    }) =>
      trpcClient.planningConfig.subscribeEnvironmentGlobal.subscribe(undefined, {
        onData: (data) => {
          callbacks.onData(data)
          const waiter = refreshWaiterRef.current
          if (waiter?.generation === refreshKey) {
            refreshResultRef.current = waiter.generation
            setRefreshPending(false)
          }
        },
        onError: (error) => {
          callbacks.onError(error)
          const waiter = refreshWaiterRef.current
          if (waiter?.generation === refreshKey) {
            refreshResultRef.current = waiter.generation
            setRefreshPending(false)
          }
        },
      }),
    [refreshKey]
  )
  const state = useSubscription<EnvironmentGlobalConfig | null>(
    subscribe,
    async () => null,
    [refreshKey],
    'planningConfig.subscribeEnvironmentGlobal'
  )
  useEffect(() => {
    const waiter = refreshWaiterRef.current
    if (
      !waiter ||
      waiter.generation !== refreshKey ||
      refreshResultRef.current !== waiter.generation
    ) {
      return
    }
    refreshResultRef.current = null
    refreshWaiterRef.current = null
    refreshPendingRef.current = false
    // Resolve only after useSubscription's data/error state has committed.
    waiter.resolve()
  }, [refreshKey, refreshPending, state.data, state.error, state.isLoading])
  const refresh = useCallback(() => {
    if (refreshPendingRef.current) return refreshWaiterRef.current?.promise ?? Promise.resolve()
    const next = refreshGenerationRef.current + 1
    refreshGenerationRef.current = next
    let resolveWaiter!: () => void
    const promise = new Promise<void>((resolve) => {
      resolveWaiter = resolve
    })
    refreshWaiterRef.current = { generation: next, promise, resolve: resolveWaiter }
    refreshPendingRef.current = true
    setRefreshPending(true)
    setRefreshKey(next)
    return promise
  }, [])

  return { ...state, refresh, refreshPending }
}
