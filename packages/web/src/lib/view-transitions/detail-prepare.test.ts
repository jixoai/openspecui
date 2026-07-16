import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  isStaticModeMock,
  specDocumentQueryMock,
  opsxStatusQueryMock,
  archiveGetQueryMock,
  gitEntryMetaQueryMock,
  fetchQueryMock,
  primeSubscriptionCacheMock,
} = vi.hoisted(() => ({
  isStaticModeMock: vi.fn(() => false),
  specDocumentQueryMock: vi.fn(),
  opsxStatusQueryMock: vi.fn(),
  archiveGetQueryMock: vi.fn(),
  gitEntryMetaQueryMock: vi.fn(),
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
      selector: { type: 'commit', hash: 'abc12345' },
    })
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
        queryKey: ['git', 'planning', 'meta', 'commit', 'abc12345'],
      })
    )
    expect(gitEntryMetaQueryMock).toHaveBeenCalledWith({
      scope: 'planning',
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
