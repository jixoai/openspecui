/**
 * Orthogonal intents (updated 2026-07-19 Asia/Shanghai):
 * 1. Prove scoped Git detail rendering, back navigation, and document flow.
 * 2. Prove mounted binding replacement retires stale detail, files, and patch content.
 *
 * Original request (2026-07-16): "3.7 Git exposes explicit code-repository and planning-repository scopes when they differ"
 * Derived requirement (2026-07-19): Checkpoint 6.11 retires stale Git repository bindings.
 */
import type { GitRepositoryScopes, RootContextState } from '@openspecui/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GitCommitViewRoute, GitUncommittedViewRoute } from './git-view'

const {
  scopesQueryMock,
  scopesSubscribeMock,
  rootContextSubscribeMock,
  getEntryMetaQueryMock,
  getEntryFilesQueryMock,
  staticModeMock,
  useParamsMock,
  routerLocation,
  projectDir,
  subscriptionState,
} = vi.hoisted(() => ({
  scopesQueryMock: vi.fn(),
  scopesSubscribeMock: vi.fn(),
  rootContextSubscribeMock: vi.fn(),
  getEntryMetaQueryMock: vi.fn(),
  getEntryFilesQueryMock: vi.fn(),
  staticModeMock: vi.fn(() => false),
  useParamsMock: vi.fn(() => ({ hash: 'abc12345' })),
  routerLocation: {
    pathname: '/git/commit/abc12345',
    search: {},
    searchStr: '',
    hash: '',
    state: null,
  },
  projectDir: '/Users/kzf/Dev/GitHub/jixoai-labs/agenter',
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
      getEntryMeta: {
        query: getEntryMetaQueryMock,
      },
      getEntryFiles: {
        query: getEntryFilesQueryMock,
      },
    },
    rootContext: {
      subscribe: {
        subscribe: rootContextSubscribeMock,
      },
    },
  },
}))

vi.mock('@/lib/static-mode', () => ({
  isStaticMode: staticModeMock,
  getBasePath: () => '/',
}))

vi.mock('@/components/git/git-panel-detail', () => ({
  GitEntryDetailPanel: ({
    selector,
    projectDir,
    repositoryScope,
    entry,
    eagerFiles,
  }: {
    selector: { type: string; hash?: string }
    projectDir?: string | null
    repositoryScope?: string
    entry?: { title?: string } | null
    eagerFiles?: Array<{ patch?: string | null }>
  }) => (
    <div data-testid="git-entry-detail-panel">
      {selector.type}
      {selector.hash ? `:${selector.hash}` : ''}
      {projectDir ? `:${projectDir}` : ''}
      {repositoryScope ? `:${repositoryScope}` : ''}
      {entry?.title ? `:${entry.title}` : ''}
      {eagerFiles?.map((file) => file.patch).join(':')}
    </div>
  ),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    ...props
  }: {
    to: string
    children: ReactNode
    [key: string]: unknown
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useLocation: () => routerLocation,
  useNavigate: () => vi.fn(),
  useParams: () => useParamsMock(),
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
  planningRoot = '/tmp/planning',
  planningBindingToken = 'planning-binding-a'
): GitRepositoryScopes {
  return {
    defaultScope: 'code',
    code: {
      scope: 'code',
      bindingToken: 'code-binding',
      rootPath: projectDir,
      repository: { topLevel: projectDir, commonDir: `${projectDir}/.git` },
    },
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
    launchProject: { path: projectDir },
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

describe('Git entry routes', () => {
  beforeEach(() => {
    staticModeMock.mockReturnValue(false)
    useParamsMock.mockReturnValue({ hash: 'abc12345' })
    routerLocation.pathname = '/git/commit/abc12345'
    routerLocation.searchStr = ''
    routerLocation.state = null
    subscriptionState.currentScopes = createGitScopes()
    subscriptionState.currentRoot = createReadyRootState('/tmp/planning')
    subscriptionState.scopesCallbacks = undefined
    subscriptionState.rootCallbacks = undefined
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
    getEntryMetaQueryMock.mockResolvedValue({
      type: 'commit',
      hash: 'abc12345',
      title: 'feat: add git panel',
      committedAt: 1,
      relatedChanges: ['add-git-panel-worktree-handoff'],
      diff: { files: 1, insertions: 3, deletions: 1 },
    })
    getEntryFilesQueryMock.mockResolvedValue({
      files: [],
      eagerFiles: [],
      eagerPatchLineBudget: 1000,
      eagerPatchLineCount: 0,
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders a back button to commits on the commit detail page', async () => {
    renderWithQueryClient(<GitCommitViewRoute />)

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Back to commits' }).getAttribute('href')).toBe(
        '/git'
      )
    })

    expect(screen.getByTestId('git-entry-detail-panel').textContent).toContain(
      `commit:abc12345:${projectDir}:code`
    )
    expect(getEntryMetaQueryMock).toHaveBeenCalledWith({
      scope: 'code',
      expectedBindingToken: 'code-binding',
      selector: { type: 'commit', hash: 'abc12345' },
    })
  })

  it('keeps the commit title and subtitle fully wrappable instead of truncating them', async () => {
    getEntryMetaQueryMock.mockResolvedValue({
      type: 'commit',
      hash: 'abc12345',
      title: 'docs(spec): archive chat layout and history pagination follow-up summary',
      committedAt: 1,
      relatedChanges: ['compact-chat-density-and-layout-rubric'],
      diff: { files: 41, insertions: 196, deletions: 18 },
    })

    renderWithQueryClient(<GitCommitViewRoute />)

    await waitFor(() => {
      const heading = screen.getByRole('heading', {
        name: /docs\(spec\): archive chat layout and history pagination follow-up summary/i,
      })
      const headingText = heading.querySelector('span')
      expect(headingText?.className).not.toContain('truncate')
      expect(screen.getByText(/abc12345 · linked openspec changes:/i).className).not.toContain(
        'truncate'
      )
    })
  })

  it('renders the uncommitted detail route with the uncommitted selector', async () => {
    getEntryMetaQueryMock.mockResolvedValue({
      type: 'uncommitted',
      title: 'working tree',
      updatedAt: 1,
      relatedChanges: [],
      diff: { files: 1, insertions: 3, deletions: 1 },
    })

    renderWithQueryClient(<GitUncommittedViewRoute />)

    await waitFor(() => {
      expect(screen.getByTestId('git-entry-detail-panel').textContent).toContain(
        `uncommitted:${projectDir}:code`
      )
    })
  })

  it('keeps git detail content in document flow so the shell can scroll long diffs', async () => {
    renderWithQueryClient(<GitCommitViewRoute />)

    await waitFor(() => {
      const detailContainer = screen
        .getByTestId('git-entry-detail-panel')
        .closest('.vt-detail-content')
      expect(detailContainer).toBeTruthy()
      expect(detailContainer?.className).not.toContain('flex-1')
      expect(detailContainer?.className).not.toContain('min-h-0')
    })
  })

  it('preserves Planning repository scope across queries and the back link', async () => {
    routerLocation.searchStr = '?gitScope=planning'
    renderWithQueryClient(<GitCommitViewRoute />)

    await waitFor(() => {
      expect(getEntryMetaQueryMock).toHaveBeenCalledWith({
        scope: 'planning',
        expectedBindingToken: 'planning-binding-a',
        selector: { type: 'commit', hash: 'abc12345' },
      })
    })
    expect(getEntryFilesQueryMock).toHaveBeenCalledWith({
      scope: 'planning',
      expectedBindingToken: 'planning-binding-a',
      selector: { type: 'commit', hash: 'abc12345' },
    })
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Back to commits' }).getAttribute('href')).toBe(
        '/git?gitScope=planning'
      )
      expect(screen.getByTestId('git-entry-detail-panel').textContent).toContain(
        'commit:abc12345:/tmp/planning:planning'
      )
    })
  })

  it('keeps the requested Planning URL while a mismatched Root uses Code data', async () => {
    routerLocation.searchStr = '?gitScope=planning'
    subscriptionState.currentScopes = createGitScopes('/tmp/planning-a', 'planning-binding-a')
    subscriptionState.currentRoot = createReadyRootState('/tmp/planning-b')

    renderWithQueryClient(<GitCommitViewRoute />)

    await waitFor(() => {
      expect(getEntryMetaQueryMock).toHaveBeenCalledWith({
        scope: 'code',
        expectedBindingToken: 'code-binding',
        selector: { type: 'commit', hash: 'abc12345' },
      })
    })
    await screen.findByTestId('git-entry-detail-panel')
    expect(screen.getByRole('link', { name: 'Back to commits' }).getAttribute('href')).toBe(
      '/git?gitScope=planning'
    )
    expect(screen.getByTestId('git-entry-detail-panel').textContent).toContain(
      `commit:abc12345:${projectDir}:code`
    )
  })

  it('retires mounted A detail and patch content while B detail requests are pending', async () => {
    routerLocation.searchStr = '?gitScope=planning'
    subscriptionState.currentScopes = createGitScopes('/tmp/planning-a', 'planning-binding-a')
    subscriptionState.currentRoot = createReadyRootState('/tmp/planning-a')
    const pendingB = new Promise<never>(() => {})
    getEntryMetaQueryMock.mockImplementation((input: { expectedBindingToken: string }) =>
      input.expectedBindingToken === 'planning-binding-a'
        ? Promise.resolve({
            type: 'commit',
            hash: 'abc12345',
            title: 'Root A detail',
            committedAt: 1,
            relatedChanges: [],
            diff: { files: 1, insertions: 1, deletions: 0 },
          })
        : pendingB
    )
    getEntryFilesQueryMock.mockImplementation((input: { expectedBindingToken: string }) =>
      input.expectedBindingToken === 'planning-binding-a'
        ? Promise.resolve({
            files: [],
            eagerFiles: [{ patch: 'Root A patch' }],
            eagerPatchLineBudget: 1000,
            eagerPatchLineCount: 1,
          })
        : pendingB
    )

    const { queryClient } = renderWithQueryClient(<GitCommitViewRoute />)
    await waitFor(() => {
      expect(screen.getByTestId('git-entry-detail-panel').textContent).toContain('Root A detail')
      expect(screen.getByTestId('git-entry-detail-panel').textContent).toContain('Root A patch')
    })

    const scopesB = createGitScopes('/tmp/planning-b', 'planning-binding-b')
    const rootB = createReadyRootState('/tmp/planning-b')
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
      expect(screen.getByText(/Loading Git detail for \/tmp\/planning-b/)).toBeTruthy()
    })
    expect(screen.queryByText(/Root A detail/)).toBeNull()
    expect(screen.queryByText(/Root A patch/)).toBeNull()
    const bKeys = queryClient
      .getQueryCache()
      .getAll()
      .map((query) => query.queryKey)
      .filter((key) => key.includes('planning-binding-b'))
    expect(bKeys.some((key) => key.includes('meta'))).toBe(true)
    expect(bKeys.some((key) => key.includes('files'))).toBe(true)
  })
})
