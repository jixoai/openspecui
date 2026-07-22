/**
 * Orthogonal intents (updated 2026-07-23 Asia/Shanghai):
 * 1. Prove cached subscription data is display-only while a reconnect is pending.
 * 2. Preserve the loading gate until the replacement projection arrives.
 * 3. Prove direct unmount retires a pending static loader before it can write cache.
 * 4. Prove Archive projection recompute events retain data without impersonating transport loading.
 * 5. Prove the shared lifecycle owner retires ordinary, reactive, and authoritative generations.
 *
 * Original request (2026-07-19): "代码已经提交，开始review。如果有问题，那么可更新change。"
 * Owner report (2026-07-22): "整个过程中，几乎都在 Loading。"
 */
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  primeSubscriptionCache,
  type ReactiveProjectionEvent,
  useAuthoritativeSubscription,
  useReactiveProjectionSubscription,
  useSubscription,
} from './use-subscription'

const { staticModeMock } = vi.hoisted(() => ({ staticModeMock: vi.fn(() => false) }))

type StringProjectionCallbacks = {
  onEvent(event: ReactiveProjectionEvent<string>): void
  onError(error: Error): void
}

type StringSubscriptionCallbacks = {
  onData(data: string): void
  onError(error: Error): void
}

vi.mock('./static-mode', () => ({
  isStaticMode: staticModeMock,
}))

describe('useSubscription cache rebind', () => {
  beforeEach(() => {
    staticModeMock.mockReturnValue(false)
  })

  it('retires every old generation callback and keeps the cache on A until B emits', () => {
    type Callbacks = {
      onData(value: string): void
      onError(error: Error): void
      onConnectionStateChange(state: {
        state: 'idle' | 'connecting' | 'pending'
        error: Error | null
      }): void
      onStopped(): void
      onComplete(): void
    }
    const callbacks: Callbacks[] = []
    const subscribe = vi.fn((next: Callbacks) => {
      callbacks.push(next)
      return { unsubscribe: vi.fn() }
    })
    primeSubscriptionCache('authoritative-generation-test', 'A')
    let dependency = 0

    const { result, rerender } = renderHook(() =>
      useAuthoritativeSubscription(
        (next) => subscribe(next),
        undefined,
        [dependency],
        'authoritative-generation-test'
      )
    )

    act(() => callbacks[0]?.onData('A'))
    dependency = 1
    rerender()

    const oldError = new Error('late old generation')
    act(() => {
      callbacks[0]?.onData('stale')
      callbacks[0]?.onError(oldError)
      callbacks[0]?.onConnectionStateChange({ state: 'connecting', error: null })
      callbacks[0]?.onStopped()
      callbacks[0]?.onComplete()
    })
    expect(result.current).toMatchObject({
      data: 'A',
      isLoading: true,
      error: null,
      authority: { state: 'waiting', reason: 'rebind' },
    })

    dependency = 2
    rerender()
    expect(result.current.data).toBe('A')

    act(() => callbacks[2]?.onData('B'))
    expect(result.current).toMatchObject({
      data: 'B',
      isLoading: false,
      error: null,
      authority: { state: 'current' },
    })
    act(() => callbacks[0]?.onData('late-after-B'))
    expect(result.current.data).toBe('B')
  })

  it('keeps terminal error evidence visible across later transport states', () => {
    type Callbacks = {
      onData(value: string): void
      onError(error: Error): void
      onConnectionStateChange(state: {
        state: 'idle' | 'connecting' | 'pending'
        error: Error | null
      }): void
      onStopped(): void
      onComplete(): void
    }
    let callbacks: Callbacks | undefined
    const subscribe = vi.fn((next: Callbacks) => {
      callbacks = next
      return { unsubscribe: vi.fn() }
    })

    const { result } = renderHook(() =>
      useAuthoritativeSubscription((next) => subscribe(next), undefined, [], 'terminal-error-test')
    )
    const error = new Error('terminal transport failure')
    act(() => callbacks?.onError(error))
    act(() => callbacks?.onConnectionStateChange({ state: 'connecting', error: null }))
    expect(result.current).toMatchObject({
      error,
      isLoading: false,
      authority: { state: 'failed', error },
    })
  })

  it('ignores a static loader completion after its generation is cleaned up', async () => {
    staticModeMock.mockReturnValue(true)
    const loaders: Array<() => void> = []
    const loader = vi.fn(
      () => new Promise<string>((resolve) => loaders.push(() => resolve('stale')))
    )
    let dependency = 0
    const { result, rerender } = renderHook(() =>
      useAuthoritativeSubscription(
        () => ({ unsubscribe: vi.fn() }),
        loader,
        [dependency],
        'static-generation-test'
      )
    )

    dependency = 1
    rerender()
    act(() => loaders[0]?.())
    await Promise.resolve()
    expect(result.current.data).toBeUndefined()
    expect(result.current.authority.state).toBe('waiting')

    dependency = 2
    rerender()
    expect(result.current.data).toBeUndefined()
  })

  it('preserves static loader rejection as failed authority', async () => {
    staticModeMock.mockReturnValue(true)
    const error = new Error('static loader failed')
    const { result } = renderHook(() =>
      useAuthoritativeSubscription(
        () => ({ unsubscribe: vi.fn() }),
        () => Promise.reject(error),
        [],
        'static-loader-rejection-6-11'
      )
    )

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(result.current).toMatchObject({
      data: undefined,
      isLoading: false,
      error,
      authority: { state: 'failed', error },
    })
  })

  it('retires a pending static loader on direct unmount before it can populate cache', async () => {
    staticModeMock.mockReturnValue(true)
    const cacheKey = 'static-direct-unmount-cache-6-11'
    let resolveLoader: ((value: string) => void) | undefined
    const loader = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveLoader = resolve
        })
    )

    const pending = renderHook(() =>
      useAuthoritativeSubscription(() => ({ unsubscribe: vi.fn() }), loader, [], cacheKey)
    )
    expect(pending.result.current.data).toBeUndefined()

    pending.unmount()
    await act(async () => {
      resolveLoader?.('stale-after-unmount')
      await Promise.resolve()
    })

    const reader = renderHook(() =>
      useAuthoritativeSubscription(
        () => ({ unsubscribe: vi.fn() }),
        () => new Promise<string>(() => undefined),
        [],
        cacheKey
      )
    )
    expect(reader.result.current.data).toBeUndefined()
    reader.unmount()
  })

  it('keeps cached A display-only until the reconnect emits B', () => {
    type Callbacks = {
      onData(value: string): void
      onError(error: Error): void
    }
    const callbacks: Callbacks[] = []
    const subscribe = vi.fn((next: Callbacks) => {
      callbacks.push(next)
      return { unsubscribe: vi.fn() }
    })
    primeSubscriptionCache('git-scope-cache-test', 'A')
    let dependency = 0

    const { result, rerender } = renderHook(() =>
      useSubscription(
        (next) => subscribe(next),
        undefined,
        [dependency],
        'git-scope-cache-test',
        'loading'
      )
    )

    expect(result.current.data).toBe('A')
    expect(result.current.isLoading).toBe(true)

    act(() => callbacks[0]?.onData('A'))
    expect(result.current.isLoading).toBe(false)

    dependency = 1
    rerender()
    expect(result.current.data).toBe('A')
    expect(result.current.isLoading).toBe(true)

    act(() => callbacks[1]?.onData('B'))
    expect(result.current).toMatchObject({ data: 'B', isLoading: false, error: null })
  })

  it('retains cached data as authoritative for the default subscription policy', () => {
    const subscribe = vi.fn(
      (_next: { onData(value: string): void; onError(error: Error): void }) => ({
        unsubscribe: vi.fn(),
      })
    )
    primeSubscriptionCache('non-git-cache-test', 'A')

    const { result } = renderHook(() =>
      useSubscription((next) => subscribe(next), undefined, [], 'non-git-cache-test')
    )

    expect(result.current).toMatchObject({ data: 'A', isLoading: false, error: null })
  })

  it('preserves an empty ordinary cache key as uncached across remounts', () => {
    const callbacks: StringSubscriptionCallbacks[] = []
    primeSubscriptionCache('', 'primed-empty-key')
    const mounted = renderHook(() =>
      useSubscription(
        (next) => {
          callbacks.push(next)
          return { unsubscribe: vi.fn() }
        },
        undefined,
        [],
        ''
      )
    )

    expect(mounted.result.current).toEqual({ data: undefined, isLoading: true, error: null })
    act(() => callbacks[0]?.onData('current-but-uncached'))
    expect(mounted.result.current).toEqual({
      data: 'current-but-uncached',
      isLoading: false,
      error: null,
    })
    mounted.unmount()

    const reader = renderHook(() =>
      useSubscription(() => ({ unsubscribe: vi.fn() }), undefined, [], '')
    )
    expect(reader.result.current).toEqual({ data: undefined, isLoading: true, error: null })
    reader.unmount()
  })

  it('rejects late ordinary A live data and errors after B begins without publishing stale cache', () => {
    const callbacks: StringSubscriptionCallbacks[] = []
    const subscriptions = new Map<number, ReturnType<typeof vi.fn>>()
    const subscribe = vi.fn((next: StringSubscriptionCallbacks) => {
      callbacks.push(next)
      const unsubscribe = vi.fn()
      subscriptions.set(callbacks.length - 1, unsubscribe)
      return { unsubscribe }
    })
    const cacheKey = 'ordinary-live-generation-6-16-m'
    let dependency = 0
    const mounted = renderHook(() =>
      useSubscription((next) => subscribe(next), undefined, [dependency], cacheKey)
    )

    act(() => callbacks[0]?.onData('A'))
    expect(mounted.result.current).toMatchObject({ data: 'A', isLoading: false, error: null })

    dependency = 1
    mounted.rerender()
    act(() => callbacks[1]?.onData('B'))
    const lateError = new Error('late ordinary A error')
    act(() => {
      callbacks[0]?.onData('late-A')
      callbacks[0]?.onError(lateError)
    })
    expect(mounted.result.current).toMatchObject({ data: 'B', isLoading: false, error: null })
    expect(subscriptions.get(0)).toHaveBeenCalledOnce()

    mounted.unmount()
    const reader = renderHook(() =>
      useSubscription(() => ({ unsubscribe: vi.fn() }), undefined, [], cacheKey)
    )
    expect(reader.result.current).toMatchObject({ data: 'B', isLoading: false, error: null })
    reader.unmount()
  })

  it('keeps a late ordinary live callback after unmount out of a fresh reader cache', () => {
    const callbacks: StringSubscriptionCallbacks[] = []
    const cacheKey = 'ordinary-live-unmount-cache-6-16-m'
    const mounted = renderHook(() =>
      useSubscription(
        (next) => {
          callbacks.push(next)
          return { unsubscribe: vi.fn() }
        },
        undefined,
        [],
        cacheKey
      )
    )

    mounted.unmount()
    act(() => {
      callbacks[0]?.onData('late-after-unmount')
      callbacks[0]?.onError(new Error('late-after-unmount'))
    })

    const reader = renderHook(() =>
      useSubscription(() => ({ unsubscribe: vi.fn() }), undefined, [], cacheKey)
    )
    expect(reader.result.current).toEqual({ data: undefined, isLoading: true, error: null })
    reader.unmount()
  })

  it('retires an ordinary static A loader before its resolve can publish into B', async () => {
    staticModeMock.mockReturnValue(true)
    type Deferred = {
      resolve(data: string): void
    }
    const loaders: Deferred[] = []
    const loader = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          loaders.push({ resolve })
        })
    )
    const cacheKey = 'ordinary-static-generation-6-16-m'
    let dependency = 0
    const mounted = renderHook(() =>
      useSubscription(() => ({ unsubscribe: vi.fn() }), loader, [dependency], cacheKey)
    )

    dependency = 1
    mounted.rerender()
    await act(async () => {
      loaders[0]?.resolve('late-A')
      await Promise.resolve()
    })
    expect(mounted.result.current).toEqual({ data: undefined, isLoading: true, error: null })

    await act(async () => {
      loaders[1]?.resolve('B')
      await Promise.resolve()
    })
    expect(mounted.result.current).toEqual({ data: 'B', isLoading: false, error: null })

    mounted.unmount()
    const reader = renderHook(() =>
      useSubscription(
        () => ({ unsubscribe: vi.fn() }),
        () => new Promise<string>(() => undefined),
        [],
        cacheKey
      )
    )
    expect(reader.result.current).toEqual({ data: 'B', isLoading: false, error: null })
    reader.unmount()
  })

  it('retires an ordinary static A rejection before it can publish an error into B', async () => {
    staticModeMock.mockReturnValue(true)
    type Deferred = {
      resolve(data: string): void
      reject(error: Error): void
    }
    const loaders: Deferred[] = []
    const loader = vi.fn(
      () =>
        new Promise<string>((resolve, reject) => {
          loaders.push({ resolve, reject })
        })
    )
    let dependency = 0
    const { result, rerender } = renderHook(() =>
      useSubscription(() => ({ unsubscribe: vi.fn() }), loader, [dependency])
    )

    dependency = 1
    rerender()
    const lateError = new Error('late static A rejection')
    await act(async () => {
      loaders[0]?.reject(lateError)
      await Promise.resolve()
    })
    expect(result.current).toEqual({ data: undefined, isLoading: true, error: null })

    await act(async () => {
      loaders[1]?.resolve('B')
      await Promise.resolve()
    })
    expect(result.current).toEqual({ data: 'B', isLoading: false, error: null })
  })
})

describe('useReactiveProjectionSubscription', () => {
  beforeEach(() => {
    staticModeMock.mockReturnValue(false)
  })

  it('distinguishes initial loading from a retained-data recompute', () => {
    let callbacks: StringProjectionCallbacks | undefined
    const subscribe = vi.fn((next: StringProjectionCallbacks) => {
      callbacks = next
      return { unsubscribe: vi.fn() }
    })

    const { result } = renderHook(() =>
      useReactiveProjectionSubscription((next) => subscribe(next))
    )

    expect(result.current).toEqual({
      data: undefined,
      isLoading: true,
      isUpdating: false,
      error: null,
    })

    act(() => callbacks?.onEvent({ type: 'data', data: 'A' }))
    expect(result.current).toEqual({
      data: 'A',
      isLoading: false,
      isUpdating: false,
      error: null,
    })

    act(() => callbacks?.onEvent({ type: 'recompute-started' }))
    expect(result.current).toEqual({
      data: 'A',
      isLoading: false,
      isUpdating: true,
      error: null,
    })

    act(() => callbacks?.onEvent({ type: 'data', data: 'B' }))
    expect(result.current).toEqual({
      data: 'B',
      isLoading: false,
      isUpdating: false,
      error: null,
    })
  })

  it('retains A and the original task error after a failed recompute', () => {
    let callbacks: StringProjectionCallbacks | undefined
    const subscribe = vi.fn((next: StringProjectionCallbacks) => {
      callbacks = next
      return { unsubscribe: vi.fn() }
    })
    const { result } = renderHook(() =>
      useReactiveProjectionSubscription((next) => subscribe(next))
    )
    const error = new Error('replacement failed')

    act(() => callbacks?.onEvent({ type: 'data', data: 'A' }))
    act(() => callbacks?.onEvent({ type: 'recompute-started' }))
    act(() => callbacks?.onError(error))

    expect(result.current).toEqual({
      data: 'A',
      isLoading: false,
      isUpdating: false,
      error,
    })
  })

  it('retires old callbacks before they can mutate state or cache', () => {
    const callbacks: StringProjectionCallbacks[] = []
    const subscribe = vi.fn((next: StringProjectionCallbacks) => {
      callbacks.push(next)
      return { unsubscribe: vi.fn() }
    })
    const cacheKey = 'reactive-projection-generation-test'
    let dependency = 0
    const { result, rerender } = renderHook(() =>
      useReactiveProjectionSubscription(
        (next) => subscribe(next),
        undefined,
        [dependency],
        cacheKey
      )
    )

    act(() => callbacks[0]?.onEvent({ type: 'data', data: 'A' }))
    dependency = 1
    rerender()
    expect(result.current).toEqual({
      data: 'A',
      isLoading: false,
      isUpdating: false,
      error: null,
    })

    act(() => {
      callbacks[0]?.onEvent({ type: 'recompute-started' })
      callbacks[0]?.onEvent({ type: 'data', data: 'stale' })
      callbacks[0]?.onError(new Error('late error'))
    })
    expect(result.current).toEqual({
      data: 'A',
      isLoading: false,
      isUpdating: false,
      error: null,
    })

    dependency = 2
    rerender()
    expect(result.current.data).toBe('A')

    act(() => callbacks[2]?.onEvent({ type: 'data', data: 'B' }))
    expect(result.current).toEqual({
      data: 'B',
      isLoading: false,
      isUpdating: false,
      error: null,
    })
  })

  it('never projects static loading or data as a recompute', async () => {
    staticModeMock.mockReturnValue(true)
    let resolveLoader: ((value: string) => void) | undefined
    const loader = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveLoader = resolve
        })
    )
    const { result } = renderHook(() =>
      useReactiveProjectionSubscription(() => ({ unsubscribe: vi.fn() }), loader)
    )

    expect(result.current).toMatchObject({ isLoading: true, isUpdating: false })
    await act(async () => {
      resolveLoader?.('static')
      await Promise.resolve()
    })
    expect(result.current).toEqual({
      data: 'static',
      isLoading: false,
      isUpdating: false,
      error: null,
    })
  })

  it('retires a static projection generation before it can mutate state or cache', async () => {
    staticModeMock.mockReturnValue(true)
    const loaders: Array<(value: string) => void> = []
    const loader = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          loaders.push(resolve)
        })
    )
    const cacheKey = 'reactive-projection-static-generation-test'
    let dependency = 0
    const { result, rerender } = renderHook(() =>
      useReactiveProjectionSubscription(
        () => ({ unsubscribe: vi.fn() }),
        loader,
        [dependency],
        cacheKey
      )
    )

    dependency = 1
    rerender()
    await act(async () => {
      loaders[0]?.('stale')
      await Promise.resolve()
    })
    expect(result.current).toEqual({
      data: undefined,
      isLoading: true,
      isUpdating: false,
      error: null,
    })

    dependency = 2
    rerender()
    expect(result.current.data).toBeUndefined()

    await act(async () => {
      loaders[2]?.('current')
      await Promise.resolve()
    })
    expect(result.current).toEqual({
      data: 'current',
      isLoading: false,
      isUpdating: false,
      error: null,
    })
  })
})
