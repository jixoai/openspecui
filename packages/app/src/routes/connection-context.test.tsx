/**
 * Orthogonal intents (updated 2026-07-27 Asia/Shanghai):
 * 1. Prove real Inspector/Register/Remove lifecycle rendering through the production route, dispatcher, and providers.
 * 2. Prove exact selected-tab and generation retirement at the real Store action owner.
 * 3. Prove grouped projects and two-source Root/Reference provenance remain visible.
 * 4. Preserve checked two-backend hosted fixtures and locator-scoped credentials.
 * 5. Retain rejection repair paths without fabricating backend lifecycle records.
 *
 * Original request (2026-07-24): "apply openspec-change: close-openspec-cli16-delivery-gaps"
 * P3-D evidence (2026-07-25): render all Server-owned Store mutation lifecycle states through real form/dialog actions.
 * Owner-reported acceptance gap (2026-07-26): Store Manager did not expose how to select B while retaining A.
 * Original request (2026-07-26): "缓存现在正在被更新中。"
 */
// @vitest-environment jsdom

import {
  buildBackendHealthPayload,
  type HostedBackendHealthResponse,
} from '@openspecui/core/hosted-app'
import type {
  HostedRootContext,
  HostedRootContextProjectionState,
  HostedRootContextState,
} from '@openspecui/core/hosted-contract'
import type { StoreMutationEnvelope } from '@openspecui/core/store-mutation-protocol'
import type { StoreDoctorStore } from '@openspecui/core/store-types'
import { RouterProvider } from '@tanstack/react-router'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAppRouter, type AppRouterContext } from '../app-router'
import type {
  CliProjectionSelector,
  CliProjectionTransportCallbacks,
} from '../lib/cli-projection-transport'
import { bindLaunchCredential, clearLaunchCredential } from '../lib/launch-credential'
import type { MutationLifecycleCallbacks } from '../lib/mutation-observation'
import { getHostedShellStorageKey, type HostedShellState } from '../lib/shell-state'
import { getConnectionsSnapshot } from '../lib/use-connections'

const lifecycleTransport = vi.hoisted(() => {
  const callbacksByApiBaseUrl = new Map<string, MutationLifecycleCallbacks>()
  return {
    connect(apiBaseUrl: string, callbacks: MutationLifecycleCallbacks) {
      callbacksByApiBaseUrl.set(apiBaseUrl, callbacks)
      return {
        unsubscribe() {
          if (callbacksByApiBaseUrl.get(apiBaseUrl) === callbacks) {
            callbacksByApiBaseUrl.delete(apiBaseUrl)
          }
        },
      }
    },
    callbacks(apiBaseUrl: string): MutationLifecycleCallbacks {
      const callbacks = callbacksByApiBaseUrl.get(apiBaseUrl)
      if (!callbacks) throw new Error(`Missing lifecycle callbacks for ${apiBaseUrl}.`)
      return callbacks
    },
    reset() {
      callbacksByApiBaseUrl.clear()
    },
  }
})

vi.mock('../lib/mutation-observation-transport', () => ({
  createTRPCMutationObservationTransportFactory: () => ({ connect: lifecycleTransport.connect }),
}))

const projectionTransport = vi.hoisted(() => {
  const callbacksByKey = new Map<string, CliProjectionTransportCallbacks>()
  const key = (apiBaseUrl: string, kind: CliProjectionSelector['kind']) => `${apiBaseUrl}:${kind}`
  return {
    connect(
      apiBaseUrl: string,
      selector: CliProjectionSelector,
      callbacks: CliProjectionTransportCallbacks
    ) {
      const identity = key(apiBaseUrl, selector.kind)
      callbacksByKey.set(identity, callbacks)
      queueMicrotask(() => {
        callbacks.onNotice({
          identity,
          workGeneration: 1,
          snapshotGeneration: 1,
          state: 'ready',
          invalidationCause: 'initial',
        })
      })
      return {
        unsubscribe() {
          if (callbacksByKey.get(identity) === callbacks) callbacksByKey.delete(identity)
        },
      }
    },
    callbacks(apiBaseUrl: string, kind: CliProjectionSelector['kind']) {
      const callbacks = callbacksByKey.get(key(apiBaseUrl, kind))
      if (!callbacks) throw new Error(`Missing projection callbacks for ${apiBaseUrl}:${kind}.`)
      return callbacks
    },
    reset() {
      callbacksByKey.clear()
    },
  }
})

vi.mock('../lib/cli-projection-transport', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/cli-projection-transport')>()
  return {
    ...original,
    createTRPCCliProjectionTransportFactory: () => ({ connect: projectionTransport.connect }),
  }
})

const API_A = 'http://localhost:3100'
const API_B = 'http://localhost:3200'

function lifecycleRecord(
  requestId: string,
  kind: 'register' | 'remove',
  status: StoreMutationEnvelope['status']
): StoreMutationEnvelope {
  const base = {
    requestId,
    envUri: 'env:project-b',
    kind,
    observedAt: 1,
  }
  if (status === 'succeeded' || status === 'failed' || status === 'indeterminate') {
    return {
      ...base,
      status,
      result: { exitStatus: status === 'succeeded' ? 0 : 1, stderr: `Store ${kind} ${status}.` },
    }
  }
  return { ...base, status }
}

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

type SubmittedMutationKind = 'setup' | 'register' | 'unregister' | 'remove'

interface SubmittedMutation {
  requestId: string
  kind: SubmittedMutationKind
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readSubmittedMutation(body: BodyInit | null | undefined): SubmittedMutation {
  if (typeof body !== 'string')
    throw new Error('Store mutation fixture requires a JSON request body.')
  const parsed: unknown = JSON.parse(body)
  if (!isRecord(parsed)) {
    throw new Error('Store mutation fixture received a non-object request.')
  }
  const { requestId, kind } = parsed
  if (typeof requestId !== 'string' || requestId.length === 0) {
    throw new Error('Store mutation fixture received no request id.')
  }
  if (kind !== 'setup' && kind !== 'register' && kind !== 'unregister' && kind !== 'remove') {
    throw new Error('Store mutation fixture received an unknown kind.')
  }
  return { requestId, kind }
}

function rootProjection(
  rootContext: HostedRootContextState,
  workGeneration: number,
  identity = 'root-context:fixture'
): HostedRootContextProjectionState {
  if (rootContext.state === 'loading') {
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
  return {
    state: 'ready',
    identity,
    workGeneration,
    invalidationCause: 'initial',
    data: resolved,
    freshness: 'current',
    snapshotGeneration: workGeneration,
    error: null,
  }
}

function createBackendFetch(
  mutations: string[],
  options: {
    authenticationRequired?: string
    requests?: Array<{ url: string; authorization: string | null }>
    envUris?: ReadonlyMap<string, string>
    envUrisAfterInitial?: ReadonlyMap<string, string>
    rootContexts?: ReadonlyMap<string, HostedRootContextState>
    rootContextsAfterInitial?: ReadonlyMap<string, HostedRootContextState>
    stores?: StoreDoctorStore[]
    storeProjectionState?: 'ready' | 'revalidating'
    storeProjectionGate?: { kind: 'list' | 'doctor'; afterPull: number; wait: Promise<void> }
    storePulls?: string[]
    mutationRequests?: SubmittedMutation[]
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
  const storeRequestCounts = new Map<string, number>()
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
    if (url.includes('/trpc/rootContext.refreshProjection')) {
      return Response.json({ result: { data: { state: 'revalidating' } } })
    }
    if (url.includes('/trpc/rootContext.readProjection')) {
      const rootRequestCount = (rootRequestCounts.get(apiBaseUrl) ?? 0) + 1
      rootRequestCounts.set(apiBaseUrl, rootRequestCount)
      const rootContext =
        (rootRequestCount > 1 ? options.rootContextsAfterInitial?.get(apiBaseUrl) : undefined) ??
        options.rootContexts?.get(apiBaseUrl) ??
        ({
          state: 'loading',
          data: null,
          attempt: null,
          error: null,
          observedAt: 1,
        } satisfies HostedRootContextState)
      return Response.json({
        result: {
          data: rootProjection(rootContext, rootRequestCount, `${apiBaseUrl}:root-context`),
        },
      })
    }
    if (
      url.includes('/trpc/stores.readListProjection') ||
      url.includes('/trpc/stores.readDoctorProjection')
    ) {
      const kind = url.includes('readListProjection') ? 'list' : 'doctor'
      const projectionKind = kind === 'list' ? 'store-list' : 'store-doctor'
      const state = options.storeProjectionState ?? 'ready'
      const requestKey = `${apiBaseUrl}:${kind}`
      const storeRequestCount = (storeRequestCounts.get(requestKey) ?? 0) + 1
      storeRequestCounts.set(requestKey, storeRequestCount)
      options.storePulls?.push(`${apiBaseUrl}:${kind}`)
      if (
        options.storeProjectionGate?.kind === kind &&
        storeRequestCount > options.storeProjectionGate.afterPull
      ) {
        await options.storeProjectionGate.wait
      }
      return Response.json({
        result: {
          data: {
            state,
            identity: `${apiBaseUrl}:${projectionKind}`,
            workGeneration: state === 'ready' ? 1 : 2,
            invalidationCause: state === 'ready' ? 'initial' : 'dependency',
            data: { available: true, stores: options.stores ?? [] },
            freshness: state === 'ready' ? 'current' : 'stale-display-only',
            snapshotGeneration: 1,
            error: null,
          },
        },
      })
    }
    if (url.includes('/trpc/stores.refreshProjection')) {
      return Response.json({ result: { data: { state: 'revalidating' } } })
    }
    if (url.includes('/trpc/stores.mutate')) {
      const mutation = readSubmittedMutation(init?.body)
      mutations.push(apiBaseUrl)
      options.mutationRequests?.push(mutation)
      if (options.mutationRejection) {
        return new Response(null, options.mutationRejection)
      }
      return Response.json({
        result: {
          data: {
            requestId: mutation.requestId,
            envUri: health.get(apiBaseUrl)?.envUri ?? `env:${apiBaseUrl}`,
            kind: mutation.kind,
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
  references: HostedRootContext['references']
): HostedRootContext {
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

async function establishCurrentMutationLedger(): Promise<MutationLifecycleCallbacks> {
  await waitFor(() => lifecycleTransport.callbacks(API_B))
  const callbacks = lifecycleTransport.callbacks(API_B)
  await act(async () => {
    callbacks.onData({ type: 'snapshot', cursor: 0, records: [] })
  })
  return callbacks
}

const REGISTER_LIFECYCLE_STATES = [
  { status: 'accepted', label: 'Queued' },
  { status: 'running', label: 'Running' },
  { status: 'succeeded', label: 'Succeeded' },
] as const satisfies ReadonlyArray<{
  status: Extract<StoreMutationEnvelope['status'], 'accepted' | 'running' | 'succeeded'>
  label: string
}>

const REMOVE_TERMINAL_STATES = [
  { status: 'failed', label: 'Failed' },
  { status: 'indeterminate', label: 'Indeterminate' },
] as const satisfies ReadonlyArray<{
  status: Extract<StoreMutationEnvelope['status'], 'failed' | 'indeterminate'>
  label: string
}>

beforeEach(() => {
  lifecycleTransport.reset()
  projectionTransport.reset()
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
  it('selects the Store Manager backend explicitly while retaining every connected tab', async () => {
    vi.stubGlobal('fetch', createBackendFetch([]))
    const rendered = await renderRoute('/environment/stores/inspector')

    const selector = await screen.findByRole<HTMLSelectElement>('combobox', {
      name: 'Store Manager backend',
    })
    expect(selector.value).toBe('tab-b')
    expect([...selector.options].map((option) => option.value)).toEqual(['tab-a', 'tab-b'])

    fireEvent.change(selector, { target: { value: 'tab-a' } })
    await waitFor(() => expect(getConnectionsSnapshot().activeTabId).toBe('tab-a'))
    expect(getConnectionsSnapshot().tabs).toHaveLength(2)

    fireEvent.change(selector, { target: { value: 'tab-b' } })
    await waitFor(() => expect(getConnectionsSnapshot().activeTabId).toBe('tab-b'))
    expect(getConnectionsSnapshot().tabs).toHaveLength(2)
    await unmount(rendered)
  })

  it.each(REGISTER_LIFECYCLE_STATES)(
    'renders backend-owned Register $status lifecycle evidence through the real route dispatcher',
    async ({ status, label }) => {
      const mutations: string[] = []
      const mutationRequests: SubmittedMutation[] = []
      vi.stubGlobal('fetch', createBackendFetch(mutations, { mutationRequests }))
      const rendered = await renderRoute('/environment/stores/inspector')
      try {
        const callbacks = await establishCurrentMutationLedger()
        const path = await screen.findByPlaceholderText('Path to Store root')
        fireEvent.change(path, { target: { value: `/tmp/${status}-store` } })
        fireEvent.click(screen.getByRole('button', { name: 'Register Store' }))

        await waitFor(() => expect(mutations).toEqual([API_B]))
        const request = mutationRequests[0]
        if (!request) throw new Error('Register route did not submit a Store mutation request.')
        expect(request.kind).toBe('register')
        await act(async () => {
          callbacks.onData({
            type: 'changed',
            cursor: 1,
            record: lifecycleRecord(request.requestId, 'register', status),
          })
        })

        expect((await screen.findAllByText(label)).length).toBeGreaterThan(0)
      } finally {
        await unmount(rendered)
      }
    }
  )

  it.each(REMOVE_TERMINAL_STATES)(
    'renders backend-owned Remove $status evidence and retains the repair dialog',
    async ({ status, label }) => {
      const mutations: string[] = []
      const mutationRequests: SubmittedMutation[] = []
      vi.stubGlobal('fetch', createBackendFetch(mutations, { mutationRequests, stores: [STORE] }))
      const rendered = await renderRoute('/environment/stores/inspector')
      try {
        const callbacks = await establishCurrentMutationLedger()
        fireEvent.click(await screen.findByRole('button', { name: 'Remove files' }))
        fireEvent.change(screen.getByLabelText('Type the Store id to confirm'), {
          target: { value: STORE.id },
        })
        fireEvent.click(screen.getByRole('button', { name: 'Remove Store' }))

        await waitFor(() => expect(mutations).toEqual([API_B]))
        const request = mutationRequests[0]
        if (!request) throw new Error('Remove dialog did not submit a Store mutation request.')
        expect(request.kind).toBe('remove')
        await act(async () => {
          await Promise.resolve()
          await Promise.resolve()
        })
        await act(async () => {
          callbacks.onData({
            type: 'changed',
            cursor: 1,
            record: lifecycleRecord(request.requestId, 'remove', status),
          })
        })

        expect((await screen.findAllByText(label)).length).toBeGreaterThan(0)
        expect(screen.getByRole('form', { name: 'Remove Store files' })).toBeTruthy()
      } finally {
        await unmount(rendered)
      }
    }
  )

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

  it('rejects a real Store form dispatch while retained Doctor data is revalidating', async () => {
    const mutations: string[] = []
    vi.stubGlobal('fetch', createBackendFetch(mutations, { storeProjectionState: 'revalidating' }))
    const rendered = await renderRoute('/environment/stores/inspector')

    fireEvent.change(await screen.findByPlaceholderText('Path to Store root'), {
      target: { value: '/tmp/stale-store' },
    })
    await act(async () => {
      fireEvent.submit(screen.getByRole('form', { name: 'Store setup or registration' }))
    })

    expect(
      await screen.findByText('Store diagnostics are not current. Wait for refresh to settle.')
    ).toBeTruthy()
    expect(mutations).toEqual([])
    await unmount(rendered)
  })

  it('revokes a real Store form dispatch as soon as the Doctor lifecycle becomes stale', async () => {
    let releaseDoctorPull!: () => void
    const doctorPull = new Promise<void>((resolve) => {
      releaseDoctorPull = resolve
    })
    const mutations: string[] = []
    vi.stubGlobal(
      'fetch',
      createBackendFetch(mutations, {
        storeProjectionGate: { kind: 'doctor', afterPull: 1, wait: doctorPull },
      })
    )
    const rendered = await renderRoute('/environment/stores/inspector')

    fireEvent.change(await screen.findByPlaceholderText('Path to Store root'), {
      target: { value: '/tmp/stale-after-notice' },
    })
    await act(async () => {
      projectionTransport.callbacks(API_B, 'store-doctor').onNotice({
        identity: `${API_B}:store-doctor`,
        workGeneration: 2,
        snapshotGeneration: 1,
        state: 'revalidating',
        invalidationCause: 'dependency',
      })
    })
    fireEvent.submit(screen.getByRole('form', { name: 'Store setup or registration' }))

    expect(
      await screen.findByText('Store diagnostics are not current. Wait for refresh to settle.')
    ).toBeTruthy()
    expect(mutations).toEqual([])
    releaseDoctorPull()
    await unmount(rendered)
  })

  it('keeps a Register draft bound to B when another current tab becomes selected', async () => {
    const mutations: string[] = []
    vi.stubGlobal('fetch', createBackendFetch(mutations))
    const rendered = await renderRoute('/environment/stores/inspector')

    const path = await screen.findByPlaceholderText('Path to Store root')
    fireEvent.change(path, { target: { value: '/tmp/store-b' } })
    const selector = screen.getByRole<HTMLSelectElement>('combobox', {
      name: 'Store Manager backend',
    })
    fireEvent.change(selector, { target: { value: 'tab-a' } })

    await waitFor(() => {
      expect(getConnectionsSnapshot().activeTabId).toBe('tab-a')
      expect(screen.getByRole('status').textContent).toContain(
        'This draft belongs to a previous environment observation.'
      )
      expect(
        screen.getByRole<HTMLButtonElement>('button', { name: 'Register Store' }).disabled
      ).toBe(false)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Register Store' }))

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
        requests.filter((request) =>
          request.url.includes(`${API_B}/trpc/rootContext.readProjection`)
        ).length
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
        rootContexts: new Map<string, HostedRootContextState>([
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
        rootContexts: new Map<string, HostedRootContextState>([
          [API_A, { state: 'ready', data: rootA, attempt: null, error: null, observedAt: 101 }],
        ]),
        rootContextsAfterInitial: new Map<string, HostedRootContextState>([
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
        rootContexts: new Map<string, HostedRootContextState>([
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
      expect(
        requests.filter((request) => request.url.includes('rootContext.readProjection'))
      ).toHaveLength(2)
    })
    expect(
      requests
        .filter(
          (request) =>
            request.url.endsWith('/api/health') ||
            request.url.includes('rootContext.readProjection')
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
