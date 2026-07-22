/**
 * Orthogonal intents (created 2026-07-22 Asia/Shanghai):
 * 1. Prove cached Root Context remains displayable but cannot authorize writes during a live rebind.
 * 2. Drive real Root Context tRPC lifecycle callbacks through the authoritative subscription owner.
 * 3. Prove retired Root observers cannot restore cached data or mutation authority.
 *
 * Owner-reported debt (2026-07-22): "整个过程中，几乎都在 Loading，切换个页面也等，做任何动作也在等。"
 */
import type { RootContext, RootContextState } from '@openspecui/core'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useContextSubscription } from './use-context-subscription'
import { useRootActionState } from './use-root-action-state'
import { primeSubscriptionCache } from './use-subscription'

type RootContextCallbacks = {
  onData(data: RootContextState): void
  onError(error: Error): void
  onConnectionStateChange(state: {
    state: 'idle' | 'connecting' | 'pending'
    error: Error | null
  }): void
  onStopped(): void
  onComplete(): void
}

const { rootContextSubscribeMock, staticModeMock } = vi.hoisted(() => ({
  rootContextSubscribeMock:
    vi.fn<(input: undefined, callbacks: RootContextCallbacks) => { unsubscribe(): void }>(),
  staticModeMock: vi.fn(() => false),
}))

vi.mock('./trpc', () => ({
  trpcClient: {
    rootContext: {
      subscribe: {
        subscribe: rootContextSubscribeMock,
      },
    },
  },
}))

vi.mock('./static-mode', () => ({
  isStaticMode: staticModeMock,
}))

function rootContext(path: string, observedAt: number): RootContext {
  return {
    launchProject: { path: '/launch' },
    planningRoot: { path, source: 'nearest', healthy: true, status: [] },
    storeId: null,
    cli: { available: true, version: '1.6.0' },
    references: [],
    contextMembers: [],
    dataScope: {
      path: '/runtime/openspec',
      source: 'xdg-data-home',
      environmentVariable: 'XDG_DATA_HOME',
    },
    diagnostics: { root: [], doctor: [], context: [] },
    evidence: { doctor: null, context: null },
    observedAt,
  }
}

function ready(path: string, observedAt: number): RootContextState {
  return {
    state: 'ready',
    data: rootContext(path, observedAt),
    attempt: null,
    error: null,
    observedAt,
  }
}

function emitAll(
  callbacks: readonly RootContextCallbacks[],
  emit: (callbacks: RootContextCallbacks) => void
): void {
  for (const callback of callbacks) emit(callback)
}

function useRootContextAndActionState() {
  return {
    context: useContextSubscription(),
    action: useRootActionState(),
  }
}

describe('useContextSubscription current authority', () => {
  beforeEach(() => {
    staticModeMock.mockReturnValue(false)
    rootContextSubscribeMock.mockReset()
  })

  it('keeps cached A displayable and root actions locked through lifecycle states until current B arrives', () => {
    const rootA = ready('/planning-a', 1)
    const rootB = ready('/planning-b', 2)
    const callbacks: RootContextCallbacks[] = []
    rootContextSubscribeMock.mockImplementation((_input, next) => {
      callbacks.push(next)
      return { unsubscribe: vi.fn() }
    })
    primeSubscriptionCache('root-context.subscribe', rootA)

    const { result } = renderHook(() => useRootContextAndActionState())

    expect(result.current.context).toMatchObject({
      data: rootA,
      isLoading: true,
      authority: { state: 'waiting', reason: 'rebind' },
    })
    expect(result.current.action).toMatchObject({ status: 'checking', disabled: true })

    act(() =>
      emitAll(callbacks, (callback) =>
        callback.onConnectionStateChange({ state: 'connecting', error: null })
      )
    )
    expect(result.current.action).toMatchObject({ status: 'checking', disabled: true })

    act(() =>
      emitAll(callbacks, (callback) =>
        callback.onConnectionStateChange({ state: 'pending', error: null })
      )
    )
    expect(result.current.action).toMatchObject({ status: 'checking', disabled: true })

    const transportError = new Error('Root Context transport failed')
    act(() => emitAll(callbacks, (callback) => callback.onError(transportError)))
    expect(result.current.action).toMatchObject({ status: 'blocked', disabled: true })

    act(() => emitAll(callbacks, (callback) => callback.onStopped()))
    act(() => emitAll(callbacks, (callback) => callback.onComplete()))
    expect(result.current.action).toMatchObject({ status: 'blocked', disabled: true })

    act(() => emitAll(callbacks, (callback) => callback.onData(rootB)))
    expect(result.current.context).toMatchObject({
      data: rootB,
      isLoading: false,
      authority: { state: 'current' },
    })
    expect(result.current.action).toMatchObject({
      status: 'ready',
      disabled: false,
      context: rootB.data,
    })
  })

  it('rejects late Root A callbacks after retirement without overwriting cached B', () => {
    const rootA = ready('/planning-a', 1)
    const rootB = ready('/planning-b', 2)
    const callbacks: RootContextCallbacks[] = []
    rootContextSubscribeMock.mockImplementation((_input, next) => {
      callbacks.push(next)
      return { unsubscribe: vi.fn() }
    })
    primeSubscriptionCache('root-context.subscribe', rootA)

    const mounted = renderHook(() => useRootContextAndActionState())
    act(() => emitAll(callbacks, (callback) => callback.onData(rootB)))
    expect(mounted.result.current.action).toMatchObject({ status: 'ready', disabled: false })

    const retiredCallbacks = [...callbacks]
    mounted.unmount()
    act(() => {
      emitAll(retiredCallbacks, (callback) => callback.onData(rootA))
      emitAll(retiredCallbacks, (callback) =>
        callback.onError(new Error('late retired Root Context error'))
      )
    })

    const replacement = renderHook(() => useRootContextAndActionState())
    expect(replacement.result.current.context).toMatchObject({
      data: rootB,
      authority: { state: 'waiting', reason: 'rebind' },
    })
    expect(replacement.result.current.action).toMatchObject({ status: 'checking', disabled: true })
    replacement.unmount()
  })
})
