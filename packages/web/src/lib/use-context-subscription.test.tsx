/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Prove cached Root Context remains displayable but cannot authorize writes during a live rebind.
 * 2. Drive lifecycle-only Push followed by typed Root Projection Pull.
 * 3. Prove revalidation/refresh-error and retired Pulls cannot restore mutation authority.
 * 4. Prove initial Root Context discovery does not wait for a lifecycle notice or supersede synchronous replay.
 *
 * Owner-reported debt (2026-07-22): "整个过程中，几乎都在 Loading，切换个页面也等，做任何动作也在等。"
 * Original request (2026-07-26): "即便现在有正在的任务，界面上仍然可以读到缓存。"
 * Original request (2026-07-31): "所有可能其它页面都有类似的问题。"
 */
import type {
  HostedRootContext,
  HostedRootContextProjectionState,
  HostedRootContextState,
} from '@openspecui/core/hosted-contract'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useContextSubscription } from './use-context-subscription'
import { useRootActionState } from './use-root-action-state'
import { primeSubscriptionCache } from './use-subscription'

type RootContextNoticeCallbacks = {
  onData(data: unknown): void
  onError(error: Error): void
  onConnectionStateChange(state: {
    state: 'idle' | 'connecting' | 'pending'
    error: Error | null
  }): void
  onStopped(): void
  onComplete(): void
}

const { rootContextReadProjectionMock, rootContextSubscribeProjectionMock, staticModeMock } =
  vi.hoisted(() => ({
    rootContextReadProjectionMock: vi.fn<() => Promise<HostedRootContextProjectionState>>(),
    rootContextSubscribeProjectionMock:
      vi.fn<(input: undefined, callbacks: RootContextNoticeCallbacks) => { unsubscribe(): void }>(),
    staticModeMock: vi.fn(() => false),
  }))

vi.mock('./trpc', () => ({
  trpcClient: {
    rootContext: {
      readProjection: {
        query: rootContextReadProjectionMock,
      },
      subscribeProjection: {
        subscribe: rootContextSubscribeProjectionMock,
      },
    },
  },
}))

vi.mock('./static-mode', () => ({
  isStaticMode: staticModeMock,
}))

function rootContext(path: string, observedAt: number): HostedRootContext {
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

function ready(path: string, observedAt: number): HostedRootContextState {
  return {
    state: 'ready',
    data: rootContext(path, observedAt),
    attempt: null,
    error: null,
    observedAt,
  }
}

function projection(
  data: HostedRootContextState,
  state: 'ready' | 'revalidating' = 'ready',
  workGeneration = 1
): HostedRootContextProjectionState {
  if (data.state === 'loading' || data.state === 'refreshing') {
    throw new Error('Projection fixtures require a settled Root result.')
  }
  return state === 'ready'
    ? {
        state,
        identity: 'root-context:test',
        workGeneration,
        invalidationCause: 'initial',
        data,
        freshness: 'current',
        snapshotGeneration: workGeneration,
        error: null,
      }
    : {
        state,
        identity: 'root-context:test',
        workGeneration,
        invalidationCause: 'dependency',
        data,
        freshness: 'stale-display-only',
        snapshotGeneration: workGeneration - 1,
        error: null,
      }
}

function refreshError(
  data: HostedRootContextState,
  workGeneration: number
): HostedRootContextProjectionState {
  if (data.state === 'loading' || data.state === 'refreshing') {
    throw new Error('Projection fixtures require a settled Root result.')
  }
  return {
    state: 'refresh-error',
    identity: 'root-context:test',
    workGeneration,
    invalidationCause: 'dependency',
    data,
    freshness: 'stale-display-only',
    snapshotGeneration: workGeneration - 1,
    error: { name: 'Error', message: 'Root replacement failed.', cliEvidence: null },
  }
}

const NOTICE = {
  identity: 'root-context:test',
  workGeneration: 1,
  snapshotGeneration: 1,
  state: 'ready' as const,
  invalidationCause: 'initial' as const,
}

function emitAll(
  callbacks: readonly RootContextNoticeCallbacks[],
  emit: (callbacks: RootContextNoticeCallbacks) => void
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
    rootContextReadProjectionMock.mockReset()
    rootContextSubscribeProjectionMock.mockReset()
  })

  it('pulls the initial Root Context without waiting for a lifecycle notice', async () => {
    const root = ready('/planning-current', 1)
    rootContextReadProjectionMock.mockResolvedValue(projection(root))
    rootContextSubscribeProjectionMock.mockReturnValue({ unsubscribe: vi.fn() })

    const mounted = renderHook(() => useContextSubscription())

    await waitFor(() => expect(rootContextReadProjectionMock).toHaveBeenCalledOnce())
    await waitFor(() => {
      expect(mounted.result.current).toMatchObject({
        data: root,
        isLoading: false,
        authority: { state: 'current' },
      })
    })
    expect(rootContextSubscribeProjectionMock).toHaveBeenCalledOnce()
    mounted.unmount()
  })

  it('uses a synchronously replayed notice as admission instead of starting a second Pull', async () => {
    const root = ready('/planning-replayed', 1)
    rootContextReadProjectionMock.mockResolvedValue(projection(root))
    rootContextSubscribeProjectionMock.mockImplementation((_input, callbacks) => {
      callbacks.onData(NOTICE)
      return { unsubscribe: vi.fn() }
    })

    const mounted = renderHook(() => useContextSubscription())

    await waitFor(() => expect(mounted.result.current.data).toEqual(root))
    expect(rootContextReadProjectionMock).toHaveBeenCalledOnce()
    mounted.unmount()
  })

  it('does not let a malformed synchronous notice suppress the admission Pull', async () => {
    const root = ready('/planning-after-malformed-notice', 1)
    rootContextReadProjectionMock.mockResolvedValue(projection(root))
    rootContextSubscribeProjectionMock.mockImplementation((_input, callbacks) => {
      callbacks.onData({ malformed: true })
      return { unsubscribe: vi.fn() }
    })

    const mounted = renderHook(() => useContextSubscription())

    await waitFor(() => expect(rootContextReadProjectionMock).toHaveBeenCalledOnce())
    await waitFor(() => expect(mounted.result.current.data).toEqual(root))
    mounted.unmount()
  })

  it('keeps cached A displayable and root actions locked through lifecycle states until current B Pull arrives', async () => {
    const rootA = ready('/planning-a', 1)
    const rootB = ready('/planning-b', 2)
    const callbacks: RootContextNoticeCallbacks[] = []
    rootContextSubscribeProjectionMock.mockImplementation((_input, next) => {
      callbacks.push(next)
      return { unsubscribe: vi.fn() }
    })
    rootContextReadProjectionMock.mockResolvedValue(projection(rootB))
    primeSubscriptionCache('root-context.projection', rootA)

    const { result } = renderHook(() => useRootContextAndActionState())

    // The action owner is the fixed point: generic cached A must not authorize writes.
    expect(result.current.action).toMatchObject({ status: 'checking', disabled: true })
    expect(result.current.context).toMatchObject({
      data: rootA,
      isLoading: true,
      authority: { state: 'waiting', reason: 'rebind' },
    })

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

    act(() => emitAll(callbacks, (callback) => callback.onData(NOTICE)))
    await waitFor(() => {
      expect(result.current.context).toMatchObject({
        data: rootB,
        isLoading: false,
        authority: { state: 'current' },
      })
    })
    expect(result.current.action).toMatchObject({
      status: 'ready',
      disabled: false,
      context: rootB.data,
    })
  })

  it('rejects a late Root A Pull after retirement without overwriting cached B', async () => {
    const rootA = ready('/planning-a', 1)
    const rootB = ready('/planning-b', 2)
    const callbacks: RootContextNoticeCallbacks[] = []
    rootContextSubscribeProjectionMock.mockImplementation((_input, next) => {
      callbacks.push(next)
      return { unsubscribe: vi.fn() }
    })
    rootContextReadProjectionMock.mockResolvedValue(projection(rootB))
    primeSubscriptionCache('root-context.projection', rootA)

    const mounted = renderHook(() => useRootContextAndActionState())
    act(() => emitAll(callbacks, (callback) => callback.onData(NOTICE)))
    await waitFor(() => {
      expect(mounted.result.current.action).toMatchObject({ status: 'ready', disabled: false })
    })

    const retiredCallbacks = [...callbacks]
    mounted.unmount()
    rootContextReadProjectionMock.mockResolvedValue(projection(rootA, 'ready', 2))
    act(() => {
      emitAll(retiredCallbacks, (callback) => callback.onData({ ...NOTICE, workGeneration: 2 }))
      emitAll(retiredCallbacks, (callback) =>
        callback.onError(new Error('late retired Root Context error'))
      )
    })
    await Promise.resolve()

    const replacement = renderHook(() => useRootContextAndActionState())
    expect(replacement.result.current.context).toMatchObject({
      data: rootB,
      authority: { state: 'waiting', reason: 'rebind' },
    })
    expect(replacement.result.current.action).toMatchObject({ status: 'checking', disabled: true })
    replacement.unmount()
  })

  it('retains settled Root data as display-only through revalidation and refresh failure', async () => {
    const rootA = ready('/planning-a', 1)
    const rootB = ready('/planning-b', 2)
    const callbacks: RootContextNoticeCallbacks[] = []
    let currentProjection = projection(rootA)
    rootContextReadProjectionMock.mockImplementation(async () => currentProjection)
    rootContextSubscribeProjectionMock.mockImplementation((_input, next) => {
      callbacks.push(next)
      return { unsubscribe: vi.fn() }
    })

    const mounted = renderHook(() => useRootContextAndActionState())
    act(() => emitAll(callbacks, (callback) => callback.onData(NOTICE)))
    await waitFor(() => {
      expect(mounted.result.current.action).toMatchObject({ status: 'ready', disabled: false })
    })

    currentProjection = projection(rootA, 'revalidating', 2)
    act(() =>
      emitAll(callbacks, (callback) =>
        callback.onData({ ...NOTICE, state: 'revalidating', workGeneration: 2 })
      )
    )
    await waitFor(() => {
      expect(mounted.result.current.context).toMatchObject({
        data: rootA,
        isLoading: false,
        authority: { state: 'waiting', reason: 'pending' },
      })
      expect(mounted.result.current.action).toMatchObject({ status: 'checking', disabled: true })
    })

    currentProjection = refreshError(rootA, 2)
    act(() =>
      emitAll(callbacks, (callback) =>
        callback.onData({ ...NOTICE, state: 'refresh-error', workGeneration: 2 })
      )
    )
    await waitFor(() => {
      expect(mounted.result.current.context).toMatchObject({
        data: rootA,
        error: { message: 'Root replacement failed.' },
        authority: { state: 'failed' },
      })
      expect(mounted.result.current.action).toMatchObject({ status: 'blocked', disabled: true })
    })

    currentProjection = projection(rootB, 'ready', 3)
    act(() =>
      emitAll(callbacks, (callback) =>
        callback.onData({ ...NOTICE, workGeneration: 3, snapshotGeneration: 3 })
      )
    )
    await waitFor(() => {
      expect(mounted.result.current.context).toMatchObject({
        data: rootB,
        error: null,
        authority: { state: 'current' },
      })
      expect(mounted.result.current.action).toMatchObject({ status: 'ready', disabled: false })
    })
    mounted.unmount()
  })
})
