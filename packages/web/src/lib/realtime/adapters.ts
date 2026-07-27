/**
 * Orthogonal intents (created 2026-07-24 Asia/Shanghai):
 * 1. Adapt the ordinary `SubscriptionState` into the realtime projection input.
 * 2. Adapt the reactive `ReactiveProjectionSubscriptionState` and authoritative states.
 * 3. Adapt React Query fetch state (Git surfaces) without importing the query client types.
 *
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢……页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 * Reviewer replan (2026-07-24): adapters are transport-agnostic. Under v1 they read the five signals the
 * existing hooks already emit; after P1 the adapter input source upgrades to v2 token+pull but this output
 * contract is unchanged, so atoms/routes need no change.
 *
 * Compromise: adapters only normalize existing signals. They must not invent a second truth source, optimistic
 * business-data writes, or a client-selected root/store identity.
 */
import type { SubscriptionAuthority, SubscriptionState } from '../use-subscription'

import {
  deriveProjectionState,
  type RealtimeProjectionCause,
  type RealtimeProjectionEmptyPredicate,
  type RealtimeProjectionInput,
  type RealtimeProjectionProgress,
  type RealtimeProjectionState,
} from './state'

/** Map an authoritative subscription's waiting reason to the realtime cause. */
export function authorityReasonToCause(
  reason: 'initial' | 'rebind' | 'idle' | 'connecting' | 'pending'
): RealtimeProjectionCause {
  switch (reason) {
    case 'initial':
      return 'initial'
    case 'rebind':
      return 'root-rebind'
    case 'idle':
    case 'connecting':
    case 'pending':
      return 'reconnect'
  }
}

/** Derive the realtime authority from the authoritative subscription's authority state. */
export function deriveAuthority(authority: SubscriptionAuthority): 'current' | 'display-only' {
  return authority.state === 'current' ? 'current' : 'display-only'
}

/**
 * Adapt an ordinary subscription state. The ordinary hook keeps cached data authoritative by default, so
 * authority is `current` once data arrives and `display-only` only while the first payload is pending.
 */
export function fromSubscriptionState<T>(
  state: SubscriptionState<T>,
  options: { isEmpty?: RealtimeProjectionEmptyPredicate<T> } = {}
): RealtimeProjectionState<T> {
  const hasContent = state.data !== undefined
  const input: RealtimeProjectionInput<T> = {
    data: state.data,
    isLoading: state.isLoading,
    isUpdating: false,
    error: state.error,
    authority: hasContent && !state.isLoading ? 'current' : 'display-only',
    cause: hasContent ? (state.isLoading ? 'reconnect' : 'initial') : 'initial',
    progress: null,
  }
  return deriveProjectionState(input, options)
}

/**
 * Adapt a reactive projection subscription state. `isUpdating` distinguishes a background recompute over
 * readable content from the first load.
 */
export function fromReactiveProjectionState<T>(
  state: SubscriptionState<T> & { isUpdating: boolean },
  options: { isEmpty?: RealtimeProjectionEmptyPredicate<T> } = {}
): RealtimeProjectionState<T> {
  const hasContent = state.data !== undefined
  const input: RealtimeProjectionInput<T> = {
    data: state.data,
    isLoading: state.isLoading,
    isUpdating: state.isUpdating,
    error: state.error,
    authority: hasContent && !state.isLoading && !state.isUpdating ? 'current' : 'display-only',
    cause: state.isUpdating
      ? 'server-push'
      : hasContent && state.isLoading
        ? 'reconnect'
        : 'initial',
    progress: null,
  }
  return deriveProjectionState(input, options)
}

/**
 * Adapt an authoritative subscription state. The authority field is the source of truth for mutation gating;
 * a waiting authority with retained data yields `display-only` (readable, mutations locked).
 */
export function fromAuthoritativeState<T>(
  state: SubscriptionState<T> & { authority: SubscriptionAuthority },
  options: { isEmpty?: RealtimeProjectionEmptyPredicate<T> } = {}
): RealtimeProjectionState<T> {
  const authority = deriveAuthority(state.authority)
  const cause =
    state.authority.state === 'waiting' ? authorityReasonToCause(state.authority.reason) : 'initial'
  const hasContent = state.data !== undefined
  const input: RealtimeProjectionInput<T> = {
    data: state.data,
    isLoading: state.isLoading,
    isUpdating: hasContent && authority === 'display-only' && state.isLoading,
    error: state.error,
    authority,
    cause,
    progress: null,
  }
  return deriveProjectionState(input, options)
}

/**
 * Adapt a Changes progressive subscription. Retains real partial rows, row errors, and known/unknown progress.
 */
export function fromChangesState<T>(
  state: SubscriptionState<T> & {
    isUpdating: boolean
    rowErrors?: unknown[]
    progress?: ProjectionWorkProgressLike | null
  },
  options: { isEmpty?: RealtimeProjectionEmptyPredicate<T> } = {}
): RealtimeProjectionState<T> {
  const progress = normalizeProgress(state.progress ?? null)
  const hasContent = state.data !== undefined
  const input: RealtimeProjectionInput<T> = {
    data: state.data,
    isLoading: state.isLoading,
    isUpdating: state.isUpdating,
    error: state.error,
    authority: hasContent && !state.isLoading && !state.isUpdating ? 'current' : 'display-only',
    cause: state.isUpdating
      ? 'server-push'
      : hasContent && state.isLoading
        ? 'reconnect'
        : 'initial',
    progress,
  }
  return deriveProjectionState(input, options)
}

/** Structural shape of progress fields across the codebase (core ProjectionWorkProgress mirrors this). */
interface ProjectionWorkProgressLike {
  completed: number
  total: number | 'unknown'
}

function normalizeProgress(
  progress: ProjectionWorkProgressLike | null
): RealtimeProjectionProgress | null {
  if (progress === null) return null
  return { completed: progress.completed, total: progress.total }
}

/**
 * Adapt a React Query fetch state. Git surfaces use the query client rather than the subscription primitive.
 * `isFetching` over readable content maps to a reconnect-style revalidation; `isPending` without data is the
 * initial load. This keeps Git token authority and reconnect locks intact without importing query-client types.
 */
export function fromQueryState<TData>(
  data: TData | undefined,
  query: {
    isPending: boolean
    isFetching: boolean
    isError: boolean
    error: Error | null
  },
  options: { isEmpty?: RealtimeProjectionEmptyPredicate<TData> } = {}
): RealtimeProjectionState<TData> {
  const hasContent = data !== undefined
  const isLoading = !hasContent && (query.isPending || query.isFetching)
  const isUpdating = hasContent && query.isFetching
  const error = query.isError ? query.error : null
  const input: RealtimeProjectionInput<TData> = {
    data,
    isLoading,
    isUpdating,
    error,
    authority: hasContent && !isUpdating ? 'current' : 'display-only',
    cause: isUpdating ? 'user-action' : hasContent ? 'initial' : 'initial',
    progress: null,
  }
  return deriveProjectionState(input, options)
}
