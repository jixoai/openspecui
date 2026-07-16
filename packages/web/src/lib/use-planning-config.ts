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
import { useCallback, useState } from 'react'
import * as StaticProvider from './static-data-provider'
import { trpcClient } from './trpc'
import { useSubscription, type SubscriptionState } from './use-subscription'

export interface ActiveRootConfigView {
  content: string | null
  exists: boolean
  filePath: string | null
  owner: ActiveRootConfig['owner'] | null
}

export interface RefreshableSubscriptionState<T> extends SubscriptionState<T> {
  refresh: () => void
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
  const subscribe = useCallback(
    (callbacks: {
      onData: (data: EnvironmentGlobalConfig | null) => void
      onError: (error: Error) => void
    }) =>
      trpcClient.planningConfig.subscribeEnvironmentGlobal.subscribe(undefined, {
        onData: callbacks.onData,
        onError: callbacks.onError,
      }),
    []
  )
  const state = useSubscription<EnvironmentGlobalConfig | null>(
    subscribe,
    async () => null,
    [refreshKey],
    'planningConfig.subscribeEnvironmentGlobal'
  )
  const refresh = useCallback(() => setRefreshKey((current) => current + 1), [])

  return { ...state, refresh }
}
