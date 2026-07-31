/**
 * Orthogonal intents (updated 2026-07-30 Asia/Shanghai):
 * 1. Prove Store display provenance retires immediately across backend locator replacement.
 * 2. Preserve same-locator settled Store data as display-only during revalidation.
 * 3. Prove stale, pending, and refresh-error Store lifecycle states cannot retain mutation authority.
 * 4. Prove a fresh owner performs its typed Pull before the first lifecycle notice.
 * 5. Prove explicit refresh is single-flight and locks the complete request lifecycle.
 *
 * Original request (2026-07-26): "真正基于文件、甚至是文件内容结构的变更去拉取更新。"
 * Owner architecture clarification (2026-07-26): "界面上仍然可以读到缓存，但它也能知道这个缓存现在正在被更新中。"
 */
// @vitest-environment jsdom

import type {
  HostedCliProjectionNotice,
  HostedStoreDoctorProjectionState,
  HostedStoreListProjectionState,
} from '@openspecui/core/hosted-contract'
import { act, cleanup, render, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchBackendStoreInspectorProjection,
  fetchBackendStoreInventoryProjection,
  refreshBackendStoreProjections,
} from './backend-client'
import type {
  CliProjectionSelector,
  CliProjectionTransportCallbacks,
} from './cli-projection-transport'
import { useStoreData } from './use-store-data'

const transport = vi.hoisted(() => {
  const callbacks = new Map<string, CliProjectionTransportCallbacks>()
  const key = (apiBaseUrl: string, selector: CliProjectionSelector) =>
    `${apiBaseUrl}:${selector.kind}`
  return {
    connect(
      apiBaseUrl: string,
      selector: CliProjectionSelector,
      nextCallbacks: CliProjectionTransportCallbacks
    ) {
      const identity = key(apiBaseUrl, selector)
      callbacks.set(identity, nextCallbacks)
      return {
        unsubscribe() {
          if (callbacks.get(identity) === nextCallbacks) callbacks.delete(identity)
        },
      }
    },
    get(apiBaseUrl: string, kind: CliProjectionSelector['kind']) {
      const nextCallbacks = callbacks.get(`${apiBaseUrl}:${kind}`)
      if (!nextCallbacks) throw new Error(`Missing ${apiBaseUrl}:${kind} transport.`)
      return nextCallbacks
    },
    reset() {
      callbacks.clear()
    },
  }
})

vi.mock('./cli-projection-transport', async (importOriginal) => {
  const original = await importOriginal<typeof import('./cli-projection-transport')>()
  return {
    ...original,
    createTRPCCliProjectionTransportFactory: () => ({ connect: transport.connect }),
  }
})

vi.mock('./backend-client', async (importOriginal) => {
  const original = await importOriginal<typeof import('./backend-client')>()
  return {
    ...original,
    fetchBackendStoreInventoryProjection: vi.fn(),
    fetchBackendStoreInspectorProjection: vi.fn(),
    refreshBackendStoreProjections: vi.fn(),
  }
})

const API_A = 'http://localhost:3111'
const API_B = 'http://localhost:3112'

interface Deferred<T> {
  promise: Promise<T>
  resolve(value: T): void
}

function createDeferred<T>(): Deferred<T> {
  let resolvePromise: ((value: T) => void) | undefined
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve
  })
  return {
    promise,
    resolve(value) {
      if (!resolvePromise) throw new Error('Deferred resolver was not initialized.')
      resolvePromise(value)
    },
  }
}

function listState(apiBaseUrl: string): HostedStoreListProjectionState {
  return {
    state: 'ready',
    identity: `${apiBaseUrl}:store-list`,
    workGeneration: 1,
    invalidationCause: 'initial',
    data: {
      available: true,
      stores: [{ id: `${apiBaseUrl}-inventory`, root: `/stores/${apiBaseUrl}` }],
    },
    freshness: 'current',
    snapshotGeneration: 1,
    error: null,
  }
}

function doctorState(apiBaseUrl: string): HostedStoreDoctorProjectionState {
  return {
    state: 'ready',
    identity: `${apiBaseUrl}:store-doctor`,
    workGeneration: 1,
    invalidationCause: 'initial',
    data: {
      available: true,
      stores: [{ id: `${apiBaseUrl}-doctor`, root: `/stores/${apiBaseUrl}` }],
    },
    freshness: 'current',
    snapshotGeneration: 1,
    error: null,
  }
}

function notice(
  apiBaseUrl: string,
  kind: 'store-list' | 'store-doctor',
  state: HostedCliProjectionNotice['state'] = 'ready',
  workGeneration = 1
): HostedCliProjectionNotice {
  return {
    state,
    identity: `${apiBaseUrl}:${kind}`,
    workGeneration,
    invalidationCause: workGeneration === 1 ? 'initial' : 'dependency',
    snapshotGeneration: 1,
  }
}

async function publishReady(apiBaseUrl: string): Promise<void> {
  await waitFor(() => transport.get(apiBaseUrl, 'store-list'))
  await act(async () => {
    transport.get(apiBaseUrl, 'store-list').onNotice(notice(apiBaseUrl, 'store-list'))
    transport.get(apiBaseUrl, 'store-doctor').onNotice(notice(apiBaseUrl, 'store-doctor'))
  })
}

interface StoreDataRenderSnapshot {
  apiBaseUrl: string
  inventoryId: string | null
  inspectorId: string | null
  errorMessage: string | null
  isInventoryUpdating: boolean
  isInspectorUpdating: boolean
  canMutate: boolean
}

function StoreDataProbe({
  apiBaseUrl,
  snapshots,
}: {
  apiBaseUrl: string
  snapshots: StoreDataRenderSnapshot[]
}) {
  const state = useStoreData({ apiBaseUrl })
  snapshots.push({
    apiBaseUrl,
    inventoryId: state.inventory?.stores[0]?.id ?? null,
    inspectorId: state.inspector?.stores[0]?.id ?? null,
    errorMessage: state.inventoryError?.message ?? state.inspectorError?.message ?? null,
    isInventoryUpdating: state.isInventoryUpdating,
    isInspectorUpdating: state.isInspectorUpdating,
    canMutate: state.canMutate,
  })
  return null
}

afterEach(() => {
  cleanup()
  transport.reset()
  vi.clearAllMocks()
})

describe('useStoreData locator provenance', () => {
  it('single-flights explicit refresh and exposes its loading lock until replacement Pull settles', async () => {
    vi.mocked(fetchBackendStoreInventoryProjection).mockResolvedValue(listState(API_A))
    vi.mocked(fetchBackendStoreInspectorProjection).mockResolvedValue(doctorState(API_A))
    const refreshRequest = createDeferred<void>()
    vi.mocked(refreshBackendStoreProjections).mockReturnValue(refreshRequest.promise)
    const view = renderHook(() => useStoreData({ apiBaseUrl: API_A }))

    await publishReady(API_A)
    await waitFor(() => expect(view.result.current.canMutate).toBe(true))

    let firstRefresh: Promise<void> | undefined
    let secondRefresh: Promise<void> | undefined
    act(() => {
      firstRefresh = view.result.current.refresh()
      secondRefresh = view.result.current.refresh()
    })

    expect(firstRefresh).toBe(secondRefresh)
    expect(refreshBackendStoreProjections).toHaveBeenCalledTimes(1)
    expect(view.result.current.isInventoryUpdating).toBe(true)
    expect(view.result.current.isInspectorUpdating).toBe(true)
    expect(view.result.current.canMutate).toBe(false)

    await act(async () => {
      refreshRequest.resolve()
      await firstRefresh
    })
    expect(view.result.current.isInventoryUpdating).toBe(false)
    expect(view.result.current.isInspectorUpdating).toBe(false)
  })

  it('pulls Store list and Doctor immediately before the first lifecycle notice', async () => {
    vi.mocked(fetchBackendStoreInventoryProjection).mockResolvedValue(listState(API_A))
    vi.mocked(fetchBackendStoreInspectorProjection).mockResolvedValue(doctorState(API_A))
    const view = renderHook(() => useStoreData({ apiBaseUrl: API_A }))

    await waitFor(() => {
      expect(view.result.current.inventory?.stores[0]?.id).toBe(`${API_A}-inventory`)
      expect(view.result.current.inspector?.stores[0]?.id).toBe(`${API_A}-doctor`)
    })
    expect(fetchBackendStoreInventoryProjection).toHaveBeenCalledWith({ apiBaseUrl: API_A })
    expect(fetchBackendStoreInspectorProjection).toHaveBeenCalledWith({ apiBaseUrl: API_A })
    expect(view.result.current.canMutate).toBe(false)
  })

  it('keeps Inspector loading while Store list settles independently', async () => {
    const pendingDoctor = createDeferred<HostedStoreDoctorProjectionState>()
    vi.mocked(fetchBackendStoreInventoryProjection).mockResolvedValue(listState(API_A))
    vi.mocked(fetchBackendStoreInspectorProjection).mockReturnValue(pendingDoctor.promise)
    const view = renderHook(() => useStoreData({ apiBaseUrl: API_A }))

    await waitFor(() => transport.get(API_A, 'store-list'))
    await act(async () => {
      transport.get(API_A, 'store-list').onNotice(notice(API_A, 'store-list'))
    })
    await waitFor(() => expect(view.result.current.inventory?.stores[0]?.id).toContain(API_A))

    expect(view.result.current.isInventoryLoading).toBe(false)
    expect(view.result.current.isInspectorLoading).toBe(true)
    expect(view.result.current.inspector).toBeUndefined()
    expect(view.result.current.canMutate).toBe(false)
  })

  it("masks A Store facts during B's first render before the rebind effect retires A", async () => {
    vi.mocked(fetchBackendStoreInventoryProjection).mockResolvedValue(listState(API_A))
    vi.mocked(fetchBackendStoreInspectorProjection).mockResolvedValue(doctorState(API_A))
    const snapshots: StoreDataRenderSnapshot[] = []
    const view = render(<StoreDataProbe apiBaseUrl={API_A} snapshots={snapshots} />)

    await publishReady(API_A)
    await waitFor(() => {
      expect(snapshots.at(-1)).toMatchObject({
        apiBaseUrl: API_A,
        inventoryId: `${API_A}-inventory`,
        inspectorId: `${API_A}-doctor`,
        errorMessage: null,
        isInventoryUpdating: false,
        isInspectorUpdating: false,
        canMutate: true,
      })
    })

    const renderCountBeforeB = snapshots.length
    view.rerender(<StoreDataProbe apiBaseUrl={API_B} snapshots={snapshots} />)

    expect(snapshots[renderCountBeforeB]).toEqual({
      apiBaseUrl: API_B,
      inventoryId: null,
      inspectorId: null,
      errorMessage: null,
      isInventoryUpdating: false,
      isInspectorUpdating: false,
      canMutate: false,
    })
  })

  it("masks an A transport error during B's first render", async () => {
    vi.mocked(fetchBackendStoreInventoryProjection).mockResolvedValue(listState(API_A))
    vi.mocked(fetchBackendStoreInspectorProjection).mockResolvedValue(doctorState(API_A))
    const snapshots: StoreDataRenderSnapshot[] = []
    const view = render(<StoreDataProbe apiBaseUrl={API_A} snapshots={snapshots} />)

    await publishReady(API_A)
    await waitFor(() => expect(snapshots.at(-1)?.canMutate).toBe(true))
    await act(async () => {
      transport.get(API_A, 'store-list').onError(new Error('A transport failed'))
    })
    await waitFor(() => expect(snapshots.at(-1)?.errorMessage).toBe('A transport failed'))

    const renderCountBeforeB = snapshots.length
    view.rerender(<StoreDataProbe apiBaseUrl={API_B} snapshots={snapshots} />)

    expect(snapshots[renderCountBeforeB]).toMatchObject({
      apiBaseUrl: API_B,
      errorMessage: null,
      isInventoryUpdating: false,
      isInspectorUpdating: false,
      canMutate: false,
    })
  })

  it('retires settled A Store data immediately when locator B begins its first Pull', async () => {
    const pendingListB = createDeferred<HostedStoreListProjectionState>()
    const pendingDoctorB = createDeferred<HostedStoreDoctorProjectionState>()
    vi.mocked(fetchBackendStoreInventoryProjection).mockImplementation(({ apiBaseUrl }) =>
      apiBaseUrl === API_A ? Promise.resolve(listState(API_A)) : pendingListB.promise
    )
    vi.mocked(fetchBackendStoreInspectorProjection).mockImplementation(({ apiBaseUrl }) =>
      apiBaseUrl === API_A ? Promise.resolve(doctorState(API_A)) : pendingDoctorB.promise
    )
    const view = renderHook(
      ({ apiBaseUrl }: { apiBaseUrl: string }) => useStoreData({ apiBaseUrl }),
      { initialProps: { apiBaseUrl: API_A } }
    )

    await publishReady(API_A)
    await waitFor(() => expect(view.result.current.inventory?.stores[0]?.id).toContain(API_A))
    expect(view.result.current.inspector?.stores[0]?.id).toContain(API_A)
    expect(view.result.current.canMutate).toBe(true)

    await act(async () => view.rerender({ apiBaseUrl: API_B }))

    expect(view.result.current.inventory).toBeUndefined()
    expect(view.result.current.inspector).toBeUndefined()
    expect(view.result.current.canMutate).toBe(false)
    expect(view.result.current.isInventoryLoading).toBe(true)
    expect(view.result.current.isInspectorLoading).toBe(true)

    pendingListB.resolve(listState(API_B))
    pendingDoctorB.resolve(doctorState(API_B))
  })

  it('retains same-locator settled data as display-only while replacement Work is pending', async () => {
    const replacementList = createDeferred<HostedStoreListProjectionState>()
    const replacementDoctor = createDeferred<HostedStoreDoctorProjectionState>()
    vi.mocked(fetchBackendStoreInventoryProjection)
      .mockResolvedValueOnce(listState(API_A))
      .mockReturnValueOnce(replacementList.promise)
    vi.mocked(fetchBackendStoreInspectorProjection)
      .mockResolvedValueOnce(doctorState(API_A))
      .mockReturnValueOnce(replacementDoctor.promise)
    const view = renderHook(() => useStoreData({ apiBaseUrl: API_A }))

    await publishReady(API_A)
    await waitFor(() => expect(view.result.current.canMutate).toBe(true))
    await act(async () => {
      transport.get(API_A, 'store-list').onNotice(notice(API_A, 'store-list', 'revalidating', 2))
      transport
        .get(API_A, 'store-doctor')
        .onNotice(notice(API_A, 'store-doctor', 'revalidating', 2))
    })

    expect(view.result.current.inventory?.stores[0]?.id).toContain(API_A)
    expect(view.result.current.inspector?.stores[0]?.id).toContain(API_A)
    expect(view.result.current.isInventoryUpdating).toBe(true)
    expect(view.result.current.isInspectorUpdating).toBe(true)
    expect(view.result.current.canMutate).toBe(false)

    replacementList.resolve(listState(API_A))
    replacementDoctor.resolve(doctorState(API_A))
  })

  it('retains Doctor data but exposes its same-locator refresh failure', async () => {
    vi.mocked(fetchBackendStoreInventoryProjection).mockResolvedValue(listState(API_A))
    vi.mocked(fetchBackendStoreInspectorProjection)
      .mockResolvedValueOnce(doctorState(API_A))
      .mockRejectedValueOnce(new Error('Doctor replacement failed'))
    const view = renderHook(() => useStoreData({ apiBaseUrl: API_A }))

    await publishReady(API_A)
    await waitFor(() => expect(view.result.current.canMutate).toBe(true))
    await act(async () => {
      transport
        .get(API_A, 'store-doctor')
        .onNotice(notice(API_A, 'store-doctor', 'revalidating', 2))
    })

    await waitFor(() => {
      expect(view.result.current.inspector?.stores[0]?.id).toContain(API_A)
      expect(view.result.current.inspectorError?.message).toBe('Doctor replacement failed')
    })
    expect(view.result.current.inventoryError).toBeNull()
    expect(view.result.current.canMutate).toBe(false)
  })
})
