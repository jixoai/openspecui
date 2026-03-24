import type { DashboardGitWorktree } from '@openspecui/core'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Dashboard, WorktreeRow } from './dashboard'

const {
  dashboardOverviewMock,
  dashboardGitTaskStatusMock,
  refreshDashboardGitSnapshotMock,
  opsxStatusListMock,
  opsxConfigBundleMock,
  navControllerMock,
  staticModeMock,
} = vi.hoisted(() => ({
  dashboardOverviewMock: vi.fn(),
  dashboardGitTaskStatusMock: vi.fn(),
  refreshDashboardGitSnapshotMock: vi.fn(),
  opsxStatusListMock: vi.fn(),
  opsxConfigBundleMock: vi.fn(),
  navControllerMock: {
    activatePop: vi.fn(),
  },
  staticModeMock: vi.fn(() => true),
}))

vi.mock('@/components/dashboard/metric-card', () => ({
  DashboardMetricCard: ({ label, value }: { label: string; value: string }) => (
    <div data-testid={`metric-card:${label}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  ),
}))

vi.mock('@/lib/use-dashboard', () => ({
  useDashboardOverviewSubscription: dashboardOverviewMock,
  useDashboardGitTaskStatusSubscription: dashboardGitTaskStatusMock,
  refreshDashboardGitSnapshot: refreshDashboardGitSnapshotMock,
  removeDetachedDashboardWorktree: vi.fn(),
}))

vi.mock('@/lib/use-opsx', () => ({
  useOpsxStatusListSubscription: opsxStatusListMock,
  useOpsxConfigBundleSubscription: opsxConfigBundleMock,
}))

vi.mock('@/lib/nav-controller', () => ({
  navController: navControllerMock,
}))

vi.mock('@/lib/static-mode', () => ({
  isStaticMode: staticModeMock,
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    ...props
  }: { to: string; children?: ReactNode } & Omit<ComponentProps<'a'>, 'href'>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))

describe('Dashboard', () => {
  const writeText = vi.fn<(value: string) => Promise<void>>()

  function isDisabled(name: string): boolean {
    return (screen.getByRole('button', { name }) as HTMLButtonElement).disabled
  }

  function createOverviewData() {
    return {
      summary: {
        specifications: 12,
        requirements: 24,
        activeChanges: 12,
        inProgressChanges: 4,
        completedChanges: 2,
        archivedTasksCompleted: 3,
        tasksTotal: 8,
        tasksCompleted: 4,
        taskCompletionPercent: 50,
      },
      trends: {
        specifications: [],
        requirements: [],
        activeChanges: [],
        inProgressChanges: [],
        completedChanges: [],
        taskCompletionPercent: [],
      },
      triColorTrends: {
        specifications: [],
        requirements: [],
        activeChanges: [],
        inProgressChanges: [],
        completedChanges: [],
        taskCompletionPercent: [],
      },
      trendKinds: {
        specifications: 'monotonic' as const,
        requirements: 'monotonic' as const,
        activeChanges: 'bidirectional' as const,
        inProgressChanges: 'bidirectional' as const,
        completedChanges: 'monotonic' as const,
        taskCompletionPercent: 'bidirectional' as const,
      },
      cardAvailability: {
        specifications: { state: 'ok' as const },
        requirements: { state: 'ok' as const },
        activeChanges: {
          state: 'invalid' as const,
          reason: 'objective-history-unavailable' as const,
        },
        inProgressChanges: {
          state: 'invalid' as const,
          reason: 'objective-history-unavailable' as const,
        },
        completedChanges: { state: 'ok' as const },
        taskCompletionPercent: {
          state: 'invalid' as const,
          reason: 'objective-history-unavailable' as const,
        },
      },
      trendMeta: {
        pointLimit: 100,
        lastUpdatedAt: 1,
      },
      specifications: [
        { id: 'spec-2', name: 'Spec 2', requirements: 1, updatedAt: 2 },
        { id: 'spec-1', name: 'Spec 1', requirements: 9, updatedAt: 1 },
      ],
      activeChanges: [
        { id: 'change-2', name: 'Change 2', progress: { total: 1, completed: 0 }, updatedAt: 2 },
        { id: 'change-1', name: 'Change 1', progress: { total: 1, completed: 1 }, updatedAt: 1 },
      ],
      git: {
        defaultBranch: 'main',
        worktrees: [],
      },
    }
  }

  const baseWorktree: DashboardGitWorktree = {
    path: '/tmp/openspecui-feature-a',
    relativePath: '../tmp/openspecui-feature-a',
    branchName: 'feature-a',
    detached: false,
    isCurrent: false,
    ahead: 2,
    behind: 1,
    diff: { files: 3, insertions: 8, deletions: 2 },
    entries: [],
  }

  beforeEach(() => {
    localStorage.clear()
    writeText.mockReset()
    writeText.mockResolvedValue(undefined)
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    dashboardOverviewMock.mockReturnValue({
      data: createOverviewData(),
      isLoading: false,
      error: null,
    })
    refreshDashboardGitSnapshotMock.mockReset()
    refreshDashboardGitSnapshotMock.mockResolvedValue(undefined)
    staticModeMock.mockReturnValue(true)
    dashboardGitTaskStatusMock.mockReturnValue({
      data: {
        running: false,
        inFlight: 0,
        lastStartedAt: null,
        lastFinishedAt: null,
        lastReason: null,
        lastError: null,
      },
    })
    opsxStatusListMock.mockReturnValue({ data: [] })
    opsxConfigBundleMock.mockReturnValue({ data: null })
    navControllerMock.activatePop.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  it('renders Active Changes before Specifications', () => {
    render(<Dashboard />)

    const activeChangesHeading = screen.getByRole('heading', { name: 'Active Changes' })
    const specificationsHeading = screen.getByRole('heading', { name: 'Specifications' })

    expect(activeChangesHeading.compareDocumentPosition(specificationsHeading)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )
  })

  it('copies on click and toggles path mode via button or double click', async () => {
    render(<WorktreeRow worktree={baseWorktree} emphasize={false} />)

    const copyButton = screen.getByRole('button', { name: 'Copy absolute path for feature-a' })
    expect(screen.getByText('/tmp/openspecui-feature-a')).toBeTruthy()

    fireEvent.click(copyButton)
    expect(writeText).toHaveBeenCalledWith('/tmp/openspecui-feature-a')

    fireEvent.doubleClick(copyButton)
    expect(screen.getByText('../tmp/openspecui-feature-a')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Show absolute path' }))
    expect(screen.getByText('/tmp/openspecui-feature-a')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Show relative path' }))
    fireEvent.click(screen.getByRole('button', { name: 'Copy relative path for feature-a' }))
    expect(writeText).toHaveBeenLastCalledWith('../tmp/openspecui-feature-a')
  })

  it('exposes direct removal for detached non-current worktrees', () => {
    const onRemove = vi.fn()

    render(
      <WorktreeRow
        worktree={{
          ...baseWorktree,
          branchName: '(detached)',
          detached: true,
        }}
        emphasize={false}
        onRemoveDetachedWorktree={onRemove}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Remove detached worktree' }))
    expect(onRemove).toHaveBeenCalledTimes(1)
    expect(onRemove.mock.calls[0]?.[0]).toMatchObject({
      path: '/tmp/openspecui-feature-a',
      detached: true,
    })
  })

  it('sorts git entries with uncommitted first, then newest commits', () => {
    staticModeMock.mockReturnValue(false)
    dashboardOverviewMock.mockReturnValue({
      data: {
        ...createOverviewData(),
        summary: {
          specifications: 0,
          requirements: 0,
          activeChanges: 0,
          inProgressChanges: 0,
          completedChanges: 0,
          archivedTasksCompleted: 0,
          tasksTotal: 0,
          tasksCompleted: 0,
          taskCompletionPercent: null,
        },
        specifications: [],
        activeChanges: [],
        git: {
          defaultBranch: 'main',
          worktrees: [
            {
              ...baseWorktree,
              isCurrent: true,
              entries: [
                {
                  type: 'commit',
                  hash: 'oldcommit',
                  title: 'Older commit',
                  committedAt: 1_700_000_000_000,
                  relatedChanges: [],
                  diff: { files: 1, insertions: 1, deletions: 0 },
                },
                {
                  type: 'uncommitted',
                  title: 'Uncommitted',
                  updatedAt: 1_710_300_000_000,
                  relatedChanges: [],
                  diff: { files: 2, insertions: 3, deletions: 1 },
                },
                {
                  type: 'commit',
                  hash: 'newcommit',
                  title: 'Newer commit',
                  committedAt: 1_710_200_000_000,
                  relatedChanges: [],
                  diff: { files: 1, insertions: 4, deletions: 2 },
                },
              ],
            },
          ],
        },
      },
      isLoading: false,
      error: null,
    })

    render(<Dashboard />)

    const uncommitted = screen.getByText('Uncommitted')
    const newerCommit = screen.getByText('Newer commit')
    const olderCommit = screen.getByText('Older commit')

    expect(
      uncommitted.compareDocumentPosition(newerCommit) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      newerCommit.compareDocumentPosition(olderCommit) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('supports auto refresh presets and clears manual refresh after task completion', async () => {
    staticModeMock.mockReturnValue(false)
    const now = 1_000
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(now)
    let gitTaskStatus = {
      running: false,
      inFlight: 0,
      lastStartedAt: null as number | null,
      lastFinishedAt: null as number | null,
      lastReason: null as string | null,
      lastError: null as string | null,
    }
    dashboardGitTaskStatusMock.mockImplementation(() => ({ data: gitTaskStatus }))
    refreshDashboardGitSnapshotMock.mockResolvedValue(undefined)

    const view = render(<Dashboard />)
    await waitFor(() =>
      expect(refreshDashboardGitSnapshotMock).toHaveBeenCalledWith('dashboard-mount')
    )

    gitTaskStatus = {
      ...gitTaskStatus,
      lastStartedAt: now,
      lastFinishedAt: now + 10,
      lastReason: 'dashboard-mount',
    }
    view.rerender(<Dashboard />)
    await waitFor(() => expect(isDisabled('Refresh')).toBe(false))

    refreshDashboardGitSnapshotMock.mockClear()

    fireEvent.click(screen.getByRole('combobox', { name: 'Git auto refresh' }))
    const option = screen.getByRole('option', { name: '30s' })
    fireEvent.mouseMove(option)
    fireEvent.click(option)

    expect(localStorage.getItem('openspecui:dashboard:git-auto-refresh')).toBe('30s')

    gitTaskStatus = {
      ...gitTaskStatus,
      running: true,
      inFlight: 1,
      lastStartedAt: now + 20,
      lastFinishedAt: now + 10,
      lastReason: 'watcher-change',
    }
    view.rerender(<Dashboard />)

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(refreshDashboardGitSnapshotMock).toHaveBeenCalledWith('manual-button')
    await waitFor(() => expect(isDisabled('Refresh')).toBe(true))
    expect(view.container.querySelector('svg.animate-spin')).toBeTruthy()

    gitTaskStatus = {
      ...gitTaskStatus,
      running: false,
      inFlight: 0,
      lastFinishedAt: now + 200,
      lastReason: 'watcher-change',
    }
    view.rerender(<Dashboard />)
    await waitFor(() => expect(isDisabled('Refresh')).toBe(false))
    dateNowSpy.mockRestore()
  })

  it('does not immediately retrigger dashboard-mount refresh after the first request settles', async () => {
    staticModeMock.mockReturnValue(false)

    let gitTaskStatus = {
      running: false,
      inFlight: 0,
      lastStartedAt: null as number | null,
      lastFinishedAt: null as number | null,
      lastReason: null as string | null,
      lastError: null as string | null,
    }
    dashboardGitTaskStatusMock.mockImplementation(() => ({ data: gitTaskStatus }))
    refreshDashboardGitSnapshotMock.mockResolvedValue(undefined)

    const view = render(<Dashboard />)

    await waitFor(() => {
      expect(refreshDashboardGitSnapshotMock).toHaveBeenCalledTimes(1)
      expect(refreshDashboardGitSnapshotMock).toHaveBeenCalledWith('dashboard-mount')
    })

    gitTaskStatus = {
      ...gitTaskStatus,
      lastStartedAt: 1_000,
      lastFinishedAt: 2_000,
      lastReason: 'dashboard-mount',
    }
    view.rerender(<Dashboard />)

    await waitFor(() => expect(isDisabled('Refresh')).toBe(false))
    expect(refreshDashboardGitSnapshotMock).toHaveBeenCalledTimes(1)
  })
})
