/**
 * Orthogonal intents (created 2026-07-24 Asia/Shanghai):
 * 1. Prove multi-source health and Root Context collection in one owner.
 * 2. Prove a late removed-and-readded locator generation cannot publish stale evidence.
 * 3. Preserve per-source authentication and error states without cross-source fallback.
 *
 * Original request (2026-07-24): "apply openspec-change: close-openspec-cli16-delivery-gaps"
 */
import {
  buildBackendHealthPayload,
  type HostedBackendHealthResponse,
  type RootContextState,
} from '@openspecui/core'
import { describe, expect, it } from 'vitest'
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
})
