/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Audit the mobile/desktop header for only the retained destinations (8.6/8.7).
 * 2. Prove mobile renders Workspaces + Stores plus direct favorite-directory secondary navigation.
 * 3. Preserve stable mobile icon+label geometry.
 * 4. Prove favorite navigation comes from the daemon snapshot rather than browser storage.
 * 5. Keep the sidebar brand bound to the App-owned logo asset.
 * Compromise: navigation and brand assertions share this rendered shell fixture because both audit the same
 * persistent App sidebar and mobile header.
 *
 * Original request (2026-07-30): "左侧只留下 Workspaces + Stores 就行了。"
 * Owner direction (2026-07-29): mobile-first visual priority, container-query responsive.
 * Owner correction (2026-07-31): no Running/Favorites accordion; favorites are direct second-level rows.
 * Owner correction (2026-07-31): replace the OpenSpecUI App sidebar glyph with the product logo.
 * Owner correction (2026-07-31): OpenTray hides duplicate sidebar branding beneath its branded titlebar.
 * Owner correction (2026-07-31): either App brand toggles an icon-only primary-navigation rail.
 * Owner correction (2026-07-31): sidebar expansion uses native View Transitions without width/transform timers.
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
const originalFetch = global.fetch
const originalStartViewTransition = document.startViewTransition
const renderedRoots = new Set<Root>()

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
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/api/daemon/workspaces')) {
        return new Response(JSON.stringify({ revision: 1, workspaces: [] }), {
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.endsWith('/api/daemon/workspace-directories')) {
        return new Response(
          JSON.stringify({
            revision: 1,
            catalog: {
              version: 1,
              entries: [
                {
                  canonicalPath: '/projects/favorite-project',
                  favorite: true,
                  lastOpenedAt: 1,
                },
              ],
            },
          }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      }
      return new Response('missing', { status: 404 })
    }) as typeof fetch
  })
  afterEach(async () => {
    await act(async () => {
      for (const root of renderedRoots) root.unmount()
    })
    renderedRoots.clear()
    window.matchMedia = originalMatchMedia
    global.fetch = originalFetch
    document.startViewTransition = originalStartViewTransition
    delete document.documentElement.dataset.sidebarVt
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
    expect(container.querySelector('[data-app-sidebar-brand] img[src="/icon.svg"]')).toBeTruthy()
  })

  it('hides duplicate sidebar branding when OpenTray owns the branded titlebar', async () => {
    const { container } = await renderAt(
      <RouterProvider
        router={routerFor('/stores', {
          ...EMPTY_CONTEXT,
          appPresentation: 'opentray-overlay',
        })}
      />
    )
    await vi.waitFor(() =>
      expect(container.querySelector('[data-app-titlebar="true"]')).toBeTruthy()
    )
    expect(container.querySelector('[data-app-sidebar-brand]')).toBeNull()
    expect(container.querySelector('[data-app-titlebar="true"]')?.textContent).toContain(
      'OpenSpecUI App'
    )
  })

  it('collapses the inline sidebar brand into an icon-only primary-navigation rail', async () => {
    const finished = Promise.resolve()
    const startViewTransition = vi.fn((callback: ViewTransitionUpdateCallback) => {
      callback()
      return {
        finished,
        ready: Promise.resolve(),
        skipTransition() {},
        types: new Set<string>(),
        updateCallbackDone: Promise.resolve(),
      }
    })
    document.startViewTransition = startViewTransition
    const { container } = await renderAt(<RouterProvider router={routerFor('/workspaces')} />)
    const sidebar = container.querySelector('aside')
    const brand = container.querySelector<HTMLButtonElement>('[data-app-sidebar-brand]')
    expect(sidebar?.getAttribute('data-sidebar-collapsed')).toBe('false')
    expect(sidebar?.className).toContain('overflow-hidden')
    expect(sidebar?.className).not.toContain('transition-[width,padding]')
    expect(sidebar?.className).not.toContain('duration-200')

    await act(async () => brand?.click())

    expect(startViewTransition).toHaveBeenCalledTimes(1)
    expect(sidebar?.getAttribute('data-sidebar-collapsed')).toBe('true')
    expect(brand?.querySelector('img[src="/icon.svg"]')).toBeTruthy()
    expect(brand?.querySelector('span')?.className).toContain('sr-only')
    expect(container.querySelector('[data-testid="mobile-workspaces-secondary-nav"]')).toBeTruthy()
    expect(sidebar?.textContent).not.toContain('favorite-project')
    expect(sidebar?.querySelector('a[aria-label="Workspaces"]')).toBeTruthy()
    expect(sidebar?.querySelector('a[aria-label="Stores"]')).toBeTruthy()
    expect(sidebar?.querySelector('a[aria-label="Settings"]')).toBeTruthy()

    await act(async () => brand?.click())
    expect(startViewTransition).toHaveBeenCalledTimes(2)
    expect(sidebar?.getAttribute('data-sidebar-collapsed')).toBe('false')
    expect(sidebar?.textContent).toContain('favorite-project')
  })

  it('toggles the same sidebar state from the OpenTray titlebar brand', async () => {
    const { container } = await renderAt(
      <RouterProvider
        router={routerFor('/stores', {
          ...EMPTY_CONTEXT,
          appPresentation: 'opentray-overlay',
        })}
      />
    )
    const sidebar = container.querySelector('aside')
    const brand = await vi.waitFor(() =>
      container.querySelector<HTMLButtonElement>('button[aria-label="Collapse sidebar"]')
    )
    await act(async () => brand?.click())
    expect(sidebar?.getAttribute('data-sidebar-collapsed')).toBe('true')
    expect(sidebar?.querySelector('a[aria-label="Workspaces"]')).toBeTruthy()
    expect(sidebar?.querySelector('a[aria-label="Stores"]')).toBeTruthy()
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

  it('mounts direct favorite secondary navigation on mobile without accordion chrome', async () => {
    const { container } = await renderAt(<RouterProvider router={routerFor('/workspaces')} />)
    const mobileSecondary = container.querySelector(
      '[data-testid="mobile-workspaces-secondary-nav"]'
    )
    await vi.waitFor(() => expect(mobileSecondary?.textContent).toContain('favorite-project'))
    expect(mobileSecondary?.textContent).not.toContain('Running')
    expect(mobileSecondary?.textContent).not.toContain('Favorites')
    expect(localStorage.getItem('openspecui-app:workspace-directory-catalog')).toBeNull()
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
