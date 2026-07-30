/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Prove Workspace Home, running navigation, and Launcher remain contained at a mobile-width boundary.
 * 2. Prove the real Task Manager route renders path-first evidence and dispatches exact managed Stop.
 * 3. Keep this Chromium fixture below the owner-only final App walkthrough boundary.
 *
 * Original request (2026-07-30): "任务管理器...可以杀掉Workspace，或者收藏、取消收藏"
 */
import { RouterProvider, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import '../index.css'
import { selectWorkspacePathLabel } from '../lib/workspace-path-label'
import { WorkspaceTaskManagerRoute } from '../routes/workspace-task-manager'
import { WorkspaceHome } from './workspace-home'
import { WorkspaceLauncherDialog } from './workspace-launcher-dialog'
import { WorkspacesSecondaryNav } from './workspaces-secondary-nav'

const daemon = vi.hoisted(() => ({
  stopManagedProject: vi.fn(async () => {}),
  focusWorkspace: vi.fn(),
  closeWorkspace: vi.fn(),
}))

vi.mock('./app-daemon-workspace-owner', () => ({
  useAppDaemonWorkspace: () => ({
    error: null,
    availability: 'supported',
    workspaces: [
      {
        id: 'workspace-team',
        backendUrl: 'http://127.0.0.1:43127',
        credential: null,
        projectDir: '/projects/team',
        ownership: 'daemon-managed',
        registeredAt: 1,
        managedGeneration: 7,
        shutdown: 'managed',
        git: {
          remoteUrl: 'https://github.com/acme/team.git',
          branch: 'main',
          githubSlug: 'acme/team',
        },
      },
    ],
    openWorkspaceInBrowser: vi.fn(async () => {}),
    startManagedProject: vi.fn(),
    stopManagedProject: daemon.stopManagedProject,
    focusWorkspace: daemon.focusWorkspace,
    closeWorkspace: daemon.closeWorkspace,
    resolveWorkspaceId: () => null,
    dismissDaemonWorkspace: vi.fn(),
  }),
}))

function renderTaskManager() {
  const rootRoute = createRootRoute({ component: WorkspaceTaskManagerRoute })
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => null,
  })
  const router = createRouter({ routeTree: rootRoute.addChildren([indexRoute]) })
  return render(<RouterProvider router={router} />)
}

beforeEach(async () => {
  localStorage.clear()
  daemon.stopManagedProject.mockClear()
  daemon.focusWorkspace.mockClear()
  daemon.closeWorkspace.mockClear()
  await page.viewport(1280, 720)
})

afterEach(() => cleanup())

describe('Workspace management browser boundary', () => {
  it('contains Home, running navigation, and Launcher at 320px', async () => {
    await page.viewport(320, 720)
    const view = render(
      <main className="w-full min-w-0 overflow-hidden">
        <WorkspaceHome
          catalog={{
            favorites: [{ canonicalPath: '/projects/team', favorite: true, lastOpenedAt: 2 }],
            recent: [{ canonicalPath: '/projects/design', favorite: false, lastOpenedAt: 1 }],
          }}
          launchSupported
          onSubmitPath={() => {}}
          onToggleFavorite={() => {}}
          onOpenDirectory={() => {}}
        />
        <WorkspacesSecondaryNav
          entries={[
            {
              id: 'workspace-team',
              projectPath: '/projects/team',
              ownership: 'daemon-managed',
              health: 'ready',
              managedGeneration: 7,
              shutdown: 'managed',
              label: selectWorkspacePathLabel({
                projectPath: '/projects/team',
                git: { githubRemote: 'https://github.com/acme/team.git', branch: 'main' },
              }),
            },
          ]}
          onSelect={() => {}}
        />
        <WorkspaceLauncherDialog
          open
          onClose={() => {}}
          candidates={[
            {
              apiBaseUrl: 'http://127.0.0.1:43127',
              source: 'daemon-live',
              reachability: 'online',
              label: {
                title: 'acme/team',
                subtitle: 'main',
                detail: '/projects/team',
              },
            },
          ]}
          openWorkspaces={[]}
          pending={[]}
          onFocus={() => {}}
          onOpen={() => {}}
          onForget={() => {}}
          onConnect={() => {}}
        />
      </main>
    )

    expect(screen.getByRole('heading', { name: 'Workspaces' })).toBeVisible()
    expect(screen.getByText('Running (1)')).toBeVisible()
    expect(screen.getByText('Open Workspace')).toBeInTheDocument()
    expect(view.container.scrollWidth).toBeLessThanOrEqual(view.container.clientWidth)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  })

  it('renders the real Task Manager route and dispatches the exact managed generation', async () => {
    await page.viewport(320, 720)
    const view = renderTaskManager()

    expect(await screen.findByText('acme/team')).toBeVisible()
    expect(screen.getByText('main')).toBeVisible()
    expect(screen.queryByText('43127')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add to favorites' }))
    expect(screen.getByRole('button', { name: 'Remove from favorites' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Stop' }))

    expect(daemon.stopManagedProject).toHaveBeenCalledWith(7)
    expect(view.container.scrollWidth).toBeLessThanOrEqual(view.container.clientWidth)
  })
})
