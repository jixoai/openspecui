/**
 * Orthogonal intents (created 2026-07-24 Asia/Shanghai):
 * 1. Prove a transport reconnect over cached data does NOT relabel it as initial-loading (pervasive-Loading root cause).
 * 2. Prove readable content stays readable with display-only authority; only mutations lock.
 * 3. Prove the adapter derives `revalidating`/`display-only` rather than `initial-loading` during reconnect.
 *
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢……页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 * Owner report (2026-07-22): "整个过程中，几乎都在 Loading。"
 * Evidence type: unit (focused Vitest lane). This is the Web-side root-cause red/green/mutation proof.
 */
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fromAuthoritativeState, type RealtimeProjectionTopology } from './realtime'
import { useAuthoritativeSubscription } from './use-subscription'

const { staticModeMock } = vi.hoisted(() => ({ staticModeMock: vi.fn(() => false) }))

vi.mock('./static-mode', () => ({
  isStaticMode: staticModeMock,
}))

type AuthoritativeCallbacks<T> = {
  onData(data: T): void
  onError(error: Error): void
  onConnectionStateChange(state: {
    state: 'idle' | 'connecting' | 'pending'
    error: Error | null
  }): void
  onStopped(): void
  onComplete(): void
}

describe('useAuthoritativeSubscription transport reconnect over cached data', () => {
  beforeEach(() => {
    staticModeMock.mockReturnValue(false)
  })

  it('does not relabel cached data as isLoading on transport reconnect (root-cause red/green)', () => {
    let callbacks: AuthoritativeCallbacks<string> | undefined
    const subscribe = vi.fn((next: AuthoritativeCallbacks<string>) => {
      callbacks = next
      return { unsubscribe: vi.fn() }
    })
    const { result } = renderHook(() =>
      useAuthoritativeSubscription((next) => subscribe(next), undefined, [], 'reconnect-root-cause')
    )

    // Initial payload commits and is current.
    act(() => callbacks?.onData('A'))
    expect(result.current).toMatchObject({
      data: 'A',
      isLoading: false,
      authority: { state: 'current' },
    })

    // Transport reconnects (WS drops and reconnects) over the SAME subscription with cached data present.
    act(() => callbacks?.onConnectionStateChange({ state: 'connecting', error: null }))

    // RED (pre-fix): isLoading was true here, collapsing retained content into initial-loading.
    // GREEN (post-fix): isLoading stays false; authority is revoked to waiting but data remains readable.
    expect(result.current.data).toBe('A')
    expect(result.current.isLoading).toBe(false)
    expect(result.current.authority.state).toBe('waiting')
  })

  it('does not relabel cached data as isLoading on transport stop without terminal error', () => {
    let callbacks: AuthoritativeCallbacks<string> | undefined
    const subscribe = vi.fn((next: AuthoritativeCallbacks<string>) => {
      callbacks = next
      return { unsubscribe: vi.fn() }
    })
    const { result } = renderHook(() =>
      useAuthoritativeSubscription((next) => subscribe(next), undefined, [], 'reconnect-stop')
    )

    act(() => callbacks?.onData('A'))
    act(() => callbacks?.onStopped())
    expect(result.current.data).toBe('A')
    expect(result.current.isLoading).toBe(false)
    expect(result.current.authority.state).toBe('waiting')
  })

  it('adapter derives revalidating/display-only (not initial-loading) during reconnect over cached data', () => {
    let callbacks: AuthoritativeCallbacks<string[]> | undefined
    const subscribe = vi.fn((next: AuthoritativeCallbacks<string[]>) => {
      callbacks = next
      return { unsubscribe: vi.fn() }
    })
    const { result } = renderHook(() =>
      useAuthoritativeSubscription((next) => subscribe(next), undefined, [], 'reconnect-adapter')
    )

    act(() => callbacks?.onData(['a', 'b']))
    act(() => callbacks?.onConnectionStateChange({ state: 'connecting', error: null }))

    const projected = fromAuthoritativeState(result.current)
    const acceptable: RealtimeProjectionTopology[] = ['revalidating']
    expect(acceptable).toContain(projected.topology)
    expect(projected.authority).toBe('display-only')
    expect(projected.data).toEqual(['a', 'b'])
  })

  it('preserves a terminal error as refresh-error over retained content, not initial-loading', () => {
    let callbacks: AuthoritativeCallbacks<string[]> | undefined
    const subscribe = vi.fn((next: AuthoritativeCallbacks<string[]>) => {
      callbacks = next
      return { unsubscribe: vi.fn() }
    })
    const { result } = renderHook(() =>
      useAuthoritativeSubscription((next) => subscribe(next), undefined, [], 'reconnect-error')
    )

    act(() => callbacks?.onData(['a']))
    act(() => callbacks?.onError(new Error('transport failed')))
    const projected = fromAuthoritativeState(result.current)
    expect(projected.topology).toBe('refresh-error')
    expect(projected.data).toEqual(['a'])
  })
})
