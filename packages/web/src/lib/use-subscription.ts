import type { ArchiveMeta, Change, ChangeFile, Spec, SpecMeta } from '@openspecui/core'
import { useEffect, useRef, useState } from 'react'
import * as StaticProvider from './static-data-provider'
import { isStaticMode } from './static-mode'
import { trpcClient } from './trpc'

/** 订阅状态 */
export interface SubscriptionState<T> {
  data: T | undefined
  isLoading: boolean
  error: Error | null
}

/** 订阅回调 */
interface SubscriptionCallbacks<T> {
  onData: (data: T) => void
  onError: (err: Error) => void
}

/** 可取消订阅的对象 */
interface Unsubscribable {
  unsubscribe: () => void
}

/** Module-level cache: stores last received value per subscription key for instant re-mount */
const subscriptionCache = new Map<string, unknown>()

/**
 * 通用订阅 Hook (支持静态模式)
 *
 * 替代 useQuery，直接从 WebSocket 获取数据。
 * 当订阅的数据变更时，自动更新组件。
 * 在静态模式下，从 data.json 加载数据。
 *
 * @param subscribe 订阅函数
 * @param staticLoader 静态数据加载函数（静态模式下使用）
 * @param deps 依赖数组
 * @param cacheKey 缓存键，用于在组件重新挂载时提供即时数据（避免 view transition 闪烁）
 */
export function useSubscription<T>(
  subscribe: (callbacks: SubscriptionCallbacks<T>) => Unsubscribable,
  staticLoader?: () => Promise<T>,
  deps: unknown[] = [],
  cacheKey?: string
): SubscriptionState<T> {
  const [state, setState] = useState<SubscriptionState<T>>(() => {
    if (cacheKey && subscriptionCache.has(cacheKey)) {
      return { data: subscriptionCache.get(cacheKey) as T, isLoading: false, error: null }
    }
    return { data: undefined, isLoading: true, error: null }
  })

  const subscriptionRef = useRef<Unsubscribable | null>(null)
  const inStaticMode = isStaticMode()

  useEffect(() => {
    // 清理之前的订阅
    subscriptionRef.current?.unsubscribe()

    // Use cached data if available, otherwise mark as loading
    if (cacheKey && subscriptionCache.has(cacheKey)) {
      setState({ data: subscriptionCache.get(cacheKey) as T, isLoading: false, error: null })
    } else {
      setState((prev) => ({ ...prev, isLoading: true, error: null }))
    }

    // 静态模式：从 data.json 加载数据
    if (inStaticMode) {
      if (staticLoader) {
        staticLoader()
          .then((data) => {
            if (cacheKey) subscriptionCache.set(cacheKey, data)
            setState({ data, isLoading: false, error: null })
          })
          .catch((error) => {
            console.error('Static data loading error:', error)
            setState((prev) => ({ ...prev, isLoading: false, error }))
          })
      } else {
        console.warn('No static loader provided for subscription in static mode')
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: new Error('Static loader not available'),
        }))
      }
      return
    }

    // 动态模式：创建 WebSocket 订阅
    const subscription = subscribe({
      onData: (data) => {
        if (cacheKey) subscriptionCache.set(cacheKey, data)
        setState({ data, isLoading: false, error: null })
      },
      onError: (error) => {
        console.error('Subscription error:', error)
        setState((prev) => ({ ...prev, isLoading: false, error }))
      },
    })

    subscriptionRef.current = subscription

    return () => {
      subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inStaticMode, ...deps])

  return state
}

// =====================
// Spec subscriptions
// =====================

export function useSpecsSubscription(): SubscriptionState<SpecMeta[]> {
  return useSubscription<SpecMeta[]>(
    (callbacks) =>
      trpcClient.spec.subscribe.subscribe(undefined, {
        onData: callbacks.onData,
        onError: callbacks.onError,
      }),
    StaticProvider.getSpecs,
    [],
    'spec.subscribe'
  )
}

export function useSpecSubscription(id: string): SubscriptionState<Spec | null> {
  return useSubscription<Spec | null>(
    (callbacks) =>
      trpcClient.spec.subscribeOne.subscribe(
        { id },
        {
          onData: callbacks.onData,
          onError: callbacks.onError,
        }
      ),
    () => StaticProvider.getSpec(id),
    [id],
    `spec.subscribeOne:${id}`
  )
}

export function useSpecRawSubscription(id: string): SubscriptionState<string | null> {
  return useSubscription<string | null>(
    (callbacks) =>
      trpcClient.spec.subscribeRaw.subscribe(
        { id },
        {
          onData: callbacks.onData,
          onError: callbacks.onError,
        }
      ),
    () => StaticProvider.getSpecRaw(id),
    [id],
    `spec.subscribeRaw:${id}`
  )
}

// =====================
// Change subscriptions
// =====================

export function useChangeFilesSubscription(id: string): SubscriptionState<ChangeFile[]> {
  return useSubscription<ChangeFile[]>(
    (callbacks) =>
      trpcClient.change.subscribeFiles.subscribe(
        { id },
        {
          onData: callbacks.onData,
          onError: callbacks.onError,
        }
      ),
    () => StaticProvider.getChangeFiles(id),
    [id],
    `change.subscribeFiles:${id}`
  )
}

// =====================
// Archive subscriptions
// =====================

export function useArchivesSubscription(): SubscriptionState<ArchiveMeta[]> {
  return useSubscription<ArchiveMeta[]>(
    (callbacks) =>
      trpcClient.archive.subscribe.subscribe(undefined, {
        onData: callbacks.onData,
        onError: callbacks.onError,
      }),
    StaticProvider.getArchives,
    [],
    'archive.subscribe'
  )
}

/** Archived change 数据类型 (与 Change 相同结构) */
export type ArchivedChange = Change

export function useArchiveSubscription(id: string): SubscriptionState<ArchivedChange | null> {
  return useSubscription<ArchivedChange | null>(
    (callbacks) =>
      trpcClient.archive.subscribeOne.subscribe(
        { id },
        {
          onData: callbacks.onData,
          onError: callbacks.onError,
        }
      ),
    () => StaticProvider.getArchive(id),
    [id],
    `archive.subscribeOne:${id}`
  )
}

export function useArchiveFilesSubscription(id: string): SubscriptionState<ChangeFile[]> {
  return useSubscription<ChangeFile[]>(
    (callbacks) =>
      trpcClient.archive.subscribeFiles.subscribe(
        { id },
        {
          onData: callbacks.onData,
          onError: callbacks.onError,
        }
      ),
    () => StaticProvider.getArchiveFiles(id),
    [id],
    `archive.subscribeFiles:${id}`
  )
}

// =====================
// Config subscriptions
// =====================

/** OpenSpecUI 配置类型 */
export interface OpenSpecUIConfig {
  cli: { command?: string }
  ui: { theme: 'light' | 'dark' | 'system' }
}

export function useConfigSubscription(): SubscriptionState<OpenSpecUIConfig> {
  return useSubscription<OpenSpecUIConfig>(
    (callbacks) =>
      trpcClient.config.subscribe.subscribe(undefined, {
        onData: callbacks.onData,
        onError: callbacks.onError,
      }),
    StaticProvider.getConfig,
    [],
    'config.subscribe'
  )
}

// =====================
// CLI subscriptions
// =====================

export function useConfiguredToolsSubscription(): SubscriptionState<string[]> {
  return useSubscription<string[]>(
    (callbacks) =>
      trpcClient.cli.subscribeConfiguredTools.subscribe(undefined, {
        onData: callbacks.onData,
        onError: callbacks.onError,
      }),
    StaticProvider.getConfiguredTools,
    [],
    'cli.subscribeConfiguredTools'
  )
}
