/**
 * Orthogonal intents (updated 2026-07-26 Asia/Shanghai):
 * 1. Prove scoped Git detail rendering, back navigation, and document flow.
 * 2. Prove mounted binding replacement retires stale detail, files, and patch content.
 * 3. Prove Git loading handoffs match both repository binding and target entity.
 * 4. Prove cached Git detail stays locked until a replacement scope emits.
 *
 * Original request (2026-07-16): "3.7 Git exposes explicit code-repository and planning-repository scopes when they differ"
 * Derived requirement (2026-07-19): Checkpoint 6.11 retires stale Git repository bindings.
 * Original request (2026-07-26): "展开全面的接口升级和内核升级和测试升级。"
 */
import type {
  GitRepositoryScopeDescriptor,
  GitRepositoryScopes,
  RootContextState,
} from '@openspecui/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createRootProjectionFixture,
  createRootProjectionNoticeFixture,
  type RootProjectionFixtureCallbacks,
} from '../test-fixtures/root-context-projection'
import { GitCommitViewRoute, GitUncommittedViewRoute } from './git-view'

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false
type Expect<Value extends true> = Value
type ResolvingPlanningIsNull = Expect<
  Equal<Extract<GitRepositoryScopes, { planningState: 'resolving' }>['planning'], null>
>
type SettledPlanningAllowsDescriptor = Expect<
  Equal<
    Extract<GitRepositoryScopes, { planningState: 'settled' }>['planning'],
    (GitRepositoryScopeDescriptor & { readonly scope: 'planning' }) | null
  >
>
const checkedScopeContract: [ResolvingPlanningIsNull, SettledPlanningAllowsDescriptor] = [
  true,
  true,
]

const {
  scopesQueryMock,
  scopesSubscribeMock,
  rootContextReadProjectionMock,
  rootContextSubscribeProjectionMock,
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
  rootContextReadProjectionMock: vi.fn(),
  rootContextSubscribeProjectionMock: vi.fn(),
  getEntryMetaQueryMock: vi.fn(),
  getEntryFilesQueryMock: vi.fn(),
  staticModeMock: vi.fn(() => false),
  useParamsMock: vi.fn(() => ({ hash: 'abc12345' })),
  routerLocation: {
    pathname: '/git/commit/abc12345',
    search: {},
    searchStr: '',
    hash: '',
    state: null as unknown,
  },
  projectDir: '/Users/kzf/Dev/GitHub/jixoai-labs/agenter',
  subscriptionState: {} as {
    currentScopes?: GitRepositoryScopes
    currentRoot?: RootContextState
    scopesCallbacks?: {
      onData(data: GitRepositoryScopes): void
      onError(error: Error): void
    }
    rootCallbacks?: RootProjectionFixtureCallbacks
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
      readProjection: {
        query: rootContextReadProjectionMock,
      },
      subscribeProjection: {
        subscribe: rootContextSubscribeProjectionMock,
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
    rootContextReadProjectionMock.mockImplementation(async () => {
      const current = subscriptionState.currentRoot
      if (!current) throw new Error('Missing Root Context fixture state.')
      return createRootProjectionFixture(current)
    })
    rootContextSubscribeProjectionMock.mockImplementation(
      (_input: undefined, callbacks: RootProjectionFixtureCallbacks) => {
        subscriptionState.rootCallbacks = callbacks
        const current = subscriptionState.currentRoot
        if (current) callbacks.onData(createRootProjectionNoticeFixture(current))
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

  it('keeps the resolving scope contract explicit in the checked fixture', () => {
    expect(checkedScopeContract).toEqual([true, true])
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

  it('renders current-binding handoff title and subtitle while A detail is loading', async () => {
    routerLocation.searchStr = '?gitScope=planning'
    routerLocation.state = {
      __vtHandoff: {
        family: 'git',
        entityId: 'abc12345',
        bindingToken: 'planning-binding-a',
        title: 'Root A handoff title',
        subtitle: 'Root A handoff subtitle',
      },
    }
    const pendingDetail = new Promise<never>(() => {})
    getEntryMetaQueryMock.mockReturnValue(pendingDetail)
    getEntryFilesQueryMock.mockReturnValue(pendingDetail)

    renderWithQueryClient(<GitCommitViewRoute />)

    expect(await screen.findByText('Root A handoff title')).toBeTruthy()
    expect(screen.getByText('Root A handoff subtitle')).toBeTruthy()
    expect(screen.queryByText(/Loading Git detail for/)).toBeNull()
  })

  it('does not render an A handoff for a B selector under the same binding', async () => {
    routerLocation.searchStr = '?gitScope=planning'
    routerLocation.pathname = '/git/commit/def67890'
    useParamsMock.mockReturnValue({ hash: 'def67890' })
    routerLocation.state = {
      __vtHandoff: {
        family: 'git',
        entityId: 'abc12345',
        bindingToken: 'planning-binding-a',
        title: 'Commit A handoff title',
        subtitle: 'Commit A handoff subtitle',
      },
    }
    const pendingDetail = new Promise<never>(() => {})
    getEntryMetaQueryMock.mockReturnValue(pendingDetail)
    getEntryFilesQueryMock.mockReturnValue(pendingDetail)

    renderWithQueryClient(<GitCommitViewRoute />)

    expect(await screen.findByTestId('git-detail-loading')).toBeTruthy()
    expect(screen.queryByText('Commit A handoff title')).toBeNull()
    expect(screen.queryByText('Commit A handoff subtitle')).toBeNull()
    await waitFor(() => {
      expect(getEntryMetaQueryMock).toHaveBeenCalledWith({
        scope: 'planning',
        expectedBindingToken: 'planning-binding-a',
        selector: { type: 'commit', hash: 'def67890' },
      })
    })
  })

  it('does not render an A handoff after B becomes current before detail mount', async () => {
    routerLocation.searchStr = '?gitScope=planning'
    routerLocation.state = {
      __vtHandoff: {
        family: 'git',
        entityId: 'abc12345',
        bindingToken: 'planning-binding-a',
        title: 'Root A handoff title',
        subtitle: 'Root A handoff subtitle',
      },
    }
    subscriptionState.currentScopes = createGitScopes('/tmp/planning-b', 'planning-binding-b')
    subscriptionState.currentRoot = createReadyRootState('/tmp/planning-b')
    const pendingDetail = new Promise<never>(() => {})
    getEntryMetaQueryMock.mockReturnValue(pendingDetail)
    getEntryFilesQueryMock.mockReturnValue(pendingDetail)

    renderWithQueryClient(<GitCommitViewRoute />)

    expect(await screen.findByTestId('git-detail-loading')).toBeTruthy()
    expect(screen.queryByText('Root A handoff title')).toBeNull()
    expect(screen.queryByText('Root A handoff subtitle')).toBeNull()
  })

  it('locks cached A detail during scope reconnect, then loads B after emission', async () => {
    routerLocation.searchStr = '?gitScope=planning'
    routerLocation.state = {
      __vtHandoff: {
        family: 'git',
        entityId: 'abc12345',
        bindingToken: 'planning-binding-a',
        title: 'Root A handoff title',
        subtitle: 'Root A handoff subtitle',
      },
    }
    const scopeA = createGitScopes('/tmp/planning-a', 'planning-binding-a')
    subscriptionState.currentScopes = scopeA
    subscriptionState.currentRoot = createReadyRootState('/tmp/planning-a')
    getEntryMetaQueryMock.mockImplementation((input: { expectedBindingToken: string }) =>
      Promise.resolve({
        type: 'commit' as const,
        hash: 'abc12345',
        title:
          input.expectedBindingToken === 'planning-binding-b' ? 'Root B detail' : 'Root A detail',
        committedAt: 1,
        relatedChanges: [],
        diff: { files: 1, insertions: 1, deletions: 0 },
      })
    )
    getEntryFilesQueryMock.mockImplementation((input: { expectedBindingToken: string }) =>
      Promise.resolve({
        files: [],
        eagerFiles: [
          {
            patch:
              input.expectedBindingToken === 'planning-binding-b' ? 'Root B patch' : 'Root A patch',
          },
        ],
        eagerPatchLineBudget: 1000,
        eagerPatchLineCount: 1,
      })
    )

    const first = renderWithQueryClient(<GitCommitViewRoute />)
    await screen.findByText('Root A detail')
    first.unmount()

    const scopeB = createGitScopes('/tmp/planning-b', 'planning-binding-b')
    subscriptionState.currentScopes = scopeB
    subscriptionState.currentRoot = createReadyRootState('/tmp/planning-b')
    scopesSubscribeMock.mockImplementationOnce((_input, callbacks) => {
      subscriptionState.scopesCallbacks = callbacks
      return { unsubscribe: vi.fn() }
    })
    const metaCallsBeforeReconnect = getEntryMetaQueryMock.mock.calls.length
    const fileCallsBeforeReconnect = getEntryFilesQueryMock.mock.calls.length

    const second = renderWithQueryClient(<GitCommitViewRoute />)
    await waitFor(() =>
      expect({
        loading: screen.queryByTestId('git-detail-loading') !== null,
        metaCalls: getEntryMetaQueryMock.mock.calls.slice(metaCallsBeforeReconnect),
        fileCalls: getEntryFilesQueryMock.mock.calls.slice(fileCallsBeforeReconnect),
        staleHandoff: screen.queryByText('Root A handoff title') !== null,
      }).toEqual({
        loading: true,
        metaCalls: [],
        fileCalls: [],
        staleHandoff: false,
      })
    )

    await act(async () => {
      const callbacks = subscriptionState.scopesCallbacks
      if (!callbacks) throw new Error('Git scope reconnect callback is unavailable.')
      callbacks.onData(scopeB)
    })

    await screen.findByText('Root B detail')
    expect(getEntryMetaQueryMock).toHaveBeenCalledWith({
      scope: 'planning',
      expectedBindingToken: 'planning-binding-b',
      selector: { type: 'commit', hash: 'abc12345' },
    })
    expect(getEntryFilesQueryMock).toHaveBeenCalledWith({
      scope: 'planning',
      expectedBindingToken: 'planning-binding-b',
      selector: { type: 'commit', hash: 'abc12345' },
    })
    expect(screen.getByTestId('git-entry-detail-panel').textContent).toContain('Root B patch')
    expect(screen.queryByText('Root A handoff title')).toBeNull()
    second.unmount()
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
      rootCallbacks.onData(createRootProjectionNoticeFixture(rootB))
    })

    await waitFor(() => {
      expect(screen.getByTestId('git-detail-loading')).toBeTruthy()
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
