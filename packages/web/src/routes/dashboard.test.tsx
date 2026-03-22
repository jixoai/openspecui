import type { DashboardGitWorktree } from '@openspecui/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Dashboard, WorktreeRow } from './dashboard'

const {
  dashboardOverviewMock,
  dashboardGitTaskStatusMock,
  opsxStatusListMock,
  opsxConfigBundleMock,
  navControllerMock,
} = vi.hoisted(() => ({
  dashboardOverviewMock: vi.fn(),
  dashboardGitTaskStatusMock: vi.fn(),
  opsxStatusListMock: vi.fn(),
  opsxConfigBundleMock: vi.fn(),
  navControllerMock: {
    activatePop: vi.fn(),
  },
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
  refreshDashboardGitSnapshot: vi.fn(),
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
  isStaticMode: () => true,
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
    writeText.mockReset()
    writeText.mockResolvedValue(undefined)
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    dashboardOverviewMock.mockReturnValue({
      data: {
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
          specifications: 'monotonic',
          requirements: 'monotonic',
          activeChanges: 'bidirectional',
          inProgressChanges: 'bidirectional',
          completedChanges: 'monotonic',
          taskCompletionPercent: 'bidirectional',
        },
        cardAvailability: {
          specifications: { state: 'ok' },
          requirements: { state: 'ok' },
          activeChanges: { state: 'invalid', reason: 'objective-history-unavailable' },
          inProgressChanges: { state: 'invalid', reason: 'objective-history-unavailable' },
          completedChanges: { state: 'ok' },
          taskCompletionPercent: {
            state: 'invalid',
            reason: 'objective-history-unavailable',
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
      },
      isLoading: false,
      error: null,
    })
    dashboardGitTaskStatusMock.mockReturnValue({ data: null })
    opsxStatusListMock.mockReturnValue({ data: [] })
    opsxConfigBundleMock.mockReturnValue({ data: null })
    navControllerMock.activatePop.mockReset()
  })

  afterEach(() => {
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
})
