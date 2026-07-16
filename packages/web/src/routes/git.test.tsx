import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GitRoute } from './git'

const {
  scopesQueryMock,
  overviewQueryMock,
  listEntriesQueryMock,
  switchWorktreeMock,
  refreshGitMock,
  removeDetachedWorktreeMock,
  staticModeMock,
  navPushMock,
  navReplaceMock,
  routerLocation,
  navigateToServerHandoffMock,
} = vi.hoisted(() => ({
  scopesQueryMock: vi.fn(),
  overviewQueryMock: vi.fn(),
  listEntriesQueryMock: vi.fn(),
  switchWorktreeMock: vi.fn(),
  refreshGitMock: vi.fn(),
  removeDetachedWorktreeMock: vi.fn(),
  staticModeMock: vi.fn(() => false),
  navPushMock: vi.fn(),
  navReplaceMock: vi.fn(),
  routerLocation: {
    pathname: '/git',
    searchStr: '',
    hash: '',
    state: null,
  },
  navigateToServerHandoffMock: vi.fn(),
}))

vi.mock('@/lib/trpc', () => ({
  trpcClient: {
    git: {
      scopes: {
        query: scopesQueryMock,
      },
      overview: {
        query: overviewQueryMock,
      },
      listEntries: {
        query: listEntriesQueryMock,
      },
      switchWorktree: {
        mutate: switchWorktreeMock,
      },
      refresh: {
        mutate: refreshGitMock,
      },
      removeDetachedWorktree: {
        mutate: removeDetachedWorktreeMock,
      },
    },
  },
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useLocation: () => routerLocation,
  }
})

vi.mock('@/lib/static-mode', () => ({
  isStaticMode: staticModeMock,
}))

vi.mock('@/lib/server-handoff', () => ({
  navigateToServerHandoff: navigateToServerHandoffMock,
}))

vi.mock('@/lib/nav-controller', () => ({
  navController: {
    push: navPushMock,
    replace: navReplaceMock,
    getAreaForPath: () => 'bottom',
  },
}))

vi.mock('@/components/git/git-shared', () => ({
  GIT_WORKTREE_BG_CLASS: 'bg-worktree-current',
  GIT_WORKTREE_BORDER_CLASS: 'border-worktree-current',
  copyText: vi.fn(() => Promise.resolve()),
  isHttpUrl: (value: string) => /^https?:\/\//.test(value),
  DiffStat: ({
    diff,
    className,
  }: {
    diff: { insertions: number; deletions: number }
    className?: string
  }) => (
    <span className={className}>
      +{diff.insertions}/-{diff.deletions}
    </span>
  ),
  GitAutoRefreshPresetIcon: () => <span data-testid="git-refresh-icon">icon</span>,
  GitAheadBehindBadge: ({ ahead, behind }: { ahead: number; behind: number }) => (
    <span>
      ahead {ahead} behind {behind}
    </span>
  ),
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
  GitFilesBadge: ({ files }: { files: number }) => <span>{files} files</span>,
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

  beforeEach(() => {
    staticModeMock.mockReturnValue(false)
    routerLocation.pathname = '/git'
    routerLocation.searchStr = ''
    routerLocation.state = null
    scopesQueryMock.mockResolvedValue({
      defaultScope: 'code',
      code: {
        scope: 'code',
        rootPath: '/repo',
        repository: { topLevel: '/repo', commonDir: '/repo/.git' },
      },
      planning: {
        scope: 'planning',
        rootPath: '/planning',
        repository: { topLevel: '/planning', commonDir: '/planning/.git' },
      },
    })
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
    refreshGitMock.mockResolvedValue({ success: true })
    removeDetachedWorktreeMock.mockResolvedValue({ success: true })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('uses Code repository as the explicit default for status and history', async () => {
    renderWithQueryClient(<GitRoute />)

    await waitFor(() => {
      expect(screen.getByText('main against origin/main')).toBeTruthy()
    })

    expect(overviewQueryMock).toHaveBeenCalledWith({ scope: 'code' })
    expect(listEntriesQueryMock).toHaveBeenCalledWith({
      scope: 'code',
      cursor: undefined,
      limit: 50,
    })
  })

  it('preserves Planning repository scope in history requests and detail navigation', async () => {
    routerLocation.searchStr = '?gitScope=planning'
    renderWithQueryClient(<GitRoute />)

    await waitFor(() => {
      expect(overviewQueryMock).toHaveBeenCalledWith({ scope: 'planning' })
    })
    expect(listEntriesQueryMock).toHaveBeenCalledWith({
      scope: 'planning',
      cursor: undefined,
      limit: 50,
    })

    fireEvent.click(screen.getByRole('button', { name: 'feat: add git panel' }))
    expect(navPushMock).toHaveBeenCalledWith(
      'bottom',
      '/git/commit/abc12345?gitScope=planning',
      expect.anything()
    )
  })

  it('switches repository scope through URL state instead of local hidden state', async () => {
    renderWithQueryClient(<GitRoute />)

    const planningButton = await screen.findByRole('button', { name: 'Planning repository' })
    fireEvent.click(planningButton)

    expect(navReplaceMock).toHaveBeenCalledWith('bottom', '/git?gitScope=planning', undefined)
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

  it('uses an accessible icon button for worktree switching', async () => {
    const handoff = {
      serverUrl: 'http://127.0.0.1:3200',
    }
    switchWorktreeMock.mockResolvedValueOnce(handoff)
    overviewQueryMock.mockResolvedValueOnce({
      ...overviewData,
      otherWorktrees: [
        {
          path: '/repo-feature',
          relativePath: '../repo-feature',
          pathAvailable: true,
          branchName: 'feature/responsive-shell',
          detached: false,
          isCurrent: false,
          ahead: 2,
          behind: 0,
          diff: { files: 3, insertions: 12, deletions: 4 },
          entries: [],
        },
      ],
    })

    renderWithQueryClient(<GitRoute />)

    await waitFor(() => {
      expect(screen.getByText('/repo-feature')).toBeTruthy()
    })

    const switchButton = screen.getByRole('button', {
      name: 'Switch to feature/responsive-shell',
    })
    expect(switchButton.textContent).toBe('')

    fireEvent.click(switchButton)

    await waitFor(() => {
      expect(switchWorktreeMock).toHaveBeenCalledWith({
        scope: 'code',
        path: '/repo-feature',
      })
    })
    await waitFor(() => {
      expect(navigateToServerHandoffMock).toHaveBeenCalledWith({
        handoff,
        location: window.location,
      })
    })
  })

  it('removes a detached worktree only through the selected repository scope', async () => {
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true)
    overviewQueryMock.mockResolvedValueOnce({
      ...overviewData,
      otherWorktrees: [
        {
          path: '/repo-detached',
          relativePath: '../repo-detached',
          pathAvailable: true,
          branchName: '(detached)',
          detached: true,
          isCurrent: false,
          ahead: 0,
          behind: 0,
          diff: { files: 0, insertions: 0, deletions: 0 },
          entries: [],
        },
      ],
    })

    renderWithQueryClient(<GitRoute />)
    const removeButton = await screen.findByRole('button', { name: 'Remove detached worktree' })
    fireEvent.click(removeButton)

    await waitFor(() => {
      expect(removeDetachedWorktreeMock).toHaveBeenCalledWith({
        scope: 'code',
        path: '/repo-detached',
      })
    })
    confirmMock.mockRestore()
  })
})
