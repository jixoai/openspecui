/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Prove Dashboard keeps real regional geometry mounted while Summary admits lower-priority projections.
 * 2. Prove readonly lifecycle refresh conflicts visibly across A-to-B, settles, and resumes on B.
 * 3. Prove live Code Git curation and navigation preserve backend-issued binding provenance.
 * 4. Prove Dashboard snapshots cannot be relabeled across Code binding replacements.
 * 5. Prove retained Overview content remains visible beside terminal error evidence.
 *
 * Original request (2026-07-16): "接下来，你来接手后续工作"
 * Derived requirement (2026-07-19): Checkpoint 6.11 preserves Dashboard Git provenance.
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 * Original request (2026-07-27): "统一修复所有类似的问题（我们也没不多，各个页面都检查一下，特别是app 那边新增的页面）"
 * Original request (2026-07-31): "dashboard.refreshGitSnapshot?batch=1 这个请求一直在阻塞其它任务，这个不是只读吗"
 * Owner correction (2026-07-31): Preserve Dashboard lifecycle refresh through readonly query transport.
 * Owner-reported regression (2026-07-31): "Git Snapshot 界面上的代码？我现在手动刷新不了。"
 * Original request (2026-07-31): "优化 Dashboard，目前是 Kanban / Code Git Snapshot / Active Changes / Specifications。改成 Kanban 独占一行，然后移除 Specifications，接着就是 Active Changes / Code Git Snapshot 两个一行"
 * Original request (2026-07-31): "这个看板底部加一个border"
 * Original request (2026-07-31): "基于真实的布局去做骨架屏，或者说是直接让卡片自身去支持 Pending 样式"
 * Original request (2026-07-31): "commitList这里默认显示5个就好"
 */
import type { DashboardGitRefreshControlProps } from '@/components/dashboard/git-refresh-control'
import type { DashboardGitEntry, DashboardGitWorktree, GitRepositoryScopes } from '@openspecui/core'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Dashboard, WorktreeRow } from './dashboard'

type WorktreeRowProps = ComponentProps<typeof WorktreeRow>

const {
  dashboardOverviewMock,
  dashboardGitTaskStatusMock,
  refreshDashboardGitSnapshotMock,
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
  DashboardMetricCard: ({
    label,
    value,
    pending,
    className,
  }: {
    label: string
    value: string
    pending?: boolean
    className?: string
  }) => (
    <div
      data-testid={`metric-card:${label}`}
      data-pending={String(Boolean(pending))}
      className={className}
    >
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

  function createCommit(index: number): DashboardGitEntry {
    return {
      type: 'commit',
      hash: `commit-${index}`,
      title: `Commit ${index}`,
      committedAt: 1_710_000_000_000 + index,
      relatedChanges: [],
      diff: { files: 1, insertions: index, deletions: 0 },
    }
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

  it('renders Kanban as a full row before the shared Active Changes and Code Git row', () => {
    staticModeMock.mockReturnValue(false)
    render(<Dashboard />)

    const kanbanRow = screen.getByTestId('dashboard-kanban-row')
    const secondaryGrid = screen.getByTestId('dashboard-secondary-grid')
    const kanbanHeading = screen.getByRole('heading', { name: 'Kanban' })
    const activeChangesHeading = screen.getByRole('heading', { name: 'Active Changes' })
    const gitHeading = screen.getByRole('heading', { name: 'Code Git Snapshot' })

    expect(kanbanRow).toContainElement(kanbanHeading)
    expect(kanbanRow).toHaveClass('border-b')
    expect(secondaryGrid).toContainElement(activeChangesHeading)
    expect(secondaryGrid).toContainElement(gitHeading)
    expect(secondaryGrid).toHaveClass('@[64rem]:grid-cols-2')
    expect(kanbanRow.compareDocumentPosition(secondaryGrid)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(activeChangesHeading.compareDocumentPosition(gitHeading)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )
    expect(screen.queryByRole('heading', { name: 'Specifications' })).not.toBeInTheDocument()
  })

  it('keeps the Summary visible while independent Trends and Git regions are still loading', () => {
    const overview = createOverviewData()
    staticModeMock.mockReturnValue(false)
    dashboardOverviewMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
      regions: {
        summary: {
          data: {
            summary: overview.summary,
            specifications: overview.specifications,
            activeChanges: overview.activeChanges,
          },
          isLoading: false,
          isUpdating: true,
          error: null,
        },
        trends: { data: undefined, isLoading: true, isUpdating: false, error: null },
        git: { data: undefined, isLoading: true, isUpdating: false, error: null },
      },
    })

    const { container } = render(<Dashboard />)

    expect(screen.getByTestId('metric-card:Specifications / Requirements')).toHaveTextContent(
      '12 / 24'
    )
    expect(screen.getByRole('heading', { name: 'Active Changes' })).toBeInTheDocument()
    expect(container.querySelector('.rt-revalidate-cue')).not.toBeNull()
    expect(screen.queryByText('Updating dashboard summary...')).toBeNull()
    expect(screen.getByText('Active Changes')).toBeInTheDocument()
    expect(container.querySelectorAll('.rt-skeleton').length).toBeGreaterThan(0)
    expect(screen.queryByText('Loading Code Git snapshot...')).toBeNull()
  })

  it('keeps the real Dashboard regions mounted while Summary is Pending', () => {
    staticModeMock.mockReturnValue(false)
    dashboardOverviewMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      regions: {
        summary: { data: undefined, isLoading: true, isUpdating: false, error: null },
        trends: { data: undefined, isLoading: false, isUpdating: false, error: null },
        git: { data: undefined, isLoading: false, isUpdating: false, error: null },
      },
    })

    const { container } = render(<Dashboard />)

    expect(screen.getByRole('heading', { name: 'Historical Trends' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Kanban' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Active Changes' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Code Git Snapshot' })).toBeTruthy()
    expect(screen.getByTestId('dashboard-context-summary')).toBeTruthy()

    const metric = screen.getByTestId('metric-card:Specifications / Requirements')
    expect(metric).toHaveAttribute('data-pending', 'true')
    expect(metric.className).toContain('h-44')
    expect(screen.getByTestId('readonly-kanban')).toHaveAttribute('aria-busy', 'true')
    expect(
      container.querySelector('[data-testid="dashboard-active-changes"] .rt-skeleton')
    ).toBeTruthy()
    expect(
      container.querySelector('[data-testid="dashboard-git-snapshot"] .rt-skeleton')
    ).toBeTruthy()
  })

  it('admits lower-priority workflow projections only after Summary is renderable', () => {
    staticModeMock.mockReturnValue(false)
    dashboardOverviewMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    })

    const view = render(<Dashboard />)

    expect(opsxStatusListMock).toHaveBeenLastCalledWith(false)
    expect(opsxConfigBundleMock).toHaveBeenLastCalledWith(false)
    expect(gitScopesMock).toHaveBeenLastCalledWith(false)

    dashboardOverviewMock.mockReturnValue({
      data: createOverviewData(),
      isLoading: false,
      error: null,
    })
    view.rerender(<Dashboard />)

    expect(opsxStatusListMock).toHaveBeenLastCalledWith(true)
    expect(opsxConfigBundleMock).toHaveBeenLastCalledWith(true)
    expect(gitScopesMock).toHaveBeenLastCalledWith(true)
  })

  it('retains the stable Overview content alongside a terminal subscription error', () => {
    dashboardOverviewMock.mockReturnValue({
      data: createOverviewData(),
      isLoading: false,
      error: new Error('dashboard overview failed'),
    })

    render(<Dashboard />)

    expect(screen.getByRole('heading', { name: 'Active Changes' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Error loading dashboard: dashboard overview failed'
    )
  })

  it('keeps stable Dashboard regions beside the terminal Overview error', () => {
    staticModeMock.mockReturnValue(false)
    dashboardOverviewMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('dashboard overview unavailable'),
    })

    render(<Dashboard />)

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Error loading dashboard: dashboard overview unavailable'
    )
    expect(screen.getByRole('heading', { name: 'Historical Trends' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Kanban' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Active Changes' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Code Git Snapshot' })).toBeInTheDocument()
  })

  it('integrates the data-scope summary with the current static mode', () => {
    staticModeMock.mockReturnValue(false)
    render(<Dashboard />)

    expect(screen.getByTestId('dashboard-context-summary').textContent).toBe('false')
    expect(dashboardContextSummaryMock).toHaveBeenCalledWith({ staticMode: false })
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

  it('shows changed Uncommitted plus four commits and hides detached Other Worktrees', () => {
    staticModeMock.mockReturnValue(false)
    dashboardOverviewMock.mockReturnValue({
      data: {
        ...createOverviewData(),
        git: {
          bindingToken: 'code-binding',
          defaultBranch: 'main',
          worktrees: [
            {
              ...baseWorktree,
              isCurrent: true,
              entries: [
                ...Array.from({ length: 6 }, (_, index) => createCommit(index + 1)),
                {
                  type: 'uncommitted',
                  title: 'Uncommitted',
                  updatedAt: 1_720_000_000_000,
                  relatedChanges: [],
                  diff: { files: 2, insertions: 3, deletions: 1 },
                },
              ],
            },
            { ...baseWorktree, path: '/tmp/visible', branchName: 'feature-visible' },
            {
              ...baseWorktree,
              path: '/tmp/detached',
              branchName: '(detached)',
              detached: true,
            },
          ],
        },
      },
      isLoading: false,
      error: null,
    })

    render(<Dashboard />)

    expect(screen.getByText('Uncommitted')).toBeTruthy()
    for (const index of [6, 5, 4, 3]) expect(screen.getByText(`Commit ${index}`)).toBeTruthy()
    expect(screen.queryByText('Commit 2')).toBeNull()
    expect(screen.queryByText('Commit 1')).toBeNull()
    expect(
      worktreeRowRenderMock.mock.calls.some(([props]) => props.worktree.path === '/tmp/visible')
    ).toBe(true)
    expect(
      worktreeRowRenderMock.mock.calls.some(([props]) => props.worktree.path === '/tmp/detached')
    ).toBe(false)
  })

  it('hides empty Uncommitted and shows the five newest commits', () => {
    staticModeMock.mockReturnValue(false)
    dashboardOverviewMock.mockReturnValue({
      data: {
        ...createOverviewData(),
        git: {
          bindingToken: 'code-binding',
          defaultBranch: 'main',
          worktrees: [
            {
              ...baseWorktree,
              isCurrent: true,
              entries: [
                ...Array.from({ length: 6 }, (_, index) => createCommit(index + 1)),
                {
                  type: 'uncommitted',
                  title: 'Uncommitted',
                  updatedAt: null,
                  relatedChanges: [],
                  diff: { files: 0, insertions: 0, deletions: 0 },
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

    expect(screen.queryByText('Uncommitted')).toBeNull()
    for (const index of [6, 5, 4, 3, 2]) expect(screen.getByText(`Commit ${index}`)).toBeTruthy()
    expect(screen.queryByText('Commit 1')).toBeNull()
  })

  it('issues the readonly Git refresh when Dashboard enters its lifecycle', async () => {
    staticModeMock.mockReturnValue(false)

    render(<Dashboard />)
    await waitFor(() =>
      expect(refreshDashboardGitSnapshotMock).toHaveBeenCalledWith(
        'dashboard-mount',
        'code-binding'
      )
    )
  })

  it('issues an automatic Git refresh only after the user-selected interval elapses', async () => {
    staticModeMock.mockReturnValue(false)
    localStorage.setItem('openspecui:dashboard:git-auto-refresh', '30s')
    vi.useFakeTimers()

    render(<Dashboard />)
    await act(async () => undefined)
    expect(refreshDashboardGitSnapshotMock).toHaveBeenCalledWith('dashboard-mount', 'code-binding')
    refreshDashboardGitSnapshotMock.mockClear()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })

    expect(refreshDashboardGitSnapshotMock).toHaveBeenCalledOnce()
    expect(refreshDashboardGitSnapshotMock).toHaveBeenCalledWith('auto-refresh:30s', 'code-binding')
  })

  it('supports auto refresh presets and locks manual refresh only until its query settles', async () => {
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

    const manualRefresh = createDeferred<void>()
    refreshDashboardGitSnapshotMock.mockReturnValueOnce(manualRefresh.promise)
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(refreshDashboardGitSnapshotMock).toHaveBeenCalledWith('manual-button', 'code-binding')
    await waitFor(() => expect(isDisabled('Refresh')).toBe(true))
    expect(view.container.querySelector('svg.animate-spin')).toBeTruthy()

    await act(async () => {
      manualRefresh.resolve()
      await manualRefresh.promise
    })
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

  it('releases the lifecycle request when its readonly query settles even while watcher work runs', async () => {
    staticModeMock.mockReturnValue(false)
    dashboardGitTaskStatusMock.mockReturnValue({
      data: {
        running: true,
        inFlight: 1,
        lastStartedAt: 1,
        lastFinishedAt: null,
        lastReason: 'watcher-change',
        lastError: null,
      },
    })
    const lifecycleRefresh = createDeferred<void>()
    refreshDashboardGitSnapshotMock.mockReturnValueOnce(lifecycleRefresh.promise)

    render(<Dashboard />)
    await waitFor(() =>
      expect(refreshDashboardGitSnapshotMock).toHaveBeenCalledWith(
        'dashboard-mount',
        'code-binding'
      )
    )
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled()

    await act(async () => {
      lifecycleRefresh.resolve()
      await lifecycleRefresh.promise
    })

    await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled())
    refreshDashboardGitSnapshotMock.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    expect(refreshDashboardGitSnapshotMock).toHaveBeenCalledWith('manual-button', 'code-binding')
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

  it('conflicts a captured A refresh after B publishes, then resumes the current B refresh', async () => {
    staticModeMock.mockReturnValue(false)
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_000)
    const detachedWorktree: DashboardGitWorktree = {
      ...baseWorktree,
      path: '/workspace/code/detached',
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
    view.rerender(<Dashboard />)
    const refreshA = latestRefreshControl().onRefresh

    gitScopesMock.mockReturnValue({
      data: scopesB,
      isLoading: false,
      error: null,
      authority: { state: 'current' },
    })
    dashboardOverviewMock.mockReturnValue({ data: snapshotB, isLoading: false, error: null })
    dashboardGitRefreshControlRenderMock.mockClear()
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

    expect(refreshDashboardGitSnapshotMock).not.toHaveBeenCalledWith(
      'manual-button',
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

    dateNowSpy.mockRestore()
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
