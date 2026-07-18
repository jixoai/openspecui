/**
 * Orthogonal intents (updated 2026-07-19 Asia/Shanghai):
 * 1. Prove detail View Transition preparation primes authoritative caches.
 * 2. Prove Git preparation includes the current repository binding token.
 *
 * Original request (2026-07-16): "3.7 Git exposes explicit code-repository and planning-repository scopes when they differ"
 * Derived requirement (2026-07-19): Checkpoint 6.11 retires stale Git prefetch bindings.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  isStaticModeMock,
  specDocumentQueryMock,
  opsxStatusQueryMock,
  archiveGetQueryMock,
  gitEntryMetaQueryMock,
  gitScopesQueryMock,
  gitCodeQueryMock,
  fetchQueryMock,
  primeSubscriptionCacheMock,
} = vi.hoisted(() => ({
  isStaticModeMock: vi.fn(() => false),
  specDocumentQueryMock: vi.fn(),
  opsxStatusQueryMock: vi.fn(),
  archiveGetQueryMock: vi.fn(),
  gitEntryMetaQueryMock: vi.fn(),
  gitScopesQueryMock: vi.fn(),
  gitCodeQueryMock: vi.fn(),
  fetchQueryMock: vi.fn(async ({ queryFn }: { queryFn: () => Promise<unknown> }) => queryFn()),
  primeSubscriptionCacheMock: vi.fn(),
}))

vi.mock('@/lib/static-mode', () => ({
  isStaticMode: isStaticModeMock,
}))

vi.mock('@/lib/trpc', () => ({
  trpcClient: {
    spec: {
      document: {
        query: specDocumentQueryMock,
      },
    },
    opsx: {
      status: {
        query: opsxStatusQueryMock,
      },
    },
    archive: {
      get: {
        query: archiveGetQueryMock,
      },
    },
    git: {
      code: {
        query: gitCodeQueryMock,
      },
      scopes: {
        query: gitScopesQueryMock,
      },
      getEntryMeta: {
        query: gitEntryMetaQueryMock,
      },
    },
  },
  queryClient: {
    fetchQuery: fetchQueryMock,
  },
}))

vi.mock('@/lib/use-subscription', () => ({
  primeSubscriptionCache: primeSubscriptionCacheMock,
  getSpecDocumentSubscriptionCacheKey: (identity: {
    kind: 'owned' | 'referenced'
    specId: string
    storeId?: string
  }) =>
    `spec.subscribeDocument:${identity.kind}:${identity.storeId ? `${identity.storeId}:` : ''}${identity.specId}`,
  getArchiveSubscriptionCacheKey: (id: string) => `archive.subscribeOne:${id}`,
}))

vi.mock('@/lib/use-opsx', () => ({
  getOpsxStatusSubscriptionCacheKey: ({
    change,
    schema,
    refreshKey,
  }: {
    change?: string
    schema?: string
    refreshKey?: number
  }) => (change ? `opsx.subscribeStatus:${change}:${schema}:${refreshKey}` : undefined),
}))

vi.mock('./prepare-wait', () => ({
  waitForPrepareTask: async (task: () => Promise<void>) => ({
    status: 'ready' as const,
    value: await task(),
  }),
}))

import { prepareRouteDetailViewTransition } from './detail-prepare'

describe('prepareRouteDetailViewTransition', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isStaticModeMock.mockReturnValue(false)
    gitCodeQueryMock.mockResolvedValue({
      scope: 'code',
      bindingToken: 'code-binding',
      rootPath: '/repo',
      repository: { topLevel: '/repo', commonDir: '/repo/.git' },
    })
    gitScopesQueryMock.mockResolvedValue({
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
        bindingToken: 'planning-binding',
        rootPath: '/planning',
        repository: { topLevel: '/planning', commonDir: '/planning/.git' },
      },
    })
  })

  it('primes the spec subscription cache before a forward detail VT', async () => {
    const spec = { id: 'alpha', name: 'Alpha Spec' }
    specDocumentQueryMock.mockResolvedValue(spec)

    await expect(
      prepareRouteDetailViewTransition({
        intent: {
          area: 'main',
          kind: 'route-detail',
          direction: 'forward',
        },
        pathname: '/specs/owned/alpha',
      })
    ).resolves.toBe('ready')

    expect(specDocumentQueryMock).toHaveBeenCalledWith({ kind: 'owned', specId: 'alpha' })
    expect(primeSubscriptionCacheMock).toHaveBeenCalledWith(
      'spec.subscribeDocument:owned:alpha',
      spec
    )
  })

  it('primes a referenced duplicate under its Store-specific cache key', async () => {
    const document = { identity: { kind: 'referenced', storeId: 'platform-a', specId: 'alpha' } }
    specDocumentQueryMock.mockResolvedValue(document)

    await expect(
      prepareRouteDetailViewTransition({
        intent: {
          area: 'main',
          kind: 'route-detail',
          direction: 'forward',
        },
        pathname: '/specs/referenced/platform-a/alpha',
      })
    ).resolves.toBe('ready')

    expect(specDocumentQueryMock).toHaveBeenCalledWith({
      kind: 'referenced',
      storeId: 'platform-a',
      specId: 'alpha',
    })
    expect(primeSubscriptionCacheMock).toHaveBeenCalledWith(
      'spec.subscribeDocument:referenced:platform-a:alpha',
      document
    )
  })

  it('primes the change status subscription cache before a forward detail VT', async () => {
    const status = { changeName: 'alpha-change', artifacts: [] }
    opsxStatusQueryMock.mockResolvedValue(status)

    await expect(
      prepareRouteDetailViewTransition({
        intent: {
          area: 'main',
          kind: 'route-detail',
          direction: 'forward',
        },
        pathname: '/changes/alpha-change',
      })
    ).resolves.toBe('ready')

    expect(opsxStatusQueryMock).toHaveBeenCalledWith({ change: 'alpha-change' })
    expect(primeSubscriptionCacheMock).toHaveBeenCalledWith(
      'opsx.subscribeStatus:alpha-change:undefined:0',
      status
    )
  })

  it('warms the git shell query cache before a forward detail VT', async () => {
    gitEntryMetaQueryMock.mockResolvedValue({
      type: 'commit',
      hash: 'abc12345',
      title: 'feat: prepare vt',
    })

    await expect(
      prepareRouteDetailViewTransition({
        intent: {
          area: 'bottom',
          kind: 'route-detail',
          direction: 'forward',
        },
        pathname: '/git/commit/abc12345',
      })
    ).resolves.toBe('ready')

    expect(fetchQueryMock).toHaveBeenCalledTimes(1)
    expect(gitEntryMetaQueryMock).toHaveBeenCalledWith({
      scope: 'code',
      expectedBindingToken: 'code-binding',
      selector: { type: 'commit', hash: 'abc12345' },
    })
  })

  it('does not prefetch a Git selector when the handoff token is stale', async () => {
    await expect(
      prepareRouteDetailViewTransition({
        intent: {
          area: 'bottom',
          kind: 'route-detail',
          direction: 'forward',
        },
        pathname: '/git/commit/abc12345',
        state: {
          __vtHandoff: {
            family: 'git',
            entityId: 'abc12345',
            title: 'Root A commit',
            bindingToken: 'planning-binding-a',
          },
        },
      })
    ).resolves.toBe('ready')

    expect(gitCodeQueryMock).toHaveBeenCalledOnce()
    expect(fetchQueryMock).not.toHaveBeenCalled()
    expect(gitEntryMetaQueryMock).not.toHaveBeenCalled()
  })

  it('primes Planning repository Git detail under a scope-specific cache key', async () => {
    gitEntryMetaQueryMock.mockResolvedValue({
      type: 'commit',
      hash: 'abc12345',
      title: 'feat: prepare planning vt',
    })

    await expect(
      prepareRouteDetailViewTransition({
        intent: {
          area: 'bottom',
          kind: 'route-detail',
          direction: 'forward',
        },
        pathname: '/git/commit/abc12345',
        search: '?gitScope=planning',
      })
    ).resolves.toBe('ready')

    expect(fetchQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['git', 'planning', 'planning-binding', 'meta', 'commit', 'abc12345'],
      })
    )
    expect(gitEntryMetaQueryMock).toHaveBeenCalledWith({
      scope: 'planning',
      expectedBindingToken: 'planning-binding',
      selector: { type: 'commit', hash: 'abc12345' },
    })
  })

  it('skips preparation for backward detail transitions', async () => {
    await expect(
      prepareRouteDetailViewTransition({
        intent: {
          area: 'main',
          kind: 'route-detail',
          direction: 'backward',
        },
        pathname: '/specs/owned/alpha',
      })
    ).resolves.toBe('ready')

    expect(specDocumentQueryMock).not.toHaveBeenCalled()
    expect(primeSubscriptionCacheMock).not.toHaveBeenCalled()
  })
})
