/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Prove the App router renders every first-party product surface.
 * 2. Prove launch ownership remains active outside the Sessions route.
 * 3. Prove route round-trips preserve the AppLayout-owned iframe Document identity.
 * 4. Prove persistent Sessions consumes the App shell's remaining mobile viewport budget.
 *
 * Original request (2026-07-15): "app 模式提供了多标签管理。"
 * Owner-reported defect (2026-07-26): opening B or C eventually makes older tabs lose authentication.
 * Original request (2026-07-27): "统一修复所有类似的问题，特别是app 那边新增的页面。"
 */
// @vitest-environment jsdom

import { buildBackendHealthPayload } from '@openspecui/core/hosted-app'
import { RouterProvider } from '@tanstack/react-router'
import { act, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createAppRouter, type AppRouterContext } from './app-router'
import { clearLaunchCredential, readLaunchCredential } from './lib/launch-credential'
import { getHostedShellStorageKey } from './lib/shell-state'

const EMPTY_CONTEXT: AppRouterContext = {
  initialLaunchRequest: null,
  fallbackLaunchRequest: null,
  initialError: null,
}

const renderedRoots = new Set<Root>()
const originalBroadcastChannel = globalThis.BroadcastChannel
const originalMatchMedia = window.matchMedia
const originalFetch = global.fetch

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
  // 直接设置历史位置，避免依赖浏览器地址栏。
  router.history.push(initialPath)
  return router
}

describe('app-router', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
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
    document.body.innerHTML = ''
  })

  it('renders the App layout shell', async () => {
    const router = routerFor(EMPTY_CONTEXT, '/settings')
    const { container } = await renderAt(<RouterProvider router={router} />)
    expect(container.textContent ?? '').toContain('Settings')
    // 侧栏导航存在。
    expect(container.textContent ?? '').toContain('Connections')
    expect(container.textContent ?? '').toContain('Environment')
  })

  it('renders Connections as home', async () => {
    const router = routerFor(EMPTY_CONTEXT, '/connections')
    const { container } = await renderAt(<RouterProvider router={router} />)
    expect(container.textContent ?? '').toContain('Connections')
    expect(container.textContent ?? '').toContain('No backend connections yet')
  })

  it('renders Environment Center with neutral (observed-only) copy', async () => {
    const router = routerFor(EMPTY_CONTEXT, '/environment')
    const { container } = await renderAt(<RouterProvider router={router} />)
    const text = container.textContent ?? ''
    // envUri 中性表达：不声称全集。
    expect(text).not.toMatch(/all references|unreferenced/i)
    expect(text).toContain('No runtime environments observed')
  })

  it('keeps the launch owner active while Environment is the current route', async () => {
    const router = routerFor(EMPTY_CONTEXT, '/environment')
    await renderAt(<RouterProvider router={router} />)
    const launcher = new TestBroadcastChannel('openspecui-app:pwa-launch')

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

  it('preserves an App-lifetime launch error for the Sessions surface', async () => {
    const router = routerFor(
      {
        ...EMPTY_CONTEXT,
        initialError: 'The launch credential requires a valid backend locator.',
      },
      '/sessions'
    )
    const { container } = await renderAt(<RouterProvider router={router} />)

    expect(container.textContent).toContain(
      'The launch credential requires a valid backend locator.'
    )
  })

  it('preserves the hosted iframe identity across Sessions route round-trips', async () => {
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

    const router = routerFor(EMPTY_CONTEXT, '/sessions')
    const { container } = await renderAt(<RouterProvider router={router} />)
    await waitFor(() => {
      expect(container.querySelector('iframe[title="Hosted OpenSpec UI project-a"]')).toBeTruthy()
    })
    const iframe = container.querySelector('iframe[title="Hosted OpenSpec UI project-a"]')
    expect(iframe).toBeTruthy()
    expect(container.querySelector('[data-testid="app-layout"]')?.className).toContain('h-dvh')
    expect(container.querySelector('[data-testid="app-main"]')?.className).toContain(
      'overflow-hidden'
    )
    expect(container.querySelector('[data-testid="hosted-sessions-surface"]')?.className).toContain(
      'h-full'
    )
    expect(container.querySelector('.hosted-shell-root')?.className).toContain('h-full')
    expect(container.querySelector('.hosted-shell-tabs')?.className).toContain('h-full')

    await act(async () => {
      await router.navigate({ to: '/environment' })
    })
    expect(
      container.querySelector<HTMLElement>('[data-testid="hosted-sessions-surface"]')?.hidden
    ).toBe(true)
    expect(container.querySelector('iframe[title="Hosted OpenSpec UI project-a"]')).toBe(iframe)

    await act(async () => {
      await router.navigate({ to: '/sessions' })
    })
    expect(
      container.querySelector<HTMLElement>('[data-testid="hosted-sessions-surface"]')?.hidden
    ).toBe(false)
    expect(container.querySelector('iframe[title="Hosted OpenSpec UI project-a"]')).toBe(iframe)
  })

  it('redirects Store Manager root to Inspector', async () => {
    const router = routerFor(EMPTY_CONTEXT, '/environment/stores')
    await renderAt(<RouterProvider router={router} />)
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    // 重定向后落在 inspector。
    expect(router.state.location.pathname).toBe('/environment/stores/inspector')
  })

  it('renders Store Manager Inspector with Experimental marker', async () => {
    const router = routerFor(EMPTY_CONTEXT, '/environment/stores/inspector')
    const { container } = await renderAt(<RouterProvider router={router} />)
    const text = container.textContent ?? ''
    expect(text).toContain('Store Manager')
    expect(text).toContain('Experimental')
    expect(text).toContain('Inspector')
    expect(text).toContain('No Stores registered')
  })

  it('renders Context Matrix view with neutral empty-state copy', async () => {
    const router = routerFor(EMPTY_CONTEXT, '/environment/stores/context')
    const { container } = await renderAt(<RouterProvider router={router} />)
    const text = container.textContent ?? ''
    expect(text).toContain('Context Matrix')
    expect(text).toContain('Experimental')
    // 中性空态：不声称全集，只说「observed」。
    expect(text).toContain('No project contexts observed')
    expect(text).not.toMatch(/all references|unreferenced/i)
  })

  it('renders Inventory view', async () => {
    const router = routerFor(EMPTY_CONTEXT, '/environment/stores/inventory')
    const { container } = await renderAt(<RouterProvider router={router} />)
    const text = container.textContent ?? ''
    expect(text).toContain('Inventory')
    expect(text).toContain('Registry is empty')
  })
})
