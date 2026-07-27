/**
 * Orthogonal intents (updated 2026-07-27 Asia/Shanghai):
 * 1. Project ownership-specific planning-config facets into reactive Web state.
 * 2. Keep static Active Root content available without inventing owner provenance.
 * 3. Let Environment Global consumers explicitly refresh the CLI-owned reactive projection.
 * 4. Keep refresh pending until the replacement projection commits, then resolve awaiters.
 * 5. Compose CLI facts with the separate file-native Environment Global projection.
 *
 * Original request (2026-07-15): "Config ownership separates launch-project binding, active-root config, and environment-global config."
 * Original request (2026-07-18): "Refresh completion must follow the committed subscription projection so Apply can safely dispatch its second operation."
 * Original request (2026-07-26): "展开全面的接口升级和内核升级和测试升级。"
 */
import type {
  ActiveRootConfig,
  EnvironmentGlobalConfig,
  ProjectBindingConfig,
} from '@openspecui/core'
import {
  CliProjectionNoticeSchema,
  EnvironmentGlobalFileProjectionStateSchema,
  EnvironmentGlobalProjectionStateSchema,
  type EnvironmentGlobalFileProjectionData,
  type EnvironmentGlobalProjectionData,
} from '@openspecui/core/planning-cli-projection'
import { useCallback, useMemo } from 'react'
import * as StaticProvider from './static-data-provider'
import { trpcClient } from './trpc'
import {
  useCliProjectionLifecycle,
  type CliProjectionLifecycleSource,
  type CliProjectionSubscriptionState,
} from './use-cli-projection'
import { useSubscription, type SubscriptionState } from './use-subscription'

/** Active-root configuration subscription with its current Root Context state. */
export interface ActiveRootConfigView {
  content: string | null
  exists: boolean
  filePath: string | null
  owner: ActiveRootConfig['owner'] | null
}

/** Subscription state that exposes an explicit invalidation-driven refresh action. */
export interface RefreshableSubscriptionState<T> extends CliProjectionSubscriptionState<T> {}

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
  const cliSource = useMemo<CliProjectionLifecycleSource<EnvironmentGlobalProjectionData>>(
    () => ({
      read: () => trpcClient.planningConfig.readEnvironmentGlobalProjection.query(),
      refresh: () => trpcClient.planningConfig.refreshEnvironmentGlobalProjection.mutate(),
      parseState: (raw) => EnvironmentGlobalProjectionStateSchema.parse(raw),
      subscribe(callbacks) {
        return trpcClient.planningConfig.subscribeEnvironmentGlobalProjection.subscribe(undefined, {
          onData(raw) {
            const decoded = CliProjectionNoticeSchema.safeParse(raw)
            if (!decoded.success) {
              callbacks.onError(
                new Error(`Malformed Environment Global notice: ${decoded.error.message}`)
              )
              return
            }
            callbacks.onNotice()
          },
          onError: callbacks.onError,
          onConnectionStateChange(connection) {
            if (connection.error) {
              callbacks.onError(connection.error)
              return
            }
            if (connection.state === 'connecting' || connection.state === 'pending') {
              callbacks.onConnectionState(connection.state)
            }
          },
          onStopped: callbacks.onStopped,
          onComplete: callbacks.onComplete,
        })
      },
    }),
    []
  )

  const fileSource = useMemo<CliProjectionLifecycleSource<EnvironmentGlobalFileProjectionData>>(
    () => ({
      read: () => trpcClient.planningConfig.readEnvironmentGlobalFileProjection.query(),
      refresh: () => trpcClient.planningConfig.refreshEnvironmentGlobalFileProjection.mutate(),
      parseState: (raw) => EnvironmentGlobalFileProjectionStateSchema.parse(raw),
      subscribe(callbacks) {
        return trpcClient.planningConfig.subscribeEnvironmentGlobalFileProjection.subscribe(
          undefined,
          {
            onData(raw) {
              const decoded = CliProjectionNoticeSchema.safeParse(raw)
              if (!decoded.success) {
                callbacks.onError(
                  new Error(`Malformed Environment Global file notice: ${decoded.error.message}`)
                )
                return
              }
              callbacks.onNotice()
            },
            onError: callbacks.onError,
            onConnectionStateChange(connection) {
              if (connection.error) {
                callbacks.onError(connection.error)
                return
              }
              if (connection.state === 'connecting' || connection.state === 'pending') {
                callbacks.onConnectionState(connection.state)
              }
            },
            onStopped: callbacks.onStopped,
            onComplete: callbacks.onComplete,
          }
        )
      },
    }),
    []
  )

  const cli = useCliProjectionLifecycle({
    source: cliSource,
    sourceKey: 'environment-global-cli',
    selectData: (data) => data,
    staticLoader: async () => null,
    cacheKey: 'planningConfig.environmentGlobalCliProjection',
  })
  const file = useCliProjectionLifecycle({
    source: fileSource,
    sourceKey: 'environment-global-file',
    selectData: (data) => data,
    staticLoader: async () => null,
    cacheKey: 'planningConfig.environmentGlobalFileProjection',
  })

  const data =
    cli.data !== undefined && cli.data !== null && file.data !== undefined && file.data !== null
      ? ({
          ...cli.data,
          kind: 'environment-global',
          file: file.data.file,
        } satisfies EnvironmentGlobalConfig)
      : undefined
  const error = cli.error ?? file.error
  return {
    data,
    isLoading: cli.isLoading || file.isLoading,
    isUpdating: cli.isUpdating || file.isUpdating,
    refreshPending: cli.refreshPending || file.refreshPending,
    error,
    authority:
      cli.authority.state === 'failed'
        ? cli.authority
        : file.authority.state === 'failed'
          ? file.authority
          : cli.authority.state === 'current' && file.authority.state === 'current'
            ? { state: 'current' as const }
            : { state: 'waiting' as const, reason: 'pending' as const },
    refresh: async () => {
      await cli.refresh()
    },
  }
}
