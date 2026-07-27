/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Prove equivalent raw locator formatting cannot retire an admitted Store record.
 * 2. Drive the real mutation-observation provider through its transport callback and React rerender.
 * 3. Distinguish the initial Root admission Pull from one exact-tab mutation refresh/Pull.
 *
 * Original request (2026-07-24): "apply openspec-change: close-openspec-cli16-delivery-gaps"
 * Review correction (2026-07-25): raw `http://host` -> `http://host/` must preserve lifecycle identity.
 * Original request (2026-07-26): "推送变更，然后让多端基于订阅拉取更新。"
 * Original request (2026-07-27): "统一修复所有类似的问题，特别是app 那边新增的页面。"
 */
// @vitest-environment jsdom

import { buildBackendHealthPayload } from '@openspecui/core/hosted-app'
import type { StoreMutationEnvelope } from '@openspecui/core/store-mutation-protocol'
import { act, waitFor } from '@testing-library/react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConnectionObservationProvider } from '../lib/connection-observation'
import type { MutationLifecycleCallbacks } from '../lib/mutation-observation'
import {
  MutationObservationProvider,
  useMutationObservations,
} from '../lib/mutation-observation-provider'
import { getHostedShellStorageKey } from '../lib/shell-state'
import { useStoreMutationLifecycle } from './store-mutation-lifecycle'

const API = 'http://host'
const REQUEST_ID = 'equivalent-locator-terminal'

const transportProbe = vi.hoisted(() => {
  let callbacks: MutationLifecycleCallbacks | null = null
  return {
    connect(_apiBaseUrl: string, nextCallbacks: MutationLifecycleCallbacks) {
      callbacks = nextCallbacks
      return { unsubscribe() {} }
    },
    callbacks() {
      if (!callbacks) throw new Error('Missing mutation lifecycle transport callbacks.')
      return callbacks
    },
    reset() {
      callbacks = null
    },
  }
})

vi.mock('../lib/mutation-observation-transport', () => ({
  createTRPCMutationObservationTransportFactory: () => ({ connect: transportProbe.connect }),
}))

interface LifecycleApi {
  registerAdmission(apiBaseUrl: string, admission: StoreMutationEnvelope): void
}

interface LifecycleSnapshot {
  current: boolean
  recordCount: number
  mutationLifecycle: string | null
}

function LifecycleHarness({
  apiBaseUrl,
  refreshStore,
  onReady,
  onSnapshot,
}: {
  apiBaseUrl: string
  refreshStore: () => void
  onReady(api: LifecycleApi): void
  onSnapshot(snapshot: LifecycleSnapshot): void
}) {
  const mutationObservations = useMutationObservations()
  const lifecycle = useStoreMutationLifecycle(apiBaseUrl, refreshStore)
  onReady(lifecycle)
  onSnapshot({
    current: lifecycle.locator?.current === true,
    recordCount: lifecycle.recent.length,
    mutationLifecycle: mutationObservations.projections[0]?.lifecycle ?? null,
  })
  return null
}

function persistHostTab(): void {
  localStorage.setItem(
    getHostedShellStorageKey(),
    JSON.stringify({
      activeTabId: 'host-tab',
      tabs: [
        {
          id: 'host-tab',
          sessionId: 'host-session',
          apiBaseUrl: API,
          createdAt: 1,
        },
      ],
    })
  )
}

function healthResponse(): Response {
  return Response.json(
    buildBackendHealthPayload({
      projectDir: '/tmp/equivalent-locator',
      projectName: 'equivalent-locator',
      watcherEnabled: true,
      openspecuiVersion: '6.0.0',
      embeddedUiUrl: 'https://host',
      apiBaseUrl: API,
      cliVersion: '1.6.0',
      envUri: 'openspecui-env://1/equivalent-locator',
    })
  )
}

async function renderLifecycle(
  apiBaseUrl: string,
  refreshStore: () => void,
  onReady: (api: LifecycleApi) => void,
  onSnapshot: (snapshot: LifecycleSnapshot) => void
): Promise<{ root: Root; container: HTMLDivElement; rerender(apiBaseUrl: string): Promise<void> }> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const render = async (nextApiBaseUrl: string) => {
    await act(async () => {
      root.render(
        <MutationObservationProvider>
          <ConnectionObservationProvider>
            <LifecycleHarness
              apiBaseUrl={nextApiBaseUrl}
              refreshStore={refreshStore}
              onReady={onReady}
              onSnapshot={onSnapshot}
            />
          </ConnectionObservationProvider>
        </MutationObservationProvider>
      )
    })
  }
  await render(apiBaseUrl)
  return { root, container, rerender: render }
}

describe('Store mutation lifecycle equivalent locator identity', () => {
  beforeEach(() => {
    localStorage.clear()
    persistHostTab()
    transportProbe.reset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    document.body.innerHTML = ''
  })

  it('preserves an admission across raw equivalent locator rerender and pulls the matching Context once', async () => {
    let contextPulls = 0
    let contextRefreshes = 0
    const refreshStore = vi.fn()
    let resolveLifecycle: (api: LifecycleApi) => void = () => {}
    const lifecycleReady = new Promise<LifecycleApi>((resolve) => {
      resolveLifecycle = resolve
    })
    let snapshot: LifecycleSnapshot = { current: false, recordCount: 0, mutationLifecycle: null }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url === `${API}/api/health`) return healthResponse()
        if (url === `${API}/trpc/rootContext.refreshProjection`) {
          contextRefreshes += 1
          return Response.json({ result: { data: null } })
        }
        if (url === `${API}/trpc/rootContext.readProjection`) {
          contextPulls += 1
          return Response.json({
            result: {
              data: {
                state: 'loading',
                identity: 'root-context:test',
                workGeneration: 1,
                data: null,
                freshness: null,
                snapshotGeneration: null,
                error: null,
              },
            },
          })
        }
        throw new Error(`Unexpected fetch: ${url}`)
      })
    )

    const rendered = await renderLifecycle(API, refreshStore, resolveLifecycle, (nextSnapshot) => {
      snapshot = nextSnapshot
    })
    try {
      await waitFor(() => transportProbe.callbacks())
      const admittedLifecycle = await lifecycleReady
      await waitFor(() => expect(contextPulls).toBe(1))

      await act(async () => {
        admittedLifecycle.registerAdmission(API, {
          requestId: REQUEST_ID,
          envUri: 'openspecui-env://1/equivalent-locator',
          kind: 'register',
          status: 'accepted',
          observedAt: 1,
        })
      })
      await rendered.rerender(`${API}/`)
      expect(contextPulls).toBe(1)
      await act(async () => {
        transportProbe.callbacks().onData({
          type: 'snapshot',
          cursor: 1,
          records: [
            {
              requestId: REQUEST_ID,
              envUri: 'openspecui-env://1/equivalent-locator',
              kind: 'register',
              status: 'succeeded',
              observedAt: 1,
              result: { exitStatus: 0 },
            },
          ],
        })
      })

      await waitFor(() => {
        expect(snapshot).toEqual({ current: true, recordCount: 1, mutationLifecycle: 'current' })
        expect(refreshStore).toHaveBeenCalledTimes(1)
        expect(contextRefreshes).toBe(1)
        expect(contextPulls).toBe(2)
      })
    } finally {
      await act(async () => rendered.root.unmount())
      rendered.container.remove()
    }
  })
})
