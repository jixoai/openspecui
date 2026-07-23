/**
 * Orthogonal intents (created 2026-07-24 Asia/Shanghai):
 * 1. Prove selected Store actions cross the real route owner without first-online fallback.
 * 2. Prove exact selected-tab and generation retirement at the real Store action owner.
 * 3. Prove grouped projects and two-source Root/Reference provenance remain visible.
 * 4. Preserve checked two-backend hosted fixtures and locator-scoped credentials.
 *
 * Original request (2026-07-24): "apply openspec-change: close-openspec-cli16-delivery-gaps"
 */
// @vitest-environment jsdom

import type { RootContext, RootContextState } from '@openspecui/core'
import {
  buildBackendHealthPayload,
  type HostedBackendHealthResponse,
} from '@openspecui/core/hosted-app'
import { RouterProvider } from '@tanstack/react-router'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAppRouter, type AppRouterContext } from '../app-router'
import { createConnectionObservationOwner } from '../lib/connection-observation'
import { bindLaunchCredential, clearLaunchCredential } from '../lib/launch-credential'
import { getHostedShellStorageKey, type HostedShellState } from '../lib/shell-state'
import { dispatchStoreMutation } from '../lib/store-action'
import { resolveActiveBackendAuthority } from '../lib/use-active-backend'

const API_A = 'http://localhost:3100'
const API_B = 'http://localhost:3200'

const EMPTY_CONTEXT: AppRouterContext = {
  initialLaunchRequest: null,
  fallbackLaunchRequest: null,
  initialError: null,
}

function createHealth(
  apiBaseUrl: string,
  name: string,
  envUri: string
): HostedBackendHealthResponse {
  return buildBackendHealthPayload({
    projectDir: `/tmp/${name}`,
    projectName: name,
    watcherEnabled: true,
    openspecuiVersion: '6.0.0',
    embeddedUiUrl: apiBaseUrl,
    apiBaseUrl,
    cliVersion: '1.6.0',
    envUri,
  })
}

function persistTwoBackends(): void {
  const state: HostedShellState = {
    activeTabId: 'tab-b',
    tabs: [
      { id: 'tab-a', sessionId: 'session-a', apiBaseUrl: API_A, createdAt: 1 },
      { id: 'tab-b', sessionId: 'session-b', apiBaseUrl: API_B, createdAt: 2 },
    ],
  }
  localStorage.setItem(getHostedShellStorageKey(), JSON.stringify(state))
}

function createBackendFetch(
  mutations: string[],
  options: {
    authenticationRequired?: string
    requests?: Array<{ url: string; authorization: string | null }>
    envUris?: ReadonlyMap<string, string>
    rootContexts?: ReadonlyMap<string, RootContextState>
  } = {}
): typeof fetch {
  const health = new Map<string, HostedBackendHealthResponse>([
    [API_A, createHealth(API_A, 'project-a', options.envUris?.get(API_A) ?? 'env:a')],
    [API_B, createHealth(API_B, 'project-b', options.envUris?.get(API_B) ?? 'env:b')],
  ])
  return vi.fn(async (input, init) => {
    const url = String(input)
    const apiBaseUrl = url.startsWith(API_A) ? API_A : API_B
    options.requests?.push({
      url,
      authorization: new Headers(init?.headers).get('authorization'),
    })
    if (url.endsWith('/api/health')) {
      if (options.authenticationRequired === apiBaseUrl) {
        return new Response(null, { status: 401 })
      }
      return Response.json(health.get(apiBaseUrl))
    }
    if (url.includes('/trpc/rootContext.get')) {
      return Response.json({
        result: {
          data:
            options.rootContexts?.get(apiBaseUrl) ??
            ({
              state: 'loading',
              data: null,
              attempt: null,
              error: null,
              observedAt: 1,
            } satisfies RootContextState),
        },
      })
    }
    if (url.includes('/trpc/stores.list') || url.includes('/trpc/stores.doctor')) {
      return Response.json({ result: { data: { available: true, stores: [] } } })
    }
    if (url.includes('/trpc/stores.mutate')) {
      mutations.push(apiBaseUrl)
      return Response.json({
        result: {
          data: {
            requestId: 'register-1',
            kind: 'register',
            status: 'succeeded',
            observedAt: 1,
          },
        },
      })
    }
    return new Response(null, { status: 404 })
  })
}

function createRootData(
  projectName: string,
  storeId: string,
  references: RootContext['references']
): RootContext {
  return {
    launchProject: { path: `/tmp/${projectName}` },
    planningRoot: {
      path: `/stores/${storeId}`,
      source: 'store',
      store_id: storeId,
      healthy: true,
      status: [],
    },
    storeId,
    generation: `root-${projectName}`,
    cli: { available: true, version: '1.6.0' },
    references,
    contextMembers: [],
    dataScope: {
      path: '/tmp/shared-data/openspec',
      source: 'xdg-data-home',
      environmentVariable: 'XDG_DATA_HOME',
    },
    diagnostics: { root: [], doctor: [], context: [] },
    evidence: { doctor: null, context: null },
    observedAt: 1,
  }
}

async function renderRoute(path: string): Promise<{ root: Root; container: HTMLDivElement }> {
  const router = createAppRouter(EMPTY_CONTEXT)
  await router.navigate({ to: path })
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(<RouterProvider router={router} />)
  })
  return { root, container }
}

async function unmount(rendered: { root: Root; container: HTMLDivElement }): Promise<void> {
  await act(async () => rendered.root.unmount())
  rendered.container.remove()
}

beforeEach(() => {
  localStorage.clear()
  persistTwoBackends()
  bindLaunchCredential(API_A, 'credential-a')
  bindLaunchCredential(API_B, 'credential-b')
})

afterEach(() => {
  vi.restoreAllMocks()
  clearLaunchCredential(API_A)
  clearLaunchCredential(API_B)
  localStorage.clear()
  document.body.innerHTML = ''
})

describe('App connection selection and observation routes', () => {
  it('dispatches a real Store form action to selected B rather than first-online A', async () => {
    const mutations: string[] = []
    vi.stubGlobal('fetch', createBackendFetch(mutations))
    const rendered = await renderRoute('/environment/stores/inspector')

    const path = await screen.findByPlaceholderText('Path to Store root')
    fireEvent.change(path, { target: { value: '/tmp/store-b' } })
    fireEvent.click(screen.getByRole('button', { name: 'Register Store' }))

    await waitFor(() => expect(mutations).toEqual([API_B]))
    await unmount(rendered)
  })

  it('keeps the real Store action unavailable when selected B requires authentication', async () => {
    const mutations: string[] = []
    vi.stubGlobal('fetch', createBackendFetch(mutations, { authenticationRequired: API_B }))
    const rendered = await renderRoute('/environment/stores/inspector')

    const path = await screen.findByPlaceholderText('Path to Store root')
    fireEvent.change(path, { target: { value: '/tmp/store-b' } })
    const submit = screen.getByRole<HTMLButtonElement>('button', { name: 'Register Store' })
    await waitFor(() => expect(submit.disabled).toBe(true))

    // Cross only the presentation lock; the production route action guard must still reject dispatch.
    submit.disabled = false
    fireEvent.click(submit)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(mutations).toEqual([])
    await unmount(rendered)
  })

  it('rejects a Store action while selected B is replaced at the same locator', async () => {
    const mutations: string[] = []
    vi.stubGlobal('fetch', createBackendFetch(mutations))
    const rendered = await renderRoute('/environment/stores/inspector')

    const path = await screen.findByPlaceholderText('Path to Store root')
    fireEvent.change(path, { target: { value: '/tmp/store-b' } })
    const submit = screen.getByRole<HTMLButtonElement>('button', { name: 'Register Store' })
    await waitFor(() => expect(submit.disabled).toBe(false))

    const replacement: HostedShellState = {
      activeTabId: 'tab-b-replacement',
      tabs: [
        { id: 'tab-a', sessionId: 'session-a', apiBaseUrl: API_A, createdAt: 1 },
        {
          id: 'tab-b-replacement',
          sessionId: 'session-b-replacement',
          apiBaseUrl: API_B,
          createdAt: 3,
        },
      ],
    }
    localStorage.setItem(getHostedShellStorageKey(), JSON.stringify(replacement))

    await act(async () => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: getHostedShellStorageKey(),
          newValue: JSON.stringify(replacement),
        })
      )
      fireEvent.click(submit)
    })

    expect(mutations).toEqual([])
    await unmount(rendered)
  })

  it('rejects a Store action captured from the prior observation generation', async () => {
    const state: HostedShellState = {
      activeTabId: 'tab-b',
      tabs: [
        { id: 'tab-a', sessionId: 'session-a', apiBaseUrl: API_A, createdAt: 1 },
        { id: 'tab-b', sessionId: 'session-b', apiBaseUrl: API_B, createdAt: 2 },
      ],
    }
    const owner = createConnectionObservationOwner({
      probe: async (apiBaseUrl) => ({
        reachability: 'online',
        health: createHealth(
          apiBaseUrl,
          apiBaseUrl === API_A ? 'project-a' : 'project-b',
          apiBaseUrl === API_A ? 'env:a' : 'env:b'
        ),
        errorMessage: null,
      }),
      fetchRootContext: async () => ({
        state: 'loading',
        data: null,
        attempt: null,
        error: null,
        observedAt: 1,
      }),
      now: () => 1,
    })
    owner.setTabs(state.tabs)
    await owner.refresh(['tab-b'])
    const tab = state.tabs[1]
    const observation = owner
      .getSnapshot()
      .observations.find((candidate) => candidate.tabId === 'tab-b')
    expect(tab).toBeDefined()
    expect(observation).toBeDefined()
    if (!tab || !observation) throw new Error('Selected B fixture did not become observable.')
    const authority = resolveActiveBackendAuthority({
      selectedTab: tab,
      observation,
      owner,
      readConnections: () => state,
    })
    expect(authority).not.toBeNull()

    const mutations: string[] = []
    vi.stubGlobal('fetch', createBackendFetch(mutations))
    await owner.refresh(['tab-b'])
    const result = await dispatchStoreMutation(authority, {
      requestId: 'register-retired-generation',
      kind: 'register',
      path: '/tmp/store-b',
    })

    expect(result).toBeNull()
    expect(mutations).toEqual([])
  })

  it('renders every current environment rather than only the active backend', async () => {
    vi.stubGlobal('fetch', createBackendFetch([]))
    const environment = await renderRoute('/environment')
    expect(await screen.findByText('env:a')).toBeTruthy()
    expect(screen.getByText('env:b')).toBeTruthy()
    await unmount(environment)
  })

  it('keeps both connected projects visible when one envUri groups their backends', async () => {
    vi.stubGlobal(
      'fetch',
      createBackendFetch([], {
        envUris: new Map([
          [API_A, 'env:shared'],
          [API_B, 'env:shared'],
        ]),
      })
    )
    const environment = await renderRoute('/environment')

    expect(await screen.findByText('env:shared')).toBeTruthy()
    expect(screen.getByText('2 connected projects')).toBeTruthy()
    expect(screen.getByText('project-a')).toBeTruthy()
    expect(screen.getByText('project-b')).toBeTruthy()
    expect(screen.getByText(API_A)).toBeTruthy()
    expect(screen.getByText(API_B)).toBeTruthy()
    await unmount(environment)
  })

  it('renders every current project Context rather than only the active backend', async () => {
    vi.stubGlobal('fetch', createBackendFetch([]))
    const context = await renderRoute('/environment/stores/context')
    expect(await screen.findByText('project-a')).toBeTruthy()
    expect(screen.getByText('project-b')).toBeTruthy()
    await unmount(context)
  })

  it('renders distinct A/B Reference provenance and typed Root error evidence', async () => {
    const rootA = createRootData('project-a', 'root-a', [
      { store_id: 'reference-a', root: '/stores/reference-a', status: [] },
    ])
    const rootB = createRootData('project-b', 'root-b', [
      {
        store_id: 'reference-b',
        root: '/stores/reference-b',
        status: [
          {
            severity: 'warning',
            code: 'reference-b-warning',
            message: 'Reference B is retained from the last successful observation.',
          },
        ],
      },
    ])
    vi.stubGlobal(
      'fetch',
      createBackendFetch([], {
        envUris: new Map([
          [API_A, 'env:shared'],
          [API_B, 'env:shared'],
        ]),
        rootContexts: new Map<string, RootContextState>([
          [API_A, { state: 'ready', data: rootA, attempt: null, error: null, observedAt: 2 }],
          [
            API_B,
            {
              state: 'error',
              data: rootB,
              attempt: { ...rootB, planningRoot: null, observedAt: 3 },
              error: { code: 'root-unhealthy', message: 'Project B root is unhealthy.' },
              observedAt: 3,
            },
          ],
        ]),
      })
    )
    const context = await renderRoute('/environment/stores/context')

    const referenceA = await screen.findByLabelText('project-a references reference-a (healthy)')
    expect(referenceA.getAttribute('title')).toBe('/stores/reference-a')
    const referenceB = screen.getByLabelText('project-b references reference-b (healthy)')
    expect(referenceB.getAttribute('title')).toBe('/stores/reference-b')
    expect(screen.getByText('Root error')).toBeTruthy()
    expect(screen.getByText('root-unhealthy: Project B root is unhealthy.')).toBeTruthy()
    expect(screen.getByText('retained stale snapshot')).toBeTruthy()
    expect(screen.getByText('Observed relationships only — not a machine-wide index.')).toBeTruthy()
    await unmount(context)
  })

  it('keeps health and Root HTTP credentials isolated by backend locator', async () => {
    const requests: Array<{ url: string; authorization: string | null }> = []
    vi.stubGlobal('fetch', createBackendFetch([], { requests }))
    const rendered = await renderRoute('/environment/stores/context')

    await screen.findByText('project-a')
    await waitFor(() => {
      expect(requests.filter((request) => request.url.includes('rootContext.get'))).toHaveLength(2)
    })
    expect(
      requests
        .filter(
          (request) =>
            request.url.endsWith('/api/health') || request.url.includes('rootContext.get')
        )
        .map((request) => ({
          backend: request.url.startsWith(API_A) ? 'A' : 'B',
          authorization: request.authorization,
        }))
    ).toEqual([
      { backend: 'A', authorization: 'Bearer credential-a' },
      { backend: 'B', authorization: 'Bearer credential-b' },
      { backend: 'A', authorization: 'Bearer credential-a' },
      { backend: 'B', authorization: 'Bearer credential-b' },
    ])
    await unmount(rendered)
  })
})
