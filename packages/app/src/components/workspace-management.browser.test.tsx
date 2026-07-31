/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Prove Workspace Home, favorite navigation, and Launcher remain contained at a mobile-width boundary.
 * 2. Prove Task Manager dispatches exact daemon-owned favorite and managed Stop commands.
 * 3. Keep this Chromium fixture below the owner-only final App walkthrough boundary.
 *
 * Original request (2026-07-30): "任务管理器...可以杀掉Workspace，或者收藏、取消收藏"
 * Owner correction (2026-07-31): "TaskManagerPage 改成 TaskManagerDialog"
 * Owner correction (2026-07-31): Favorites replace Running navigation; external close-only rows expose no fake
 *   lifecycle action.
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import '../index.css'
import { WorkspaceHome } from './workspace-home'
import { WorkspaceLauncherDialog } from './workspace-launcher-dialog'
import { WorkspaceTaskManagerDialog } from './workspace-task-manager-dialog'
import { WorkspacesSecondaryNav } from './workspaces-secondary-nav'

const daemon = vi.hoisted(() => ({
  stopManagedProject: vi.fn(async () => {}),
  setDirectoryFavorite: vi.fn(async () => {}),
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
      {
        id: 'workspace-external',
        backendUrl: 'http://127.0.0.1:3100',
        credential: null,
        projectDir: '/projects/openspecui',
        ownership: 'external',
        registeredAt: 2,
        managedGeneration: null,
        shutdown: 'close-only',
        git: {
          remoteUrl: 'https://github.com/jixoai-labs/openspecui.git',
          branch: 'main',
          githubSlug: 'jixoai-labs/openspecui',
        },
      },
    ],
    directoryCatalog: { version: 1, entries: [] },
    openWorkspaceInBrowser: vi.fn(async () => {}),
    startManagedProject: vi.fn(),
    stopManagedProject: daemon.stopManagedProject,
    setDirectoryFavorite: daemon.setDirectoryFavorite,
    focusWorkspace: daemon.focusWorkspace,
    closeWorkspace: daemon.closeWorkspace,
    resolveWorkspaceId: () => null,
    dismissDaemonWorkspace: vi.fn(),
  }),
}))

vi.mock('../lib/running-backend-observation-provider', () => ({
  useRunningBackendObservations: () => ({
    revision: 1,
    observations: [
      {
        workspaceId: 'workspace-team',
        backendUrl: 'http://127.0.0.1:43127',
        registeredAt: 1,
        state: 'running',
        healthReachability: 'online',
        websocket: 'connected',
        error: null,
        observedAt: 1,
      },
      {
        workspaceId: 'workspace-external',
        backendUrl: 'http://127.0.0.1:3100',
        registeredAt: 2,
        state: 'running',
        healthReachability: 'online',
        websocket: 'connected',
        error: null,
        observedAt: 1,
      },
    ],
  }),
}))

function renderTaskManager() {
  return render(<WorkspaceTaskManagerDialog open onClose={() => {}} />)
}

beforeEach(async () => {
  localStorage.clear()
  daemon.stopManagedProject.mockClear()
  daemon.setDirectoryFavorite.mockClear()
  daemon.focusWorkspace.mockClear()
  daemon.closeWorkspace.mockClear()
  await page.viewport(1280, 720)
})

afterEach(() => cleanup())

describe('Workspace management browser boundary', () => {
  it('contains Home, favorite navigation, and Launcher at 320px', async () => {
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
          favorites={[{ canonicalPath: '/projects/team', favorite: true, lastOpenedAt: 2 }]}
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
    expect(screen.getAllByText('team').length).toBeGreaterThan(0)
    expect(screen.getByText('Open Workspace')).toBeInTheDocument()
    expect(view.container.scrollWidth).toBeLessThanOrEqual(view.container.clientWidth)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  })

  it('renders the real Task Manager dialog and dispatches the exact managed generation', async () => {
    await page.viewport(320, 720)
    const view = renderTaskManager()

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /Task Manager/ })).toBeVisible()
    })
    expect(await screen.findByText('acme/team')).toBeVisible()
    expect(screen.getByText('jixoai-labs/openspecui')).toBeVisible()
    expect(screen.getAllByText('main')).toHaveLength(2)
    expect(screen.queryByText('43127')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Close Workspace' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Remove|Delete/ })).not.toBeInTheDocument()
    const managedRow = screen.getByText('acme/team').closest('li')
    expect(managedRow).not.toBeNull()
    fireEvent.click(within(managedRow!).getByRole('button', { name: 'Add to favorites' }))
    await waitFor(() => {
      expect(daemon.setDirectoryFavorite).toHaveBeenCalledWith('/projects/team', true)
    })
    expect(within(managedRow!).getByRole('button', { name: 'Add to favorites' })).toBeVisible()
    const stopButton = within(managedRow!).getByRole('button', { name: 'Stop' })
    await waitFor(() => expect(stopButton).toBeEnabled())
    fireEvent.click(stopButton)
    fireEvent.click(within(managedRow!).getByRole('button', { name: 'Confirm Stop' }))

    expect(daemon.stopManagedProject).toHaveBeenCalledWith(7)
    expect(view.container.scrollWidth).toBeLessThanOrEqual(view.container.clientWidth)
  })
})
