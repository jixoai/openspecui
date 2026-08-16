/**
 * Orthogonal intents (updated 2026-08-06 Asia/Shanghai):
 * 1. Prove ChangeList click B crosses the real VTLink, detail preparation, and navigation coordinator.
 * 2. Assert one resolved Change-detail route with the exact collision-safe handoff.
 * 3. Stabilize only transport and native-transition runtime edges for an in-memory Router fixture.
 *
 * Original request (2026-07-23): "List mutations and route changes preserve physical continuity through existing motion/View Transition patterns."
 * Derived requirement (2026-08-06): full-suite scheduling must await asynchronous onResolved evidence.
 */
import type { SubscriptionState } from '@/lib/use-subscription'
import type { ChangeMeta, ChangeStatus } from '@openspecui/core'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChangeList } from './change-list'

interface ViewTransitionRunOptions {
  update: () => void
}

function createChange(id: string, name: string): ChangeMeta {
  return {
    id,
    name,
    createdAt: 1,
    updatedAt: 1,
    trackedTaskProgress: {
      tasks: [],
      total: 1,
      completed: 0,
      remaining: 1,
      phase: 'in-progress',
      source: {
        kind: 'none',
        artifactId: null,
        outputPath: null,
        filePaths: [],
      },
    },
    documentChecklistSummary: {
      groups: [],
      total: 0,
      completed: 0,
      remaining: 0,
    },
    cliTaskSummary: null,
  }
}

const useChangesSubscriptionMock = vi.hoisted(() => vi.fn())
const useOpsxStatusListSubscriptionMock = vi.hoisted(() => vi.fn())
const opsxStatusQueryMock = vi.hoisted(() => vi.fn())
const primeSubscriptionCacheMock = vi.hoisted(() => vi.fn())
const runViewTransitionMock = vi.hoisted(() =>
  vi.fn(async ({ update }: ViewTransitionRunOptions) => {
    update()
  })
)

vi.mock('@/lib/static-mode', () => ({
  isStaticMode: () => false,
}))

vi.mock('@/lib/trpc', () => ({
  trpcClient: {
    opsx: {
      status: {
        query: opsxStatusQueryMock,
      },
    },
  },
  queryClient: {
    fetchQuery: vi.fn(),
  },
}))

vi.mock('@/lib/use-subscription', () => ({
  useChangesSubscription: useChangesSubscriptionMock,
  primeSubscriptionCache: primeSubscriptionCacheMock,
  getArchiveSubscriptionCacheKey: (id: string) => `archive.subscribeOne:${id}`,
  getSpecDocumentSubscriptionCacheKey: (identity: {
    kind: 'owned' | 'referenced'
    specId: string
    storeId?: string
  }) => `spec.subscribeDocument:${identity.kind}:${identity.storeId ?? ''}:${identity.specId}`,
}))

vi.mock('@/lib/use-opsx', () => ({
  useOpsxStatusListSubscription: useOpsxStatusListSubscriptionMock,
  getOpsxStatusSubscriptionCacheKey: (input: { change?: string; schema?: string }) =>
    input.change === undefined ? undefined : `opsx.subscribeStatus:${input.change}:${input.schema}`,
}))

vi.mock('@/lib/nav-controller', () => ({
  navController: {
    getAreaForPath: () => 'main',
    getLocation: () => ({ pathname: '/changes' }),
    push: vi.fn(),
    replace: vi.fn(),
    activatePop: vi.fn(),
  },
}))

vi.mock('@/lib/view-transitions/runtime', () => ({
  runViewTransition: runViewTransitionMock,
}))

function ChangeDetailProbe() {
  return <div data-testid="change-detail-probe">Change detail</div>
}

function createNavigationFixture() {
  const rootRoute = createRootRoute({
    component: Outlet,
  })
  const changesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/changes',
    component: ChangeList,
  })
  const changeDetailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/changes/$changeId',
    component: ChangeDetailProbe,
  })

  return createRouter({
    routeTree: rootRoute.addChildren([changesRoute, changeDetailRoute]),
    history: createMemoryHistory({ initialEntries: ['/changes'] }),
  })
}

describe('ChangeList detail navigation', () => {
  const changesState: SubscriptionState<ChangeMeta[]> = {
    data: [createChange('a', 'Change A'), createChange('b', 'Change B')],
    isLoading: false,
    error: null,
  }
  const statusState: SubscriptionState<ChangeStatus[]> = {
    data: [],
    isLoading: false,
    error: null,
  }
  const preparedStatus: ChangeStatus = {
    changeName: 'b',
    schemaName: 'spec-driven',
    isPlanningComplete: false,
    applyRequires: ['tasks'],
    artifacts: [],
    provenance: { kind: 'static' },
  }

  beforeEach(() => {
    useChangesSubscriptionMock.mockImplementation(() => changesState)
    useOpsxStatusListSubscriptionMock.mockImplementation(() => statusState)
    opsxStatusQueryMock.mockResolvedValue(preparedStatus)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('prepares and resolves exactly one changes:b handoff through the real Router', async () => {
    const router = createNavigationFixture()
    await router.load()
    const resolvedDetailPaths: string[] = []
    const unsubscribe = router.subscribe('onResolved', (event) => {
      if (event.toLocation.pathname === '/changes/b') {
        resolvedDetailPaths.push(event.toLocation.pathname)
      }
    })

    render(<RouterProvider router={router} />)
    const rowB = await screen.findByRole('link', { name: /Change B/i })

    fireEvent.click(rowB)

    await waitFor(() => expect(router.state.location.pathname).toBe('/changes/b'))
    expect(screen.getByTestId('change-detail-probe')).toBeTruthy()
    expect(opsxStatusQueryMock).toHaveBeenCalledExactlyOnceWith({ change: 'b' })
    expect(primeSubscriptionCacheMock).toHaveBeenCalledWith(
      'opsx.subscribeStatus:b:undefined',
      preparedStatus
    )
    expect(runViewTransitionMock).toHaveBeenCalledOnce()
    await waitFor(() => expect(resolvedDetailPaths).toEqual(['/changes/b']))
    expect(router.state.location.state).toMatchObject({
      __vtHandoff: {
        family: 'changes',
        entityId: 'b',
        title: 'Change B',
        subtitle: 'b',
      },
    })

    unsubscribe()
  })
})
