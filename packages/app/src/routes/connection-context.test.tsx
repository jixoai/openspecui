/**
 * Orthogonal intents (updated 2026-07-24 Asia/Shanghai):
 * 1. Prove selected Store actions and terminal-only refresh cross the real route owner.
 * 2. Prove exact selected-tab and generation retirement at the real Store action owner.
 * 3. Prove grouped projects and two-source Root/Reference provenance remain visible.
 * 4. Preserve checked two-backend hosted fixtures and locator-scoped credentials.
 * 5. Cross real Register/Remove forms without disabled-DOM mutation or test-only instrumentation.
 *
 * Original request (2026-07-24): "apply openspec-change: close-openspec-cli16-delivery-gaps"
 */
// @vitest-environment jsdom

import type { RootContext, RootContextState } from '@openspecui/core'
import {
  buildBackendHealthPayload,
  type HostedBackendHealthResponse,
} from '@openspecui/core/hosted-app'
import type { StoreDoctorStore } from '@openspecui/core/store-types'
import { RouterProvider } from '@tanstack/react-router'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAppRouter, type AppRouterContext } from '../app-router'
import { bindLaunchCredential, clearLaunchCredential } from '../lib/launch-credential'
import { getHostedShellStorageKey, type HostedShellState } from '../lib/shell-state'
import { getConnectionsSnapshot } from '../lib/use-connections'

const API_A = 'http://localhost:3100'
const API_B = 'http://localhost:3200'

const STORE: StoreDoctorStore = {
  id: 'design-system',
  root: '/stores/design-system',
  metadata_path: '/stores/design-system/.openspec-store.json',
  openspec_root: {
    present: true,
    config: { present: true },
    specs: { present: true },
    changes: { present: true },
    archive: { present: true },
    healthy: true,
    status: [],
  },
  metadata: { present: true, valid: true, id: 'design-system', remote: null },
  git: {
    is_repository: true,
    has_commits: true,
    has_uncommitted_changes: false,
    has_remote: false,
    origin_url: null,
  },
  status: [],
}

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
    envUrisAfterInitial?: ReadonlyMap<string, string>
    rootContexts?: ReadonlyMap<string, RootContextState>
    rootContextsAfterInitial?: ReadonlyMap<string, RootContextState>
    stores?: StoreDoctorStore[]
    storePulls?: string[]
    mutationRejection?: { status: number; statusText: string }
    offlineAfterInitial?: string
  } = {}
): typeof fetch {
  const health = new Map<string, HostedBackendHealthResponse>([
    [API_A, createHealth(API_A, 'project-a', options.envUris?.get(API_A) ?? 'env:a')],
    [API_B, createHealth(API_B, 'project-b', options.envUris?.get(API_B) ?? 'env:b')],
  ])
  const healthRequestCounts = new Map<string, number>()
  const rootRequestCounts = new Map<string, number>()
  return vi.fn(async (input, init) => {
    const url = String(input)
    const apiBaseUrl = url.startsWith(API_A) ? API_A : API_B
    options.requests?.push({
      url,
      authorization: new Headers(init?.headers).get('authorization'),
    })
    if (url.endsWith('/api/health')) {
      const healthRequestCount = (healthRequestCounts.get(apiBaseUrl) ?? 0) + 1
      healthRequestCounts.set(apiBaseUrl, healthRequestCount)
      if (options.offlineAfterInitial === apiBaseUrl && healthRequestCount > 1) {
        return new Response(null, { status: 503 })
      }
      if (options.authenticationRequired === apiBaseUrl) {
        return new Response(null, { status: 401 })
      }
      const refreshedEnvUri = options.envUrisAfterInitial?.get(apiBaseUrl)
      if (healthRequestCount > 1 && refreshedEnvUri) {
        return Response.json(
          createHealth(
            apiBaseUrl,
            apiBaseUrl === API_A ? 'project-a' : 'project-b',
            refreshedEnvUri
          )
        )
      }
      return Response.json(health.get(apiBaseUrl))
    }
    if (url.includes('/trpc/rootContext.get')) {
      const rootRequestCount = (rootRequestCounts.get(apiBaseUrl) ?? 0) + 1
      rootRequestCounts.set(apiBaseUrl, rootRequestCount)
      return Response.json({
        result: {
          data:
            (rootRequestCount > 1
              ? options.rootContextsAfterInitial?.get(apiBaseUrl)
              : undefined) ??
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
      options.storePulls?.push(`${apiBaseUrl}:${url.includes('stores.list') ? 'list' : 'doctor'}`)
      return Response.json({
        result: { data: { available: true, stores: options.stores ?? [] } },
      })
    }
    if (url.includes('/trpc/stores.mutate')) {
      mutations.push(apiBaseUrl)
      if (options.mutationRejection) {
        return new Response(null, options.mutationRejection)
      }
      return Response.json({
        result: {
          data: {
            requestId: 'register-1',
            envUri: health.get(apiBaseUrl)?.envUri ?? `env:${apiBaseUrl}`,
            kind: 'register',
            status: 'accepted',
            observedAt: 1,
            rejoined: false,
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

  it('does not pull Store projections from HTTP admission before ledger terminal settlement', async () => {
    const mutations: string[] = []
    const storePulls: string[] = []
    vi.stubGlobal('fetch', createBackendFetch(mutations, { storePulls }))
    const rendered = await renderRoute('/environment/stores/inspector')

    const path = await screen.findByPlaceholderText('Path to Store root')
    await waitFor(() =>
      expect(storePulls.filter((entry) => entry.startsWith(`${API_B}:`))).toHaveLength(2)
    )
    fireEvent.change(path, { target: { value: '/tmp/store-b' } })
    fireEvent.click(screen.getByRole('button', { name: 'Register Store' }))
    await waitFor(() => expect(mutations).toEqual([API_B]))
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(storePulls.filter((entry) => entry.startsWith(`${API_B}:`))).toHaveLength(2)
    await unmount(rendered)
  })

  it('keeps the real Remove form open with HTTP rejection and no fabricated lifecycle record', async () => {
    const mutations: string[] = []
    vi.stubGlobal(
      'fetch',
      createBackendFetch(mutations, {
        stores: [STORE],
        mutationRejection: { status: 403, statusText: 'Forbidden' },
      })
    )
    const rendered = await renderRoute('/environment/stores/inspector')

    fireEvent.click(await screen.findByRole('button', { name: 'Remove files' }))
    fireEvent.change(screen.getByLabelText('Type the Store id to confirm'), {
      target: { value: 'design-system' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Remove Store' }))

    await screen.findByText('Store mutation request failed: 403 Forbidden.')
    expect(screen.getByRole('form', { name: 'Remove Store files' })).toBeTruthy()
    expect(document.body.textContent).not.toContain('Indeterminate')
    expect(mutations).toEqual([API_B])
    await unmount(rendered)
  })

  it('keeps the real Store action unavailable when selected B requires authentication', async () => {
    const mutations: string[] = []
    vi.stubGlobal('fetch', createBackendFetch(mutations, { authenticationRequired: API_B }))
    const rendered = await renderRoute('/environment/stores/inspector')

    const path = await screen.findByPlaceholderText('Path to Store root')
    fireEvent.change(path, { target: { value: '/tmp/store-b' } })
    await waitFor(() =>
      expect(
        screen.getByRole<HTMLButtonElement>('button', { name: 'Register Store' }).disabled
      ).toBe(true)
    )
    fireEvent.submit(screen.getByRole('form', { name: 'Store setup or registration' }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(mutations).toEqual([])
    await unmount(rendered)
  })

  it('rejects a Register draft after same-id and same-locator tab replacement before effects run', async () => {
    const mutations: string[] = []
    vi.stubGlobal('fetch', createBackendFetch(mutations))
    const rendered = await renderRoute('/environment/stores/inspector')

    const path = await screen.findByPlaceholderText('Path to Store root')
    fireEvent.change(path, { target: { value: '/tmp/store-b' } })
    const replacement: HostedShellState = {
      activeTabId: 'tab-b',
      tabs: [
        { id: 'tab-a', sessionId: 'session-a', apiBaseUrl: API_A, createdAt: 1 },
        { id: 'tab-b', sessionId: 'replacement-session', apiBaseUrl: API_B, createdAt: 3 },
      ],
    }

    localStorage.setItem(getHostedShellStorageKey(), JSON.stringify(replacement))
    fireEvent.submit(screen.getByRole('form', { name: 'Store setup or registration' }))

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(mutations).toEqual([])
    await unmount(rendered)
  })

  it('keeps a Register draft bound to B when another current tab becomes selected', async () => {
    const mutations: string[] = []
    vi.stubGlobal('fetch', createBackendFetch(mutations))
    const rendered = await renderRoute('/environment/stores/inspector')

    const path = await screen.findByPlaceholderText('Path to Store root')
    fireEvent.change(path, { target: { value: '/tmp/store-b' } })
    const submit = screen.getByRole<HTMLButtonElement>('button', { name: 'Register Store' })
    const selectedA: HostedShellState = {
      activeTabId: 'tab-a',
      tabs: [
        { id: 'tab-a', sessionId: 'session-a', apiBaseUrl: API_A, createdAt: 1 },
        { id: 'tab-b', sessionId: 'session-b', apiBaseUrl: API_B, createdAt: 2 },
      ],
    }

    localStorage.setItem(getHostedShellStorageKey(), JSON.stringify(selectedA))
    await act(async () => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: getHostedShellStorageKey(),
          newValue: JSON.stringify(selectedA),
        })
      )
    })

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toContain(
        'This draft belongs to a previous environment observation.'
      )
      expect(submit.disabled).toBe(false)
    })
    fireEvent.click(submit)

    expect(mutations).toEqual([])
    await unmount(rendered)
  })

  it('keeps an open Remove dialog bound to its retired observation generation', async () => {
    const mutations: string[] = []
    const requests: Array<{ url: string; authorization: string | null }> = []
    vi.stubGlobal(
      'fetch',
      createBackendFetch(mutations, {
        requests,
        stores: [STORE],
        envUrisAfterInitial: new Map([[API_B, 'env:b-refreshed']]),
      })
    )
    const rendered = await renderRoute('/environment/stores/inspector')

    fireEvent.click(await screen.findByRole('button', { name: 'Remove files' }))
    await screen.findByLabelText('Type the Store id to confirm')

    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    await waitFor(() => {
      expect(
        requests.filter((request) => request.url.includes(`${API_B}/trpc/rootContext.get`)).length
      ).toBeGreaterThanOrEqual(2)
      expect(
        screen.getByText(
          'The environment refreshed after this dialog opened. Close and reopen it before removing files.'
        )
      ).toBeTruthy()
      expect(screen.getByText('env:b')).toBeTruthy()
      expect(screen.queryByText('env:b-refreshed')).toBeNull()
    })
    expect(getConnectionsSnapshot().activeTabId).toBe('tab-b')
    const currentConfirmation = screen.getByLabelText('Type the Store id to confirm')
    await act(async () => {
      fireEvent.change(currentConfirmation, { target: { value: 'design-system' } })
    })
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Remove Store' }).disabled).toBe(
      true
    )
    await act(async () => {
      fireEvent.submit(screen.getByRole('form', { name: 'Remove Store files' }))
    })

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(mutations).toEqual([])
    await unmount(rendered)
  })

  it('dispatches a confirmed Remove dialog through the selected B mutation owner', async () => {
    const mutations: string[] = []
    vi.stubGlobal('fetch', createBackendFetch(mutations, { stores: [STORE] }))
    const rendered = await renderRoute('/environment/stores/inspector')

    fireEvent.click(await screen.findByRole('button', { name: 'Remove files' }))
    fireEvent.change(await screen.findByLabelText('Type the Store id to confirm'), {
      target: { value: 'design-system' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Remove Store' }))

    await waitFor(() => expect(mutations).toEqual([API_B]))
    await unmount(rendered)
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

    const referenceA = await screen.findByLabelText('project-a references reference-a (observed)')
    expect(referenceA.getAttribute('title')).toBe('/stores/reference-a')
    const referenceB = screen.getByLabelText('project-b references reference-b (warning)')
    expect(referenceB.textContent).toContain('warning')
    expect(screen.getByText('[warning] reference-b-warning')).toBeTruthy()
    expect(
      screen.getByText('Reference B is retained from the last successful observation.')
    ).toBeTruthy()
    expect(screen.getByText(API_B, { selector: '[data-reference-source]' })).toBeTruthy()
    expect(screen.getByText('Root error')).toBeTruthy()
    expect(screen.getByText('root-unhealthy: Project B root is unhealthy.')).toBeTruthy()
    expect(screen.getByText('retained stale snapshot')).toBeTruthy()
    expect(screen.getByText('Observed relationships only — not a machine-wide index.')).toBeTruthy()
    await unmount(context)
  })

  it('renders retained A evidence separately from a failed B Root attempt', async () => {
    const rootA = createRootData('project-a', 'root-a', [
      { store_id: 'reference-a', root: '/stores/reference-a', status: [] },
    ])
    const failedB = createRootData('project-a', 'root-b', [])
    localStorage.setItem(
      getHostedShellStorageKey(),
      JSON.stringify({
        activeTabId: 'tab-a',
        tabs: [{ id: 'tab-a', sessionId: 'session-a', apiBaseUrl: API_A, createdAt: 1 }],
      } satisfies HostedShellState)
    )
    vi.stubGlobal(
      'fetch',
      createBackendFetch([], {
        envUris: new Map([[API_A, 'env:a']]),
        envUrisAfterInitial: new Map([[API_A, 'env:b']]),
        rootContexts: new Map<string, RootContextState>([
          [API_A, { state: 'ready', data: rootA, attempt: null, error: null, observedAt: 101 }],
        ]),
        rootContextsAfterInitial: new Map<string, RootContextState>([
          [
            API_A,
            {
              state: 'error',
              data: failedB,
              attempt: { ...failedB, planningRoot: null, observedAt: 202 },
              error: { code: 'root-unhealthy', message: 'Root attempt B failed.' },
              observedAt: 202,
            },
          ],
        ]),
      })
    )
    const context = await renderRoute('/environment/stores/context')
    const referenceA = await screen.findByLabelText('project-a references reference-a (observed)')
    expect(referenceA.getAttribute('title')).toBe('/stores/reference-a')

    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })

    const projectRow = await screen.findByText('Latest Root attempt failed')
    const row = projectRow.closest('tr')
    expect(row).not.toBeNull()
    if (!row) throw new Error('Project Context row is unavailable.')
    expect(within(row).getByText('root-a')).toBeTruthy()
    expect(within(row).getByLabelText('project-a references reference-a (observed)')).toBeTruthy()
    expect(within(row).getByText('root-unhealthy: Root attempt B failed.')).toBeTruthy()
    const attemptSource = within(row).getByLabelText('Latest Root attempt source')
    expect(within(attemptSource).getByText(API_A)).toBeTruthy()
    expect(within(attemptSource).getByText('generation 2')).toBeTruthy()
    expect(within(attemptSource).getByText('env:b')).toBeTruthy()
    expect(within(attemptSource).getByText('observed 202')).toBeTruthy()
    await unmount(context)
  })

  it("keeps an offline source's retained Root and Reference provenance visibly stale", async () => {
    const rootB = createRootData('project-b', 'root-b', [
      {
        store_id: 'reference-b',
        root: '/stores/reference-b',
        status: [
          {
            severity: 'warning',
            code: 'reference-b-warning',
            message: 'Reference B was retained before disconnect.',
          },
        ],
      },
    ])
    vi.stubGlobal(
      'fetch',
      createBackendFetch([], {
        rootContexts: new Map<string, RootContextState>([
          [API_B, { state: 'ready', data: rootB, attempt: null, error: null, observedAt: 2 }],
        ]),
        offlineAfterInitial: API_B,
      })
    )
    const context = await renderRoute('/environment/stores/context')
    expect(await screen.findByText('project-b')).toBeTruthy()

    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })

    await waitFor(() => {
      const projectB = screen.getByText('project-b').closest('tr')
      expect(projectB).not.toBeNull()
      if (!projectB) throw new Error('Project B row is unavailable.')
      expect(within(projectB).getByText('retained stale snapshot')).toBeTruthy()
      expect(
        within(projectB).getByLabelText('project-b references reference-b (warning)')
      ).toBeTruthy()
    })
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
