/**
 * Orthogonal intents (updated 2026-07-26 Asia/Shanghai):
 * 1. Drive Environment Global lifecycle-only Push through typed Pull endpoints.
 * 2. Prove revalidating data remains displayable while write authority is revoked.
 * 3. Prove refresh-error keeps stale data visible, settles refresh, and cannot authorize writes.
 *
 * Original request (2026-07-18): "Refresh locking must span the asynchronous subscription rebind."
 * Original request (2026-07-26): "Environment Global stale/refresh-error 不得授权写入（在 hook 可观测边界证明）。"
 */
import type {
  EnvironmentGlobalFileProjectionData,
  EnvironmentGlobalFileProjectionState,
  EnvironmentGlobalProjectionData,
  EnvironmentGlobalProjectionState,
} from '@openspecui/core/planning-cli-projection'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEnvironmentGlobalConfigSubscription } from './use-planning-config'

interface ProjectionNoticeCallbacks {
  onData(data: unknown): void
  onError(error: Error): void
  onConnectionStateChange(state: {
    state: 'idle' | 'connecting' | 'pending'
    error: Error | null
  }): void
  onStopped(): void
  onComplete(): void
}

const {
  projectionReadMock,
  projectionRefreshMock,
  projectionSubscribeMock,
  fileProjectionReadMock,
  fileProjectionRefreshMock,
  fileProjectionSubscribeMock,
} = vi.hoisted(() => ({
  projectionReadMock: vi.fn<() => Promise<EnvironmentGlobalProjectionState>>(),
  projectionRefreshMock: vi.fn<() => Promise<EnvironmentGlobalProjectionState>>(),
  projectionSubscribeMock:
    vi.fn<(input: undefined, callbacks: ProjectionNoticeCallbacks) => { unsubscribe(): void }>(),
  fileProjectionReadMock: vi.fn<() => Promise<EnvironmentGlobalFileProjectionState>>(),
  fileProjectionRefreshMock: vi.fn<() => Promise<EnvironmentGlobalFileProjectionState>>(),
  fileProjectionSubscribeMock:
    vi.fn<(input: undefined, callbacks: ProjectionNoticeCallbacks) => { unsubscribe(): void }>(),
}))

vi.mock('./static-mode', () => ({ isStaticMode: () => false }))
vi.mock('./trpc', () => ({
  trpcClient: {
    planningConfig: {
      readEnvironmentGlobalProjection: { query: projectionReadMock },
      refreshEnvironmentGlobalProjection: { mutate: projectionRefreshMock },
      subscribeEnvironmentGlobalProjection: { subscribe: projectionSubscribeMock },
      readEnvironmentGlobalFileProjection: { query: fileProjectionReadMock },
      refreshEnvironmentGlobalFileProjection: { mutate: fileProjectionRefreshMock },
      subscribeEnvironmentGlobalFileProjection: { subscribe: fileProjectionSubscribeMock },
    },
  },
}))

function environmentGlobalData(): EnvironmentGlobalProjectionData {
  const config = { profile: 'core', futureField: { retained: true } }
  return {
    kind: 'environment-global',
    owner: {
      kind: 'runtime-environment',
      dataScope: {
        path: '/runtime/openspec',
        source: 'xdg-data-home',
        environmentVariable: 'XDG_DATA_HOME',
      },
    },
    configPath: '/runtime/openspec/config.json',
    config,
    profileState: {
      available: true,
      profile: 'core',
      delivery: 'both',
      workflows: ['propose', 'apply'],
      driftStatus: 'in-sync',
      warningText: null,
    },
    evidence: {
      path: { success: true, stdout: '/runtime/openspec/config.json\n', stderr: '', exitCode: 0 },
      config: {
        success: true,
        stdout: JSON.stringify(config),
        stderr: '',
        exitCode: 0,
        data: config,
        payload: config,
        diagnostics: [],
      },
      drift: { success: true, stdout: '', stderr: '', exitCode: 0 },
    },
  }
}

function environmentGlobalFileData(): EnvironmentGlobalFileProjectionData {
  return {
    kind: 'environment-global-file',
    owner: {
      kind: 'runtime-environment',
      dataScope: {
        path: '/runtime/openspec',
        source: 'xdg-data-home',
        environmentVariable: 'XDG_DATA_HOME',
      },
    },
    file: {
      path: '/runtime/openspec/config.json',
      format: 'json',
      exists: true,
      content: '{"profile":"core"}\n',
    },
  }
}

function readyFile(workGeneration: number): EnvironmentGlobalFileProjectionState {
  return {
    state: 'ready',
    identity: 'environment-global-file:test',
    workGeneration,
    invalidationCause: 'initial',
    data: environmentGlobalFileData(),
    freshness: 'current',
    snapshotGeneration: workGeneration,
    error: null,
  }
}

function fileNotice(state: EnvironmentGlobalFileProjectionState) {
  return {
    identity: state.identity,
    workGeneration: state.workGeneration,
    snapshotGeneration: state.snapshotGeneration,
    state: state.state,
    invalidationCause: state.invalidationCause,
  }
}

function ready(
  data: EnvironmentGlobalProjectionData,
  workGeneration: number
): EnvironmentGlobalProjectionState {
  return {
    state: 'ready',
    identity: 'environment-global:test',
    workGeneration,
    invalidationCause: 'initial',
    data,
    freshness: 'current',
    snapshotGeneration: workGeneration,
    error: null,
  }
}

function revalidating(
  data: EnvironmentGlobalProjectionData,
  workGeneration: number
): EnvironmentGlobalProjectionState {
  return {
    state: 'revalidating',
    identity: 'environment-global:test',
    workGeneration,
    invalidationCause: 'dependency',
    data,
    freshness: 'stale-display-only',
    snapshotGeneration: workGeneration - 1,
    error: null,
  }
}

function refreshError(
  data: EnvironmentGlobalProjectionData,
  workGeneration: number
): EnvironmentGlobalProjectionState {
  return {
    state: 'refresh-error',
    identity: 'environment-global:test',
    workGeneration,
    invalidationCause: 'dependency',
    data,
    freshness: 'stale-display-only',
    snapshotGeneration: workGeneration - 1,
    error: {
      name: 'Error',
      message: 'Environment Global refresh failed.',
      cliEvidence: null,
    },
  }
}

function notice(state: EnvironmentGlobalProjectionState) {
  return {
    identity: state.identity,
    workGeneration: state.workGeneration,
    snapshotGeneration: state.snapshotGeneration,
    state: state.state,
    invalidationCause: state.invalidationCause,
  }
}

function useEnvironmentGlobalWithWriteAuthority() {
  const projection = useEnvironmentGlobalConfigSubscription()
  return {
    projection,
    canWrite: projection.authority.state === 'current' && !projection.refreshPending,
  }
}

describe('useEnvironmentGlobalConfigSubscription', () => {
  const subscriptions: ProjectionNoticeCallbacks[] = []
  const fileSubscriptions: ProjectionNoticeCallbacks[] = []
  let currentProjection: EnvironmentGlobalProjectionState

  beforeEach(() => {
    subscriptions.length = 0
    fileSubscriptions.length = 0
    currentProjection = ready(environmentGlobalData(), 1)
    projectionReadMock.mockReset().mockImplementation(async () => currentProjection)
    projectionRefreshMock.mockReset()
    projectionSubscribeMock.mockReset().mockImplementation((_input, callbacks) => {
      subscriptions.push(callbacks)
      return { unsubscribe: vi.fn() }
    })
    fileProjectionReadMock.mockReset().mockResolvedValue(readyFile(1))
    fileProjectionRefreshMock.mockReset().mockResolvedValue(readyFile(1))
    fileProjectionSubscribeMock.mockReset().mockImplementation((_input, callbacks) => {
      fileSubscriptions.push(callbacks)
      return { unsubscribe: vi.fn() }
    })
  })

  afterEach(() => cleanup())

  it('retains Environment Global display data but revokes write authority for stale and refresh-error states', async () => {
    const { result } = renderHook(() => useEnvironmentGlobalWithWriteAuthority())
    await waitFor(() => expect(projectionSubscribeMock).toHaveBeenCalledOnce())
    await waitFor(() => expect(fileProjectionSubscribeMock).toHaveBeenCalledOnce())

    act(() => {
      subscriptions[0]?.onData(notice(currentProjection))
      fileSubscriptions[0]?.onData(fileNotice(readyFile(1)))
    })
    await waitFor(() => {
      expect(result.current.projection.authority).toEqual({ state: 'current' })
      expect(result.current.canWrite).toBe(true)
    })
    const settledData = result.current.projection.data

    currentProjection = revalidating(environmentGlobalData(), 2)
    act(() => {
      subscriptions[0]?.onData(notice(currentProjection))
      fileSubscriptions[0]?.onData(fileNotice(readyFile(1)))
    })
    await waitFor(() => {
      expect(result.current.projection).toMatchObject({
        data: settledData,
        isLoading: false,
        isUpdating: true,
        error: null,
        authority: { state: 'waiting', reason: 'pending' },
      })
      expect(result.current.canWrite).toBe(false)
    })

    currentProjection = refreshError(environmentGlobalData(), 2)
    act(() => {
      subscriptions[0]?.onData(notice(currentProjection))
      fileSubscriptions[0]?.onData(fileNotice(readyFile(1)))
    })
    await waitFor(() => {
      expect(result.current.projection).toMatchObject({
        data: settledData,
        isLoading: false,
        isUpdating: true,
        error: { message: 'Environment Global refresh failed.' },
        authority: { state: 'failed' },
      })
      expect(result.current.canWrite).toBe(false)
    })
  })

  it('uses the refresh endpoint and settles matching refresh-error only after its Pull commits', async () => {
    const { result } = renderHook(() => useEnvironmentGlobalWithWriteAuthority())
    await waitFor(() => expect(projectionSubscribeMock).toHaveBeenCalledOnce())
    await waitFor(() => expect(fileProjectionSubscribeMock).toHaveBeenCalledOnce())
    act(() => {
      subscriptions[0]?.onData(notice(currentProjection))
      fileSubscriptions[0]?.onData(fileNotice(readyFile(1)))
    })
    await waitFor(() => expect(result.current.canWrite).toBe(true))

    currentProjection = revalidating(environmentGlobalData(), 2)
    projectionRefreshMock.mockResolvedValue(currentProjection)
    let refreshPromise!: Promise<void>
    act(() => {
      refreshPromise = result.current.projection.refresh()
    })

    await waitFor(() => {
      expect(projectionRefreshMock).toHaveBeenCalledOnce()
      expect(result.current.projection.refreshPending).toBe(true)
      expect(result.current.projection.authority).toEqual({ state: 'waiting', reason: 'pending' })
      expect(result.current.canWrite).toBe(false)
    })

    currentProjection = refreshError(environmentGlobalData(), 2)
    act(() => {
      subscriptions[0]?.onData(notice(currentProjection))
      fileSubscriptions[0]?.onData(fileNotice(readyFile(1)))
    })
    await expect(refreshPromise).resolves.toBeUndefined()
    await waitFor(() => {
      expect(result.current.projection.refreshPending).toBe(false)
      expect(result.current.projection.data).toBeDefined()
      expect(result.current.projection.authority).toMatchObject({ state: 'failed' })
      expect(result.current.canWrite).toBe(false)
    })
  })
})
