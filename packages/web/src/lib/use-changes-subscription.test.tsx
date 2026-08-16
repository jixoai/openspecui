/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Prove the first Change row renders before later inventory work settles.
 * 2. Preserve row-level errors and explicit progress beside completed rows.
 * 3. Keep an unknown total explicit instead of deriving a false percentage.
 * 4. Retire partial Root A rows when a batch from Root B begins.
 * 5. Render same-identity stale rows during revalidation without treating them as settled.
 *
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 */
import {
  createDocumentChecklistSummary,
  createTrackedTaskProgress,
  type ChangeMeta,
  type ChangeProjectionBatch,
} from '@openspecui/core'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useChangesSubscription } from './use-subscription'

interface ChangeWorkIdentity {
  projectionKind: string
  planningRoot: { identity: string; source: string; storeSelector: string | null }
  owner: { generation: string | null; gitBindingToken: string | null }
  selector: string
  inputFingerprint: string
  protocolVersion: number
}

interface ChangeBatchEvent {
  type: 'batch'
  batch: ChangeProjectionBatch
  progress: ChangeProjectionBatch['progress']
  identity: ChangeWorkIdentity
  workGeneration: number
}

interface ChangeSnapshotEvent {
  type: 'snapshot' | 'complete'
  snapshot: {
    data: { rows: ChangeMeta[]; errors: Array<{ changeId: string; message: string }> }
    freshness: 'current' | 'stale-display-only'
    identity: ChangeWorkIdentity
    workGeneration: number
  }
}

interface ChangeSubscriptionCallbacks {
  onData(event: ChangeBatchEvent | ChangeSnapshotEvent): void
  onError(error: Error): void
}

const { callbacks, staticModeMock, subscribeBatchesMock } = vi.hoisted(() => ({
  callbacks: [] as ChangeSubscriptionCallbacks[],
  staticModeMock: vi.fn(() => false),
  subscribeBatchesMock: vi.fn((_input: undefined, next: ChangeSubscriptionCallbacks) => {
    callbacks.push(next)
    return { unsubscribe: vi.fn() }
  }),
}))

vi.mock('./static-mode', () => ({
  isStaticMode: staticModeMock,
}))

vi.mock('./trpc', () => ({
  trpcClient: {
    change: {
      subscribeBatches: {
        subscribe: subscribeBatchesMock,
      },
    },
  },
}))

function changeRow(id: string): ChangeMeta {
  return {
    id,
    name: id,
    trackedTaskProgress: createTrackedTaskProgress([]),
    documentChecklistSummary: createDocumentChecklistSummary([]),
    createdAt: 1,
    updatedAt: 1,
    cliTaskSummary: null,
  }
}

function changeIdentity(generation: string) {
  return {
    projectionKind: 'changes-rows',
    planningRoot: { identity: `/planning/${generation}`, source: 'nearest', storeSelector: null },
    owner: { generation, gitBindingToken: null },
    selector: 'changes:list-with-meta',
    inputFingerprint: 'reactive-filesystem:changes-v1',
    protocolVersion: 1,
  }
}

describe('useChangesSubscription', () => {
  beforeEach(() => {
    callbacks.length = 0
    staticModeMock.mockReturnValue(false)
    subscribeBatchesMock.mockClear()
  })

  it('publishes the first completed row and retains a later row error with unknown total progress', () => {
    const { result } = renderHook(() => useChangesSubscription())

    expect(result.current).toMatchObject({ data: undefined, isLoading: true, rowErrors: [] })

    act(() => {
      callbacks[0]?.onData({
        type: 'batch',
        batch: {
          rows: [changeRow('first')],
          errors: [],
          progress: { completed: 1, total: 'unknown' },
        },
        progress: { completed: 1, total: 'unknown' },
        identity: changeIdentity('A'),
        workGeneration: 1,
      })
    })

    expect(result.current).toMatchObject({
      data: [changeRow('first')],
      isLoading: false,
      error: null,
      rowErrors: [],
      progress: { completed: 1, total: 'unknown' },
    })

    act(() => {
      callbacks[0]?.onData({
        type: 'batch',
        batch: {
          rows: [],
          errors: [{ changeId: 'later', message: 'later row failed' }],
          progress: { completed: 2, total: 'unknown' },
        },
        progress: { completed: 2, total: 'unknown' },
        identity: changeIdentity('A'),
        workGeneration: 1,
      })
    })

    expect(result.current).toMatchObject({
      data: [changeRow('first')],
      isLoading: false,
      error: null,
      rowErrors: [{ changeId: 'later', message: 'later row failed' }],
      progress: { completed: 2, total: 'unknown' },
    })
  })

  it('replaces partial Root A rows when Root B begins its own batch stream', () => {
    const { result } = renderHook(() => useChangesSubscription())

    act(() => {
      callbacks[0]?.onData({
        type: 'batch',
        batch: {
          rows: [changeRow('first')],
          errors: [],
          progress: { completed: 1, total: 2 },
        },
        progress: { completed: 1, total: 2 },
        identity: changeIdentity('A'),
        workGeneration: 1,
      })
    })
    expect(result.current.data).toEqual([changeRow('first')])

    act(() => {
      callbacks[0]?.onData({
        type: 'batch',
        batch: {
          rows: [changeRow('second')],
          errors: [],
          progress: { completed: 1, total: 2 },
        },
        progress: { completed: 1, total: 2 },
        identity: changeIdentity('B'),
        workGeneration: 1,
      })
    })

    expect(result.current).toMatchObject({
      data: [changeRow('second')],
      rowErrors: [],
      progress: { completed: 1, total: 2 },
    })
  })

  it('renders stale rows while the same Planning-root projection revalidates', () => {
    const { result } = renderHook(() => useChangesSubscription())

    act(() => {
      callbacks[0]?.onData({
        type: 'snapshot',
        snapshot: {
          data: { rows: [changeRow('cached')], errors: [] },
          freshness: 'stale-display-only',
          identity: changeIdentity('A'),
          workGeneration: 2,
        },
      })
    })

    expect(result.current).toMatchObject({
      data: [changeRow('cached')],
      isLoading: false,
      isUpdating: true,
      error: null,
    })

    act(() => {
      callbacks[0]?.onData({
        type: 'snapshot',
        snapshot: {
          data: { rows: [changeRow('current')], errors: [] },
          freshness: 'current',
          identity: changeIdentity('A'),
          workGeneration: 2,
        },
      })
    })

    expect(result.current).toMatchObject({
      data: [changeRow('current')],
      isLoading: false,
      isUpdating: false,
      error: null,
    })
  })
})
