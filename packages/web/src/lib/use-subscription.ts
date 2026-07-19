/**
 * Orthogonal intents (updated 2026-07-19 Asia/Shanghai):
 * 1. Provide one cached subscription lifecycle for live and static project projections.
 * 2. Bind Spec, Change, Archive, Config, Notification, and CLI projections to typed hooks.
 * 3. Preserve cache identity for detail projections across remounts and view transitions.
 * 4. Keep Git scope cache data non-authoritative until an opt-in reconnect emits a replacement.
 *
 * Original request (2026-07-15): "我们这个项目本身只是 OpenSpec 的一个可视化投影，所以保持客观中立很重要。"
 * Derived requirement (2026-07-18): Checkpoint 6.9 replaces the project Stores route with Context.
 * Derived requirement (2026-07-19): Checkpoint 6.11 locks cached Git scope data during reconnect.
 *
 * Compromise: typed entity hooks remain aggregated because they share the same cache and live/static
 * subscription primitive; splitting them now would add import churn outside checkpoint 6.9.
 */
import type {
  ArchiveMeta,
  ChangeFile,
  ChangeMeta,
  NotificationRecord,
  OpenSpecUIConfig,
  OpenSpecUIConfigPresence,
  OpenSpecUIGlobalSettings,
  OpsxEntityDetail,
} from '@openspecui/core'
import {
  specIdentityKey,
  type SpecCatalog,
  type SpecDocumentProjection,
  type SpecIdentity,
} from '@openspecui/core/spec-catalog'
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

/** Explicit authority for projections whose cached data must never authorize live operations. */
export type SubscriptionAuthority =
  | { state: 'waiting'; reason: 'initial' | 'rebind' | 'idle' | 'connecting' | 'pending' }
  | { state: 'current' }
  | { state: 'failed'; error: Error }

/** Subscription state whose operation authority is independent from loading presentation. */
export interface AuthoritativeSubscriptionState<T> extends SubscriptionState<T> {
  authority: SubscriptionAuthority
}

/** Controls whether cached data remains authoritative while a subscription reconnects. */
export type SubscriptionCacheRebindPolicy = 'retain' | 'loading'

/** 订阅回调 */
interface SubscriptionCallbacks<T> {
  onData: (data: T) => void
  onError: (err: Error) => void
}

/** Transport lifecycle projected by a typed subscription observer. */
export interface SubscriptionConnectionState {
  state: 'idle' | 'connecting' | 'pending'
  error: Error | null
}

/** Callbacks for a projection that revokes authority on transport lifecycle changes. */
export interface AuthoritativeSubscriptionCallbacks<T> extends SubscriptionCallbacks<T> {
  onConnectionStateChange: (state: SubscriptionConnectionState) => void
  onStopped: () => void
  onComplete: () => void
}

/** 可取消订阅的对象 */
interface Unsubscribable {
  unsubscribe: () => void
}

/** Module-level cache: stores last received value per subscription key for instant re-mount */
const subscriptionCache = new Map<string, unknown>()

export function primeSubscriptionCache<T>(cacheKey: string, data: T): void {
  subscriptionCache.set(cacheKey, data)
}

export function getSpecDocumentSubscriptionCacheKey(identity: SpecIdentity): string {
  return `spec.subscribeDocument:${specIdentityKey(identity)}`
}

export function getArchiveSubscriptionCacheKey(id: string): string {
  return `archive.subscribeOne:${id}`
}

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
  cacheKey?: string,
  cacheRebindPolicy: SubscriptionCacheRebindPolicy = 'retain'
): SubscriptionState<T> {
  const [state, setState] = useState<SubscriptionState<T>>(() => {
    if (cacheKey && subscriptionCache.has(cacheKey)) {
      return {
        data: subscriptionCache.get(cacheKey) as T,
        isLoading: cacheRebindPolicy === 'loading',
        error: null,
      }
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
      setState({
        data: subscriptionCache.get(cacheKey) as T,
        isLoading: cacheRebindPolicy === 'loading',
        error: null,
      })
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

/**
 * Subscribe with an explicit cache/transport authority state.
 *
 * Cached data remains available for stale context, but only a replacement data emission makes it
 * current. Connecting, pending, idle, and terminal error states all revoke operation authority.
 */
export function useAuthoritativeSubscription<T>(
  subscribe: (callbacks: AuthoritativeSubscriptionCallbacks<T>) => Unsubscribable,
  staticLoader?: () => Promise<T>,
  deps: unknown[] = [],
  cacheKey?: string
): AuthoritativeSubscriptionState<T> {
  const cached = cacheKey ? subscriptionCache.get(cacheKey) : undefined
  const hasCached = cacheKey !== undefined && subscriptionCache.has(cacheKey)
  const [state, setState] = useState<AuthoritativeSubscriptionState<T>>(() => ({
    data: hasCached ? (cached as T) : undefined,
    isLoading: true,
    error: null,
    authority: { state: 'waiting', reason: hasCached ? 'rebind' : 'initial' },
  }))
  const subscriptionRef = useRef<Unsubscribable | null>(null)
  const generationRef = useRef(0)
  const inStaticMode = isStaticMode()

  useEffect(() => {
    const generation = generationRef.current + 1
    generationRef.current = generation
    let active = true
    let terminalError: Error | null = null
    let terminal = false
    let subscription: Unsubscribable | null = null
    const isActive = () => active && generationRef.current === generation
    const cleanup = () => {
      active = false
      if (generationRef.current === generation) generationRef.current += 1
      const currentSubscription = subscription ?? subscriptionRef.current
      subscription = null
      subscriptionRef.current = null
      currentSubscription?.unsubscribe()
    }

    subscriptionRef.current?.unsubscribe()
    subscriptionRef.current = null
    const effectHasCached = cacheKey !== undefined && subscriptionCache.has(cacheKey)
    setState({
      data: effectHasCached ? (subscriptionCache.get(cacheKey) as T) : undefined,
      isLoading: true,
      error: null,
      authority: { state: 'waiting', reason: effectHasCached ? 'rebind' : 'initial' },
    })

    if (inStaticMode) {
      if (!staticLoader) {
        const error = new Error('Static loader not available')
        setState((previous) => ({
          ...previous,
          isLoading: false,
          error,
          authority: { state: 'failed', error },
        }))
        return cleanup
      }
      staticLoader()
        .then((data) => {
          if (!isActive()) return
          if (cacheKey) subscriptionCache.set(cacheKey, data)
          setState({ data, isLoading: false, error: null, authority: { state: 'current' } })
        })
        .catch((cause: unknown) => {
          if (!isActive()) return
          const error = cause instanceof Error ? cause : new Error(String(cause))
          setState((previous) => ({
            ...previous,
            isLoading: false,
            error,
            authority: { state: 'failed', error },
          }))
        })
      return cleanup
    }

    subscription = subscribe({
      onData(data) {
        if (!isActive()) return
        terminal = false
        terminalError = null
        if (cacheKey) subscriptionCache.set(cacheKey, data)
        setState({ data, isLoading: false, error: null, authority: { state: 'current' } })
      },
      onError(error) {
        if (!isActive()) return
        terminalError = error
        setState((previous) => ({
          ...previous,
          isLoading: false,
          error,
          authority: { state: 'failed', error },
        }))
      },
      onConnectionStateChange(connection) {
        if (!isActive() || terminal || terminalError) return
        setState((previous) => ({
          ...previous,
          isLoading: true,
          error: connection.error ?? terminalError,
          authority: { state: 'waiting', reason: connection.state },
        }))
      },
      onStopped() {
        if (!isActive()) return
        terminal = true
        setState((previous) =>
          terminalError
            ? {
                ...previous,
                isLoading: false,
                error: terminalError,
                authority: { state: 'failed', error: terminalError },
              }
            : { ...previous, isLoading: true, authority: { state: 'waiting', reason: 'idle' } }
        )
      },
      onComplete() {
        if (!isActive()) return
        terminal = true
        setState((previous) =>
          terminalError
            ? {
                ...previous,
                isLoading: false,
                error: terminalError,
                authority: { state: 'failed', error: terminalError },
              }
            : { ...previous, isLoading: true, authority: { state: 'waiting', reason: 'idle' } }
        )
      },
    })
    subscriptionRef.current = subscription
    return cleanup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inStaticMode, ...deps])

  return state
}

// =====================
// Spec subscriptions
// =====================

export function useSpecsSubscription(): SubscriptionState<SpecCatalog> {
  return useSubscription<SpecCatalog>(
    (callbacks) =>
      trpcClient.spec.subscribeCatalog.subscribe(undefined, {
        onData: callbacks.onData,
        onError: callbacks.onError,
      }),
    StaticProvider.getSpecCatalog,
    [],
    'spec.subscribeCatalog'
  )
}

export function useSpecDocumentSubscription(
  identity: SpecIdentity
): SubscriptionState<SpecDocumentProjection> {
  const cacheKey = getSpecDocumentSubscriptionCacheKey(identity)
  return useSubscription<SpecDocumentProjection>(
    (callbacks) =>
      trpcClient.spec.subscribeDocument.subscribe(identity, {
        onData: callbacks.onData,
        onError: callbacks.onError,
      }),
    () => StaticProvider.getSpecDocument(identity),
    [cacheKey],
    cacheKey
  )
}

// =====================
// Change subscriptions
// =====================

export function useChangesSubscription(): SubscriptionState<ChangeMeta[]> {
  return useSubscription<ChangeMeta[]>(
    (callbacks) =>
      trpcClient.change.subscribe.subscribe(undefined, {
        onData: callbacks.onData,
        onError: callbacks.onError,
      }),
    StaticProvider.getChanges,
    [],
    'change.subscribe'
  )
}

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

export type ArchivedChange = OpsxEntityDetail

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
    getArchiveSubscriptionCacheKey(id)
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

export function useConfigPresenceSubscription(): SubscriptionState<OpenSpecUIConfigPresence> {
  return useSubscription<OpenSpecUIConfigPresence>(
    (callbacks) =>
      trpcClient.config.subscribePresence.subscribe(undefined, {
        onData: callbacks.onData,
        onError: callbacks.onError,
      }),
    async () => ({
      translation: {
        enabled: false,
        targetLanguage: false,
        displayMode: false,
        cacheEnabled: false,
        engineId: false,
        engines: {
          local: false,
          localCt2: false,
          localLlama: false,
          openai: false,
        },
      },
    }),
    [],
    'config.subscribePresence'
  )
}

export function useGlobalSettingsSubscription(): SubscriptionState<OpenSpecUIGlobalSettings> {
  return useSubscription<OpenSpecUIGlobalSettings>(
    (callbacks) =>
      trpcClient.globalSettings.subscribe.subscribe(undefined, {
        onData: callbacks.onData,
        onError: callbacks.onError,
      }),
    undefined,
    [],
    'globalSettings.subscribe'
  )
}

// =====================
// Notification subscriptions
// =====================

export function useNotificationsSubscription(): SubscriptionState<NotificationRecord[]> {
  return useSubscription<NotificationRecord[]>(
    (callbacks) =>
      trpcClient.notifications.subscribe.subscribe(undefined, {
        onData: callbacks.onData,
        onError: callbacks.onError,
      }),
    async () => [],
    [],
    'notifications.subscribe'
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
