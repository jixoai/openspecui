/**
 * Orthogonal intents (updated 2026-07-19 Asia/Shanghai):
 * 1. Prove Dashboard planning metrics and Code Git projections render independently.
 * 2. Prove rendered A-to-B refresh/removal intents conflict visibly, settle, and resume on B.
 * 3. Prove live Code Git navigation carries the backend-issued binding token.
 * 4. Prove Dashboard snapshots cannot be relabeled across Code binding replacements.
 *
 * Original request (2026-07-16): "接下来，你来接手后续工作"
 * Derived requirement (2026-07-19): Checkpoint 6.11 preserves Dashboard Git provenance.
 */
import type { DashboardGitRefreshControlProps } from '@/components/dashboard/git-refresh-control'
import type { DashboardGitWorktree, GitRepositoryScopes } from '@openspecui/core'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Dashboard, WorktreeRow } from './dashboard'

type WorktreeRowProps = ComponentProps<typeof WorktreeRow>

const {
  dashboardOverviewMock,
  dashboardGitTaskStatusMock,
  refreshDashboardGitSnapshotMock,
  removeDetachedDashboardWorktreeMock,
  opsxStatusListMock,
  opsxConfigBundleMock,
  navControllerMock,
  staticModeMock,
  dashboardContextSummaryMock,
  codeBindingQueryMock,
  gitScopesMock,
  dashboardGitRefreshControlRenderMock,
  worktreeRowRenderMock,
} = vi.hoisted(() => ({
  dashboardOverviewMock: vi.fn(),
  dashboardGitTaskStatusMock: vi.fn(),
  refreshDashboardGitSnapshotMock: vi.fn(),
  removeDetachedDashboardWorktreeMock: vi.fn(),
  opsxStatusListMock: vi.fn(),
  opsxConfigBundleMock: vi.fn(),
  navControllerMock: {
    activatePop: vi.fn(),
    push: vi.fn(),
  },
  staticModeMock: vi.fn(() => true),
  dashboardContextSummaryMock: vi.fn(),
  codeBindingQueryMock: vi.fn(async () => ({ bindingToken: 'code-binding' })),
  gitScopesMock: vi.fn(),
  dashboardGitRefreshControlRenderMock: vi.fn<(props: DashboardGitRefreshControlProps) => void>(),
  worktreeRowRenderMock: vi.fn<(props: WorktreeRowProps) => void>(),
}))

vi.mock('@/components/dashboard/git-refresh-control', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/dashboard/git-refresh-control')>()
  return {
    ...actual,
    DashboardGitRefreshControl: (props: DashboardGitRefreshControlProps) => {
      dashboardGitRefreshControlRenderMock(props)
      return <actual.DashboardGitRefreshControl {...props} />
    },
  }
})

vi.mock('@/components/git/git-shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/git/git-shared')>()
  return {
    ...actual,
    WorktreeRow: (props: WorktreeRowProps) => {
      worktreeRowRenderMock(props)
      return <actual.WorktreeRow {...props} />
    },
  }
})

vi.mock('@/components/dashboard/metric-card', () => ({
  DashboardMetricCard: ({ label, value }: { label: string; value: string }) => (
    <div data-testid={`metric-card:${label}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  ),
}))

vi.mock('@/components/dashboard/context-summary', () => ({
  DashboardContextSummary: ({ staticMode }: { staticMode: boolean }) => {
    dashboardContextSummaryMock({ staticMode })
    return <div data-testid="dashboard-context-summary">{String(staticMode)}</div>
  },
}))

vi.mock('@/lib/use-dashboard', () => ({
  useDashboardOverviewSubscription: dashboardOverviewMock,
  useDashboardGitTaskStatusSubscription: dashboardGitTaskStatusMock,
  refreshDashboardGitSnapshot: refreshDashboardGitSnapshotMock,
  removeDetachedDashboardWorktree: removeDetachedDashboardWorktreeMock,
}))

vi.mock('@/lib/use-git-repository-scope', () => ({
  useGitRepositoryScopes: (...args: unknown[]) => {
    const state = gitScopesMock(...args)
    return {
      ...state,
      authority:
        state.authority ??
        (state.error
          ? { state: 'failed', error: state.error }
          : state.isLoading
            ? { state: 'waiting', reason: 'rebind' }
            : { state: 'current' }),
    }
  },
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

vi.mock('@/lib/trpc', () => ({
  trpcClient: {
    git: {
      code: {
        query: codeBindingQueryMock,
      },
    },
  },
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
  useLocation: () => ({
    pathname: '/dashboard',
    search: '',
    hash: '',
    state: null,
  }),
  useNavigate: () => vi.fn(),
}))

describe('Dashboard', () => {
  const writeText = vi.fn<(value: string) => Promise<void>>()

  class GitConflictError extends Error {
    readonly data = { code: 'CONFLICT' } as const
  }

  function latestRefreshControl(): DashboardGitRefreshControlProps {
    const call = dashboardGitRefreshControlRenderMock.mock.lastCall
    if (!call) throw new Error('Dashboard refresh control was not rendered.')
    return call[0]
  }

  function latestWorktreeRow(path: string): WorktreeRowProps {
    const call = worktreeRowRenderMock.mock.calls.find(([props]) => props.worktree.path === path)
    if (!call) throw new Error(`Dashboard worktree row was not rendered for ${path}.`)
    return call[0]
  }

  function createDeferred<T>() {
    let resolve: (value: T | PromiseLike<T>) => void = () => {}
    let reject: (reason?: unknown) => void = () => {}
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise
      reject = rejectPromise
    })
    return { promise, resolve, reject }
  }

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
        {
          id: 'change-2',
          name: 'Change 2',
          trackedTaskProgress: { total: 1, completed: 0, phase: 'in-progress' },
          updatedAt: 2,
        },
        {
          id: 'change-1',
          name: 'Change 1',
          trackedTaskProgress: { total: 1, completed: 1, phase: 'complete' },
          updatedAt: 1,
        },
      ],
      git: {
        bindingToken: 'code-binding',
        defaultBranch: 'main',
        worktrees: [],
      },
    }
  }

  const baseWorktree: DashboardGitWorktree = {
    path: '/tmp/openspecui-feature-a',
    relativePath: '../tmp/openspecui-feature-a',
    pathAvailable: true,
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
    removeDetachedDashboardWorktreeMock.mockReset()
    removeDetachedDashboardWorktreeMock.mockResolvedValue(undefined)
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
    navControllerMock.push.mockReset()
    dashboardContextSummaryMock.mockClear()
    dashboardGitRefreshControlRenderMock.mockClear()
    worktreeRowRenderMock.mockClear()
    gitScopesMock.mockReturnValue({
      data: {
        defaultScope: 'code',
        code: {
          scope: 'code',
          bindingToken: 'code-binding',
          rootPath: '/workspace/code',
          repository: { topLevel: '/workspace/code', commonDir: '/workspace/code/.git' },
        },
        planningState: 'settled',
        planning: null,
      } satisfies GitRepositoryScopes,
      isLoading: false,
      error: null,
    })
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

  it('integrates the data-scope summary with the current static mode', () => {
    staticModeMock.mockReturnValue(false)
    render(<Dashboard />)

    expect(screen.getByTestId('dashboard-context-summary').textContent).toBe('false')
    expect(dashboardContextSummaryMock).toHaveBeenCalledWith({ staticMode: false })
  })

  it('renders specification metadata with relative time before spec id', () => {
    const now = 61_000
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(now)

    dashboardOverviewMock.mockReturnValue({
      data: {
        ...createOverviewData(),
        specifications: [{ id: 'spec-1', name: 'Spec 1', requirements: 9, updatedAt: 1_000 }],
      },
      isLoading: false,
      error: null,
    })

    render(<Dashboard />)

    expect(screen.getByText('1m ago · spec-1')).toBeInTheDocument()

    dateNowSpy.mockRestore()
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
          bindingToken: 'code-binding',
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
      expect(refreshDashboardGitSnapshotMock).toHaveBeenCalledWith(
        'dashboard-mount',
        'code-binding'
      )
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
    expect(refreshDashboardGitSnapshotMock).toHaveBeenCalledWith('manual-button', 'code-binding')
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
      expect(refreshDashboardGitSnapshotMock).toHaveBeenCalledWith(
        'dashboard-mount',
        'code-binding'
      )
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

  it('opens current git snapshot entries with their own Code binding provenance', async () => {
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
          bindingToken: 'code-binding',
          defaultBranch: 'main',
          worktrees: [
            {
              ...baseWorktree,
              isCurrent: true,
              entries: [
                {
                  type: 'commit',
                  hash: 'deadbeef',
                  title: 'Open me',
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

    fireEvent.click(screen.getByText('Open me').closest('button') as HTMLButtonElement)

    await waitFor(() => expect(navControllerMock.push).toHaveBeenCalledTimes(1))
    expect(navControllerMock.push).toHaveBeenCalledWith(
      'bottom',
      '/git/commit/deadbeef',
      expect.objectContaining({
        __vtHandoff: expect.objectContaining({
          family: 'git',
          entityId: 'deadbeef',
          title: 'Open me',
          bindingToken: 'code-binding',
        }),
      })
    )
    expect(codeBindingQueryMock).not.toHaveBeenCalled()
  })

  it('retires an A dashboard snapshot instead of handing it off with current Code token B', async () => {
    staticModeMock.mockReturnValue(false)
    let codeBindingToken = 'code-binding-a'
    gitScopesMock.mockImplementation(() => ({
      data: {
        defaultScope: 'code',
        code: {
          scope: 'code',
          bindingToken: codeBindingToken,
          rootPath: '/workspace/code',
          repository: { topLevel: '/workspace/code', commonDir: '/workspace/code/.git' },
        },
        planningState: 'settled',
        planning: null,
      } satisfies GitRepositoryScopes,
      isLoading: false,
      error: null,
    }))
    dashboardOverviewMock.mockReturnValue({
      data: {
        ...createOverviewData(),
        git: {
          bindingToken: 'code-binding-a',
          defaultBranch: 'main',
          worktrees: [
            {
              ...baseWorktree,
              isCurrent: true,
              entries: [
                {
                  type: 'commit',
                  hash: 'deadbeef',
                  title: 'Stale A entry',
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

    const view = render(<Dashboard />)
    expect(screen.getByText('Stale A entry')).toBeInTheDocument()

    codeBindingToken = 'code-binding-b'
    view.rerender(<Dashboard />)

    await waitFor(() => expect(screen.queryByText('Stale A entry')).toBeNull())
    expect(navControllerMock.push).not.toHaveBeenCalled()
  })

  it('conflicts captured A Dashboard actions after B publishes, then resumes current B actions', async () => {
    staticModeMock.mockReturnValue(false)
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_000)
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    const detachedPath = '/workspace/code/detached'
    const detachedWorktree: DashboardGitWorktree = {
      ...baseWorktree,
      path: detachedPath,
      relativePath: './detached',
      branchName: '(detached)',
      isCurrent: false,
      detached: true,
      entries: [],
    }
    const scopesA = {
      defaultScope: 'code',
      code: {
        scope: 'code',
        bindingToken: 'code-binding-a',
        rootPath: '/workspace/code',
        repository: { topLevel: '/workspace/code', commonDir: '/workspace/code/.git' },
      },
      planningState: 'settled',
      planning: null,
    } satisfies GitRepositoryScopes
    const scopesB = {
      ...scopesA,
      code: { ...scopesA.code, bindingToken: 'code-binding-b' },
    } satisfies GitRepositoryScopes
    const snapshotA = {
      ...createOverviewData(),
      git: {
        bindingToken: 'code-binding-a',
        defaultBranch: 'main-a',
        worktrees: [detachedWorktree],
      },
    }
    const snapshotB = {
      ...snapshotA,
      git: {
        bindingToken: 'code-binding-b',
        defaultBranch: 'main-b',
        worktrees: [{ ...detachedWorktree, branchName: '(detached B)' }],
      },
    }
    gitScopesMock.mockReturnValue({
      data: scopesA,
      isLoading: false,
      error: null,
      authority: { state: 'current' },
    })
    dashboardOverviewMock.mockReturnValue({ data: snapshotA, isLoading: false, error: null })

    const view = render(<Dashboard />)
    await waitFor(() =>
      expect(refreshDashboardGitSnapshotMock).toHaveBeenCalledWith(
        'dashboard-mount',
        'code-binding-a'
      )
    )
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled())
    refreshDashboardGitSnapshotMock.mockClear()
    dashboardGitRefreshControlRenderMock.mockClear()
    worktreeRowRenderMock.mockClear()
    view.rerender(<Dashboard />)
    const refreshA = latestRefreshControl().onRefresh
    const rowA = latestWorktreeRow(detachedPath)
    const removeA = rowA.onRemoveDetachedWorktree
    if (!removeA) throw new Error('Detached worktree A did not expose a removal handler.')

    gitScopesMock.mockReturnValue({
      data: scopesB,
      isLoading: false,
      error: null,
      authority: { state: 'current' },
    })
    dashboardOverviewMock.mockReturnValue({ data: snapshotB, isLoading: false, error: null })
    dashboardGitRefreshControlRenderMock.mockClear()
    worktreeRowRenderMock.mockClear()
    view.rerender(<Dashboard />)
    await waitFor(() => expect(screen.getAllByText('Default branch: main-b')).toHaveLength(2))

    const refreshADeferred = createDeferred<void>()
    refreshDashboardGitSnapshotMock.mockImplementationOnce(() => refreshADeferred.promise)
    act(() => refreshA())
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled())
    expect(refreshDashboardGitSnapshotMock).toHaveBeenLastCalledWith(
      'manual-button',
      'code-binding-a'
    )
    expect(screen.getAllByText('Default branch: main-b')).toHaveLength(2)

    await act(async () => {
      refreshADeferred.reject(
        new GitConflictError('The code repository binding changed during A refresh.')
      )
      await refreshADeferred.promise.catch(() => {})
    })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled())
    expect(screen.getByRole('alert')).toHaveTextContent(
      'CONFLICT: The code repository binding changed during A refresh.'
    )

    const removeADeferred = createDeferred<void>()
    removeDetachedDashboardWorktreeMock.mockImplementationOnce(() => removeADeferred.promise)
    act(() => {
      void removeA(rowA.worktree)
    })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Remove detached worktree' })).toBeDisabled()
    )
    expect(removeDetachedDashboardWorktreeMock).toHaveBeenLastCalledWith(
      detachedPath,
      'code-binding-a'
    )
    expect(screen.getAllByText('Default branch: main-b')).toHaveLength(2)

    await act(async () => {
      removeADeferred.reject(
        new GitConflictError('The code repository binding changed during A removal.')
      )
      await removeADeferred.promise.catch(() => {})
    })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Remove detached worktree' })).toBeEnabled()
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      'CONFLICT: The code repository binding changed during A removal.'
    )
    expect(refreshDashboardGitSnapshotMock).not.toHaveBeenCalledWith(
      'manual-button',
      'code-binding-b'
    )
    expect(removeDetachedDashboardWorktreeMock).not.toHaveBeenCalledWith(
      detachedPath,
      'code-binding-b'
    )

    refreshDashboardGitSnapshotMock.mockResolvedValueOnce(undefined)
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    await waitFor(() =>
      expect(refreshDashboardGitSnapshotMock).toHaveBeenLastCalledWith(
        'manual-button',
        'code-binding-b'
      )
    )
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled())
    expect(screen.queryByRole('alert')).toBeNull()

    removeDetachedDashboardWorktreeMock.mockResolvedValueOnce(undefined)
    fireEvent.click(screen.getByRole('button', { name: 'Remove detached worktree' }))
    await waitFor(() =>
      expect(removeDetachedDashboardWorktreeMock).toHaveBeenLastCalledWith(
        detachedPath,
        'code-binding-b'
      )
    )
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Remove detached worktree' })).toBeEnabled()
    )
    expect(screen.queryByRole('alert')).toBeNull()

    expect(confirmSpy).toHaveBeenCalledTimes(2)
    expect(alertSpy).toHaveBeenCalledTimes(1)
    dateNowSpy.mockRestore()
    confirmSpy.mockRestore()
    alertSpy.mockRestore()
  })

  it('retires a snapshot when the current Code scope is stale behind a reconnect error', () => {
    staticModeMock.mockReturnValue(false)
    gitScopesMock.mockReturnValue({
      data: {
        defaultScope: 'code',
        code: {
          scope: 'code',
          bindingToken: 'code-binding-a',
          rootPath: '/workspace/code',
          repository: { topLevel: '/workspace/code', commonDir: '/workspace/code/.git' },
        },
        planningState: 'settled',
        planning: null,
      } satisfies GitRepositoryScopes,
      isLoading: false,
      error: new Error('Git scope subscription disconnected.'),
    })
    dashboardOverviewMock.mockReturnValue({
      data: {
        ...createOverviewData(),
        git: {
          bindingToken: 'code-binding-a',
          defaultBranch: 'main',
          worktrees: [
            {
              ...baseWorktree,
              isCurrent: true,
              entries: [
                {
                  type: 'commit',
                  hash: 'deadbeef',
                  title: 'Stale reconnect entry',
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

    expect(screen.queryByText('Stale reconnect entry')).toBeNull()
    expect(navControllerMock.push).not.toHaveBeenCalled()
  })

  it('keeps cached A display-only while Git scopes reconnect, then authorizes B', async () => {
    staticModeMock.mockReturnValue(false)
    const scopeA: GitRepositoryScopes = {
      defaultScope: 'code',
      code: {
        scope: 'code',
        bindingToken: 'code-binding-a',
        rootPath: '/workspace/code-a',
        repository: { topLevel: '/workspace/code-a', commonDir: '/workspace/code-a/.git' },
      },
      planningState: 'settled',
      planning: null,
    }
    const scopeB: GitRepositoryScopes = {
      ...scopeA,
      code: {
        ...scopeA.code,
        bindingToken: 'code-binding-b',
        rootPath: '/workspace/code-b',
        repository: { topLevel: '/workspace/code-b', commonDir: '/workspace/code-b/.git' },
      },
    }
    const snapshotA = {
      ...createOverviewData(),
      git: {
        bindingToken: 'code-binding-a',
        defaultBranch: 'main',
        worktrees: [
          {
            ...baseWorktree,
            isCurrent: true,
            entries: [
              {
                type: 'commit' as const,
                hash: 'reconnect-a',
                title: 'Reconnect A entry',
                committedAt: 1_710_200_000_000,
                relatedChanges: [],
                diff: { files: 1, insertions: 1, deletions: 0 },
              },
            ],
          },
        ],
      },
    }
    const snapshotB = {
      ...snapshotA,
      git: {
        ...snapshotA.git,
        bindingToken: 'code-binding-b',
        worktrees: [
          {
            ...baseWorktree,
            isCurrent: true,
            entries: [
              {
                type: 'commit' as const,
                hash: 'reconnect-b',
                title: 'Reconnect B entry',
                committedAt: 1_710_300_000_000,
                relatedChanges: [],
                diff: { files: 1, insertions: 2, deletions: 0 },
              },
            ],
          },
        ],
      },
    }

    gitScopesMock.mockReturnValue({ data: scopeA, isLoading: true, error: null })
    dashboardOverviewMock.mockReturnValue({ data: snapshotA, isLoading: false, error: null })
    const view = render(<Dashboard />)

    expect(screen.queryByText('Reconnect A entry')).toBeNull()
    expect(navControllerMock.push).not.toHaveBeenCalled()

    gitScopesMock.mockReturnValue({ data: scopeB, isLoading: false, error: null })
    dashboardOverviewMock.mockReturnValue({ data: snapshotB, isLoading: false, error: null })
    view.rerender(<Dashboard />)

    await waitFor(() => expect(screen.getByText('Reconnect B entry')).toBeInTheDocument())
    expect(screen.queryByText('Reconnect A entry')).toBeNull()

    fireEvent.click(screen.getByText('Reconnect B entry'))
    expect(navControllerMock.push).toHaveBeenCalledWith(
      'bottom',
      '/git/commit/reconnect-b',
      expect.objectContaining({
        __vtHandoff: expect.objectContaining({
          entityId: 'reconnect-b',
          bindingToken: 'code-binding-b',
        }),
      })
    )
  })
})
