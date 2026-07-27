/**
 * Orthogonal intents (updated 2026-07-27 Asia/Shanghai):
 * 1. Prove detail View Transition preparation primes authoritative caches.
 * 2. Prove Git preparation includes the current repository binding token.
 * 3. Prove Git handoff provenance matches both the target entity and repository binding.
 * 4. Prove late detail preparation retains the selector-exact cache consumed by the detail hook.
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
  fetchQueryCache,
  primeSubscriptionCacheMock,
  primeSubscriptionCacheStore,
} = vi.hoisted(() => ({
  isStaticModeMock: vi.fn(() => false),
  specDocumentQueryMock: vi.fn(),
  opsxStatusQueryMock: vi.fn(),
  archiveGetQueryMock: vi.fn(),
  gitEntryMetaQueryMock: vi.fn(),
  gitScopesQueryMock: vi.fn(),
  gitCodeQueryMock: vi.fn(),
  fetchQueryCache: new Map<string, unknown>(),
  fetchQueryMock: vi.fn(
    async ({
      queryKey,
      queryFn,
    }: {
      queryKey: readonly unknown[]
      queryFn: () => Promise<unknown>
    }) => {
      const value = await queryFn()
      fetchQueryCache.set(JSON.stringify(queryKey), value)
      return value
    }
  ),
  primeSubscriptionCacheStore: new Map<string, unknown>(),
  primeSubscriptionCacheMock: vi.fn((key: string, value: unknown) => {
    primeSubscriptionCacheStore.set(key, value)
  }),
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

vi.mock('@/lib/use-opsx', async () => {
  const actual = await vi.importActual<typeof import('@/lib/use-opsx')>('@/lib/use-opsx')
  return { getOpsxStatusSubscriptionCacheKey: actual.getOpsxStatusSubscriptionCacheKey }
})

vi.mock('./prepare-wait', () => ({
  waitForPrepareTask: async (task: () => Promise<void>) => ({
    status: 'ready' as const,
    value: await task(),
  }),
}))

import { getGitEntryMetaQueryKey } from '@/lib/git-panel'
import { prepareRouteDetailViewTransition } from './detail-prepare'

function createDeferred<T>() {
  let resolvePromise: ((value: T) => void) | undefined
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve
  })

  return {
    promise,
    resolve(value: T): void {
      if (!resolvePromise) {
        throw new Error('Deferred promise has not installed its resolver.')
      }
      resolvePromise(value)
    },
  }
}

describe('prepareRouteDetailViewTransition', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchQueryCache.clear()
    primeSubscriptionCacheStore.clear()
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
      'opsx.subscribeStatus:alpha-change:undefined',
      status
    )
  })

  it('keeps late A and B preparations under their exact Change cache identities', async () => {
    const changeA = createDeferred<{ changeName: string }>()
    const changeB = createDeferred<{ changeName: string }>()
    opsxStatusQueryMock.mockImplementation(({ change }: { change: string }) =>
      change === 'change-a' ? changeA.promise : changeB.promise
    )

    const pendingA = prepareRouteDetailViewTransition({
      intent: {
        area: 'main',
        kind: 'route-detail',
        direction: 'forward',
      },
      pathname: '/changes/change-a',
    })
    const pendingB = prepareRouteDetailViewTransition({
      intent: {
        area: 'main',
        kind: 'route-detail',
        direction: 'forward',
      },
      pathname: '/changes/change-b',
    })

    changeB.resolve({ changeName: 'change-b' })
    await expect(pendingB).resolves.toBe('ready')
    changeA.resolve({ changeName: 'change-a' })
    await expect(pendingA).resolves.toBe('ready')

    expect(primeSubscriptionCacheMock).toHaveBeenCalledWith(
      'opsx.subscribeStatus:change-b:undefined',
      { changeName: 'change-b' }
    )
    expect(primeSubscriptionCacheMock).toHaveBeenCalledWith(
      'opsx.subscribeStatus:change-a:undefined',
      { changeName: 'change-a' }
    )
    expect(primeSubscriptionCacheStore.get('opsx.subscribeStatus:change-b:undefined')).toEqual({
      changeName: 'change-b',
    })
    expect(primeSubscriptionCacheStore.get('opsx.subscribeStatus:change-a:undefined')).toEqual({
      changeName: 'change-a',
    })
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

  it('does not use an A handoff as provenance for a B selector under the same binding', async () => {
    await expect(
      prepareRouteDetailViewTransition({
        intent: {
          area: 'bottom',
          kind: 'route-detail',
          direction: 'forward',
        },
        pathname: '/git/commit/def67890',
        state: {
          __vtHandoff: {
            family: 'git',
            entityId: 'abc12345',
            title: 'Commit A',
            bindingToken: 'code-binding',
          },
        },
      })
    ).resolves.toBe('ready')

    expect(gitCodeQueryMock).toHaveBeenCalledOnce()
    expect(fetchQueryMock.mock.calls.map(([input]) => input?.queryKey)).not.toContainEqual([
      'git',
      'code',
      'code-binding',
      'meta',
      'commit',
      'abc12345',
    ])
    expect(gitEntryMetaQueryMock).not.toHaveBeenCalledWith({
      scope: 'code',
      expectedBindingToken: 'code-binding',
      selector: { type: 'commit', hash: 'abc12345' },
    })
  })

  it('prefetches the exact selector for a matching Git handoff', async () => {
    gitEntryMetaQueryMock.mockResolvedValue({
      type: 'commit',
      hash: 'abc12345',
      title: 'Commit A',
    })

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
            title: 'Commit A',
            bindingToken: 'code-binding',
          },
        },
      })
    ).resolves.toBe('ready')

    expect(gitEntryMetaQueryMock).toHaveBeenCalledWith({
      scope: 'code',
      expectedBindingToken: 'code-binding',
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
        queryKey: ['git', 'planning', 'planning-binding', 'meta', 'commit', 'abc12345'],
      })
    )
    expect(gitEntryMetaQueryMock).toHaveBeenCalledWith({
      scope: 'planning',
      expectedBindingToken: 'planning-binding',
      selector: { type: 'commit', hash: 'abc12345' },
    })
  })

  it('keeps late A and B Git preparations under the exact binding-aware cache keys', async () => {
    const metaA = createDeferred<{ hash: string; title: string }>()
    const metaB = createDeferred<{ hash: string; title: string }>()
    gitCodeQueryMock
      .mockResolvedValueOnce({
        scope: 'code',
        bindingToken: 'binding-a',
        rootPath: '/repo-a',
        repository: { topLevel: '/repo-a', commonDir: '/repo-a/.git' },
      })
      .mockResolvedValueOnce({
        scope: 'code',
        bindingToken: 'binding-b',
        rootPath: '/repo-b',
        repository: { topLevel: '/repo-b', commonDir: '/repo-b/.git' },
      })
    gitEntryMetaQueryMock.mockImplementation(
      ({ expectedBindingToken }: { expectedBindingToken: string }) =>
        expectedBindingToken === 'binding-a' ? metaA.promise : metaB.promise
    )

    const pendingA = prepareRouteDetailViewTransition({
      intent: {
        area: 'bottom',
        kind: 'route-detail',
        direction: 'forward',
      },
      pathname: '/git/commit/abc12345',
    })
    const pendingB = prepareRouteDetailViewTransition({
      intent: {
        area: 'bottom',
        kind: 'route-detail',
        direction: 'forward',
      },
      pathname: '/git/commit/abc12345',
    })

    await Promise.resolve()
    await Promise.resolve()
    metaB.resolve({ hash: 'abc12345', title: 'Commit B' })
    await expect(pendingB).resolves.toBe('ready')
    metaA.resolve({ hash: 'abc12345', title: 'Commit A' })
    await expect(pendingA).resolves.toBe('ready')

    const selector = { type: 'commit' as const, hash: 'abc12345' }
    const bindingAKey = getGitEntryMetaQueryKey('code', 'binding-a', selector)
    const bindingBKey = getGitEntryMetaQueryKey('code', 'binding-b', selector)
    expect(fetchQueryCache.get(JSON.stringify(bindingBKey))).toEqual({
      hash: 'abc12345',
      title: 'Commit B',
    })
    expect(fetchQueryCache.get(JSON.stringify(bindingAKey))).toEqual({
      hash: 'abc12345',
      title: 'Commit A',
    })
    expect(fetchQueryMock).toHaveBeenCalledWith(expect.objectContaining({ queryKey: bindingAKey }))
    expect(fetchQueryMock).toHaveBeenCalledWith(expect.objectContaining({ queryKey: bindingBKey }))
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
