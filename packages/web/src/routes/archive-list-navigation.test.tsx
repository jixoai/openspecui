/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Prove ArchiveList click B crosses real VTLink and detail preparation.
 * 2. Prove the navigation coordinator resolves one Archive-detail route with exact handoff identity.
 * 3. Stabilize only transport and native-transition runtime edges for a typed memory Router fixture.
 *
 * Original request (2026-07-23): "List mutations and route changes preserve physical continuity through existing motion/View Transition patterns."
 */
import type { ReactiveProjectionSubscriptionState } from '@/lib/use-subscription'
import type { ArchiveMeta, OpsxEntityDetail } from '@openspecui/core'
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
import { ArchiveList } from './archive-list'

interface ViewTransitionRunOptions {
  update: () => void
}

function createArchive(id: string, name: string): ArchiveMeta {
  return {
    id,
    name,
    createdAt: 1,
    updatedAt: 1,
    trackedTaskProgress: {
      tasks: [],
      total: 1,
      completed: 1,
      remaining: 0,
      phase: 'complete',
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
  }
}

const useArchivesSubscriptionMock = vi.hoisted(() => vi.fn())
const archiveGetQueryMock = vi.hoisted(() => vi.fn())
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
    archive: {
      get: {
        query: archiveGetQueryMock,
      },
    },
  },
  queryClient: {
    fetchQuery: vi.fn(),
  },
}))

vi.mock('@/lib/use-subscription', () => ({
  useArchivesSubscription: useArchivesSubscriptionMock,
  primeSubscriptionCache: primeSubscriptionCacheMock,
  getArchiveSubscriptionCacheKey: (id: string) => `archive.subscribeOne:${id}`,
  getSpecDocumentSubscriptionCacheKey: (identity: {
    kind: 'owned' | 'referenced'
    specId: string
    storeId?: string
  }) => `spec.subscribeDocument:${identity.kind}:${identity.storeId ?? ''}:${identity.specId}`,
}))

vi.mock('@/lib/use-opsx', () => ({
  getOpsxStatusSubscriptionCacheKey: () => undefined,
}))

vi.mock('@/lib/nav-controller', () => ({
  navController: {
    getAreaForPath: () => 'main',
    getLocation: () => ({ pathname: '/archive' }),
    push: vi.fn(),
    replace: vi.fn(),
    activatePop: vi.fn(),
  },
}))

vi.mock('@/lib/view-transitions/runtime', () => ({
  runViewTransition: runViewTransitionMock,
}))

function ArchiveDetailProbe() {
  return <div data-testid="archive-detail-probe">Archive detail</div>
}

function createNavigationFixture() {
  const rootRoute = createRootRoute({
    component: Outlet,
  })
  const archiveRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/archive',
    component: ArchiveList,
  })
  const archiveDetailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/archive/$changeId',
    component: ArchiveDetailProbe,
  })

  return createRouter({
    routeTree: rootRoute.addChildren([archiveRoute, archiveDetailRoute]),
    history: createMemoryHistory({ initialEntries: ['/archive'] }),
  })
}

describe('ArchiveList detail navigation', () => {
  const archivesState: ReactiveProjectionSubscriptionState<ArchiveMeta[]> = {
    data: [createArchive('a', 'Archive A'), createArchive('b', 'Archive B')],
    isLoading: false,
    isUpdating: false,
    error: null,
  }
  const preparedArchive: OpsxEntityDetail = {
    stage: 'archive',
    id: 'b',
    exists: true,
    schemaName: 'spec-driven',
    files: [],
    artifacts: [],
    ungroupedFiles: [],
    diagnostics: [],
  }

  beforeEach(() => {
    useArchivesSubscriptionMock.mockImplementation(() => archivesState)
    archiveGetQueryMock.mockResolvedValue(preparedArchive)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('prepares and resolves exactly one archive:b handoff through the real Router', async () => {
    const router = createNavigationFixture()
    await router.load()
    const resolvedDetailPaths: string[] = []
    const unsubscribe = router.subscribe('onResolved', (event) => {
      if (event.toLocation.pathname === '/archive/b') {
        resolvedDetailPaths.push(event.toLocation.pathname)
      }
    })

    render(<RouterProvider router={router} />)
    const rowB = await screen.findByRole('link', { name: /Archive B/i })

    fireEvent.click(rowB)

    await waitFor(() => expect(router.state.location.pathname).toBe('/archive/b'))
    expect(screen.getByTestId('archive-detail-probe')).toBeTruthy()
    expect(archiveGetQueryMock).toHaveBeenCalledExactlyOnceWith({ id: 'b' })
    expect(primeSubscriptionCacheMock).toHaveBeenCalledExactlyOnceWith(
      'archive.subscribeOne:b',
      preparedArchive
    )
    expect(runViewTransitionMock).toHaveBeenCalledOnce()
    await waitFor(() => expect(resolvedDetailPaths).toEqual(['/archive/b']))
    expect(router.state.location.state).toMatchObject({
      __vtHandoff: {
        family: 'archive',
        entityId: 'b',
        title: 'Archive B',
        subtitle: 'b',
      },
    })

    unsubscribe()
  })
})
