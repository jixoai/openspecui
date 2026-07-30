/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Prove Store Detail admission starts independent Specs and Changes Pulls.
 * 2. Prove a regional lifecycle Push pulls only that region and retains its failed-refresh data.
 *
 * Original request (2026-07-30): "StoreDetailPage应该如何设计呢？"
 */
// @vitest-environment jsdom
import type {
  HostedCliProjectionNotice,
  HostedStoreContentChangesProjectionState,
  HostedStoreContentSpecsProjectionState,
} from '@openspecui/core/hosted-contract'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  CliProjectionSelector,
  CliProjectionTransportCallbacks,
} from './cli-projection-transport'
import type {
  StoreContentRequestIdentity,
  StoreContentTransportOptions,
} from './store-content-transport'
import { useStoreContentData } from './use-store-content-data'

const transport = vi.hoisted(() => {
  const callbacks = new Map<string, CliProjectionTransportCallbacks>()
  return {
    connect(
      _apiBaseUrl: string,
      selector: CliProjectionSelector,
      nextCallbacks: CliProjectionTransportCallbacks
    ) {
      if (selector.kind !== 'store-content') throw new Error('Expected Store-content selector.')
      callbacks.set(selector.contentKind, nextCallbacks)
      return {
        unsubscribe() {
          if (callbacks.get(selector.contentKind) === nextCallbacks) {
            callbacks.delete(selector.contentKind)
          }
        },
      }
    },
    get(kind: 'specs' | 'changes') {
      const callback = callbacks.get(kind)
      if (!callback) throw new Error(`Missing ${kind} transport.`)
      return callback
    },
    reset() {
      callbacks.clear()
    },
  }
})

const contentTransport = vi.hoisted(() => ({
  fetch:
    vi.fn<
      (
        options: StoreContentTransportOptions,
        identity: StoreContentRequestIdentity
      ) => Promise<
        HostedStoreContentSpecsProjectionState | HostedStoreContentChangesProjectionState
      >
    >(),
}))

vi.mock('./cli-projection-transport', async (importOriginal) => {
  const original = await importOriginal<typeof import('./cli-projection-transport')>()
  return {
    ...original,
    createTRPCCliProjectionTransportFactory: () => ({ connect: transport.connect }),
  }
})

vi.mock('./store-content-transport', async (importOriginal) => {
  const original = await importOriginal<typeof import('./store-content-transport')>()
  return { ...original, fetchBackendStoreContentProjection: contentTransport.fetch }
})

const SPECS_READY = {
  identity: 'env://a|team|specs',
  workGeneration: 1,
  invalidationCause: 'initial',
  state: 'ready',
  data: {
    available: true,
    storeId: 'team',
    specs: [{ id: 'auth', requirementCount: 3 }],
  },
  freshness: 'current',
  snapshotGeneration: 1,
  error: null,
} satisfies HostedStoreContentSpecsProjectionState

const CHANGES_READY = {
  identity: 'env://a|team|changes',
  workGeneration: 1,
  invalidationCause: 'initial',
  state: 'ready',
  data: { available: true, storeId: 'team', changes: [] },
  freshness: 'current',
  snapshotGeneration: 1,
  error: null,
} satisfies HostedStoreContentChangesProjectionState

const SPECS_REFRESH_ERROR = {
  ...SPECS_READY,
  workGeneration: 2,
  invalidationCause: 'dependency',
  state: 'refresh-error',
  freshness: 'stale-display-only',
  error: { name: 'Error', message: 'Specs refresh failed', cliEvidence: null },
} satisfies HostedStoreContentSpecsProjectionState

afterEach(() => {
  cleanup()
  transport.reset()
  contentTransport.fetch.mockReset()
})

describe('useStoreContentData detail-only lifecycle', () => {
  it('pulls regions independently and retains Specs after a regional refresh failure', async () => {
    contentTransport.fetch
      .mockResolvedValueOnce(SPECS_READY)
      .mockResolvedValueOnce(CHANGES_READY)
      .mockResolvedValueOnce(SPECS_REFRESH_ERROR)

    const { result } = renderHook(() =>
      useStoreContentData({
        apiBaseUrl: 'http://127.0.0.1:4100',
        envUri: 'env://a',
        storeId: 'team',
        supported: true,
      })
    )
    await waitFor(() => expect(result.current.specs.state).toBe('ready'))
    expect(result.current.changes.state).toBe('empty')
    expect(contentTransport.fetch).toHaveBeenCalledTimes(2)

    const notice: HostedCliProjectionNotice = {
      identity: 'env://a|team|specs',
      workGeneration: 2,
      invalidationCause: 'dependency',
      state: 'refresh-error',
      snapshotGeneration: 1,
    }
    await act(async () => transport.get('specs').onNotice(notice))
    await waitFor(() => expect(result.current.specs.error).toBe('Specs refresh failed'))
    expect(result.current.specs.entries).toEqual([{ id: 'auth', requirementCount: 3 }])
    expect(result.current.changes.state).toBe('empty')
    expect(result.current.changes.error).toBeUndefined()
    expect(contentTransport.fetch).toHaveBeenCalledTimes(3)
  })
})
