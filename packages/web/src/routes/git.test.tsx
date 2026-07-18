/**
 * Orthogonal intents (updated 2026-07-19 Asia/Shanghai):
 * 1. Prove Code/Planning Git route requests, controls, and navigation.
 * 2. Prove mounted repository rebinding retires stale Planning status and history.
 * 3. Prove every Git mutation retains the binding token captured by its render.
 *
 * Original request (2026-07-16): "3.7 Git exposes explicit code-repository and planning-repository scopes when they differ"
 * Derived requirement (2026-07-19): Checkpoint 6.11 retires stale Git repository bindings.
 */
import type { GitRepositoryScopes, GitWorktreeSummary, RootContextState } from '@openspecui/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GitRoute } from './git'

const {
  scopesQueryMock,
  scopesSubscribeMock,
  rootContextSubscribeMock,
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
  subscriptionState,
  handlerState,
} = vi.hoisted(() => ({
  scopesQueryMock: vi.fn(),
  scopesSubscribeMock: vi.fn(),
  rootContextSubscribeMock: vi.fn(),
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
  subscriptionState: {} as {
    currentScopes?: GitRepositoryScopes
    currentRoot?: RootContextState
    scopesCallbacks?: {
      onData(data: GitRepositoryScopes): void
      onError(error: Error): void
    }
    rootCallbacks?: {
      onData(data: RootContextState): void
      onError(error: Error): void
    }
  },
  handlerState: {} as {
    removeDetached?: (worktree: GitWorktreeSummary) => Promise<void> | void
  },
}))

vi.mock('@/lib/trpc', () => ({
  trpcClient: {
    git: {
      scopes: {
        query: scopesQueryMock,
      },
      subscribeScopes: {
        subscribe: scopesSubscribeMock,
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
    rootContext: {
      subscribe: {
        subscribe: rootContextSubscribeMock,
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
  getGitEntrySharedHandoff: (
    entry: { type: string; hash?: string; title: string },
    bindingToken?: string
  ) => ({
    family: 'git',
    entityId: entry.type === 'commit' ? (entry.hash ?? 'unknown') : 'uncommitted',
    title: entry.title,
    bindingToken,
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
  WorktreeRow: ({
    worktree,
    onRemoveDetachedWorktree,
  }: {
    worktree: GitWorktreeSummary
    onRemoveDetachedWorktree?: (worktree: GitWorktreeSummary) => Promise<void> | void
  }) => {
    if (onRemoveDetachedWorktree) handlerState.removeDetached = onRemoveDetachedWorktree
    return <div>{worktree.path}</div>
  },
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

function createGitScopes(
  planningRoot = '/planning',
  planningBindingToken = 'planning-binding-a'
): GitRepositoryScopes {
  return {
    defaultScope: 'code',
    code: {
      scope: 'code',
      bindingToken: 'code-binding',
      rootPath: '/repo',
      repository: { topLevel: '/repo', commonDir: '/repo/.git' },
    },
    planningState: 'settled',
    planning: {
      scope: 'planning',
      bindingToken: planningBindingToken,
      rootPath: planningRoot,
      repository: { topLevel: planningRoot, commonDir: `${planningRoot}/.git` },
    },
  }
}

function createReadyRootState(planningRoot: string): RootContextState {
  const context = {
    launchProject: { path: '/repo' },
    planningRoot: {
      path: planningRoot,
      source: 'nearest' as const,
      healthy: true,
      status: [],
    },
    storeId: null,
    cli: { available: true, version: '1.6.0' },
    references: [],
    contextMembers: [],
    dataScope: {
      path: '/tmp/openspec-data',
      source: 'user-home-default' as const,
      environmentVariable: null,
    },
    diagnostics: { root: [], doctor: [], context: [] },
    evidence: { doctor: null, context: null },
    observedAt: 1,
  }
  return {
    state: 'ready',
    data: context,
    attempt: null,
    error: null,
    observedAt: context.observedAt,
  }
}

function createRefreshingRootState(planningRoot: string): RootContextState {
  const ready = createReadyRootState(planningRoot)
  if (ready.state !== 'ready') throw new Error('Expected a ready Root Context fixture.')
  return {
    state: 'refreshing',
    data: ready.data,
    attempt: null,
    error: null,
    observedAt: ready.observedAt + 1,
  }
}

function createErrorRootState(planningRoot: string): RootContextState {
  const ready = createReadyRootState(planningRoot)
  if (ready.state !== 'ready') throw new Error('Expected a ready Root Context fixture.')
  return {
    state: 'error',
    data: ready.data,
    attempt: ready.data,
    error: { code: 'root-unhealthy', message: 'Planning root unavailable.' },
    observedAt: ready.observedAt + 1,
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
    subscriptionState.currentScopes = createGitScopes()
    subscriptionState.currentRoot = createReadyRootState('/planning')
    subscriptionState.scopesCallbacks = undefined
    subscriptionState.rootCallbacks = undefined
    handlerState.removeDetached = undefined
    scopesQueryMock.mockResolvedValue(subscriptionState.currentScopes)
    scopesSubscribeMock.mockImplementation(
      (
        _input: undefined,
        callbacks: { onData(data: GitRepositoryScopes): void; onError(error: Error): void }
      ) => {
        subscriptionState.scopesCallbacks = callbacks
        const current = subscriptionState.currentScopes
        if (current) callbacks.onData(current)
        return { unsubscribe: vi.fn() }
      }
    )
    rootContextSubscribeMock.mockImplementation(
      (
        _input: undefined,
        callbacks: { onData(data: RootContextState): void; onError(error: Error): void }
      ) => {
        subscriptionState.rootCallbacks = callbacks
        const current = subscriptionState.currentRoot
        if (current) callbacks.onData(current)
        return { unsubscribe: vi.fn() }
      }
    )
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

    expect(overviewQueryMock).toHaveBeenCalledWith({
      scope: 'code',
      expectedBindingToken: 'code-binding',
    })
    expect(listEntriesQueryMock).toHaveBeenCalledWith({
      scope: 'code',
      expectedBindingToken: 'code-binding',
      cursor: undefined,
      limit: 50,
    })
  })

  it('loads Code status and history from the first Code-only scope emission', async () => {
    const codeOnly = createGitScopes()
    codeOnly.planningState = 'resolving'
    codeOnly.planning = null
    subscriptionState.currentScopes = codeOnly
    subscriptionState.currentRoot = createReadyRootState('/planning')
    routerLocation.searchStr = '?gitScope=planning'

    renderWithQueryClient(<GitRoute />)

    await screen.findByText('main against origin/main')
    expect(screen.getByText('Planning repository binding is resolving.')).toBeTruthy()
    expect(screen.queryByText(/not a distinct Git repository/)).toBeNull()
    expect(overviewQueryMock).toHaveBeenCalledWith({
      scope: 'code',
      expectedBindingToken: 'code-binding',
    })
    expect(listEntriesQueryMock).toHaveBeenCalledWith({
      scope: 'code',
      expectedBindingToken: 'code-binding',
      cursor: undefined,
      limit: 50,
    })
  })

  it('preserves Planning repository scope in history requests and detail navigation', async () => {
    routerLocation.searchStr = '?gitScope=planning'
    renderWithQueryClient(<GitRoute />)

    await waitFor(() => {
      expect(overviewQueryMock).toHaveBeenCalledWith({
        scope: 'planning',
        expectedBindingToken: 'planning-binding-a',
      })
    })
    expect(listEntriesQueryMock).toHaveBeenCalledWith({
      scope: 'planning',
      expectedBindingToken: 'planning-binding-a',
      cursor: undefined,
      limit: 50,
    })

    fireEvent.click(await screen.findByRole('button', { name: 'feat: add git panel' }))
    expect(navPushMock).toHaveBeenCalledWith(
      'bottom',
      '/git/commit/abc12345?gitScope=planning',
      expect.objectContaining({
        __vtHandoff: expect.objectContaining({
          bindingToken: 'planning-binding-a',
        }),
      })
    )
  })

  it('retires mounted Planning status and history while B and rebound A queries are pending', async () => {
    routerLocation.searchStr = '?gitScope=planning'
    subscriptionState.currentScopes = createGitScopes('/planning-a', 'planning-binding-a')
    subscriptionState.currentRoot = createReadyRootState('/planning-a')
    const pendingRepositoryQuery = new Promise<never>(() => {})
    overviewQueryMock.mockImplementation(
      (input: { scope: string; expectedBindingToken: string }) =>
        input.expectedBindingToken === 'planning-binding-a'
          ? Promise.resolve({
              ...overviewData,
              currentWorktree: {
                ...overviewData.currentWorktree,
                path: '/planning-a',
                branchName: 'root-a-status',
              },
            })
          : pendingRepositoryQuery
    )
    listEntriesQueryMock.mockImplementation((input: { expectedBindingToken: string }) =>
      input.expectedBindingToken === 'planning-binding-a'
        ? Promise.resolve({
            items: [
              {
                type: 'commit',
                hash: 'root-a-commit',
                title: 'Root A history',
                committedAt: 1,
                relatedChanges: [],
                diff: { files: 1, insertions: 1, deletions: 0 },
              },
            ],
            nextCursor: null,
          })
        : pendingRepositoryQuery
    )

    const { queryClient } = renderWithQueryClient(<GitRoute />)
    await screen.findByText('root-a-status against origin/main')
    expect(screen.getByText('Root A history')).toBeTruthy()

    const scopesB = createGitScopes('/planning-b', 'planning-binding-b')
    const rootB = createReadyRootState('/planning-b')
    await act(async () => {
      subscriptionState.currentScopes = scopesB
      subscriptionState.currentRoot = rootB
      const scopesCallbacks = subscriptionState.scopesCallbacks
      const rootCallbacks = subscriptionState.rootCallbacks
      if (!scopesCallbacks || !rootCallbacks) throw new Error('Git subscriptions are unavailable.')
      scopesCallbacks.onData(scopesB)
      rootCallbacks.onData(rootB)
    })

    await waitFor(() => {
      expect(screen.getByText(/Loading Git data for \/planning-b/)).toBeTruthy()
    })
    expect(screen.queryByText('root-a-status against origin/main')).toBeNull()
    expect(screen.queryByText('Root A history')).toBeNull()
    expect(
      queryClient
        .getQueryCache()
        .getAll()
        .some((query) => query.queryKey.includes('planning-binding-b'))
    ).toBe(true)

    const scopesAAgain = createGitScopes('/planning-a', 'planning-binding-a-2')
    const rootAAgain = createReadyRootState('/planning-a')
    await act(async () => {
      subscriptionState.currentScopes = scopesAAgain
      subscriptionState.currentRoot = rootAAgain
      const scopesCallbacks = subscriptionState.scopesCallbacks
      const rootCallbacks = subscriptionState.rootCallbacks
      if (!scopesCallbacks || !rootCallbacks) throw new Error('Git subscriptions are unavailable.')
      scopesCallbacks.onData(scopesAAgain)
      rootCallbacks.onData(rootAAgain)
    })

    await waitFor(() => {
      expect(screen.getByText(/Loading Git data for \/planning-a/)).toBeTruthy()
    })
    expect(screen.queryByText('root-a-status against origin/main')).toBeNull()
    expect(screen.queryByText('Root A history')).toBeNull()
    expect(
      queryClient
        .getQueryCache()
        .getAll()
        .some((query) => query.queryKey.includes('planning-binding-a-2'))
    ).toBe(true)
  })

  it('retires stale Planning data when the scope subscription fails and keeps Code usable', async () => {
    routerLocation.searchStr = '?gitScope=planning'
    subscriptionState.currentScopes = createGitScopes('/planning-a', 'planning-binding-a')
    subscriptionState.currentRoot = createReadyRootState('/planning-a')
    overviewQueryMock.mockImplementation((input: { expectedBindingToken: string }) =>
      Promise.resolve(
        input.expectedBindingToken === 'planning-binding-a'
          ? {
              ...overviewData,
              currentWorktree: {
                ...overviewData.currentWorktree,
                path: '/planning-a',
                branchName: 'root-a-status',
              },
            }
          : overviewData
      )
    )
    listEntriesQueryMock.mockImplementation((input: { expectedBindingToken: string }) =>
      Promise.resolve(
        input.expectedBindingToken === 'planning-binding-a'
          ? {
              items: [
                {
                  type: 'commit',
                  hash: 'root-a-commit',
                  title: 'Root A history',
                  committedAt: 1,
                  relatedChanges: [],
                  diff: { files: 1, insertions: 1, deletions: 0 },
                },
              ],
              nextCursor: null,
            }
          : {
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
            }
      )
    )

    renderWithQueryClient(<GitRoute />)
    await screen.findByText('root-a-status against origin/main')

    await act(async () => {
      const scopesCallbacks = subscriptionState.scopesCallbacks
      if (!scopesCallbacks) throw new Error('Git scope subscription is unavailable.')
      scopesCallbacks.onError(new Error('scope stream unavailable'))
    })

    await screen.findByText('Git repository scope projection failed: scope stream unavailable')
    await screen.findByText('main against origin/main')
    expect(screen.queryByText('root-a-status against origin/main')).toBeNull()
    expect(screen.queryByText('Root A history')).toBeNull()
    expect(overviewQueryMock).toHaveBeenLastCalledWith({
      scope: 'code',
      expectedBindingToken: 'code-binding',
    })
    expect(
      (screen.getByRole('button', { name: 'Planning repository' }) as HTMLButtonElement).disabled
    ).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'feat: add git panel' }))
    expect(navPushMock).toHaveBeenCalledWith(
      'bottom',
      '/git/commit/abc12345?gitScope=planning',
      expect.anything()
    )
  })

  it.each([
    [
      'refreshing',
      createRefreshingRootState('/planning-a'),
      'Planning repository is locked while Root Context refreshes.',
    ],
    [
      'failed',
      createErrorRootState('/planning-a'),
      'Planning Root Context failed: Planning root unavailable.',
    ],
    [
      'mismatched',
      createReadyRootState('/planning-b'),
      'Planning repository binding is waiting for the current Root Context.',
    ],
  ])(
    'locks Planning for a %s Root projection while keeping Code current',
    async (_, root, message) => {
      routerLocation.searchStr = '?gitScope=planning'
      subscriptionState.currentScopes = createGitScopes('/planning-a', 'planning-binding-a')
      subscriptionState.currentRoot = root

      renderWithQueryClient(<GitRoute />)

      await screen.findByText(message)
      await screen.findByText('main against origin/main')
      expect(overviewQueryMock).toHaveBeenLastCalledWith({
        scope: 'code',
        expectedBindingToken: 'code-binding',
      })
      expect(
        (screen.getByRole('button', { name: 'Planning repository' }) as HTMLButtonElement).disabled
      ).toBe(true)
    }
  )

  it('keeps an A-captured destructive handler bound to token A after B is published', async () => {
    routerLocation.searchStr = '?gitScope=planning'
    subscriptionState.currentScopes = createGitScopes('/planning-a', 'planning-binding-a')
    subscriptionState.currentRoot = createReadyRootState('/planning-a')
    const detachedA: GitWorktreeSummary = {
      path: '/planning-a-detached',
      relativePath: '../planning-a-detached',
      pathAvailable: true,
      branchName: '(detached)',
      detached: true,
      isCurrent: false,
      ahead: 0,
      behind: 0,
      diff: { files: 0, insertions: 0, deletions: 0 },
    }
    overviewQueryMock.mockResolvedValue({
      ...overviewData,
      currentWorktree: { ...overviewData.currentWorktree, path: '/planning-a' },
      otherWorktrees: [detachedA],
    })
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderWithQueryClient(<GitRoute />)
    await screen.findByText('/planning-a-detached')
    const staleRemove = handlerState.removeDetached
    if (!staleRemove) throw new Error('Expected a captured Root A removal handler.')

    const scopesB = createGitScopes('/planning-b', 'planning-binding-b')
    const rootB = createReadyRootState('/planning-b')
    await act(async () => {
      const scopesCallbacks = subscriptionState.scopesCallbacks
      const rootCallbacks = subscriptionState.rootCallbacks
      if (!scopesCallbacks || !rootCallbacks) throw new Error('Git subscriptions are unavailable.')
      scopesCallbacks.onData(scopesB)
      rootCallbacks.onData(rootB)
    })
    await staleRemove(detachedA)

    expect(removeDetachedWorktreeMock).toHaveBeenCalledWith({
      scope: 'planning',
      expectedBindingToken: 'planning-binding-a',
      path: '/planning-a-detached',
    })
    confirmMock.mockRestore()
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
          bindingToken: 'code-binding',
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
        expectedBindingToken: 'code-binding',
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
        expectedBindingToken: 'code-binding',
        path: '/repo-detached',
      })
    })
    confirmMock.mockRestore()
  })
})
