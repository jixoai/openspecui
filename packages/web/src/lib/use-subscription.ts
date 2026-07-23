/**
 * Orthogonal intents (updated 2026-07-23 Asia/Shanghai):
 * 1. Consume one internal cached subscription lifecycle and stale-display path for live and static projections.
 * 2. Bind Spec, progressive Change, Archive, Config, Notification, and CLI projections to typed hooks.
 * 3. Preserve cache identity for detail projections across remounts and view transitions.
 * 4. Keep Git scope cache data non-authoritative until an opt-in reconnect emits a replacement.
 * 5. Expose Archive recompute lifecycle without relabeling transport loading as projection work.
 *
 * Original request (2026-07-15): "我们这个项目本身只是 OpenSpec 的一个可视化投影，所以保持客观中立很重要。"
 * Derived requirement (2026-07-18): Checkpoint 6.9 replaces the project Stores route with Context.
 * Derived requirement (2026-07-19): Checkpoint 6.11 locks cached Git scope data during reconnect.
 * Owner report (2026-07-22): "整个过程中，几乎都在 Loading。"
 *
 * Compromise: typed entity hooks remain aggregated because they share the same cache and live/static
 * subscription primitive; splitting them now would add import churn outside checkpoint 6.9.
 */
import type {
  ArchiveMeta,
  ChangeFile,
  ChangeMeta,
  ChangeProjectionRowError,
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
import { SubscriptionLifecycleOwner } from './subscription-lifecycle'
import { trpcClient } from './trpc'

export { primeSubscriptionCache } from './subscription-lifecycle'

/** 订阅状态 */
export interface SubscriptionState<T> {
  data: T | undefined
  isLoading: boolean
  error: Error | null
}

/** Opt-in projection event; stale display never enters the browser cache or grants operation authority. */
export type ReactiveProjectionEvent<T> =
  | { type: 'recompute-started' }
  | { type: 'display-stale'; data: T }
  | { type: 'data'; data: T }

/** Subscription state that distinguishes initial loading from dependency-driven recomputation. */
export interface ReactiveProjectionSubscriptionState<T> extends SubscriptionState<T> {
  isUpdating: boolean
}

/** Explicit progress emitted by a bounded Projection Work batch stream. */
export interface ProjectionWorkProgress {
  completed: number
  total: number | 'unknown'
}

/** Changes-specific state retains partial rows and row-level failures during progressive delivery. */
export interface ChangesSubscriptionState extends SubscriptionState<ChangeMeta[]> {
  isUpdating: boolean
  rowErrors: ChangeProjectionRowError[]
  progress: ProjectionWorkProgress | null
}

/** Canonical live Work identity needed to prevent cached rows from two Planning-root generations merging. */
interface ChangeProjectionWorkIdentity {
  projectionKind: string
  planningRoot: {
    identity: string
    source: string
    storeSelector: string | null
  }
  owner: {
    generation: string | null
    gitBindingToken: string | null
  }
  selector: string
  inputFingerprint: string
  protocolVersion: number
}

function changeProjectionWorkIdentityKey(identity: ChangeProjectionWorkIdentity): string {
  return JSON.stringify([
    identity.projectionKind,
    identity.planningRoot.identity,
    identity.planningRoot.source,
    identity.planningRoot.storeSelector,
    identity.owner.generation,
    identity.owner.gitBindingToken,
    identity.selector,
    identity.inputFingerprint,
    identity.protocolVersion,
  ])
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

interface ReactiveProjectionSubscriptionCallbacks<T> {
  onEvent: (event: ReactiveProjectionEvent<T>) => void
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
  const ordinaryCacheKey = cacheKey || undefined
  const lifecycleOwnerRef = useRef<SubscriptionLifecycleOwner | null>(null)
  if (lifecycleOwnerRef.current === null) {
    lifecycleOwnerRef.current = new SubscriptionLifecycleOwner()
  }
  const initialSnapshot = lifecycleOwnerRef.current.snapshot<T>(ordinaryCacheKey)
  const [state, setState] = useState<SubscriptionState<T>>(() => {
    if (initialSnapshot.hasCached) {
      return {
        data: initialSnapshot.data,
        isLoading: cacheRebindPolicy === 'loading',
        error: null,
      }
    }
    return { data: undefined, isLoading: true, error: null }
  })

  const inStaticMode = isStaticMode()

  useEffect(() => {
    const generation = lifecycleOwnerRef.current?.begin()
    if (!generation) return

    // Use cached data if available, otherwise mark as loading
    const snapshot = generation.snapshot<T>(ordinaryCacheKey)
    if (snapshot.hasCached) {
      setState({
        data: snapshot.data,
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
            generation.publishData(ordinaryCacheKey, data, () => {
              setState({ data, isLoading: false, error: null })
            })
          })
          .catch((cause: unknown) => {
            const error = cause instanceof Error ? cause : new Error(String(cause))
            generation.publish(() => {
              console.error('Static data loading error:', error)
              setState((prev) => ({ ...prev, isLoading: false, error }))
            })
          })
      } else {
        console.warn('No static loader provided for subscription in static mode')
        generation.publish(() => {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: new Error('Static loader not available'),
          }))
        })
      }
      return () => generation.retire()
    }

    // 动态模式：创建 WebSocket 订阅
    const subscription = subscribe({
      onData: (data) => {
        generation.publishData(ordinaryCacheKey, data, () => {
          setState({ data, isLoading: false, error: null })
        })
      },
      onError: (error) => {
        generation.publish(() => {
          console.error('Subscription error:', error)
          setState((prev) => ({ ...prev, isLoading: false, error }))
        })
      },
    })
    generation.attach(subscription)

    return () => generation.retire()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inStaticMode, ...deps])

  return state
}

/**
 * Subscribe to an opt-in reactive projection lifecycle.
 *
 * Only `recompute-started` enters Updating. Initial/static loading and transport lifecycle are separate
 * facts. Each effect generation owns its callbacks and cache writes, so retired work cannot publish.
 */
export function useReactiveProjectionSubscription<T>(
  subscribe: (callbacks: ReactiveProjectionSubscriptionCallbacks<T>) => Unsubscribable,
  staticLoader?: () => Promise<T>,
  deps: unknown[] = [],
  cacheKey?: string
): ReactiveProjectionSubscriptionState<T> {
  const lifecycleOwnerRef = useRef<SubscriptionLifecycleOwner | null>(null)
  if (lifecycleOwnerRef.current === null) {
    lifecycleOwnerRef.current = new SubscriptionLifecycleOwner()
  }
  const initialSnapshot = lifecycleOwnerRef.current.snapshot<T>(cacheKey)
  const [state, setState] = useState<ReactiveProjectionSubscriptionState<T>>(() => ({
    data: initialSnapshot.data,
    isLoading: !initialSnapshot.hasCached,
    isUpdating: false,
    error: null,
  }))
  const inStaticMode = isStaticMode()

  useEffect(() => {
    const generation = lifecycleOwnerRef.current?.begin()
    if (!generation) return
    const snapshot = generation.snapshot<T>(cacheKey)
    setState({
      data: snapshot.data,
      isLoading: !snapshot.hasCached,
      isUpdating: false,
      error: null,
    })

    if (inStaticMode) {
      if (!staticLoader) {
        generation.publish(() => {
          setState({
            data: snapshot.data,
            isLoading: false,
            isUpdating: false,
            error: new Error('Static loader not available'),
          })
        })
        return () => generation.retire()
      }
      staticLoader()
        .then((data) => {
          generation.publishData(cacheKey, data, () => {
            setState({ data, isLoading: false, isUpdating: false, error: null })
          })
        })
        .catch((cause: unknown) => {
          const error = cause instanceof Error ? cause : new Error(String(cause))
          generation.publish(() => {
            setState((previous) => ({
              ...previous,
              isLoading: false,
              isUpdating: false,
              error,
            }))
          })
        })
      return () => generation.retire()
    }

    const subscription = subscribe({
      onEvent(event) {
        if (event.type === 'recompute-started') {
          generation.publish(() => {
            setState((previous) => ({
              ...previous,
              isLoading: false,
              isUpdating: true,
              error: null,
            }))
          })
          return
        }
        if (event.type === 'display-stale') {
          generation.publish(() => {
            setState({
              data: event.data,
              isLoading: false,
              isUpdating: true,
              error: null,
            })
          })
          return
        }
        generation.publishData(cacheKey, event.data, () => {
          setState({
            data: event.data,
            isLoading: false,
            isUpdating: false,
            error: null,
          })
        })
      },
      onError(error) {
        generation.publish(() => {
          setState((previous) => ({
            ...previous,
            isLoading: false,
            isUpdating: false,
            error,
          }))
        })
      },
    })
    generation.attach(subscription)
    return () => generation.retire()
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
  const lifecycleOwnerRef = useRef<SubscriptionLifecycleOwner | null>(null)
  if (lifecycleOwnerRef.current === null) {
    lifecycleOwnerRef.current = new SubscriptionLifecycleOwner()
  }
  const initialSnapshot = lifecycleOwnerRef.current.snapshot<T>(cacheKey)
  const [state, setState] = useState<AuthoritativeSubscriptionState<T>>(() => ({
    data: initialSnapshot.data,
    isLoading: true,
    error: null,
    authority: { state: 'waiting', reason: initialSnapshot.hasCached ? 'rebind' : 'initial' },
  }))
  const inStaticMode = isStaticMode()

  useEffect(() => {
    const generation = lifecycleOwnerRef.current?.begin()
    if (!generation) return
    let terminalError: Error | null = null
    let terminal = false
    const snapshot = generation.snapshot<T>(cacheKey)
    setState({
      data: snapshot.data,
      isLoading: true,
      error: null,
      authority: { state: 'waiting', reason: snapshot.hasCached ? 'rebind' : 'initial' },
    })

    if (inStaticMode) {
      if (!staticLoader) {
        const error = new Error('Static loader not available')
        generation.publish(() => {
          setState((previous) => ({
            ...previous,
            isLoading: false,
            error,
            authority: { state: 'failed', error },
          }))
        })
        return () => generation.retire()
      }
      staticLoader()
        .then((data) => {
          generation.publishData(cacheKey, data, () => {
            setState({ data, isLoading: false, error: null, authority: { state: 'current' } })
          })
        })
        .catch((cause: unknown) => {
          const error = cause instanceof Error ? cause : new Error(String(cause))
          generation.publish(() => {
            setState((previous) => ({
              ...previous,
              isLoading: false,
              error,
              authority: { state: 'failed', error },
            }))
          })
        })
      return () => generation.retire()
    }

    const subscription = subscribe({
      onData(data) {
        generation.publishData(cacheKey, data, () => {
          terminal = false
          terminalError = null
          setState({ data, isLoading: false, error: null, authority: { state: 'current' } })
        })
      },
      onError(error) {
        generation.publish(() => {
          terminalError = error
          setState((previous) => ({
            ...previous,
            isLoading: false,
            error,
            authority: { state: 'failed', error },
          }))
        })
      },
      onConnectionStateChange(connection) {
        if (terminal || terminalError) return
        generation.publish(() => {
          setState((previous) => ({
            ...previous,
            // A transport reconnect over already-readable content must not relabel it as initial-loading
            // (the pervasive-Loading root cause). Retained data stays readable/copyable; only authority is
            // revoked so current-dependent mutations stay locked until a matching current payload commits.
            // When no readable content exists yet, the initial-loading surface must remain visible.
            isLoading: previous.data === undefined,
            error: connection.error ?? terminalError,
            authority: { state: 'waiting', reason: connection.state },
          }))
        })
      },
      onStopped() {
        generation.publish(() => {
          terminal = true
          setState((previous) =>
            terminalError
              ? {
                  ...previous,
                  isLoading: false,
                  error: terminalError,
                  authority: { state: 'failed', error: terminalError },
                }
              : {
                  ...previous,
                  isLoading: previous.data === undefined,
                  authority: { state: 'waiting', reason: 'idle' },
                }
          )
        })
      },
      onComplete() {
        generation.publish(() => {
          terminal = true
          setState((previous) =>
            terminalError
              ? {
                  ...previous,
                  isLoading: false,
                  error: terminalError,
                  authority: { state: 'failed', error: terminalError },
                }
              : {
                  ...previous,
                  isLoading: previous.data === undefined,
                  authority: { state: 'waiting', reason: 'idle' },
                }
          )
        })
      },
    })
    generation.attach(subscription)
    return () => generation.retire()
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

export function useChangesSubscription(): ChangesSubscriptionState {
  const lifecycleOwnerRef = useRef<SubscriptionLifecycleOwner | null>(null)
  if (lifecycleOwnerRef.current === null) {
    lifecycleOwnerRef.current = new SubscriptionLifecycleOwner()
  }
  const cacheKey = 'change.subscribe'
  const initialSnapshot = lifecycleOwnerRef.current.snapshot<ChangeMeta[]>(cacheKey)
  const [state, setState] = useState<ChangesSubscriptionState>(() => ({
    data: initialSnapshot.data,
    isLoading: !initialSnapshot.hasCached,
    isUpdating: false,
    error: null,
    rowErrors: [],
    progress: null,
  }))
  const inStaticMode = isStaticMode()

  useEffect(() => {
    const generation = lifecycleOwnerRef.current?.begin()
    if (!generation) return
    const snapshot = generation.snapshot<ChangeMeta[]>(cacheKey)
    let rows = snapshot.data ?? []
    let rowErrors: ChangeProjectionRowError[] = []
    let workIdentityKey: string | null = null

    generation.publish(() => {
      setState({
        data: rows.length > 0 ? rows : snapshot.data,
        isLoading: !snapshot.hasCached,
        isUpdating: false,
        error: null,
        rowErrors,
        progress: null,
      })
    })

    const publishRows = (
      nextRows: ChangeMeta[],
      nextErrors: ChangeProjectionRowError[],
      progress: ProjectionWorkProgress | null,
      options: { cache: boolean; isUpdating: boolean },
      error: Error | null = null
    ) => {
      rows = nextRows
      rowErrors = nextErrors
      const publish = () => {
        setState({
          data: rows,
          isLoading: false,
          isUpdating: options.isUpdating,
          error,
          rowErrors,
          progress,
        })
      }
      if (options.cache) generation.publishData(cacheKey, rows, publish)
      else generation.publish(publish)
    }

    if (inStaticMode) {
      StaticProvider.getChanges()
        .then((data) => publishRows(data, [], null, { cache: true, isUpdating: false }))
        .catch((cause: unknown) => {
          const error = cause instanceof Error ? cause : new Error(String(cause))
          generation.publish(() => {
            setState((previous) => ({ ...previous, isLoading: false, isUpdating: false, error }))
          })
        })
      return () => generation.retire()
    }

    const subscription = trpcClient.change.subscribeBatches.subscribe(undefined, {
      onData(event) {
        if (event.type === 'batch') {
          const nextWorkIdentityKey = changeProjectionWorkIdentityKey(event.identity)
          if (workIdentityKey !== nextWorkIdentityKey) {
            rows = []
            rowErrors = []
            workIdentityKey = nextWorkIdentityKey
          }
          const byId = new Map(rows.map((row) => [row.id, row] as const))
          for (const row of event.batch.rows) byId.set(row.id, row)
          const errorsById = new Map(rowErrors.map((item) => [item.changeId, item] as const))
          for (const item of event.batch.errors) errorsById.set(item.changeId, item)
          publishRows([...byId.values()], [...errorsById.values()], event.progress, {
            cache: true,
            isUpdating: true,
          })
          return
        }
        if (event.type === 'snapshot' || event.type === 'complete') {
          workIdentityKey = changeProjectionWorkIdentityKey(event.snapshot.identity)
          publishRows(event.snapshot.data.rows, event.snapshot.data.errors, null, {
            cache: event.snapshot.freshness === 'current',
            isUpdating: event.snapshot.freshness === 'stale-display-only',
          })
          return
        }
        if (event.type === 'failed') {
          const retainedSnapshot = event.retainedSnapshot
          const error = event.error instanceof Error ? event.error : new Error(String(event.error))
          if (retainedSnapshot) {
            const retained = retainedSnapshot.data
            rows = retained.rows
            rowErrors = retained.errors
            workIdentityKey = changeProjectionWorkIdentityKey(retainedSnapshot.identity)
          }
          generation.publish(() => {
            setState((previous) => ({
              ...previous,
              data: rows,
              isLoading: false,
              isUpdating: false,
              error,
              rowErrors,
            }))
          })
        }
      },
      onError(error) {
        generation.publish(() => {
          setState((previous) => ({ ...previous, isLoading: false, isUpdating: false, error }))
        })
      },
    })
    generation.attach(subscription)
    return () => generation.retire()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inStaticMode])

  return state
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

/** Subscribe to Archive rows with explicit dependency-driven recompute state in live mode. */
export function useArchivesSubscription(): ReactiveProjectionSubscriptionState<ArchiveMeta[]> {
  return useReactiveProjectionSubscription<ArchiveMeta[]>(
    (callbacks) =>
      trpcClient.archive.subscribe.subscribe(undefined, {
        onData: callbacks.onEvent,
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
