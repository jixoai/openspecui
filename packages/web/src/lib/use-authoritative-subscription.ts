/**
 * Orthogonal intents (created 2026-07-26 Asia/Shanghai):
 * 1. Retain renderable cached data across transport and projection replacement.
 * 2. Keep current mutation authority independent from readable stale content.
 * 3. Retire late callbacks and cache writes at each React effect generation.
 * 4. Preserve equivalent static-loader settlement without live transport claims.
 *
 * Original request (2026-07-26): "即便现在有正在的任务，界面上仍然可以读到缓存。"
 */
import { useEffect, useRef, useState } from 'react'
import { isStaticMode } from './static-mode'
import { SubscriptionLifecycleOwner } from './subscription-lifecycle'
import type { SubscriptionState } from './use-subscription'

/** Explicit authority for projections whose cached data must never authorize live operations. */
export type SubscriptionAuthority =
  | { state: 'waiting'; reason: 'initial' | 'rebind' | 'idle' | 'connecting' | 'pending' }
  | { state: 'current' }
  | { state: 'failed'; error: Error }

/** Subscription state whose operation authority is independent from loading presentation. */
export interface AuthoritativeSubscriptionState<T> extends SubscriptionState<T> {
  authority: SubscriptionAuthority
}

/** Transport lifecycle projected by a typed subscription observer. */
export interface SubscriptionConnectionState {
  state: 'idle' | 'connecting' | 'pending'
  error: Error | null
}

/** Callbacks for a projection that revokes authority on transport lifecycle changes. */
export interface AuthoritativeSubscriptionCallbacks<T> {
  onData: (data: T) => void
  onStaleData: (data: T, error?: Error) => void
  onError: (error: Error) => void
  onConnectionStateChange: (state: SubscriptionConnectionState) => void
  onStopped: () => void
  onComplete: () => void
}

interface Unsubscribable {
  unsubscribe(): void
}

/** Subscribe with cached display continuity and explicit transport/current authority. */
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
      onStaleData(data, error) {
        generation.publishData(cacheKey, data, () => {
          terminal = false
          terminalError = error ?? null
          setState({
            data,
            isLoading: false,
            error: error ?? null,
            authority: error ? { state: 'failed', error } : { state: 'waiting', reason: 'pending' },
          })
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
