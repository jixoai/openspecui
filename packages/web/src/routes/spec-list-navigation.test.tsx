/**
 * Orthogonal intents (updated 2026-07-25 Asia/Shanghai):
 * 1. Prove Owned SpecList rows cross real VTLink, detail preparation, and the Router.
 * 2. Prove Referenced rows preserve Store-qualified route, query, cache, and handoff identity.
 * 3. Stabilize only transport and native-transition runtime edges for a typed memory Router fixture.
 *
 * Original request (2026-07-23): "List mutations and route changes preserve physical continuity through existing motion/View Transition patterns."
 */
import type { SubscriptionState } from '@/lib/use-subscription'
import type {
  OwnedSpecDocumentProjection,
  ReferencedSpecDocumentProjection,
  SpecCatalog,
  SpecCatalogEntry,
  SpecCatalogReferenceSource,
  SpecDocumentProjection,
  SpecIdentity,
} from '@openspecui/core/spec-catalog'
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
import { SpecList } from './spec-list'

interface ViewTransitionRunOptions {
  update: () => void
}

function createOwned(specId: string, name: string): SpecCatalogEntry {
  return {
    identity: { kind: 'owned', specId },
    source: 'owned',
    readOnly: false,
    name,
    summary: null,
    updatedAt: 1,
  }
}

function createReferenced(storeId: string, specId: string, name: string): SpecCatalogEntry {
  return {
    identity: { kind: 'referenced', storeId, specId },
    source: 'referenced',
    readOnly: true,
    name,
    summary: null,
    requirementCount: 1,
    updatedAt: 0,
  }
}

function createReferenceSource(storeId: string): SpecCatalogReferenceSource {
  return {
    storeId,
    provenance: 'live',
    state: 'ready',
    diagnostics: [],
    evidence: {
      success: true,
      stdout: '{}',
      stderr: '',
      exitCode: 0,
      diagnostics: [],
    },
  }
}

function createCatalog(entries: SpecCatalogEntry[], stores: string[] = []): SpecCatalog {
  return {
    entries,
    referenceSources: stores.map(createReferenceSource),
    referenceProjection: { provenance: 'live' },
    observedAt: 1,
  }
}

const useSpecsSubscriptionMock = vi.hoisted(() => vi.fn())
const specDocumentQueryMock = vi.hoisted(() => vi.fn())
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
    spec: {
      document: {
        query: specDocumentQueryMock,
      },
    },
  },
  queryClient: {
    fetchQuery: vi.fn(),
  },
}))

vi.mock('@/lib/use-subscription', () => ({
  useSpecsSubscription: useSpecsSubscriptionMock,
  primeSubscriptionCache: primeSubscriptionCacheMock,
  getArchiveSubscriptionCacheKey: (id: string) => `archive.subscribeOne:${id}`,
  getSpecDocumentSubscriptionCacheKey: (identity: SpecIdentity) =>
    identity.kind === 'owned'
      ? `spec.subscribeDocument:owned:${identity.specId}`
      : `spec.subscribeDocument:referenced:${identity.storeId}:${identity.specId}`,
}))

vi.mock('@/lib/use-opsx', () => ({
  getOpsxStatusSubscriptionCacheKey: () => undefined,
}))

vi.mock('@/lib/nav-controller', () => ({
  navController: {
    getAreaForPath: () => 'main',
    getLocation: () => ({ pathname: '/specs' }),
    push: vi.fn(),
    replace: vi.fn(),
    activatePop: vi.fn(),
  },
}))

vi.mock('@/lib/view-transitions/runtime', () => ({
  runViewTransition: runViewTransitionMock,
}))

function SpecDetailProbe() {
  return <div data-testid="spec-detail-probe">Spec detail</div>
}

function createNavigationFixture() {
  const rootRoute = createRootRoute({ component: Outlet })
  const specsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/specs',
    component: SpecList,
  })
  const ownedRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/specs/owned/$specId',
    component: SpecDetailProbe,
  })
  const referencedRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/specs/referenced/$storeId/$specId',
    component: SpecDetailProbe,
  })
  return createRouter({
    routeTree: rootRoute.addChildren([specsRoute, ownedRoute, referencedRoute]),
    history: createMemoryHistory({ initialEntries: ['/specs'] }),
  })
}

describe('SpecList detail navigation', () => {
  let catalogState: SubscriptionState<SpecCatalog>
  const ownedDocument: OwnedSpecDocumentProjection = {
    identity: { kind: 'owned', specId: 'auth' },
    source: 'owned',
    readOnly: false,
    state: 'ready',
    spec: { id: 'auth', name: 'Owned Auth', overview: '', requirements: [] },
    rawMarkdown: '# Owned Auth',
    upstream: null,
    evidence: null,
  }
  const referencedDocument: ReferencedSpecDocumentProjection = {
    identity: { kind: 'referenced', storeId: 'platform-a', specId: 'auth' },
    source: 'referenced',
    readOnly: true,
    state: 'ready',
    spec: null,
    rawMarkdown: null,
    upstream: {
      id: 'auth',
      title: 'Platform Auth',
      overview: '',
      requirementCount: 0,
      requirements: [],
      metadata: { version: '1.0.0', format: 'openspec' },
      root: { path: '/stores/platform-a', source: 'store', store_id: 'platform-a' },
    },
    provenance: { kind: 'live' },
    evidence: {
      success: true,
      stdout: '{}',
      stderr: '',
      exitCode: 0,
      diagnostics: [],
    },
  }

  beforeEach(() => {
    catalogState = {
      data: createCatalog(
        [
          createOwned('auth', 'Owned Auth'),
          createReferenced('platform-a', 'auth', 'Platform Auth'),
        ],
        ['platform-a']
      ),
      isLoading: false,
      error: null,
    }
    useSpecsSubscriptionMock.mockImplementation(() => catalogState)
    specDocumentQueryMock.mockImplementation(
      (identity: SpecIdentity): Promise<SpecDocumentProjection> =>
        Promise.resolve(identity.kind === 'owned' ? ownedDocument : referencedDocument)
    )
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('prepares and resolves exactly one owned:auth handoff through the real Router', async () => {
    const router = createNavigationFixture()
    await router.load()
    const resolvedPaths: string[] = []
    const unsubscribe = router.subscribe('onResolved', (event) => {
      if (event.toLocation.pathname === '/specs/owned/auth') {
        resolvedPaths.push(event.toLocation.pathname)
      }
    })

    render(<RouterProvider router={router} />)
    fireEvent.click(await screen.findByRole('link', { name: /Owned Auth/i }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/specs/owned/auth'))
    expect(screen.getByTestId('spec-detail-probe')).toBeTruthy()
    expect(specDocumentQueryMock).toHaveBeenCalledExactlyOnceWith({ kind: 'owned', specId: 'auth' })
    expect(primeSubscriptionCacheMock).toHaveBeenCalledExactlyOnceWith(
      'spec.subscribeDocument:owned:auth',
      ownedDocument
    )
    expect(runViewTransitionMock).toHaveBeenCalledOnce()
    expect(resolvedPaths).toEqual(['/specs/owned/auth'])
    expect(router.state.location.state).toMatchObject({
      __vtHandoff: {
        family: 'specs',
        entityId: 'owned:auth',
        title: 'Owned Auth',
        subtitle: 'auth',
      },
    })

    unsubscribe()
  })

  it('prepares and resolves exactly one referenced:platform-a:auth handoff through the real Router', async () => {
    const router = createNavigationFixture()
    await router.load()
    const resolvedPaths: string[] = []
    const unsubscribe = router.subscribe('onResolved', (event) => {
      if (event.toLocation.pathname === '/specs/referenced/platform-a/auth') {
        resolvedPaths.push(event.toLocation.pathname)
      }
    })

    render(<RouterProvider router={router} />)
    fireEvent.click(await screen.findByRole('tab', { name: 'Referenced 1' }))
    fireEvent.click(await screen.findByRole('link', { name: /Platform Auth/i }))

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/specs/referenced/platform-a/auth')
    )
    expect(screen.getByTestId('spec-detail-probe')).toBeTruthy()
    expect(specDocumentQueryMock).toHaveBeenCalledExactlyOnceWith({
      kind: 'referenced',
      storeId: 'platform-a',
      specId: 'auth',
    })
    expect(primeSubscriptionCacheMock).toHaveBeenCalledExactlyOnceWith(
      'spec.subscribeDocument:referenced:platform-a:auth',
      referencedDocument
    )
    expect(runViewTransitionMock).toHaveBeenCalledOnce()
    expect(resolvedPaths).toEqual(['/specs/referenced/platform-a/auth'])
    expect(router.state.location.state).toMatchObject({
      __vtHandoff: {
        family: 'specs',
        entityId: 'referenced:platform-a:auth',
        title: 'Platform Auth',
        subtitle: 'platform-a / auth',
      },
    })

    unsubscribe()
  })
})
