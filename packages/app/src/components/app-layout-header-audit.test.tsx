/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Audit the mobile/desktop header for only the retained destinations (8.6/8.7).
 * 2. Prove the mobile header renders Workspaces + Stores (+ Settings when no overlay) with stable icon+label geometry.
 *
 * Original request (2026-07-30): "左侧只留下 Workspaces + Stores 就行了。"
 * Owner direction (2026-07-29): mobile-first visual priority, container-query responsive.
 */
// @vitest-environment jsdom
import { RouterProvider } from '@tanstack/react-router'
import { act } from '@testing-library/react'
import type { ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAppRouter, type AppRouterContext } from '../app-router'

const EMPTY_CONTEXT: AppRouterContext = {
  initialLaunchRequest: null,
  fallbackLaunchRequest: null,
  initialError: null,
}

const originalMatchMedia = window.matchMedia

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

function routerFor(path: string, context: AppRouterContext = EMPTY_CONTEXT) {
  const router = createAppRouter(context)
  router.history.push(path)
  return router
}

describe('App header audit (8.6/8.7)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    localStorage.clear()
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => false,
    }))
  })
  afterEach(() => {
    window.matchMedia = originalMatchMedia
    document.body.innerHTML = ''
  })

  it('desktop sidebar renders only Workspaces + Stores + Settings (no retired destinations)', async () => {
    const { container } = await renderAt(<RouterProvider router={routerFor('/stores')} />)
    // Retired destination links are absent.
    expect(container.querySelector('a[href="/connections"]')).toBeNull()
    expect(container.querySelector('a[href="/environment"]')).toBeNull()
    expect(container.querySelector('a[href="/environment/stores/inspector"]')).toBeNull()
    // Retained destinations are present.
    expect(container.querySelector('a[href="/workspaces"]')).toBeTruthy()
    expect(container.querySelector('a[href="/stores"]')).toBeTruthy()
    expect(container.querySelector('a[href="/settings"]')).toBeTruthy()
  })

  it('mobile header renders only the retained destinations (Workspaces + Stores)', async () => {
    const { container } = await renderAt(<RouterProvider router={routerFor('/stores')} />)
    // The mobile header (md:hidden) contains the nav links; verify it has Workspaces + Stores.
    const mobileHeader = container.querySelector('header.md\\:hidden')
    expect(mobileHeader).toBeTruthy()
    expect(mobileHeader?.querySelector('a[href="/workspaces"]')).toBeTruthy()
    expect(mobileHeader?.querySelector('a[href="/stores"]')).toBeTruthy()
    // No retired links in the mobile header.
    expect(mobileHeader?.querySelector('a[href="/connections"]')).toBeNull()
    expect(mobileHeader?.querySelector('a[href="/environment"]')).toBeNull()
  })

  it('mobile header icons have stable dimensions (h-3.5 w-3.5)', async () => {
    const { container } = await renderAt(<RouterProvider router={routerFor('/stores')} />)
    const mobileHeader = container.querySelector('header.md\\:hidden')
    const icons = mobileHeader?.querySelectorAll('svg')
    expect(icons?.length).toBeGreaterThan(0)
    for (const icon of icons ?? []) {
      // Every mobile nav icon uses the stable 3.5×3.5 geometry.
      expect(icon.getAttribute('class')).toContain('h-3.5')
      expect(icon.getAttribute('class')).toContain('w-3.5')
    }
  })
})
