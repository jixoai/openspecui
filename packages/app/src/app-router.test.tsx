// @vitest-environment jsdom

import { RouterProvider } from '@tanstack/react-router'
import { act } from '@testing-library/react'
import type { ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createAppRouter, type AppRouterContext } from './app-router'

const EMPTY_CONTEXT: AppRouterContext = {
  initialLaunchRequest: null,
  fallbackLaunchRequest: null,
  initialError: null,
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
  })

  afterEach(() => {
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
