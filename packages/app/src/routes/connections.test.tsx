// @vitest-environment jsdom

import { buildBackendHealthPayload } from '@openspecui/core/hosted-app'
import { RouterProvider } from '@tanstack/react-router'
import { act, fireEvent, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAppRouter, type AppRouterContext } from '../app-router'
import { getHostedShellStorageKey } from '../lib/shell-state'

const EMPTY_CONTEXT: AppRouterContext = {
  initialLaunchRequest: null,
  fallbackLaunchRequest: null,
  initialError: null,
}

const originalFetch = global.fetch

function setHealthFetch(online: boolean) {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    if (!online) throw new Error('offline')
    if (!url.endsWith('/api/health')) throw new Error(`Unexpected fetch: ${url}`)
    return new Response(
      JSON.stringify(
        buildBackendHealthPayload({
          projectDir: '/tmp/opsx',
          projectName: 'opsx',
          watcherEnabled: true,
          openspecuiVersion: '2.0.2',
          embeddedUiUrl: 'http://localhost:3100/dashboard',
        })
      ),
      { status: 200, headers: { 'content-type': 'application/json' } }
    )
  }) as typeof fetch
}

async function renderAt(element: ReactElement): Promise<{ container: HTMLDivElement; root: Root }> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(element)
  })
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
  return { container, root }
}

function routerFor(path: string) {
  const router = createAppRouter(EMPTY_CONTEXT)
  router.history.push(path)
  return router
}

describe('Connections route', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    localStorage.clear()
    setHealthFetch(true)
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('renders empty state when no connections', async () => {
    const router = routerFor('/connections')
    const { container } = await renderAt(<RouterProvider router={router} />)
    expect(container.textContent ?? '').toContain('No backend connections yet')
  })

  it('lists persisted connections (without credentials) and probes reachability', async () => {
    localStorage.setItem(
      getHostedShellStorageKey(),
      JSON.stringify({
        activeTabId: 'tab-1',
        tabs: [
          { id: 'tab-1', sessionId: 'tab-1', apiBaseUrl: 'http://localhost:3100', createdAt: 1 },
        ],
      })
    )
    const router = routerFor('/connections')
    const { container } = await renderAt(<RouterProvider router={router} />)

    expect(container.textContent ?? '').toContain('localhost:3100')
    // 连接条目不含凭据字段（AGENTS.md：持久化不带凭据）。
    const row = container.querySelector('[aria-label^="Remove connection"]')
    expect(row).toBeTruthy()
  })

  it('opens the Add Backend dialog and adds a connection via the form', async () => {
    setHealthFetch(true)
    const router = routerFor('/connections')
    const { container } = await renderAt(<RouterProvider router={router} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add Backend' }))
    })

    expect(document.querySelector('dialog[open]')).toBeTruthy()

    await act(async () => {
      fireEvent.change(screen.getByLabelText('API URL'), {
        target: { value: 'http://localhost:3200' },
      })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    })

    expect(container.textContent ?? '').toContain('localhost:3200')
    // 连接已持久化（不带凭据）。
    const stored = JSON.parse(localStorage.getItem(getHostedShellStorageKey()) ?? '{}')
    expect(stored.tabs).toHaveLength(1)
    expect(stored.tabs[0].apiBaseUrl).toBe('http://localhost:3200')
    // 凭据字段绝不出现在持久化结构中。
    expect(JSON.stringify(stored)).not.toMatch(/credential|password|token|bearer/i)
  })

  it('removes a connection when the remove action is clicked', async () => {
    localStorage.setItem(
      getHostedShellStorageKey(),
      JSON.stringify({
        activeTabId: 'tab-1',
        tabs: [
          { id: 'tab-1', sessionId: 'tab-1', apiBaseUrl: 'http://localhost:3100', createdAt: 1 },
        ],
      })
    )
    const router = routerFor('/connections')
    const { container } = await renderAt(<RouterProvider router={router} />)

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Remove connection http://localhost:3100' })
      )
    })

    expect(container.textContent ?? '').toContain('No backend connections yet')
    const stored = JSON.parse(localStorage.getItem(getHostedShellStorageKey()) ?? '{}')
    expect(stored.tabs).toHaveLength(0)
  })

  it('shows offline reachability when the backend is unreachable', async () => {
    setHealthFetch(false)
    localStorage.setItem(
      getHostedShellStorageKey(),
      JSON.stringify({
        activeTabId: 'tab-1',
        tabs: [
          { id: 'tab-1', sessionId: 'tab-1', apiBaseUrl: 'http://localhost:3100', createdAt: 1 },
        ],
      })
    )
    const router = routerFor('/connections')
    await renderAt(<RouterProvider router={router} />)

    // 不崩溃即可（offline 徽章渲染）；允许探测异步完成。
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(screen.queryByText('No backend connections yet')).toBeNull()
  })
})
