/**
 * Orthogonal intents (created 2026-07-26 Asia/Shanghai):
 * 1. Map all five typed CLI Projection states into display, typed failure evidence, and authority state.
 * 2. Correlate refresh settlement by exact Work identity and generation.
 * 3. Reject a pending refresh when its selector/source generation rebinds.
 *
 * Original request (2026-07-26): "覆盖五态、revalidating 保留 display data 但 authority 非 current、refresh identity+generation、selector/source rebind 不得错误 resolve 老 waiter。"
 * Original request (2026-07-26): "cliEvidence null only for infrastructure errors."
 */
import type { CliProjectionCommandEvidence, CliProjectionState } from '@openspecui/core'
import {
  PlanningCliProjectionStateSchema,
  type PlanningCliProjectionData,
} from '@openspecui/core/planning-cli-projection'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CliProjectionError,
  useCliProjectionLifecycle,
  type CliProjectionLifecycleSource,
} from './use-cli-projection'

vi.mock('./trpc', () => ({ trpcClient: {} }))

interface LifecycleCallbacks {
  onNotice(): void
  onConnectionState(state: 'connecting' | 'pending'): void
  onError(error: unknown): void
  onStopped(): void
  onComplete(): void
}

interface ProjectionHarness {
  source: CliProjectionLifecycleSource<PlanningCliProjectionData>
  readMock: ReturnType<typeof vi.fn<() => Promise<unknown>>>
  refreshMock: ReturnType<typeof vi.fn<() => Promise<unknown>>>
  emitNotice(): void
  setProjection(state: CliProjectionState<PlanningCliProjectionData>): void
  setRefreshResult(state: CliProjectionState<PlanningCliProjectionData>): void
}

const CLI_FAILURE_EVIDENCE: CliProjectionCommandEvidence = {
  success: false,
  stdout: '{"status":[{"severity":"error","code":"INVALID","message":"Invalid input."}]}',
  stderr: 'status failed\n',
  exitCode: 7,
  payload: {
    status: [{ severity: 'error', code: 'INVALID', message: 'Invalid input.' }],
  },
  diagnostics: [{ severity: 'error', code: 'INVALID', message: 'Invalid input.' }],
  contractError: 'status: expected valid status payload',
}

function projectionData(label: string): PlanningCliProjectionData {
  const commandEvidence = {
    success: true,
    stdout: '{}',
    stderr: '',
    exitCode: 0,
    payload: {},
    diagnostics: [],
  }
  return {
    kind: 'opsx-config-bundle',
    value: {
      schemas: [{ name: label, artifacts: [], source: 'project' }],
      schemaDetails: {},
      schemaResolutions: {},
    },
    evidence: { schemas: commandEvidence, schemaResolutions: {} },
  }
}

function loading(
  identity: string,
  workGeneration: number
): CliProjectionState<PlanningCliProjectionData> {
  return {
    state: 'loading',
    identity,
    workGeneration,
    invalidationCause: 'initial',
    data: null,
    freshness: null,
    snapshotGeneration: null,
    error: null,
  }
}

function ready(
  identity: string,
  workGeneration: number,
  label: string
): CliProjectionState<PlanningCliProjectionData> {
  return {
    state: 'ready',
    identity,
    workGeneration,
    invalidationCause: 'initial',
    data: projectionData(label),
    freshness: 'current',
    snapshotGeneration: workGeneration,
    error: null,
  }
}

function revalidating(
  identity: string,
  workGeneration: number,
  label: string
): CliProjectionState<PlanningCliProjectionData> {
  return {
    state: 'revalidating',
    identity,
    workGeneration,
    invalidationCause: 'dependency',
    data: projectionData(label),
    freshness: 'stale-display-only',
    snapshotGeneration: workGeneration - 1,
    error: null,
  }
}

function error(
  identity: string,
  workGeneration: number
): CliProjectionState<PlanningCliProjectionData> {
  return {
    state: 'error',
    identity,
    workGeneration,
    invalidationCause: 'initial',
    data: null,
    freshness: null,
    snapshotGeneration: null,
    error: { name: 'Error', message: 'Initial projection failed.', cliEvidence: null },
  }
}

function refreshError(
  identity: string,
  workGeneration: number,
  label: string
): CliProjectionState<PlanningCliProjectionData> {
  return {
    state: 'refresh-error',
    identity,
    workGeneration,
    invalidationCause: 'dependency',
    data: projectionData(label),
    freshness: 'stale-display-only',
    snapshotGeneration: workGeneration - 1,
    error: {
      name: 'Error',
      message: 'Replacement projection failed.',
      cliEvidence: null,
    },
  }
}

function commandError(
  identity: string,
  workGeneration: number
): CliProjectionState<PlanningCliProjectionData> {
  return {
    state: 'error',
    identity,
    workGeneration,
    invalidationCause: 'explicit-refresh',
    data: null,
    freshness: null,
    snapshotGeneration: null,
    error: {
      name: 'CliProjectionCommandError',
      message: 'OpenSpec status failed.',
      cliEvidence: CLI_FAILURE_EVIDENCE,
    },
  }
}

function createProjectionHarness(
  initial: CliProjectionState<PlanningCliProjectionData>
): ProjectionHarness {
  let current = initial
  let refreshResult = initial
  const callbacks = new Set<LifecycleCallbacks>()
  const readMock = vi.fn<() => Promise<unknown>>(async () => current)
  const refreshMock = vi.fn<() => Promise<unknown>>(async () => refreshResult)
  const source: CliProjectionLifecycleSource<PlanningCliProjectionData> = {
    read: readMock,
    refresh: refreshMock,
    parseState: (raw) => PlanningCliProjectionStateSchema.parse(raw),
    subscribe(next) {
      callbacks.add(next)
      return { unsubscribe: () => callbacks.delete(next) }
    },
  }
  return {
    source,
    readMock,
    refreshMock,
    emitNotice() {
      for (const callback of callbacks) callback.onNotice()
    },
    setProjection(state) {
      current = state
    },
    setRefreshResult(state) {
      refreshResult = state
    },
  }
}

function selectLabel(data: PlanningCliProjectionData): string {
  if (data.kind !== 'opsx-config-bundle') {
    throw new Error(`Expected opsx-config-bundle, received ${data.kind}.`)
  }
  return data.value.schemas[0]?.name ?? 'missing'
}

function useHarnessProjection(harness: ProjectionHarness, sourceKey: string, cacheKey: string) {
  return useCliProjectionLifecycle({
    source: harness.source,
    sourceKey,
    selectData: selectLabel,
    staticLoader: async () => 'static',
    cacheKey,
  })
}

describe('useCliProjectionLifecycle', () => {
  afterEach(() => cleanup())

  it('maps loading, ready, revalidating, refresh-error, and error without losing settled display data', async () => {
    const identity = 'projection:five-states'
    const harness = createProjectionHarness(loading(identity, 1))
    const { result } = renderHook(() =>
      useHarnessProjection(harness, identity, 'test.cli-projection.five-states')
    )

    act(() => harness.emitNotice())
    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: undefined,
        isLoading: true,
        error: null,
        authority: { state: 'waiting', reason: 'pending' },
      })
    })

    harness.setProjection(ready(identity, 1, 'A'))
    act(() => harness.emitNotice())
    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: 'A',
        isLoading: false,
        isUpdating: false,
        error: null,
        authority: { state: 'current' },
      })
    })

    harness.setProjection(revalidating(identity, 2, 'A'))
    act(() => harness.emitNotice())
    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: 'A',
        isLoading: false,
        isUpdating: true,
        error: null,
        authority: { state: 'waiting', reason: 'pending' },
      })
    })

    harness.setProjection(refreshError(identity, 2, 'A'))
    act(() => harness.emitNotice())
    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: 'A',
        isLoading: false,
        isUpdating: true,
        error: { message: 'Replacement projection failed.' },
        authority: { state: 'failed' },
      })
      expect(result.current.error).toBeInstanceOf(CliProjectionError)
      expect(result.current.error?.cliEvidence).toBeNull()
    })

    harness.setProjection(error(identity, 3))
    act(() => harness.emitNotice())
    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: 'A',
        isLoading: false,
        isUpdating: true,
        error: { message: 'Initial projection failed.' },
        authority: { state: 'failed' },
      })
      expect(result.current.error).toBeInstanceOf(CliProjectionError)
      expect(result.current.error?.cliEvidence).toBeNull()
    })

    harness.setProjection(commandError(identity, 4))
    act(() => harness.emitNotice())
    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: 'A',
        isLoading: false,
        isUpdating: true,
        error: { name: 'CliProjectionCommandError', message: 'OpenSpec status failed.' },
        authority: { state: 'failed' },
      })
      expect(result.current.error).toBeInstanceOf(CliProjectionError)
      expect(result.current.error?.cliEvidence).toEqual(CLI_FAILURE_EVIDENCE)
      expect(result.current.authority.state).not.toBe('current')
    })
  })

  it('settles refresh only for its exact identity at the requested or newer generation', async () => {
    const identity = 'projection:refresh-correlation'
    const harness = createProjectionHarness(ready(identity, 1, 'A'))
    const { result } = renderHook(() =>
      useHarnessProjection(harness, identity, 'test.cli-projection.refresh-correlation')
    )
    act(() => harness.emitNotice())
    await waitFor(() => expect(result.current.authority).toEqual({ state: 'current' }))

    const replacement = revalidating(identity, 2, 'A')
    harness.setProjection(replacement)
    harness.setRefreshResult(replacement)
    let refreshPromise!: Promise<void>
    let settled = false
    act(() => {
      refreshPromise = result.current.refresh()
      void refreshPromise.then(() => {
        settled = true
      })
    })
    await waitFor(() => {
      expect(harness.refreshMock).toHaveBeenCalledOnce()
      expect(harness.readMock).toHaveBeenCalledTimes(2)
      expect(result.current.refreshPending).toBe(true)
    })

    harness.setProjection(ready('projection:other-identity', 99, 'wrong-identity'))
    act(() => harness.emitNotice())
    await waitFor(() => expect(result.current.data).toBe('wrong-identity'))
    expect(settled).toBe(false)

    harness.setProjection(ready(identity, 1, 'old-generation'))
    act(() => harness.emitNotice())
    await waitFor(() => expect(result.current.data).toBe('old-generation'))
    expect(settled).toBe(false)

    harness.setProjection(ready(identity, 2, 'B'))
    act(() => harness.emitNotice())
    await expect(refreshPromise).resolves.toBeUndefined()
    await waitFor(() => {
      expect(result.current).toMatchObject({
        data: 'B',
        refreshPending: false,
        authority: { state: 'current' },
      })
    })
  })

  it('rejects the old refresh waiter when its source key rebinds and admits only the new source', async () => {
    const sourceA = createProjectionHarness(ready('projection:A', 1, 'A'))
    const sourceB = createProjectionHarness(ready('projection:B', 1, 'B'))
    const view = renderHook(
      ({ harness, sourceKey }: { harness: ProjectionHarness; sourceKey: string }) =>
        useHarnessProjection(harness, sourceKey, 'test.cli-projection.rebind'),
      { initialProps: { harness: sourceA, sourceKey: 'selector:A' } }
    )
    act(() => sourceA.emitNotice())
    await waitFor(() => expect(view.result.current.data).toBe('A'))

    const replacementA = revalidating('projection:A', 2, 'A')
    sourceA.setProjection(replacementA)
    sourceA.setRefreshResult(replacementA)
    let refreshPromise!: Promise<void>
    act(() => {
      refreshPromise = view.result.current.refresh()
    })
    const oldSettlement = expect(refreshPromise).rejects.toThrow(
      'CLI projection refresh was retired by a source rebind.'
    )
    await waitFor(() => {
      expect(sourceA.readMock).toHaveBeenCalledTimes(2)
      expect(view.result.current.refreshPending).toBe(true)
    })

    view.rerender({ harness: sourceB, sourceKey: 'selector:B' })
    await oldSettlement
    await waitFor(() => expect(view.result.current.refreshPending).toBe(false))

    act(() => sourceA.emitNotice())
    act(() => sourceB.emitNotice())
    await waitFor(() => {
      expect(view.result.current).toMatchObject({
        data: 'B',
        authority: { state: 'current' },
      })
    })
  })
})
