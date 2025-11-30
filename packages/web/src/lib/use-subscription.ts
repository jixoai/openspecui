import { useState, useEffect, useRef } from 'react'
import { trpcClient } from './trpc'
import type { Spec, Change, SpecMeta, ChangeMeta, ArchiveMeta } from '@openspecui/core'

/** 订阅状态 */
export interface SubscriptionState<T> {
  data: T | undefined
  isLoading: boolean
  error: Error | null
}

/** Dashboard 数据类型 */
export interface DashboardData {
  specs: Spec[]
  changes: Change[]
  archivedCount: number
  summary: {
    specCount: number
    requirementCount: number
    activeChangeCount: number
    archivedChangeCount: number
    totalTasks: number
    completedTasks: number
    progressPercent: number
  }
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

/**
 * 通用订阅 Hook
 *
 * 替代 useQuery，直接从 WebSocket 获取数据。
 * 当订阅的数据变更时，自动更新组件。
 *
 * @param subscribe 订阅函数
 * @param deps 依赖数组
 */
export function useSubscription<T>(
  subscribe: (callbacks: SubscriptionCallbacks<T>) => Unsubscribable,
  deps: unknown[] = []
): SubscriptionState<T> {
  const [state, setState] = useState<SubscriptionState<T>>({
    data: undefined,
    isLoading: true,
    error: null,
  })

  const subscriptionRef = useRef<Unsubscribable | null>(null)

  useEffect(() => {
    // 清理之前的订阅
    subscriptionRef.current?.unsubscribe()

    // 重置状态
    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    // 创建新订阅
    const subscription = subscribe({
      onData: (data) => {
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
  }, deps)

  return state
}

// =====================
// Dashboard subscriptions
// =====================

export function useDashboardSubscription(): SubscriptionState<DashboardData> {
  return useSubscription<DashboardData>(
    (callbacks) =>
      trpcClient.dashboard.subscribe.subscribe(undefined, {
        onData: callbacks.onData,
        onError: callbacks.onError,
      }),
    []
  )
}

export function useInitializedSubscription(): SubscriptionState<boolean> {
  return useSubscription<boolean>(
    (callbacks) =>
      trpcClient.dashboard.subscribeInitialized.subscribe(undefined, {
        onData: callbacks.onData,
        onError: callbacks.onError,
      }),
    []
  )
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
    []
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
    [id]
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
    [id]
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
    []
  )
}

export function useChangeSubscription(id: string): SubscriptionState<Change | null> {
  return useSubscription<Change | null>(
    (callbacks) =>
      trpcClient.change.subscribeOne.subscribe(
        { id },
        {
          onData: callbacks.onData,
          onError: callbacks.onError,
        }
      ),
    [id]
  )
}

/** Change 原始文件内容 */
export interface ChangeRaw {
  proposal: string
  tasks?: string
}

export function useChangeRawSubscription(id: string): SubscriptionState<ChangeRaw | null> {
  return useSubscription<ChangeRaw | null>(
    (callbacks) =>
      trpcClient.change.subscribeRaw.subscribe(
        { id },
        {
          onData: callbacks.onData,
          onError: callbacks.onError,
        }
      ),
    [id]
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
    []
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
    [id]
  )
}

// =====================
// Project subscriptions
// =====================

export function useProjectMdSubscription(): SubscriptionState<string | null> {
  return useSubscription<string | null>(
    (callbacks) =>
      trpcClient.project.subscribeProjectMd.subscribe(undefined, {
        onData: callbacks.onData,
        onError: callbacks.onError,
      }),
    []
  )
}

export function useAgentsMdSubscription(): SubscriptionState<string | null> {
  return useSubscription<string | null>(
    (callbacks) =>
      trpcClient.project.subscribeAgentsMd.subscribe(undefined, {
        onData: callbacks.onData,
        onError: callbacks.onError,
      }),
    []
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
    []
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
    []
  )
}
