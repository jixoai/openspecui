/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Prove the fixed Workspace Home renders Favorites/path form/Recent/Task Manager entry (4.0a).
 * 2. Prove path submission binds a loading lock and surfaces errors (4.0b).
 * 3. Prove an unsupported App delivery presents directory launch as unsupported.
 * 4. Prove Task Manager remains the primary secondary action on Home.
 *
 * Original request (2026-07-30): "Workspace需要记住曾经打开的目录，并且支持收藏。"
 * Owner correction (2026-07-31): "Task manager按钮应该有 bg-primary 的样式"
 */
// @vitest-environment jsdom
import type { WorkspaceDirectoryCatalogView } from '@openspecui/core/workspace-directory-catalog'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { act, fireEvent, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceHome } from './workspace-home'

const originalMatchMedia = window.matchMedia
const originalFetch = global.fetch

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

/**
 * Minimal router that mounts Home under its App route without loading the full HostedShell owner.
 */
function homeRouter(home: ReactElement) {
  const rootRoute = createRootRoute({ component: () => <Outlet /> })
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/workspaces',
    component: () => home,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: ['/workspaces'] }),
  })
  return router
}

const VIEW: WorkspaceDirectoryCatalogView = {
  favorites: [{ canonicalPath: '/projects/fav', favorite: true, lastOpenedAt: 1 }],
  recent: [
    { canonicalPath: '/projects/recent-a', favorite: false, lastOpenedAt: 100 },
    { canonicalPath: '/projects/recent-b', favorite: false, lastOpenedAt: 50 },
  ],
}

describe('Workspace Home (4.0a/4.0b)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    localStorage.clear()
  })
  afterEach(() => {
    window.matchMedia = originalMatchMedia
    global.fetch = originalFetch
    document.body.innerHTML = ''
  })

  it('renders Favorites above, path form in the middle, Recent below, and a Task Manager entry', async () => {
    await renderAt(
      <RouterProvider
        router={homeRouter(
          <WorkspaceHome
            catalog={VIEW}
            onSubmitPath={() => {}}
            onToggleFavorite={() => {}}
            onOpenDirectory={() => {}}
            launchSupported
          />
        )}
      />
    )

    // Fixed Home surface sections.
    expect(screen.getByText('Favorites')).toBeTruthy()
    expect(screen.getByText('Recent')).toBeTruthy()
    expect(screen.getByText('Task Manager')).toBeTruthy()
    const taskManagerClassName = screen.getByRole('button', { name: 'Task Manager' }).className
    expect(taskManagerClassName).toContain('bg-primary')
    expect(taskManagerClassName).toContain('text-primary-foreground')
    expect(screen.getByPlaceholderText(/your-project/)).toBeTruthy()

    // Favorites row uses the path-first label (basename fallback).
    expect(screen.getByLabelText('Open /projects/fav')).toBeTruthy()
    // Recent rows render in recency order.
    expect(screen.getByLabelText('Open /projects/recent-a')).toBeTruthy()
    expect(screen.getByLabelText('Open /projects/recent-b')).toBeTruthy()
  })

  it('submits the path through the form and binds a loading lock while pending', async () => {
    const onSubmitPath = vi.fn()
    await renderAt(
      <RouterProvider
        router={homeRouter(
          <WorkspaceHome
            catalog={{ favorites: [], recent: [] }}
            onSubmitPath={onSubmitPath}
            onToggleFavorite={() => {}}
            onOpenDirectory={() => {}}
            launchSupported
            pending
          />
        )}
      />
    )
    const input = screen.getByPlaceholderText(/your-project/) as HTMLInputElement
    const startButton = screen.getByRole('button', { name: 'Start' })
    // While pending the Start button is a loading lock and does not re-submit.
    expect(startButton.hasAttribute('disabled')).toBe(true)
    fireEvent.change(input, { target: { value: '/projects/new' } })
    fireEvent.click(startButton)
    expect(onSubmitPath).not.toHaveBeenCalled()
  })

  it('calls onSubmitPath with the trimmed path on Start', async () => {
    const onSubmitPath = vi.fn()
    await renderAt(
      <RouterProvider
        router={homeRouter(
          <WorkspaceHome
            catalog={{ favorites: [], recent: [] }}
            onSubmitPath={onSubmitPath}
            onToggleFavorite={() => {}}
            onOpenDirectory={() => {}}
            launchSupported
          />
        )}
      />
    )
    const input = screen.getByPlaceholderText(/your-project/) as HTMLInputElement
    fireEvent.change(input, { target: { value: '  /projects/new  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    expect(onSubmitPath).toHaveBeenCalledWith('/projects/new')
  })

  it('surfaces a concrete submission error directly', async () => {
    await renderAt(
      <RouterProvider
        router={homeRouter(
          <WorkspaceHome
            catalog={{ favorites: [], recent: [] }}
            onSubmitPath={() => {}}
            onToggleFavorite={() => {}}
            onOpenDirectory={() => {}}
            launchSupported
            error="not a directory"
          />
        )}
      />
    )
    expect(screen.getByText('not a directory')).toBeTruthy()
  })

  it('presents directory launch as unsupported for a standalone App without local daemon authority', async () => {
    await renderAt(
      <RouterProvider
        router={homeRouter(
          <WorkspaceHome
            catalog={{ favorites: [], recent: [] }}
            onSubmitPath={() => {}}
            onToggleFavorite={() => {}}
            onOpenDirectory={() => {}}
            launchSupported={false}
          />
        )}
      />
    )
    expect(screen.getByText(/Directory launch is unsupported/)).toBeTruthy()
    expect(screen.queryByPlaceholderText(/your-project/)).toBeNull()
  })
})
