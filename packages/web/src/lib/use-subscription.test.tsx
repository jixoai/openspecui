/**
 * Orthogonal intents (created 2026-07-19 Asia/Shanghai):
 * 1. Prove cached subscription data is display-only while a reconnect is pending.
 * 2. Preserve the loading gate until the replacement projection arrives.
 *
 * Original request (2026-07-19): "代码已经提交，开始review。如果有问题，那么可更新change。"
 */
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { primeSubscriptionCache, useSubscription } from './use-subscription'

const { staticModeMock } = vi.hoisted(() => ({ staticModeMock: vi.fn(() => false) }))

vi.mock('./static-mode', () => ({
  isStaticMode: staticModeMock,
}))

describe('useSubscription cache rebind', () => {
  beforeEach(() => {
    staticModeMock.mockReturnValue(false)
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
