/**
 * Orthogonal intents (created 2026-07-24 Asia/Shanghai):
 * 1. Prove multi-source health and Root Context collection in one owner.
 * 2. Prove exact-tab generations retire late removed/replaced results.
 * 3. Preserve per-source authentication and error states without cross-source fallback.
 *
 * Original request (2026-07-24): "apply openspec-change: close-openspec-cli16-delivery-gaps"
 */
import {
  buildBackendHealthPayload,
  type HostedBackendHealthResponse,
  type RootContext,
  type RootContextState,
} from '@openspecui/core'
import { describe, expect, it, vi } from 'vitest'
import { createConnectionObservationOwner } from './connection-observation'
import type { HostedBackendProbeResult } from './reachability'
import type { HostedShellTab } from './shell-state'

const API_A = 'http://localhost:3100'
const API_B = 'http://localhost:3200'

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

function loadingRoot(observedAt: number): RootContextState {
  return { state: 'loading', data: null, attempt: null, error: null, observedAt }
}

function readyRoot(projectName: string, observedAt: number): RootContextState {
  const data: RootContext = {
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
    dataScope: { path: '/tmp/data/openspec', source: 'user-home-default' },
    diagnostics: { root: [], doctor: [], context: [] },
    evidence: { doctor: null, context: null },
    observedAt,
  }
  return { state: 'ready', data, attempt: null, error: null, observedAt }
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

describe('connection observation owner', () => {
  it('keeps duplicate tabs at one locator in distinct observation generations', async () => {
    const firstProbe = deferred<HostedBackendProbeResult>()
    const secondProbe = deferred<HostedBackendProbeResult>()
    let probeCount = 0
    const owner = createConnectionObservationOwner({
      probe: () => (++probeCount === 1 ? firstProbe.promise : secondProbe.promise),
      fetchRootContext: async () => loadingRoot(1),
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
      fetchRootContext: async () => loadingRoot(2),
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
        rootStatus: 'loading',
      },
      {
        apiBaseUrl: API_B,
        reachability: 'authentication-required',
        current: false,
        health: null,
        rootStatus: 'idle',
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
      fetchRootContext: async () => loadingRoot(3),
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
      fetchRootContext: async () => loadingRoot(4),
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
          apiBaseUrl: initial.apiBaseUrl,
          generation: initial.generation,
        })
    ).toBe(false)
    expect(
      replacement &&
        owner.isCurrentAuthority({
          tabId: replacement.tabId,
          apiBaseUrl: replacement.apiBaseUrl,
          generation: replacement.generation,
        })
    ).toBe(true)
  })

  it('keeps retained Root and Reference evidence stale until replacement data commits', async () => {
    const replacementRoot = deferred<RootContextState>()
    let rootFetchCount = 0
    const owner = createConnectionObservationOwner({
      probe: async () => online(health(API_A, 'project-a')),
      fetchRootContext: async () => {
        rootFetchCount += 1
        return rootFetchCount === 1 ? readyRoot('project-a', 1) : replacementRoot.promise
      },
      now: () => rootFetchCount + 1,
    })

    owner.setTabs([tab('a', API_A)])
    await vi.waitFor(() => {
      expect(owner.getSnapshot().observations[0]?.rootStatus).toBe('ready')
    })
    const retained = owner.getSnapshot().observations[0]?.rootContext
    expect(retained?.data?.references[0]?.store_id).toBe('project-a-reference')

    const refresh = owner.refresh(['a'])
    await vi.waitFor(() => {
      expect(owner.getSnapshot().observations[0]).toMatchObject({
        current: true,
        rootStatus: 'loading',
        stale: true,
      })
    })
    expect(owner.getSnapshot().observations[0]?.rootContext).toBe(retained)

    replacementRoot.resolve(loadingRoot(3))
    await refresh
    expect(owner.getSnapshot().observations[0]).toMatchObject({
      rootStatus: 'loading',
      stale: true,
    })
    expect(owner.getSnapshot().observations[0]?.rootContext).toBe(retained)
  })

  it('keeps retained Root provenance stale through a transport failure', async () => {
    let rootFetchCount = 0
    const owner = createConnectionObservationOwner({
      probe: async () => online(health(API_A, 'project-a')),
      fetchRootContext: async () => {
        rootFetchCount += 1
        if (rootFetchCount === 1) return readyRoot('project-a', 1)
        throw new Error('websocket reconnect failed')
      },
      now: () => rootFetchCount + 1,
    })

    owner.setTabs([tab('a', API_A)])
    await vi.waitFor(() => {
      expect(owner.getSnapshot().observations[0]?.rootStatus).toBe('ready')
    })
    const retained = owner.getSnapshot().observations[0]?.rootContext
    await owner.refresh(['a'])

    expect(owner.getSnapshot().observations[0]).toMatchObject({
      current: true,
      rootStatus: 'error',
      rootError: { source: 'transport', message: 'websocket reconnect failed' },
      stale: true,
    })
    expect(owner.getSnapshot().observations[0]?.rootContext).toBe(retained)
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
      fetchRootContext: async () => readyRoot('project-a', 1),
      now: () => probeCount + 1,
    })

    owner.setTabs([tab('a', API_A)])
    await vi.waitFor(() => {
      expect(owner.getSnapshot().observations[0]?.rootStatus).toBe('ready')
    })
    const retained = owner.getSnapshot().observations[0]?.rootContext
    await owner.refresh(['a'])

    expect(owner.getSnapshot().observations[0]).toMatchObject({
      reachability: 'authentication-required',
      current: false,
      healthError: 'credential required',
      stale: true,
    })
    expect(owner.getSnapshot().observations[0]?.rootContext).toBe(retained)
    expect(owner.getSnapshot().observations[0]?.rootContext?.data?.references[0]?.store_id).toBe(
      'project-a-reference'
    )
  })
})
