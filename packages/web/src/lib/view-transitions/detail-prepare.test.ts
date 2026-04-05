import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  isStaticModeMock,
  specGetQueryMock,
  opsxStatusQueryMock,
  archiveGetQueryMock,
  gitEntryMetaQueryMock,
  fetchQueryMock,
  primeSubscriptionCacheMock,
} = vi.hoisted(() => ({
  isStaticModeMock: vi.fn(() => false),
  specGetQueryMock: vi.fn(),
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
      get: {
        query: specGetQueryMock,
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
  getSpecSubscriptionCacheKey: (id: string) => `spec.subscribeOne:${id}`,
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
    specGetQueryMock.mockResolvedValue(spec)

    await expect(
      prepareRouteDetailViewTransition({
        intent: {
          area: 'main',
          kind: 'route-detail',
          direction: 'forward',
        },
        pathname: '/specs/alpha',
      })
    ).resolves.toBe('ready')

    expect(specGetQueryMock).toHaveBeenCalledWith({ id: 'alpha' })
    expect(primeSubscriptionCacheMock).toHaveBeenCalledWith('spec.subscribeOne:alpha', spec)
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
        pathname: '/specs/alpha',
      })
    ).resolves.toBe('ready')

    expect(specGetQueryMock).not.toHaveBeenCalled()
    expect(primeSubscriptionCacheMock).not.toHaveBeenCalled()
  })
})
