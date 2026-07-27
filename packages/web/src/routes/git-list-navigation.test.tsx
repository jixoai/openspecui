/**
 * Orthogonal intents (updated 2026-07-26 Asia/Shanghai):
 * 1. Prove a Code commit row crosses the real GitRoute.onSelect into vtNavController.push.
 * 2. Prove a Planning commit row preserves ?gitScope=planning and the planning binding token.
 * 3. Stabilize only transport and the outer navigation edge; keep real GitEntryRow + GitRoute.
 *
 * Original request (2026-07-23): "List mutations and route changes preserve physical continuity through existing motion/View Transition patterns."
 * Original request (2026-07-26): "展开全面的接口升级和内核升级和测试升级。"
 */
import type { DashboardGitEntry, GitRepositoryScopes, RootContextState } from '@openspecui/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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
  vtPushMock,
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
  vtPushMock: vi.fn(
    async (
      _area: string,
      _href: string,
      _state?: { __vtHandoff?: Record<string, unknown> },
      _options?: { sharedElements?: Record<string, unknown>; source?: unknown }
    ) => {}
  ),
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
      refresh: { mutate: vi.fn() },
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

// vtNavController.push is the production navigation owner invoked by GitRoute.onSelect.
vi.mock('@/lib/view-transitions/navigation', () => ({
  vtNavController: {
    push: vtPushMock,
    replace: vi.fn(),
    activateBottom: vi.fn(),
    deactivateBottom: vi.fn(),
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

function createCommit(hash: string, title: string): DashboardGitEntry {
  return {
    type: 'commit',
    hash,
    title,
    committedAt: 1,
    relatedChanges: [],
    diff: { files: 1, insertions: 3, deletions: 1 },
  }
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

function createGitScopes(): GitRepositoryScopes {
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
      bindingToken: 'planning-binding-a',
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

function setEntries(queryClient: QueryClient, key: readonly unknown[], items: DashboardGitEntry[]) {
  queryClient.setQueryData(key, {
    pages: [{ items, nextCursor: null }],
    pageParams: [undefined],
  })
}

describe('GitRoute entry detail navigation', () => {
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
    listEntriesQueryMock.mockRejectedValue(
      new Error('listEntries should be served from the QueryClient cache in navigation tests.')
    )
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('pushes one Code commit handoff through the real GitEntryRow -> GitRoute.onSelect', async () => {
    const queryClient = createQueryClient()
    const CODE_KEY = ['git', 'code', 'code-binding', 'entries'] as const
    setEntries(queryClient, CODE_KEY, [createCommit('abc12345dead', 'feat: add git panel')])
    render(
      <QueryClientProvider client={queryClient}>
        <GitRoute />
      </QueryClientProvider>
    )

    fireEvent.click(await screen.findByRole('button', { name: /feat: add git panel/i }))

    expect(vtPushMock).toHaveBeenCalledTimes(1)
    const [area, href, state, options] = vtPushMock.mock.calls[0]
    expect(area).toBe('bottom')
    expect(href).toBe('/git/commit/abc12345dead')
    expect(state?.__vtHandoff).toMatchObject({
      family: 'git',
      entityId: 'abc12345dead',
      title: 'feat: add git panel',
      bindingToken: 'code-binding',
    })
    expect(options?.sharedElements).toMatchObject({ family: 'git', entityId: 'abc12345dead' })
  })

  it('preserves ?gitScope=planning and the planning binding token on a Planning commit click', async () => {
    routerLocation.searchStr = 'gitScope=planning'
    const queryClient = createQueryClient()
    const PLANNING_KEY = ['git', 'planning', 'planning-binding-a', 'entries'] as const
    setEntries(queryClient, PLANNING_KEY, [createCommit('plancode99ff', 'plan: converge root')])
    render(
      <QueryClientProvider client={queryClient}>
        <GitRoute />
      </QueryClientProvider>
    )

    fireEvent.click(await screen.findByRole('button', { name: /plan: converge root/i }))

    expect(vtPushMock).toHaveBeenCalledTimes(1)
    const [area, href, state, options] = vtPushMock.mock.calls[0]
    expect(area).toBe('bottom')
    // Planning scope is preserved in the href.
    expect(href).toBe('/git/commit/plancode99ff?gitScope=planning')
    expect(state?.__vtHandoff).toMatchObject({
      family: 'git',
      entityId: 'plancode99ff',
      title: 'plan: converge root',
      bindingToken: 'planning-binding-a',
    })
    expect(options?.sharedElements).toMatchObject({ family: 'git', entityId: 'plancode99ff' })
  })
})
