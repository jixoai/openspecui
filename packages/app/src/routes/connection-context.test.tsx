/**
 * Orthogonal intents (created 2026-07-24 Asia/Shanghai):
 * 1. Prove selected Store actions cross the real route owner without first-online fallback.
 * 2. Prove Environment Center and Context Matrix consume every current backend observation.
 * 3. Preserve checked two-backend hosted fixtures and locator-scoped credentials.
 *
 * Original request (2026-07-24): "apply openspec-change: close-openspec-cli16-delivery-gaps"
 */
// @vitest-environment jsdom

import {
  buildBackendHealthPayload,
  type HostedBackendHealthResponse,
} from '@openspecui/core/hosted-app'
import { RouterProvider } from '@tanstack/react-router'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAppRouter, type AppRouterContext } from '../app-router'
import { bindLaunchCredential, clearLaunchCredential } from '../lib/launch-credential'
import { getHostedShellStorageKey, type HostedShellState } from '../lib/shell-state'

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
  } = {}
): typeof fetch {
  const health = new Map<string, HostedBackendHealthResponse>([
    [API_A, createHealth(API_A, 'project-a', 'env:a')],
    [API_B, createHealth(API_B, 'project-b', 'env:b')],
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
          data: { state: 'loading', data: null, attempt: null, error: null, observedAt: 1 },
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

  it('renders every current environment rather than only the active backend', async () => {
    vi.stubGlobal('fetch', createBackendFetch([]))
    const environment = await renderRoute('/environment')
    expect(await screen.findByText('env:a')).toBeTruthy()
    expect(screen.getByText('env:b')).toBeTruthy()
    await unmount(environment)
  })

  it('renders every current project Context rather than only the active backend', async () => {
    vi.stubGlobal('fetch', createBackendFetch([]))
    const context = await renderRoute('/environment/stores/context')
    expect(await screen.findByText('project-a')).toBeTruthy()
    expect(screen.getByText('project-b')).toBeTruthy()
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
