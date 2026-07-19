/**
 * Orthogonal intents (created 2026-07-19 Asia/Shanghai):
 * 1. Prove cached subscription data is display-only while a reconnect is pending.
 * 2. Preserve the loading gate until the replacement projection arrives.
 * 3. Prove direct unmount retires a pending static loader before it can write cache.
 *
 * Original request (2026-07-19): "代码已经提交，开始review。如果有问题，那么可更新change。"
 */
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  primeSubscriptionCache,
  useAuthoritativeSubscription,
  useSubscription,
} from './use-subscription'

const { staticModeMock } = vi.hoisted(() => ({ staticModeMock: vi.fn(() => false) }))

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
})
