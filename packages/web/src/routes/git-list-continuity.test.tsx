/**
 * Orthogonal intents (updated 2026-07-26 Asia/Shanghai):
 * 1. Prove Git entry rows preserve entity identity across same-binding order mutations.
 * 2. Prove a binding rotation retires an earlier local transition before it can restore old rows.
 * 3. Prove local native-transition fallback commits the current entries without fake state.
 * 4. Prove StrictMode and native-startup failure preserve current entry truth.
 * 5. Exercise the real GitRoute + real GitEntryRow; stabilize only transport and native edges.
 *
 * Original request (2026-07-23): "List mutations and route changes preserve physical continuity through existing motion/View Transition patterns."
 * Original request (2026-07-26): "展开全面的接口升级和内核升级和测试升级。"
 * Owner correction (2026-07-31): Git refresh uses readonly query transport.
 */
import type { DashboardGitEntry, GitRepositoryScopes, RootContextState } from '@openspecui/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createRootProjectionFixture,
  createRootProjectionNoticeFixture,
  type RootProjectionFixtureCallbacks,
} from '../test-fixtures/root-context-projection'
import { GitRoute } from './git'

const {
  scopesQueryMock,
  scopesSubscribeMock,
  rootContextReadProjectionMock,
  rootContextSubscribeProjectionMock,
  overviewQueryMock,
  listEntriesQueryMock,
  staticModeMock,
  routerLocation,
  subscriptionState,
} = vi.hoisted(() => ({
  scopesQueryMock: vi.fn(),
  scopesSubscribeMock: vi.fn(),
  rootContextReadProjectionMock: vi.fn(),
  rootContextSubscribeProjectionMock: vi.fn(),
  overviewQueryMock: vi.fn(),
  listEntriesQueryMock: vi.fn(),
  staticModeMock: vi.fn(() => false),
  routerLocation: {
    pathname: '/git',
    searchStr: '',
    hash: '',
    state: null,
  },
  subscriptionState: {} as {
    currentScopes?: GitRepositoryScopes
    currentRoot?: RootContextState
    scopesCallbacks?: {
      onData(data: GitRepositoryScopes): void
      onError(error: Error): void
      onConnectionStateChange(state: {
        state: 'idle' | 'connecting' | 'pending'
        error: Error | null
      }): void
      onStopped(): void
      onComplete(): void
    }
    rootCallbacks?: RootProjectionFixtureCallbacks
  },
}))

vi.mock('@/lib/trpc', () => ({
  trpcClient: {
    git: {
      scopes: { query: scopesQueryMock },
      subscribeScopes: { subscribe: scopesSubscribeMock },
      overview: { query: overviewQueryMock },
      listEntries: { query: listEntriesQueryMock },
      switchWorktree: { mutate: vi.fn() },
      refresh: { query: vi.fn() },
      removeDetachedWorktree: { mutate: vi.fn() },
    },
    rootContext: {
      readProjection: { query: rootContextReadProjectionMock },
      subscribeProjection: { subscribe: rootContextSubscribeProjectionMock },
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
  navigateToServerHandoff: vi.fn(),
}))

vi.mock('@/lib/nav-controller', () => ({
  navController: {
    push: vi.fn(),
    replace: vi.fn(),
    getAreaForPath: () => 'bottom',
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
    </select>
  ),
}))

interface TestViewTransition {
  finished: Promise<void>
}

type TestViewTransitionDocument = Document & {
  activeViewTransition?: TestViewTransition | null
  startViewTransition?: (update: () => void) => TestViewTransition
}

function viewTransitionDocument(): TestViewTransitionDocument {
  return document as TestViewTransitionDocument
}

function installNativeTransition(onStart: (update: () => void) => TestViewTransition) {
  const startViewTransition = vi.fn(onStart)
  Object.defineProperty(document, 'startViewTransition', {
    configurable: true,
    value: startViewTransition,
  })
  return startViewTransition
}

function createCommit(
  hash: string,
  title: string,
  relatedChanges: string[] = []
): DashboardGitEntry {
  return {
    type: 'commit',
    hash,
    title,
    committedAt: 1,
    relatedChanges,
    diff: { files: 1, insertions: 3, deletions: 1 },
  }
}

function createUncommitted(title: string, updatedAt: number | null = 1): DashboardGitEntry {
  return {
    type: 'uncommitted',
    title,
    updatedAt,
    relatedChanges: [],
    diff: { files: 0, insertions: 0, deletions: 0 },
  }
}

const ENTRIES_QUERY_KEY = ['git', 'code', 'code-binding', 'entries'] as const

function setEntries(queryClient: QueryClient, items: DashboardGitEntry[]) {
  queryClient.setQueryData(ENTRIES_QUERY_KEY, {
    pages: [{ items, nextCursor: null }],
    pageParams: [undefined],
  })
}

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

function createGitScopes(planningBindingToken = 'planning-binding-a'): GitRepositoryScopes {
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
      rootPath: '/planning',
      repository: { topLevel: '/planning', commonDir: '/planning/.git' },
    },
  }
}

function createReadyRootState(): RootContextState {
  const context = {
    launchProject: { path: '/repo' },
    planningRoot: {
      path: '/planning',
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

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
}

function renderGitRoute(initialEntries: DashboardGitEntry[], wrapStrict = false) {
  const queryClient = createQueryClient()
  setEntries(queryClient, initialEntries)
  const tree = (
    <QueryClientProvider client={queryClient}>
      <GitRoute />
    </QueryClientProvider>
  )
  const result = render(wrapStrict ? <StrictMode>{tree}</StrictMode> : tree)
  return { queryClient, ...result }
}

describe('GitRoute entry-list reactive continuity', () => {
  beforeEach(() => {
    staticModeMock.mockReturnValue(false)
    routerLocation.pathname = '/git'
    routerLocation.searchStr = ''
    routerLocation.state = null
    subscriptionState.currentScopes = createGitScopes()
    subscriptionState.currentRoot = createReadyRootState()
    subscriptionState.scopesCallbacks = undefined
    subscriptionState.rootCallbacks = undefined
    scopesQueryMock.mockResolvedValue(subscriptionState.currentScopes)
    scopesSubscribeMock.mockImplementation(
      (
        _input: undefined,
        callbacks: {
          onData(data: GitRepositoryScopes): void
          onError(error: Error): void
          onConnectionStateChange(state: {
            state: 'idle' | 'connecting' | 'pending'
            error: Error | null
          }): void
          onStopped(): void
          onComplete(): void
        }
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
    overviewQueryMock.mockResolvedValue(overviewData)
    // listEntries must be served from the QueryClient cache so setQueryData is the single
    // source of truth for continuity snapshots; a live call would reject.
    listEntriesQueryMock.mockRejectedValue(
      new Error('listEntries should be served from the QueryClient cache in continuity tests.')
    )
    Reflect.deleteProperty(document, 'startViewTransition')
    Reflect.deleteProperty(document, 'activeViewTransition')
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    Reflect.deleteProperty(document, 'startViewTransition')
    Reflect.deleteProperty(document, 'activeViewTransition')
  })

  it('renders current entries immediately without a list transition on initial mount', async () => {
    renderGitRoute([
      createCommit('aaaa1111aaaa', 'feat: one'),
      createCommit('bbbb2222bbbb', 'feat: two'),
    ])
    await waitFor(() => expect(screen.getByText('Commits')).toBeTruthy())

    expect(screen.getByRole('button', { name: /feat: one/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /feat: two/i })).toBeTruthy()
    // Initial mount never invokes a native transition.
    expect(viewTransitionDocument().startViewTransition).toBeUndefined()
  })

  it('keeps surviving commit row identity while [A, B] -> [B] waits for the local transition', async () => {
    let commitTransition: (() => void) | null = null
    const finished = { resolve: null as (() => void) | null }
    const startViewTransition = installNativeTransition((update) => {
      commitTransition = update
      return {
        finished: new Promise<void>((resolve) => {
          finished.resolve = resolve
        }),
      }
    })
    const { queryClient, rerender } = renderGitRoute([
      createCommit('aaaa1111aaaa', 'feat: A'),
      createCommit('bbbb2222bbbb', 'feat: B'),
    ])
    await waitFor(() => expect(screen.getByText('Commits')).toBeTruthy())
    const rowB = screen.getByRole('button', { name: /feat: B/i })

    setEntries(queryClient, [createCommit('bbbb2222bbbb', 'feat: B')])
    const tree: ReactNode = (
      <QueryClientProvider client={queryClient}>
        <GitRoute />
      </QueryClientProvider>
    )
    rerender(tree)

    await waitFor(() => expect(startViewTransition).toHaveBeenCalledTimes(1))
    // B keeps its DOM node while the transition is pending; A still visible (stale display).
    expect(screen.getByRole('button', { name: /feat: B/i })).toBe(rowB)
    expect(screen.getByRole('button', { name: /feat: A/i })).toBeTruthy()

    if (commitTransition === null) {
      throw new Error('The Git entry transition did not expose its production update callback.')
    }
    act(() => commitTransition?.())

    expect(screen.getByRole('button', { name: /feat: B/i })).toBe(rowB)
    expect(screen.queryByRole('button', { name: /feat: A/i })).toBeNull()
    finished.resolve?.()
  })

  it('updates metadata without a transition and keeps uncommitted DOM identity across updatedAt', async () => {
    const startViewTransition = installNativeTransition((update) => {
      update()
      return { finished: Promise.resolve() }
    })
    const { queryClient, rerender } = renderGitRoute([
      createCommit('aaaa1111aaaa', 'feat: A'),
      createUncommitted('Working', 100),
    ])
    await waitFor(() => expect(screen.getByText('Commits')).toBeTruthy())
    const uncommittedRow = screen.getByRole('button', { name: /Working/i })

    // Same entity order, only metadata (title + updatedAt) changes -> no new transition.
    setEntries(queryClient, [
      createCommit('aaaa1111aaaa', 'feat: A renamed'),
      createUncommitted('Working renamed', 200),
    ])
    const tree: ReactNode = (
      <QueryClientProvider client={queryClient}>
        <GitRoute />
      </QueryClientProvider>
    )
    rerender(tree)

    await waitFor(() => expect(screen.getByText('feat: A renamed')).toBeTruthy())
    expect(startViewTransition).toHaveBeenCalledTimes(0)
    // Uncommitted keeps DOM identity even though its updatedAt metadata changed.
    expect(screen.getByRole('button', { name: /Working renamed/i })).toBe(uncommittedRow)
  })

  it('retires a late same-binding transition when a newer entry snapshot has committed', async () => {
    let commitObsolete: (() => void) | null = null
    const finished = { resolve: null as (() => void) | null }
    const transition: TestViewTransition = {
      finished: new Promise<void>((resolve) => {
        finished.resolve = resolve
      }),
    }
    const startViewTransition = installNativeTransition((update) => {
      commitObsolete = update
      viewTransitionDocument().activeViewTransition = transition
      return transition
    })
    const { queryClient, rerender } = renderGitRoute(
      [createCommit('aaaa1111aaaa', 'feat: A'), createCommit('bbbb2222bbbb', 'feat: B')],
      true
    )
    await waitFor(() => expect(screen.getByText('Commits')).toBeTruthy())

    // Same-binding snapshot A -> B (removal of A).
    setEntries(queryClient, [createCommit('bbbb2222bbbb', 'feat: B')])
    let tree: ReactNode = (
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <GitRoute />
        </QueryClientProvider>
      </StrictMode>
    )
    rerender(tree)
    await waitFor(() => expect(startViewTransition).toHaveBeenCalledTimes(1))

    // Newer current snapshot C commits immediately.
    setEntries(queryClient, [createCommit('cccc3333cccc', 'feat: C')])
    tree = (
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <GitRoute />
        </QueryClientProvider>
      </StrictMode>
    )
    rerender(tree)
    await waitFor(() => expect(screen.getByRole('button', { name: /feat: C/i })).toBeTruthy())

    if (commitObsolete === null) {
      throw new Error('The obsolete Git transition did not expose its production update callback.')
    }
    act(() => commitObsolete?.())

    // Late B callback cannot restore obsolete entries or displace C.
    expect(screen.getByRole('button', { name: /feat: C/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /feat: A/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /feat: B/i })).toBeNull()
    viewTransitionDocument().activeViewTransition = null
    finished.resolve?.()
  })

  it('retires a pending same-binding transition immediately when the binding rotates to planning', async () => {
    let commitCode: (() => void) | null = null
    const transition: TestViewTransition = { finished: new Promise(() => {}) }
    const startViewTransition = installNativeTransition((update) => {
      commitCode = update
      viewTransitionDocument().activeViewTransition = transition
      return transition
    })
    const { queryClient, rerender } = renderGitRoute(
      [createCommit('aaaa1111aaaa', 'feat: A'), createCommit('bbbb2222bbbb', 'feat: B')],
      true
    )
    await waitFor(() => expect(screen.getByText('Commits')).toBeTruthy())

    // Same-binding removal pending.
    setEntries(queryClient, [createCommit('bbbb2222bbbb', 'feat: B')])
    let tree: ReactNode = (
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <GitRoute />
        </QueryClientProvider>
      </StrictMode>
    )
    rerender(tree)
    await waitFor(() => expect(startViewTransition).toHaveBeenCalledTimes(1))

    // Rotate binding to planning via URL state. The planning entry cache is keyed by planning
    // scope+token and is seeded empty; the route renders the new binding immediately.
    routerLocation.searchStr = 'gitScope=planning'
    const PLANNING_ENTRIES_KEY = ['git', 'planning', 'planning-binding-a', 'entries'] as const
    queryClient.setQueryData(PLANNING_ENTRIES_KEY, {
      pages: [{ items: [createCommit('dddd4444dddd', 'plan: X')], nextCursor: null }],
      pageParams: [undefined],
    })
    tree = (
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <GitRoute />
        </QueryClientProvider>
      </StrictMode>
    )
    rerender(tree)
    await waitFor(() => expect(screen.getByRole('button', { name: /plan: X/i })).toBeTruthy())

    // The binding rotation commits immediately: no new native transition is started (the only
    // call is the prior same-binding removal). A rotation that instead ran the same-binding
    // path would call startViewTransition a second time.
    expect(startViewTransition).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: /feat: A/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /feat: B/i })).toBeNull()

    // Late Code transition callback cannot restore Code rows into the planning list.
    if (commitCode === null) {
      throw new Error('The pending Code transition did not expose its production update callback.')
    }
    act(() => commitCode?.())

    expect(screen.getByRole('button', { name: /plan: X/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /feat: A/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /feat: B/i })).toBeNull()
    viewTransitionDocument().activeViewTransition = null
  })

  it('keeps planning continuity for same-binding mutations after a Code -> Planning rotation', async () => {
    let commitPlanning: (() => void) | null = null
    const finished = { resolve: null as (() => void) | null }
    // Rotation itself must NOT start a native transition; only the same-binding planning
    // mutation that follows may. We capture the second call's update callback.
    const startViewTransition = installNativeTransition((update) => {
      commitPlanning = update
      return {
        finished: new Promise<void>((resolve) => {
          finished.resolve = resolve
        }),
      }
    })
    const PLANNING_ENTRIES_KEY = ['git', 'planning', 'planning-binding-a', 'entries'] as const
    const { queryClient, rerender } = renderGitRoute(
      [createCommit('aaaa1111aaaa', 'feat: A'), createCommit('bbbb2222bbbb', 'feat: B')],
      true
    )
    await waitFor(() => expect(screen.getByText('Commits')).toBeTruthy())

    // Rotate to planning and seed two planning commits.
    routerLocation.searchStr = 'gitScope=planning'
    queryClient.setQueryData(PLANNING_ENTRIES_KEY, {
      pages: [
        {
          items: [createCommit('dddd4444dddd', 'plan: X'), createCommit('eeee5555eeee', 'plan: Y')],
          nextCursor: null,
        },
      ],
      pageParams: [undefined],
    })
    let tree: ReactNode = (
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <GitRoute />
        </QueryClientProvider>
      </StrictMode>
    )
    rerender(tree)
    await waitFor(() => expect(screen.getByRole('button', { name: /plan: Y/i })).toBeTruthy())
    const rowY = screen.getByRole('button', { name: /plan: Y/i })
    // The rotation committed immediately without a native transition.
    expect(startViewTransition).toHaveBeenCalledTimes(0)

    // Same-binding planning mutation: remove plan: X. Continuity must keep plan: Y's DOM node
    // while the transition is pending. This requires committedBindingRef to have advanced to
    // planning during the rotation; otherwise bindingChanged stays true and continuity is bypassed.
    queryClient.setQueryData(PLANNING_ENTRIES_KEY, {
      pages: [{ items: [createCommit('eeee5555eeee', 'plan: Y')], nextCursor: null }],
      pageParams: [undefined],
    })
    tree = (
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <GitRoute />
        </QueryClientProvider>
      </StrictMode>
    )
    rerender(tree)
    await waitFor(() => expect(startViewTransition).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('button', { name: /plan: Y/i })).toBe(rowY)
    expect(screen.getByRole('button', { name: /plan: X/i })).toBeTruthy()

    if (commitPlanning === null) {
      throw new Error('The planning mutation did not expose its production update callback.')
    }
    act(() => commitPlanning?.())

    expect(screen.getByRole('button', { name: /plan: Y/i })).toBe(rowY)
    expect(screen.queryByRole('button', { name: /plan: X/i })).toBeNull()
    finished.resolve?.()
  })

  it('commits the current entries immediately when native View Transitions are unavailable', async () => {
    const { queryClient, rerender } = renderGitRoute([
      createCommit('aaaa1111aaaa', 'feat: A'),
      createCommit('bbbb2222bbbb', 'feat: B'),
    ])
    await waitFor(() => expect(screen.getByText('Commits')).toBeTruthy())
    const rowB = screen.getByRole('button', { name: /feat: B/i })

    // No startViewTransition installed: fallback commits immediately.
    setEntries(queryClient, [createCommit('bbbb2222bbbb', 'feat: B')])
    const tree: ReactNode = (
      <QueryClientProvider client={queryClient}>
        <GitRoute />
      </QueryClientProvider>
    )
    rerender(tree)

    await waitFor(() => expect(screen.queryByRole('button', { name: /feat: A/i })).toBeNull())
    expect(screen.getByRole('button', { name: /feat: B/i })).toBe(rowB)
  })

  it('commits the current entries immediately when native View Transition startup throws', async () => {
    const startViewTransition = installNativeTransition(() => {
      throw new Error('native transition rejected')
    })
    const { queryClient, rerender } = renderGitRoute([
      createCommit('aaaa1111aaaa', 'feat: A'),
      createCommit('bbbb2222bbbb', 'feat: B'),
    ])
    await waitFor(() => expect(screen.getByText('Commits')).toBeTruthy())
    const rowB = screen.getByRole('button', { name: /feat: B/i })

    setEntries(queryClient, [createCommit('bbbb2222bbbb', 'feat: B')])
    const tree: ReactNode = (
      <QueryClientProvider client={queryClient}>
        <GitRoute />
      </QueryClientProvider>
    )
    rerender(tree)

    await waitFor(() => expect(screen.queryByRole('button', { name: /feat: A/i })).toBeNull())
    expect(startViewTransition).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: /feat: B/i })).toBe(rowB)
  })
})
