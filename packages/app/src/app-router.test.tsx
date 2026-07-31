/**
 * Orthogonal intents (updated 2026-07-30 Asia/Shanghai):
 * 1. Prove the App router renders the two-domain (Workspaces + Stores) surface (8.1).
 * 2. Prove the root redirects to Workspaces and Settings remains a secondary utility route (8.1/8.2).
 * 3. Prove retired routes (Connections/Environment/Store Manager) are gone (8.3).
 * 4. Prove route round-trips preserve the AppLayout-owned iframe Document identity (8.5/8.9).
 * 5. Prove overlay window chrome remains globally visible outside Workspaces.
 *
 * Original request (2026-07-15): "app 模式提供了多标签管理。"
 * Original request (2026-07-30): "左侧只留下 Workspaces + Stores 就行了。"
 */
// @vitest-environment jsdom

import { buildBackendHealthPayload } from '@openspecui/core/hosted-app'
import { RouterProvider } from '@tanstack/react-router'
import { act, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAppRouter, type AppRouterContext } from './app-router'
import { clearLaunchCredential, readLaunchCredential } from './lib/launch-credential'
import { getHostedShellStorageKey } from './lib/shell-state'
import { buildStoreDetailPath } from './lib/store-route-identity'

const EMPTY_CONTEXT: AppRouterContext = {
  initialLaunchRequest: null,
  fallbackLaunchRequest: null,
  initialError: null,
}

const renderedRoots = new Set<Root>()
const originalBroadcastChannel = globalThis.BroadcastChannel
const originalMatchMedia = window.matchMedia
const originalFetch = global.fetch
const originalOpenTrayWindow = Object.getOwnPropertyDescriptor(navigator, 'opentrayWindow')

class TestBroadcastChannel {
  static readonly channels = new Map<string, Set<TestBroadcastChannel>>()
  readonly listeners = new Set<EventListener>()

  constructor(readonly name: string) {
    const channels = TestBroadcastChannel.channels.get(name) ?? new Set<TestBroadcastChannel>()
    channels.add(this)
    TestBroadcastChannel.channels.set(name, channels)
  }

  postMessage(message: unknown): void {
    for (const peer of TestBroadcastChannel.channels.get(this.name) ?? []) {
      if (peer === this) continue
      const event = new MessageEvent('message', { data: message })
      for (const listener of peer.listeners) listener(event)
    }
  }

  addEventListener(_type: 'message', listener: EventListener): void {
    this.listeners.add(listener)
  }

  removeEventListener(_type: 'message', listener: EventListener): void {
    this.listeners.delete(listener)
  }

  close(): void {
    TestBroadcastChannel.channels.get(this.name)?.delete(this)
    this.listeners.clear()
  }
}

async function renderAt(element: ReactElement): Promise<{ container: HTMLDivElement; root: Root }> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  renderedRoots.add(root)
  await act(async () => {
    root.render(element)
  })
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
  return { container, root }
}

function routerFor(context: AppRouterContext, initialPath: string) {
  const router = createAppRouter(context)
  router.history.push(initialPath)
  return router
}

describe('app-router', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    window.history.replaceState({}, '', '/')
    localStorage.clear()
    TestBroadcastChannel.channels.clear()
    Object.defineProperty(globalThis, 'BroadcastChannel', {
      configurable: true,
      value: TestBroadcastChannel,
    })
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent: () => false,
      }),
    })
  })

  afterEach(async () => {
    await act(async () => {
      for (const root of renderedRoots) root.unmount()
    })
    renderedRoots.clear()
    clearLaunchCredential('http://localhost:3102')
    Object.defineProperty(globalThis, 'BroadcastChannel', {
      configurable: true,
      value: originalBroadcastChannel,
    })
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: originalMatchMedia,
    })
    global.fetch = originalFetch
    if (originalOpenTrayWindow) {
      Object.defineProperty(navigator, 'opentrayWindow', originalOpenTrayWindow)
    } else {
      Reflect.deleteProperty(navigator, 'opentrayWindow')
    }
    document.body.innerHTML = ''
  })

  it('renders the two-domain App shell with only Workspaces + Stores navigation', async () => {
    const router = routerFor(EMPTY_CONTEXT, '/settings')
    const { container } = await renderAt(<RouterProvider router={router} />)
    const text = container.textContent ?? ''
    // Primary navigation is exactly Workspaces + Stores.
    expect(text).toContain('Workspaces')
    expect(text).toContain('Stores')
    // Retired primary navigation links are gone.
    expect(container.querySelector('a[href="/connections"]')).toBeNull()
    expect(container.querySelector('a[href="/environment"]')).toBeNull()
    expect(container.querySelector('a[href="/environment/stores/inspector"]')).toBeNull()
    expect(container.querySelector('a[href="/settings"]')).toBeTruthy()
  })

  it('redirects the root route to Workspaces', async () => {
    const router = routerFor(EMPTY_CONTEXT, '/')
    await renderAt(<RouterProvider router={router} />)
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(router.state.location.pathname).toBe('/workspaces')
  })

  it('renders the Stores index route with observed-only language', async () => {
    const router = routerFor(EMPTY_CONTEXT, '/stores')
    const { container } = await renderAt(<RouterProvider router={router} />)
    const text = container.textContent ?? ''
    expect(text).toContain('Stores')
    expect(text).toContain('Observed stores only')
  })

  it('renders Environment evidence and direct Store Detail routes instead of blank placeholders', async () => {
    const router = routerFor(EMPTY_CONTEXT, '/stores/environments')
    const { container } = await renderAt(<RouterProvider router={router} />)
    expect(container.textContent).toContain('Environment evidence')

    await act(async () => {
      await router.navigate({
        to: buildStoreDetailPath({ envUri: 'env://missing', storeId: 'team' }),
      })
    })
    await waitFor(() => {
      expect(container.textContent).toContain('not currently observed in this Environment')
    })
  })

  it('renders the OpenTray titlebar above the Workspaces surface from the global App layout', async () => {
    Object.defineProperty(navigator, 'opentrayWindow', {
      configurable: true,
      value: {
        overlay: {
          visible: true,
          getTitlebarAreaRect: vi.fn(async () => ({ x: 72, y: 0, width: 1128, height: 40 })),
        },
        startAppRegionDrag: vi.fn(),
      },
    })
    const router = routerFor(EMPTY_CONTEXT, '/workspaces')
    const { container } = await renderAt(<RouterProvider router={router} />)

    await waitFor(() => {
      expect(container.querySelector('[data-app-titlebar="true"]')).toBeTruthy()
    })
    const layout = container.querySelector('[data-testid="app-layout"]')
    const titlebar = container.querySelector('[data-app-titlebar="true"]')
    expect(layout?.getAttribute('data-titlebar-presentation')).toBe('opentray')
    expect(layout?.firstElementChild).toBe(titlebar)
  })

  it('moves Settings into the compact titlebar for overlay presentation', async () => {
    const router = routerFor(
      { ...EMPTY_CONTEXT, appPresentation: 'opentray-overlay' },
      '/workspaces'
    )
    const { container } = await renderAt(<RouterProvider router={router} />)

    await waitFor(() => {
      expect(container.querySelector('[data-app-titlebar="true"]')).toBeTruthy()
    })
    expect(container.querySelector('a[href="/settings"]')).toBeNull()
    const settings = container.querySelector<HTMLButtonElement>('button[aria-label="Settings"]')
    expect(settings).toBeTruthy()
    await act(async () => settings?.click())
    expect(router.state.location.pathname).toBe('/settings')
  })

  it('keeps the launch owner active while Stores is the current route', async () => {
    const router = routerFor(EMPTY_CONTEXT, '/stores')
    await renderAt(<RouterProvider router={router} />)
    const launcher = new TestBroadcastChannel('openspecui-app:browser-launch')

    await act(async () => {
      launcher.postMessage({
        type: 'launch',
        id: 'launch-b',
        sourceWindowId: 'launcher-b',
        request: { apiBaseUrl: 'http://localhost:3102' },
        credential: 'credential-b',
      })
      await Promise.resolve()
    })

    const stored = JSON.parse(localStorage.getItem(getHostedShellStorageKey()) ?? '{}') as unknown
    expect(stored).toMatchObject({
      tabs: [{ apiBaseUrl: 'http://localhost:3102' }],
    })
    expect(readLaunchCredential('http://localhost:3102')).toBe('credential-b')
    launcher.close()
  })

  it('preserves an App-lifetime launch error for the Workspaces surface', async () => {
    const router = routerFor(
      {
        ...EMPTY_CONTEXT,
        initialError: 'The launch credential requires a valid backend locator.',
      },
      '/workspaces'
    )
    const { container } = await renderAt(<RouterProvider router={router} />)

    expect(container.textContent).toContain(
      'The launch credential requires a valid backend locator.'
    )
  })

  it('preserves the hosted iframe identity across Workspaces -> Stores -> Workspaces round-trips', async () => {
    localStorage.setItem(
      getHostedShellStorageKey(),
      JSON.stringify({
        activeTabId: 'tab-a',
        tabs: [
          {
            id: 'tab-a',
            sessionId: 'session-a',
            apiBaseUrl: 'http://localhost:3100',
            createdAt: 1,
          },
        ],
      })
    )
    global.fetch = (async (input: RequestInfo | URL) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      if (url.endsWith('/api/health')) {
        return new Response(
          JSON.stringify(
            buildBackendHealthPayload({
              projectDir: '/tmp/project-a',
              projectName: 'project-a',
              watcherEnabled: true,
              openspecuiVersion: '6.0.0',
              embeddedUiUrl: 'http://localhost:3100/dashboard',
              apiBaseUrl: 'http://localhost:3100',
              envUri: 'env:a',
            })
          ),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }
      return new Response(JSON.stringify({ error: { message: 'fixture unavailable' } }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch

    const router = routerFor(EMPTY_CONTEXT, '/workspaces')
    const { container } = await renderAt(<RouterProvider router={router} />)
    await waitFor(() => {
      expect(container.querySelector('iframe[title="Hosted OpenSpec UI project-a"]')).toBeTruthy()
    })
    const iframe = container.querySelector('iframe[title="Hosted OpenSpec UI project-a"]')
    expect(iframe).toBeTruthy()

    // Navigate the complete Stores route family and prove the exact iframe DOM node is preserved (8.5/8.9).
    await act(async () => {
      await router.navigate({ to: '/stores' })
    })
    expect(
      container.querySelector<HTMLElement>('[data-testid="hosted-workspaces-surface"]')?.hidden
    ).toBe(true)
    expect(container.querySelector('iframe[title="Hosted OpenSpec UI project-a"]')).toBe(iframe)

    await act(async () => {
      await router.navigate({
        to: buildStoreDetailPath({ envUri: 'env:a', storeId: 'team' }),
      })
    })
    expect(container.querySelector('iframe[title="Hosted OpenSpec UI project-a"]')).toBe(iframe)

    await act(async () => {
      await router.navigate({ to: '/stores/environments' })
    })
    expect(container.querySelector('iframe[title="Hosted OpenSpec UI project-a"]')).toBe(iframe)

    await act(async () => {
      await router.navigate({ to: '/workspaces' })
    })
    expect(
      container.querySelector<HTMLElement>('[data-testid="hosted-workspaces-surface"]')?.hidden
    ).toBe(false)
    expect(container.querySelector('iframe[title="Hosted OpenSpec UI project-a"]')).toBe(iframe)
  })
})
