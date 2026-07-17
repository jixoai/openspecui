/**
 * Orthogonal intents (created 2026-07-18 Asia/Shanghai):
 * 1. Verify Environment Global refresh rebinds the subscription before releasing its lock.
 * 2. Verify repeated refresh requests share one in-flight completion.
 * 3. Verify terminal subscription errors release pending state while keeping writes unavailable.
 *
 * Original request (2026-07-18): "Refresh locking must span the asynchronous subscription rebind."
 */
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEnvironmentGlobalConfigSubscription } from './use-planning-config'

interface SubscriptionCallbacks {
  onData: (data: null) => void
  onError: (error: Error) => void
}

const { subscribeMock } = vi.hoisted(() => ({ subscribeMock: vi.fn() }))

vi.mock('./static-mode', () => ({ isStaticMode: () => false }))
vi.mock('./trpc', () => ({
  trpcClient: {
    planningConfig: {
      subscribeEnvironmentGlobal: { subscribe: subscribeMock },
    },
  },
}))

describe('useEnvironmentGlobalConfigSubscription', () => {
  const subscriptions: SubscriptionCallbacks[] = []

  beforeEach(() => {
    subscriptions.length = 0
    subscribeMock
      .mockReset()
      .mockImplementation((_input: undefined, callbacks: SubscriptionCallbacks) => {
        subscriptions.push(callbacks)
        return { unsubscribe: vi.fn() }
      })
  })

  afterEach(() => cleanup())

  it('holds refreshPending until the replacement subscription emits data', async () => {
    const { result } = renderHook(() => useEnvironmentGlobalConfigSubscription())
    await waitFor(() => expect(subscribeMock).toHaveBeenCalledTimes(1))

    act(() => subscriptions[0]?.onData(null))
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    let firstRefresh!: Promise<void>
    act(() => {
      firstRefresh = result.current.refresh()
    })
    expect(result.current.refreshPending).toBe(true)

    await waitFor(() => expect(subscribeMock).toHaveBeenCalledTimes(2))
    expect(result.current.refreshPending).toBe(true)

    let secondRefresh!: Promise<void>
    act(() => {
      secondRefresh = result.current.refresh()
    })
    expect(secondRefresh).toBe(firstRefresh)

    act(() => subscriptions[1]?.onData(null))
    await expect(firstRefresh).resolves.toBeUndefined()
    await waitFor(() => expect(result.current.refreshPending).toBe(false))
  })

  it('ends the pending window on a terminal subscription error and preserves the error lock', async () => {
    const { result } = renderHook(() => useEnvironmentGlobalConfigSubscription())
    await waitFor(() => expect(subscribeMock).toHaveBeenCalledTimes(1))
    act(() => subscriptions[0]?.onData(null))

    let refreshPromise!: Promise<void>
    act(() => {
      refreshPromise = result.current.refresh()
    })
    await waitFor(() => expect(subscribeMock).toHaveBeenCalledTimes(2))

    const error = new Error('global config subscription failed')
    act(() => subscriptions[1]?.onError(error))
    await expect(refreshPromise).resolves.toBeUndefined()
    await waitFor(() => {
      expect(result.current.refreshPending).toBe(false)
      expect(result.current.error).toBe(error)
      expect(result.current.isLoading).toBe(false)
    })
  })
})
