/**
 * Orthogonal intents (updated 2026-08-02 Asia/Shanghai):
 * 1. Prove Active Root recomputation retains the last projection while exposing Updating.
 * 2. Prove replacement data and transport failure settle without fabricating mutation authority.
 * 3. Prove static Active Root inspection remains owner/file/revision-free.
 *
 * Original request (2026-08-01): Active Root retains stale display but locks mutation during replacement refresh.
 */
import type { ActiveRootConfig, ActiveRootRevision } from '@openspecui/core'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useActiveRootConfigViewSubscription } from './use-planning-config'

interface ActiveRootSubscriptionCallbacks {
  onData(event: { type: 'recompute-started' } | { type: 'data'; data: ActiveRootConfig }): void
  onError(error: Error): void
}

const { getOpsxProjectConfigMock, staticModeState, subscribeActiveRootMock } = vi.hoisted(() => ({
  getOpsxProjectConfigMock: vi.fn<() => Promise<string | null>>(),
  staticModeState: { value: false },
  subscribeActiveRootMock:
    vi.fn<
      (input: undefined, callbacks: ActiveRootSubscriptionCallbacks) => { unsubscribe(): void }
    >(),
}))

vi.mock('./static-mode', () => ({ isStaticMode: () => staticModeState.value }))
vi.mock('./static-data-provider', () => ({ getOpsxProjectConfig: getOpsxProjectConfigMock }))
vi.mock('./trpc', () => ({
  trpcClient: {
    planningConfig: {
      subscribeActiveRoot: { subscribe: subscribeActiveRootMock },
    },
  },
}))

const REVISION_A = `sha256:${'a'.repeat(64)}` as ActiveRootRevision
const REVISION_B = `sha256:${'b'.repeat(64)}` as ActiveRootRevision

function activeRootConfig(revision: ActiveRootRevision, schema: string): ActiveRootConfig {
  return {
    kind: 'active-root',
    owner: {
      kind: 'planning-root',
      path: '/planning',
      source: 'nearest',
      storeId: null,
      externalToLaunchProject: false,
    },
    file: {
      path: '/planning/openspec/config.yaml',
      format: 'yaml',
      exists: true,
      content: `schema: ${schema}\n`,
    },
    revision,
    official: { schema, context: null, rules: null, operations: null },
    diagnostics: [],
  }
}

describe('useActiveRootConfigViewSubscription', () => {
  const subscriptions: ActiveRootSubscriptionCallbacks[] = []

  beforeEach(() => {
    subscriptions.length = 0
    staticModeState.value = false
    getOpsxProjectConfigMock.mockReset().mockResolvedValue(null)
    subscribeActiveRootMock.mockReset().mockImplementation((_input, callbacks) => {
      subscriptions.push(callbacks)
      return { unsubscribe: vi.fn() }
    })
  })

  afterEach(() => cleanup())

  it('retains current data through recompute-started and replaces it only after committed data arrives', async () => {
    const { result } = renderHook(() => useActiveRootConfigViewSubscription())
    await waitFor(() => expect(subscribeActiveRootMock).toHaveBeenCalledOnce())

    act(() =>
      subscriptions[0]?.onData({ type: 'data', data: activeRootConfig(REVISION_A, 'alpha') })
    )
    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: { revision: REVISION_A, official: { schema: 'alpha' } },
        isLoading: false,
        isUpdating: false,
        error: null,
      })
    })

    act(() => subscriptions[0]?.onData({ type: 'recompute-started' }))
    expect(result.current).toMatchObject({
      data: { revision: REVISION_A, official: { schema: 'alpha' } },
      isLoading: false,
      isUpdating: true,
      error: null,
    })

    act(() =>
      subscriptions[0]?.onData({ type: 'data', data: activeRootConfig(REVISION_B, 'beta') })
    )
    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: { revision: REVISION_B, official: { schema: 'beta' } },
        isLoading: false,
        isUpdating: false,
        error: null,
      })
    })
  })

  it('retains the last usable projection when the replacement transport fails', async () => {
    const { result } = renderHook(() => useActiveRootConfigViewSubscription())
    await waitFor(() => expect(subscribeActiveRootMock).toHaveBeenCalledOnce())
    act(() =>
      subscriptions[0]?.onData({ type: 'data', data: activeRootConfig(REVISION_A, 'alpha') })
    )
    await waitFor(() => expect(result.current.data?.revision).toBe(REVISION_A))
    act(() => subscriptions[0]?.onData({ type: 'recompute-started' }))

    const error = new Error('Active Root subscription failed.')
    act(() => subscriptions[0]?.onError(error))
    expect(result.current).toMatchObject({
      data: { revision: REVISION_A, official: { schema: 'alpha' } },
      isLoading: false,
      isUpdating: false,
      error,
    })
  })

  it('inspects static YAML without inventing live owner, path, or revision evidence', async () => {
    cleanup()
    staticModeState.value = true
    getOpsxProjectConfigMock.mockResolvedValueOnce(
      'schema: spec-driven\ncontext: Static context\nteam-key: retained\n'
    )
    const { result } = renderHook(() => useActiveRootConfigViewSubscription())

    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: {
          exists: true,
          content: 'schema: spec-driven\ncontext: Static context\nteam-key: retained\n',
          filePath: null,
          owner: null,
          revision: null,
          official: {
            schema: 'spec-driven',
            context: 'Static context',
            rules: null,
            operations: null,
          },
          diagnostics: [],
        },
        isLoading: false,
        isUpdating: false,
        error: null,
      })
    })
    expect(subscribeActiveRootMock).not.toHaveBeenCalled()
  })
})
