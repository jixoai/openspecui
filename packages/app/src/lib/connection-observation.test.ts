/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Prove multi-source health/Root collection, initial Pull, and generation-scoped health re-probe without timers or duplicate requests.
 * 2. Prove exact-tab generations retire late removed/replaced results.
 * 3. Preserve per-source authentication and event-driven disconnect states without cross-source fallback.
 * 4. Keep retained evidence and renderable health separate from replacement observation authority.
 * 5. Reject old-observation/new-tab hybrid authority.
 *
 * Original request (2026-07-24): "apply openspec-change: close-openspec-cli16-delivery-gaps"
 * Owner-reported defect (2026-07-26): "Dashboard加载完成的一瞬间开始reload。"
 * Owner-reported defect (2026-07-27): "SessionTabs 的样式没有立刻更新成 Offline 的 icon。"
 */
import { buildBackendHealthPayload, type HostedBackendHealthResponse } from '@openspecui/core'
import {
  HostedRootContextProjectionStateSchema,
  HostedRootContextStateSchema,
  type HostedRootContextProjectionState,
  type HostedRootContextState,
} from '@openspecui/core/hosted-contract'
import { describe, expect, it, vi } from 'vitest'
import type {
  CliProjectionTransportCallbacks,
  CliProjectionTransportFactory,
} from './cli-projection-transport'
import {
  bindConnectionObservationRefreshTriggers,
  createConnectionObservationOwner as createProductionConnectionObservationOwner,
} from './connection-observation'
import type { HostedBackendProbeResult } from './reachability'
import type { HostedShellTab } from './shell-state'
import { resolveActiveBackendAuthority } from './use-active-backend'
import { deriveProjectContexts, projectRootObservation } from './use-environment'

const API_A = 'http://localhost:3100'
const API_B = 'http://localhost:3200'

class RefreshEventTarget {
  visibilityState: DocumentVisibilityState = 'hidden'
  private readonly listeners = new Map<string, Set<() => void>>()

  addEventListener(type: string, listener: () => void): void {
    const listeners = this.listeners.get(type) ?? new Set<() => void>()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(type: string, listener: () => void): void {
    this.listeners.get(type)?.delete(listener)
  }

  dispatch(type: string): void {
    this.listeners.get(type)?.forEach((listener) => listener())
  }
}

function tab(id: string, apiBaseUrl: string): HostedShellTab {
  return { id, sessionId: `session-${id}`, apiBaseUrl, createdAt: 1 }
}

function health(apiBaseUrl: string, projectName: string): HostedBackendHealthResponse {
  return buildBackendHealthPayload({
    projectDir: `/tmp/${projectName}`,
    projectName,
    watcherEnabled: true,
    openspecuiVersion: '6.0.0',
    embeddedUiUrl: apiBaseUrl,
    apiBaseUrl,
    envUri: `env:${projectName}`,
  })
}

function loadingRoot(observedAt: number): HostedRootContextState {
  return HostedRootContextStateSchema.parse({
    state: 'loading',
    data: null,
    attempt: null,
    error: null,
    observedAt,
  })
}

function readyRoot(projectName: string, observedAt: number): HostedRootContextState {
  return HostedRootContextStateSchema.parse({
    state: 'ready',
    data: {
      launchProject: { path: `/tmp/${projectName}` },
      planningRoot: {
        path: `/stores/${projectName}`,
        source: 'store',
        store_id: projectName,
        healthy: true,
        status: [],
      },
      storeId: projectName,
      generation: `root-${projectName}`,
      cli: { available: true, version: '1.6.0' },
      references: [
        {
          store_id: `${projectName}-reference`,
          root: `/stores/${projectName}-reference`,
          status: [
            {
              severity: 'warning',
              code: 'reference-stale',
              message: 'Retained Reference evidence.',
            },
          ],
        },
      ],
      contextMembers: [],
      dataScope: {
        path: '/tmp/data/openspec',
        source: 'user-home-default',
        environmentVariable: null,
      },
      diagnostics: { root: [], doctor: [], context: [] },
      evidence: { doctor: null, context: null },
      observedAt,
    },
    attempt: null,
    error: null,
    observedAt,
  })
}

function failedRoot(projectName: string, observedAt: number): HostedRootContextState {
  const ready = readyRoot(projectName, observedAt)
  if (ready.state !== 'ready') throw new Error('Ready Root fixture is unavailable.')
  return HostedRootContextStateSchema.parse({
    state: 'error',
    data: ready.data,
    attempt: { ...ready.data, planningRoot: null, observedAt },
    error: { code: 'root-unhealthy', message: 'Root attempt B failed.' },
    observedAt,
  })
}

function rootProjection(
  rootContext: HostedRootContextState,
  workGeneration = 1
): HostedRootContextProjectionState {
  if (rootContext.state === 'loading') {
    return HostedRootContextProjectionStateSchema.parse({
      state: 'loading',
      identity: 'root-context:test',
      workGeneration,
      invalidationCause: 'initial',
      data: null,
      freshness: null,
      snapshotGeneration: null,
      error: null,
    })
  }
  const resolved =
    rootContext.state === 'refreshing'
      ? {
          state: 'ready' as const,
          data: rootContext.data,
          attempt: null,
          error: null,
          observedAt: rootContext.observedAt,
        }
      : rootContext
  return HostedRootContextProjectionStateSchema.parse({
    state: 'ready',
    identity: 'root-context:test',
    workGeneration,
    invalidationCause: 'initial',
    data: resolved,
    freshness: 'current',
    snapshotGeneration: workGeneration,
    error: null,
  })
}

const passiveProjectionTransportFactory: CliProjectionTransportFactory = {
  connect() {
    return { unsubscribe() {} }
  },
}

function createConnectionObservationOwner(
  overrides: Parameters<typeof createProductionConnectionObservationOwner>[0]
) {
  return createProductionConnectionObservationOwner({
    projectionTransportFactory: passiveProjectionTransportFactory,
    refreshRootProjection: async () => {},
    ...overrides,
  })
}

function online(backendHealth: HostedBackendHealthResponse): HostedBackendProbeResult {
  return { reachability: 'online', health: backendHealth, errorMessage: null }
}

function deferred<T>(): {
  promise: Promise<T>
  resolve(value: T): void
} {
  let resolvePromise: ((value: T) => void) | null = null
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve
  })
  return {
    promise,
    resolve(value) {
      if (!resolvePromise) throw new Error('Deferred promise is not initialized.')
      resolvePromise(value)
    },
  }
}

interface ProjectionCallbackCapture {
  current: CliProjectionTransportCallbacks | null
}

function requireProjectionCallbacks(
  capture: ProjectionCallbackCapture
): CliProjectionTransportCallbacks {
  if (!capture.current) throw new Error('Projection transport callbacks are unavailable.')
  return capture.current
}

describe('connection observation owner', () => {
  it('pulls Root Context immediately after health settles without waiting for a lifecycle notice', async () => {
    const fetchRootProjection = vi.fn(async () => rootProjection(readyRoot('project-a', 2)))
    const owner = createConnectionObservationOwner({
      probe: async () => online(health(API_A, 'project-a')),
      fetchRootProjection,
      projectionTransportFactory: {
        connect() {
          return { unsubscribe() {} }
        },
      },
      now: () => 2,
    })

    owner.setTabs([tab('a', API_A)])

    await vi.waitFor(() => {
      expect(fetchRootProjection).toHaveBeenCalledWith(API_A)
      expect(owner.getSnapshot().observations[0]?.rootAttempt.status).toBe('ready')
    })
  })

  it('has no healthy timer and refreshes only for explicit focus or visible lifecycle events', async () => {
    vi.useFakeTimers()
    const refresh = vi.fn(async () => {})
    const windowTarget = new RefreshEventTarget()
    const documentTarget = new RefreshEventTarget()
    const release = bindConnectionObservationRefreshTriggers({
      owner: { refresh },
      windowTarget,
      documentTarget,
    })

    try {
      await vi.advanceTimersByTimeAsync(60_000)
      expect(refresh).not.toHaveBeenCalled()

      windowTarget.dispatch('focus')
      expect(refresh).toHaveBeenCalledTimes(1)

      documentTarget.dispatch('visibilitychange')
      expect(refresh).toHaveBeenCalledTimes(1)
      documentTarget.visibilityState = 'visible'
      documentTarget.dispatch('visibilitychange')
      expect(refresh).toHaveBeenCalledTimes(2)

      release()
      windowTarget.dispatch('focus')
      documentTarget.dispatch('visibilitychange')
      expect(refresh).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('rejects an old observation for a same-id and same-locator replacement tab', () => {
    const original = tab('a', API_A)
    const replacement = { ...original, sessionId: 'replacement-session', createdAt: 2 }

    expect(
      resolveActiveBackendAuthority({
        selectedTab: replacement,
        observation: {
          tabId: original.id,
          sessionId: original.sessionId,
          apiBaseUrl: original.apiBaseUrl,
          tabCreatedAt: original.createdAt,
          generation: 1,
          reachability: 'online',
          health: health(API_A, 'original-project'),
          healthError: null,
          rootEvidence: {
            tabId: original.id,
            sessionId: original.sessionId,
            apiBaseUrl: original.apiBaseUrl,
            tabCreatedAt: original.createdAt,
            generation: 1,
            health: health(API_A, 'original-project'),
            rootContext: readyRoot('original-project', 101),
            observedAt: 101,
          },
          rootAttempt: {
            tabId: original.id,
            sessionId: original.sessionId,
            apiBaseUrl: original.apiBaseUrl,
            tabCreatedAt: original.createdAt,
            generation: 1,
            health: health(API_A, 'original-project'),
            status: 'ready',
            error: null,
            observedAt: 101,
          },
          current: true,
          stale: false,
          observedAt: 101,
        },
      })
    ).toBeNull()
  })

  it('keeps duplicate tabs at one locator in distinct observation generations', async () => {
    const firstProbe = deferred<HostedBackendProbeResult>()
    const secondProbe = deferred<HostedBackendProbeResult>()
    let probeCount = 0
    const owner = createConnectionObservationOwner({
      probe: () => (++probeCount === 1 ? firstProbe.promise : secondProbe.promise),
      fetchRootProjection: async () => rootProjection(loadingRoot(1)),
      now: () => 1,
    })

    owner.setTabs([tab('first', API_A), tab('second', API_A)])
    firstProbe.resolve(online(health(API_A, 'first-project')))
    await Promise.resolve()
    await Promise.resolve()

    expect(owner.getSnapshot().observations).toMatchObject([
      { tabId: 'first', current: true, health: { projectName: 'first-project' } },
      { tabId: 'second', current: false, reachability: 'checking', health: null },
    ])
    const firstGeneration = owner.getSnapshot().observations[0]?.generation
    const secondGeneration = owner.getSnapshot().observations[1]?.generation
    expect(firstGeneration).not.toBe(secondGeneration)

    secondProbe.resolve(online(health(API_A, 'second-project')))
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(owner.getSnapshot().observations).toMatchObject([
      { tabId: 'first', current: true, health: { projectName: 'first-project' } },
      { tabId: 'second', current: true, health: { projectName: 'second-project' } },
    ])
  })

  it('collects independent health and Root Context states for every retained source', async () => {
    const owner = createConnectionObservationOwner({
      probe: async (apiBaseUrl) =>
        apiBaseUrl === API_A
          ? online(health(API_A, 'project-a'))
          : {
              reachability: 'authentication-required',
              health: null,
              errorMessage: 'credential required',
            },
      fetchRootProjection: async () => rootProjection(loadingRoot(2)),
      now: () => 2,
    })

    owner.setTabs([tab('a', API_A), tab('b', API_B)])
    await owner.refresh()

    expect(owner.getSnapshot().observations).toMatchObject([
      {
        apiBaseUrl: API_A,
        reachability: 'online',
        current: true,
        health: { projectName: 'project-a' },
        rootAttempt: { status: 'loading' },
      },
      {
        apiBaseUrl: API_B,
        reachability: 'authentication-required',
        current: false,
        health: null,
        rootAttempt: { status: 'idle' },
      },
    ])
  })

  it('retires a late result from the removed generation after the same locator is re-added', async () => {
    const oldProbe = deferred<HostedBackendProbeResult>()
    const replacementProbe = deferred<HostedBackendProbeResult>()
    let probeCount = 0
    const owner = createConnectionObservationOwner({
      probe: () => {
        probeCount += 1
        return probeCount === 1 ? oldProbe.promise : replacementProbe.promise
      },
      fetchRootProjection: async () => rootProjection(loadingRoot(3)),
      now: () => 3,
    })

    owner.setTabs([tab('old-a', API_A)])
    owner.setTabs([])
    owner.setTabs([tab('new-a', API_A)])
    oldProbe.resolve(online(health(API_A, 'retired-project')))
    await Promise.resolve()
    await Promise.resolve()

    expect(owner.getSnapshot().observations).toMatchObject([
      {
        tabId: 'new-a',
        reachability: 'checking',
        current: false,
        health: null,
      },
    ])

    replacementProbe.resolve(online(health(API_A, 'current-project')))
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(owner.getSnapshot().observations).toMatchObject([
      {
        tabId: 'new-a',
        reachability: 'online',
        current: true,
        health: { projectName: 'current-project' },
      },
    ])
  })

  it('retires an action authority when the same tab publishes a replacement generation', async () => {
    const initialProbe = deferred<HostedBackendProbeResult>()
    let probeCount = 0
    const owner = createConnectionObservationOwner({
      probe: async () => {
        probeCount += 1
        return probeCount === 1
          ? initialProbe.promise
          : online(health(API_A, 'replacement-generation'))
      },
      fetchRootProjection: async () => rootProjection(loadingRoot(4)),
      now: () => 4,
    })

    owner.setTabs([tab('a', API_A)])
    initialProbe.resolve(online(health(API_A, 'initial-generation')))
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    const initial = owner.getSnapshot().observations[0]
    expect(initial?.current).toBe(true)

    await owner.refresh(['a'])
    const replacement = owner.getSnapshot().observations[0]
    expect(replacement?.generation).not.toBe(initial?.generation)
    expect(
      initial &&
        owner.isCurrentAuthority({
          tabId: initial.tabId,
          sessionId: initial.sessionId,
          apiBaseUrl: initial.apiBaseUrl,
          tabCreatedAt: initial.tabCreatedAt,
          generation: initial.generation,
        })
    ).toBe(false)
    expect(
      replacement &&
        owner.isCurrentAuthority({
          tabId: replacement.tabId,
          sessionId: replacement.sessionId,
          apiBaseUrl: replacement.apiBaseUrl,
          tabCreatedAt: replacement.tabCreatedAt,
          generation: replacement.generation,
        })
    ).toBe(true)
  })

  it('retains renderable health while a replacement probe is pending', async () => {
    const replacementProbe = deferred<HostedBackendProbeResult>()
    let probeCount = 0
    const owner = createConnectionObservationOwner({
      probe: async () => {
        probeCount += 1
        return probeCount === 1
          ? online(health(API_A, 'initial-generation'))
          : replacementProbe.promise
      },
      fetchRootProjection: async () =>
        rootProjection(readyRoot('initial-generation', probeCount), probeCount),
      now: () => probeCount + 1,
    })

    owner.setTabs([tab('a', API_A)])
    await vi.waitFor(() => {
      expect(owner.getSnapshot().observations[0]?.rootAttempt.status).toBe('ready')
    })
    const initial = owner.getSnapshot().observations[0]
    if (!initial) throw new Error('Initial backend observation is unavailable.')

    const refresh = owner.refresh(['a'])
    await vi.waitFor(() => {
      expect(owner.getSnapshot().observations[0]?.generation).not.toBe(initial.generation)
    })

    const pending = owner.getSnapshot().observations[0]
    expect(pending).toMatchObject({
      reachability: 'checking',
      current: false,
      stale: true,
      health: { embeddedUiUrl: API_A, projectName: 'initial-generation' },
      rootAttempt: { health: null, status: 'idle' },
    })
    expect(
      owner.isCurrentAuthority({
        tabId: initial.tabId,
        sessionId: initial.sessionId,
        apiBaseUrl: initial.apiBaseUrl,
        tabCreatedAt: initial.tabCreatedAt,
        generation: initial.generation,
      })
    ).toBe(false)

    replacementProbe.resolve(online(health(API_A, 'replacement-generation')))
    await refresh
  })

  it('reuses a pending refresh probe when the established transport disconnects', async () => {
    const replacementProbe = deferred<HostedBackendProbeResult>()
    const callbackCapture: ProjectionCallbackCapture = { current: null }
    let probeCount = 0
    const owner = createConnectionObservationOwner({
      projectionTransportFactory: {
        connect(_apiBaseUrl, _selector, nextCallbacks) {
          callbackCapture.current = nextCallbacks
          return { unsubscribe() {} }
        },
      },
      probe: async () => {
        probeCount += 1
        return probeCount === 1
          ? online(health(API_A, 'initial-generation'))
          : replacementProbe.promise
      },
      fetchRootProjection: async () =>
        rootProjection(readyRoot('project-a', probeCount), probeCount),
      now: () => probeCount + 1,
    })

    owner.setTabs([tab('a', API_A)])
    await vi.waitFor(() => expect(callbackCapture.current).not.toBeNull())
    const callbacks = requireProjectionCallbacks(callbackCapture)
    callbacks.onConnectionState('pending')
    await vi.waitFor(() => {
      expect(owner.getSnapshot().observations[0]?.rootAttempt.status).toBe('ready')
    })

    const refresh = owner.refresh(['a'])
    await vi.waitFor(() => expect(probeCount).toBe(2))
    callbacks.onConnectionState('connecting')

    expect(probeCount).toBe(2)

    replacementProbe.resolve(online(health(API_A, 'replacement-generation')))
    await refresh
  })

  it('keeps retained Root and Reference evidence stale until replacement data commits', async () => {
    const replacementRoot = deferred<HostedRootContextState>()
    let rootFetchCount = 0
    const owner = createConnectionObservationOwner({
      probe: async () => online(health(API_A, 'project-a')),
      fetchRootProjection: async () => {
        rootFetchCount += 1
        return rootProjection(
          rootFetchCount === 1 ? readyRoot('project-a', 1) : await replacementRoot.promise,
          rootFetchCount
        )
      },
      now: () => rootFetchCount + 1,
    })

    owner.setTabs([tab('a', API_A)])
    await vi.waitFor(() => {
      expect(owner.getSnapshot().observations[0]?.rootAttempt.status).toBe('ready')
    })
    const retained = owner.getSnapshot().observations[0]?.rootEvidence
    expect(retained?.rootContext.data?.references[0]?.store_id).toBe('project-a-reference')

    const refresh = owner.refresh(['a'])
    await vi.waitFor(() => {
      expect(owner.getSnapshot().observations[0]).toMatchObject({
        current: true,
        rootAttempt: { status: 'loading' },
        stale: true,
      })
    })
    expect(owner.getSnapshot().observations[0]?.rootEvidence).toBe(retained)

    replacementRoot.resolve(loadingRoot(3))
    await refresh
    expect(owner.getSnapshot().observations[0]).toMatchObject({
      rootAttempt: { status: 'loading' },
      stale: true,
    })
    expect(owner.getSnapshot().observations[0]?.rootEvidence).toBe(retained)
  })

  it('marks retained Root evidence stale as soon as a replacement lifecycle notice arrives', async () => {
    const replacementRoot = deferred<HostedRootContextState>()
    const callbackCapture: ProjectionCallbackCapture = { current: null }
    let rootFetchCount = 0
    const projectionTransportFactory: CliProjectionTransportFactory = {
      connect(_apiBaseUrl, _selector, nextCallbacks) {
        callbackCapture.current = nextCallbacks
        return { unsubscribe() {} }
      },
    }
    const owner = createConnectionObservationOwner({
      projectionTransportFactory,
      probe: async () => online(health(API_A, 'project-a')),
      fetchRootProjection: async () => {
        rootFetchCount += 1
        return rootProjection(
          rootFetchCount === 1 ? readyRoot('project-a', 1) : await replacementRoot.promise,
          rootFetchCount
        )
      },
      now: () => rootFetchCount + 1,
    })

    owner.setTabs([tab('a', API_A)])
    await vi.waitFor(() => expect(callbackCapture.current).not.toBeNull())
    const callbacks = requireProjectionCallbacks(callbackCapture)
    callbacks.onNotice({
      identity: 'root-context:test',
      workGeneration: 1,
      snapshotGeneration: 1,
      state: 'ready',
      invalidationCause: 'initial',
    })
    await vi.waitFor(() => {
      expect(owner.getSnapshot().observations[0]?.rootAttempt.status).toBe('ready')
    })
    const retained = owner.getSnapshot().observations[0]?.rootEvidence

    callbacks.onNotice({
      identity: 'root-context:test',
      workGeneration: 2,
      snapshotGeneration: 1,
      state: 'revalidating',
      invalidationCause: 'dependency',
    })
    expect(owner.getSnapshot().observations[0]).toMatchObject({
      rootAttempt: { status: 'refreshing' },
      stale: true,
    })
    expect(owner.getSnapshot().observations[0]?.rootEvidence).toBe(retained)

    replacementRoot.resolve(readyRoot('project-b', 2))
    await vi.waitFor(() => {
      expect(owner.getSnapshot().observations[0]).toMatchObject({
        rootAttempt: { status: 'ready' },
        stale: false,
      })
    })
  })

  it('re-probes health and credential authority before recommitting Root after reconnect', async () => {
    const callbackCapture: ProjectionCallbackCapture = { current: null }
    let probeCount = 0
    let rootFetchCount = 0
    const owner = createConnectionObservationOwner({
      projectionTransportFactory: {
        connect(_apiBaseUrl, _selector, nextCallbacks) {
          callbackCapture.current = nextCallbacks
          return { unsubscribe() {} }
        },
      },
      probe: async () => {
        probeCount += 1
        return online(
          buildBackendHealthPayload({
            projectDir: '/tmp/project-a',
            projectName: 'project-a',
            watcherEnabled: true,
            openspecuiVersion: probeCount === 1 ? '6.0.0' : '6.1.0',
            embeddedUiUrl: API_A,
            apiBaseUrl: API_A,
            envUri: probeCount === 1 ? 'env:a' : 'env:b',
          })
        )
      },
      fetchRootProjection: async () => {
        rootFetchCount += 1
        return rootProjection(readyRoot('project-a', rootFetchCount), rootFetchCount)
      },
      now: () => probeCount + rootFetchCount,
    })

    owner.setTabs([tab('a', API_A)])
    await vi.waitFor(() => expect(callbackCapture.current).not.toBeNull())
    const callbacks = requireProjectionCallbacks(callbackCapture)
    await vi.waitFor(() => {
      expect(owner.getSnapshot().observations[0]?.rootAttempt.status).toBe('ready')
    })
    callbacks.onConnectionState('pending')
    callbacks.onNotice({
      identity: 'root-context:test',
      workGeneration: 1,
      snapshotGeneration: 1,
      state: 'ready',
      invalidationCause: 'initial',
    })
    await vi.waitFor(() => {
      expect(owner.getSnapshot().observations[0]).toMatchObject({
        current: true,
        rootEvidence: { health: { envUri: 'env:a', openspecuiVersion: '6.0.0' } },
      })
    })

    callbacks.onConnectionState('connecting')
    expect(owner.getSnapshot().observations[0]).toMatchObject({
      reachability: 'checking',
      current: false,
      stale: true,
      rootAttempt: { status: 'refreshing' },
    })
    callbacks.onConnectionState('pending')

    await vi.waitFor(() => {
      expect(probeCount).toBe(3)
      expect(owner.getSnapshot().observations[0]).toMatchObject({
        reachability: 'online',
        current: true,
        stale: false,
        rootEvidence: { health: { envUri: 'env:b', openspecuiVersion: '6.1.0' } },
      })
    })
    expect(rootFetchCount).toBe(2)
  })

  it('publishes objective Offline from an established transport disconnect before reconnect', async () => {
    const callbackCapture: ProjectionCallbackCapture = { current: null }
    let probeCount = 0
    const owner = createConnectionObservationOwner({
      projectionTransportFactory: {
        connect(_apiBaseUrl, _selector, nextCallbacks) {
          callbackCapture.current = nextCallbacks
          return { unsubscribe() {} }
        },
      },
      probe: async () => {
        probeCount += 1
        return probeCount === 1
          ? online(health(API_A, 'project-a'))
          : { reachability: 'offline', health: null, errorMessage: 'backend offline' }
      },
      fetchRootProjection: async () => rootProjection(readyRoot('project-a', 1)),
    })

    owner.setTabs([tab('a', API_A)])
    await vi.waitFor(() => expect(callbackCapture.current).not.toBeNull())
    await vi.waitFor(() => expect(owner.getSnapshot().observations[0]?.current).toBe(true))
    const callbacks = requireProjectionCallbacks(callbackCapture)
    callbacks.onConnectionState('pending')
    callbacks.onConnectionState('connecting')

    await vi.waitFor(() => {
      expect(probeCount).toBe(2)
      expect(owner.getSnapshot().observations[0]).toMatchObject({
        reachability: 'offline',
        healthError: 'backend offline',
        current: false,
        stale: true,
      })
    })
  })

  it('keeps retained Root display-only when reconnect health loses its credential', async () => {
    const callbackCapture: ProjectionCallbackCapture = { current: null }
    let probeCount = 0
    let rootFetchCount = 0
    const owner = createConnectionObservationOwner({
      projectionTransportFactory: {
        connect(_apiBaseUrl, _selector, nextCallbacks) {
          callbackCapture.current = nextCallbacks
          return { unsubscribe() {} }
        },
      },
      probe: async () => {
        probeCount += 1
        return probeCount === 1
          ? online(health(API_A, 'project-a'))
          : {
              reachability: 'authentication-required',
              health: null,
              errorMessage: 'credential required',
            }
      },
      fetchRootProjection: async () => {
        rootFetchCount += 1
        return rootProjection(readyRoot('project-a', rootFetchCount), rootFetchCount)
      },
    })

    owner.setTabs([tab('a', API_A)])
    await vi.waitFor(() => expect(callbackCapture.current).not.toBeNull())
    const callbacks = requireProjectionCallbacks(callbackCapture)
    await vi.waitFor(() => {
      expect(owner.getSnapshot().observations[0]?.rootAttempt.status).toBe('ready')
    })
    callbacks.onConnectionState('pending')
    callbacks.onNotice({
      identity: 'root-context:test',
      workGeneration: 1,
      snapshotGeneration: 1,
      state: 'ready',
      invalidationCause: 'initial',
    })
    await vi.waitFor(() => {
      expect(owner.getSnapshot().observations[0]?.rootAttempt.status).toBe('ready')
    })
    const retained = owner.getSnapshot().observations[0]?.rootEvidence

    callbacks.onConnectionState('connecting')
    callbacks.onConnectionState('pending')

    await vi.waitFor(() => {
      expect(owner.getSnapshot().observations[0]).toMatchObject({
        reachability: 'authentication-required',
        current: false,
        stale: true,
        healthError: 'credential required',
      })
    })
    expect(owner.getSnapshot().observations[0]?.rootEvidence).toBe(retained)
    expect(rootFetchCount).toBe(1)
  })

  it('retires an older Root Pull when a newer lifecycle generation settles first', async () => {
    const firstPull = deferred<HostedRootContextProjectionState>()
    const callbackCapture: ProjectionCallbackCapture = { current: null }
    let rootFetchCount = 0
    const owner = createConnectionObservationOwner({
      projectionTransportFactory: {
        connect(_apiBaseUrl, _selector, nextCallbacks) {
          callbackCapture.current = nextCallbacks
          return { unsubscribe() {} }
        },
      },
      probe: async () => online(health(API_A, 'project-a')),
      fetchRootProjection: async () => {
        rootFetchCount += 1
        return rootFetchCount === 1
          ? firstPull.promise
          : rootProjection(readyRoot('project-b', 202), 2)
      },
      now: () => rootFetchCount + 1,
    })

    owner.setTabs([tab('a', API_A)])
    await vi.waitFor(() => expect(callbackCapture.current).not.toBeNull())
    const callbacks = requireProjectionCallbacks(callbackCapture)
    callbacks.onNotice({
      identity: 'root-context:test',
      workGeneration: 1,
      snapshotGeneration: 1,
      state: 'ready',
      invalidationCause: 'initial',
    })
    callbacks.onNotice({
      identity: 'root-context:test',
      workGeneration: 2,
      snapshotGeneration: 2,
      state: 'ready',
      invalidationCause: 'dependency',
    })

    await vi.waitFor(() => {
      expect(owner.getSnapshot().observations[0]?.rootEvidence?.rootContext).toMatchObject({
        state: 'ready',
        data: { planningRoot: { store_id: 'project-b' } },
      })
    })
    firstPull.resolve(rootProjection(readyRoot('project-a', 101), 1))
    await Promise.resolve()

    expect(owner.getSnapshot().observations[0]).toMatchObject({
      rootAttempt: { status: 'ready' },
      stale: false,
      rootEvidence: {
        rootContext: { state: 'ready', data: { planningRoot: { store_id: 'project-b' } } },
      },
    })
  })

  it('does not relabel retained Root evidence while a new environment generation is pending', async () => {
    const replacementRoot = deferred<HostedRootContextState>()
    let probeCount = 0
    const owner = createConnectionObservationOwner({
      probe: async () => {
        probeCount += 1
        return online(
          buildBackendHealthPayload({
            projectDir: '/tmp/project-a',
            projectName: 'project-a',
            watcherEnabled: true,
            openspecuiVersion: '6.0.0',
            embeddedUiUrl: API_A,
            apiBaseUrl: API_A,
            envUri: probeCount === 1 ? 'env:a' : 'env:b',
          })
        )
      },
      fetchRootProjection: async () =>
        rootProjection(
          probeCount === 1 ? readyRoot('project-a', 101) : await replacementRoot.promise,
          probeCount
        ),
      now: () => 999,
    })

    owner.setTabs([tab('a', API_A)])
    await vi.waitFor(() => {
      expect(owner.getSnapshot().observations[0]?.rootAttempt.status).toBe('ready')
    })
    const generationA = owner.getSnapshot().observations[0]?.generation

    void owner.refresh(['a'])
    await vi.waitFor(() => {
      const pending = owner.getSnapshot().observations[0]
      expect(pending?.generation).not.toBe(generationA)
      expect(pending).toMatchObject({
        rootAttempt: { status: 'loading' },
        stale: true,
        health: { envUri: 'env:b' },
      })
    })
    const pending = owner.getSnapshot().observations[0]
    if (!pending) throw new Error('Pending backend observation is unavailable.')
    const projected = projectRootObservation(pending)
    const contexts = deriveProjectContexts([projected])

    expect(contexts[0]).toMatchObject({
      evidence: {
        source: { generation: generationA, health: { envUri: 'env:a' }, observedAt: 101 },
        references: [{ source: { generation: generationA } }],
      },
      attempt: {
        source: { health: { envUri: 'env:b' } },
        status: 'loading',
      },
    })
  })

  it('keeps A evidence and a failed B attempt as separately sourced facts', async () => {
    let probeCount = 0
    let rootFetchCount = 0
    const owner = createConnectionObservationOwner({
      probe: async () => {
        probeCount += 1
        return online(
          buildBackendHealthPayload({
            projectDir: '/tmp/project-a',
            projectName: 'project-a',
            watcherEnabled: true,
            openspecuiVersion: '6.0.0',
            embeddedUiUrl: API_A,
            apiBaseUrl: API_A,
            envUri: probeCount === 1 ? 'env:a' : 'env:b',
          })
        )
      },
      fetchRootProjection: async () => {
        rootFetchCount += 1
        return rootProjection(
          rootFetchCount === 1 ? readyRoot('project-a', 101) : failedRoot('project-b', 202),
          rootFetchCount
        )
      },
      now: () => 999,
    })

    owner.setTabs([tab('a', API_A)])
    await vi.waitFor(() => {
      expect(owner.getSnapshot().observations[0]?.rootAttempt.status).toBe('ready')
    })
    await owner.refresh(['a'])

    const observation = owner.getSnapshot().observations[0]
    if (!observation) throw new Error('Connection observation is unavailable.')
    const contexts = deriveProjectContexts([projectRootObservation(observation)])
    expect(contexts).toMatchObject([
      {
        evidence: {
          source: {
            tabId: 'a',
            sessionId: 'session-a',
            apiBaseUrl: API_A,
            tabCreatedAt: 1,
            generation: 1,
            health: { envUri: 'env:a' },
            observedAt: 101,
          },
          storeId: 'project-a',
          references: [
            {
              storeId: 'project-a-reference',
              source: { generation: 1, health: { envUri: 'env:a' }, observedAt: 101 },
            },
          ],
        },
        attempt: {
          source: {
            tabId: 'a',
            sessionId: 'session-a',
            apiBaseUrl: API_A,
            tabCreatedAt: 1,
            generation: 2,
            health: { envUri: 'env:b' },
            observedAt: 202,
          },
          status: 'error',
          error: { source: 'root-context', code: 'root-unhealthy' },
        },
        stale: true,
      },
    ])
  })

  it('keeps retained Root provenance stale through a transport failure', async () => {
    let rootFetchCount = 0
    const owner = createConnectionObservationOwner({
      probe: async () => online(health(API_A, 'project-a')),
      fetchRootProjection: async () => {
        rootFetchCount += 1
        if (rootFetchCount === 1) return rootProjection(readyRoot('project-a', 1))
        throw new Error('websocket reconnect failed')
      },
      now: () => rootFetchCount + 1,
    })

    owner.setTabs([tab('a', API_A)])
    await vi.waitFor(() => {
      expect(owner.getSnapshot().observations[0]?.rootAttempt.status).toBe('ready')
    })
    const retained = owner.getSnapshot().observations[0]?.rootEvidence
    await owner.refresh(['a'])

    expect(owner.getSnapshot().observations[0]).toMatchObject({
      current: true,
      rootAttempt: {
        status: 'error',
        error: { source: 'transport', message: 'websocket reconnect failed' },
      },
      stale: true,
    })
    expect(owner.getSnapshot().observations[0]?.rootEvidence).toBe(retained)
  })

  it('keeps retained Root and Reference evidence stale after authentication is lost', async () => {
    let probeCount = 0
    const owner = createConnectionObservationOwner({
      probe: async () => {
        probeCount += 1
        return probeCount === 1
          ? online(health(API_A, 'project-a'))
          : {
              reachability: 'authentication-required',
              health: null,
              errorMessage: 'credential required',
            }
      },
      fetchRootProjection: async () => rootProjection(readyRoot('project-a', 1)),
      now: () => probeCount + 1,
    })

    owner.setTabs([tab('a', API_A)])
    await vi.waitFor(() => {
      expect(owner.getSnapshot().observations[0]?.rootAttempt.status).toBe('ready')
    })
    const retained = owner.getSnapshot().observations[0]?.rootEvidence
    await owner.refresh(['a'])

    expect(owner.getSnapshot().observations[0]).toMatchObject({
      reachability: 'authentication-required',
      current: false,
      healthError: 'credential required',
      stale: true,
    })
    expect(owner.getSnapshot().observations[0]?.rootEvidence).toBe(retained)
    expect(
      owner.getSnapshot().observations[0]?.rootEvidence?.rootContext.data?.references[0]?.store_id
    ).toBe('project-a-reference')
  })
})
