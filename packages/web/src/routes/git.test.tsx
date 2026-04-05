import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GitRoute } from './git'

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const {
  overviewQueryMock,
  listEntriesQueryMock,
  switchWorktreeMock,
  gitTaskStatusMock,
  staticModeMock,
  navPushMock,
} = vi.hoisted(() => ({
  overviewQueryMock: vi.fn(),
  listEntriesQueryMock: vi.fn(),
  switchWorktreeMock: vi.fn(),
  gitTaskStatusMock: vi.fn(),
  staticModeMock: vi.fn(() => false),
  navPushMock: vi.fn(),
}))

vi.mock('@/lib/trpc', () => ({
  trpcClient: {
    git: {
      overview: {
        query: overviewQueryMock,
      },
      listEntries: {
        query: listEntriesQueryMock,
      },
      switchWorktree: {
        mutate: switchWorktreeMock,
      },
    },
  },
}))

vi.mock('@/lib/static-mode', () => ({
  isStaticMode: staticModeMock,
}))

vi.mock('@/lib/nav-controller', () => ({
  navController: {
    push: navPushMock,
  },
}))

vi.mock('@/lib/use-dashboard', () => ({
  useDashboardGitTaskStatusSubscription: gitTaskStatusMock,
  refreshDashboardGitSnapshot: vi.fn(),
  removeDetachedDashboardWorktree: vi.fn(),
}))

vi.mock('@/components/git/git-shared', () => ({
  GitAutoRefreshPresetIcon: () => <span data-testid="git-refresh-icon">icon</span>,
  getGitEntrySharedDescriptor: (entry: { type: string; hash?: string }) => ({
    family: 'git',
    entityId: entry.type === 'commit' ? (entry.hash ?? 'unknown') : 'uncommitted',
  }),
  getGitEntrySharedHandoff: (entry: { type: string; hash?: string; title: string }) => ({
    family: 'git',
    entityId: entry.type === 'commit' ? (entry.hash ?? 'unknown') : 'uncommitted',
    title: entry.title,
  }),
  GitEntryRow: ({
    entry,
    onSelect,
  }: {
    entry: { type: string; hash?: string; title: string }
    onSelect?: (
      entry: { type: string; hash?: string; title: string },
      sourceElement: HTMLElement
    ) => void
  }) => (
    <button type="button" onClick={(event) => onSelect?.(entry, event.currentTarget)}>
      {entry.title}
    </button>
  ),
  WorktreeRow: ({ worktree }: { worktree: { path: string } }) => <div>{worktree.path}</div>,
}))

vi.mock('@/components/select', () => ({
  Select: ({
    value,
    onValueChange,
    ariaLabel,
  }: {
    value: string
    onValueChange: (value: string) => void
    ariaLabel?: string
  }) => (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
    >
      <option value="none">none</option>
      <option value="30s">30s</option>
      <option value="5min">5min</option>
      <option value="30min">30min</option>
    </select>
  ),
}))

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
}

function renderWithQueryClient(children: ReactNode) {
  const queryClient = createQueryClient()
  return {
    queryClient,
    ...render(<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>),
  }
}

describe('GitRoute', () => {
  const overviewData = {
    defaultBranch: 'origin/main',
    currentWorktree: {
      path: '/repo',
      relativePath: '.',
      pathAvailable: true,
      branchName: 'main',
      detached: false,
      isCurrent: true,
      ahead: 0,
      behind: 0,
      diff: { files: 0, insertions: 0, deletions: 0 },
      entries: [],
    },
    otherWorktrees: [],
  }

  let gitTaskStatus = {
    running: false,
    inFlight: 0,
    lastStartedAt: null as number | null,
    lastFinishedAt: 100 as number | null,
    lastReason: null as string | null,
    lastError: null as string | null,
  }

  beforeEach(() => {
    staticModeMock.mockReturnValue(false)
    gitTaskStatusMock.mockImplementation(() => ({ data: gitTaskStatus }))
    overviewQueryMock.mockResolvedValue(overviewData)
    listEntriesQueryMock.mockResolvedValue({
      items: [
        {
          type: 'commit',
          hash: 'abc12345',
          title: 'feat: add git panel',
          committedAt: 1,
          relatedChanges: [],
          diff: { files: 1, insertions: 3, deletions: 1 },
        },
      ],
      nextCursor: null,
    })
    switchWorktreeMock.mockResolvedValue({
      serverUrl: 'http://127.0.0.1:3200',
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('keeps the previous overview visible while git cache version refreshes', async () => {
    const secondOverview = createDeferred<typeof overviewData>()
    let overviewCallCount = 0
    overviewQueryMock.mockImplementation(() => {
      overviewCallCount += 1
      return overviewCallCount === 1 ? Promise.resolve(overviewData) : secondOverview.promise
    })

    const view = renderWithQueryClient(<GitRoute />)

    await waitFor(() => {
      expect(screen.getByText('main against origin/main')).toBeTruthy()
    })

    gitTaskStatus = {
      ...gitTaskStatus,
      lastFinishedAt: 200,
    }

    view.rerender(
      <QueryClientProvider client={view.queryClient}>
        <GitRoute />
      </QueryClientProvider>
    )

    expect(screen.queryByText('Loading git panel...')).toBeNull()
    expect(screen.getByText('main against origin/main')).toBeTruthy()

    secondOverview.resolve(overviewData)
  })

  it('renders the commits list without embedding commit detail and navigates on row click', async () => {
    renderWithQueryClient(<GitRoute />)

    await waitFor(() => {
      expect(screen.getByText('Commits')).toBeTruthy()
    })

    expect(screen.queryByText('Changed Files')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'feat: add git panel' }))

    expect(navPushMock).toHaveBeenCalledWith(
      'bottom',
      '/git/commit/abc12345',
      expect.objectContaining({
        __vtHandoff: expect.objectContaining({
          family: 'git',
          entityId: 'abc12345',
          title: 'feat: add git panel',
        }),
      })
    )
  })
})
