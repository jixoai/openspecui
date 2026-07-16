/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Verify identity-only invalidations trigger an authoritative Store pull.
 * 2. Verify the pushed token payload is never rendered as Store projection data.
 *
 * Original request (2026-07-15): "Push 通知变更，然后让多端基于订阅拉取更新。"
 */
import type { StoreFeatureResult, StoreListEntry } from '@openspecui/core/store-types'
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const modeState = vi.hoisted(() => ({ staticMode: false }))
const listQueryMock = vi.hoisted(() => vi.fn())
const runtimeSubscribeMock = vi.hoisted(() => vi.fn())
const handlersRef = vi.hoisted(() => ({
  current: null as {
    onData: (tokens: unknown) => void
    onError: (error: Error) => void
  } | null,
}))

vi.mock('./static-mode', () => ({
  isStaticMode: () => modeState.staticMode,
}))

vi.mock('./trpc', () => ({
  trpcClient: {
    stores: {
      list: { query: listQueryMock },
    },
    runtimeInvalidation: {
      subscribe: {
        subscribe: runtimeSubscribeMock,
      },
    },
  },
}))

function storeResult(id: string): StoreFeatureResult<StoreListEntry[]> {
  return {
    available: true,
    stores: [{ id, root: `/stores/${id}` }],
    evidence: null,
  }
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

describe('useStoresSubscription', () => {
  afterEach(() => {
    modeState.staticMode = false
    handlersRef.current = null
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('pulls Store truth after identity-only invalidation tokens', async () => {
    const first = storeResult('first')
    const second = storeResult('second')
    listQueryMock.mockResolvedValueOnce(first).mockResolvedValueOnce(second)
    const unsubscribe = vi.fn()
    runtimeSubscribeMock.mockImplementation(
      (
        input: { facets: string[] },
        handlers: {
          onData: (tokens: unknown) => void
          onError: (error: Error) => void
        }
      ) => {
        expect(input).toEqual({ facets: ['stores'] })
        handlersRef.current = handlers
        return { unsubscribe }
      }
    )

    const { useStoresSubscription } = await import('./use-subscription')
    const { result, unmount } = renderHook(() => useStoresSubscription())

    await waitFor(() => expect(result.current.data).toEqual(first))
    expect(result.current.data).not.toEqual({ facet: 'stores', generation: 1 })

    handlersRef.current?.onData([{ facet: 'stores', generation: 1 }])
    await waitFor(() => expect(result.current.data).toEqual(second))
    expect(listQueryMock).toHaveBeenCalledTimes(2)

    unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('keeps the newest Store pull when duplicate tokens race', async () => {
    const initial = storeResult('initial')
    const stale = storeResult('stale')
    const current = storeResult('current')
    const stalePull = deferred<StoreFeatureResult<StoreListEntry[]>>()
    const currentPull = deferred<StoreFeatureResult<StoreListEntry[]>>()
    listQueryMock
      .mockResolvedValueOnce(initial)
      .mockReturnValueOnce(stalePull.promise)
      .mockReturnValueOnce(currentPull.promise)
    runtimeSubscribeMock.mockImplementation(
      (
        _input: { facets: string[] },
        handlers: {
          onData: (tokens: unknown) => void
          onError: (error: Error) => void
        }
      ) => {
        handlersRef.current = handlers
        return { unsubscribe: vi.fn() }
      }
    )

    const { useStoresSubscription } = await import('./use-subscription')
    const { result } = renderHook(() => useStoresSubscription())
    await waitFor(() => expect(result.current.data).toEqual(initial))

    handlersRef.current?.onData([{ facet: 'stores', generation: 1 }])
    handlersRef.current?.onData([{ facet: 'stores', generation: 2 }])
    await waitFor(() => expect(listQueryMock).toHaveBeenCalledTimes(3))
    currentPull.resolve(current)
    await waitFor(() => expect(result.current.data).toEqual(current))
    stalePull.resolve(stale)
    await waitFor(() => expect(result.current.data).toEqual(current))
  })
})
