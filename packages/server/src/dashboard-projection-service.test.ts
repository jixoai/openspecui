/**
 * Orthogonal intents (updated 2026-07-27 Asia/Shanghai):
 * 1. Prove Dashboard Summary emits a data-free v2 wake while Git remains slow.
 * 2. Prove the typed Summary pull retains opaque identity and exposes dormant retained state immediately.
 * 3. Prove a changed Code Git binding cannot reuse the previous Git snapshot.
 * 4. Prove one-shot Dashboard queries retire their listener before later invalidation.
 * 5. Prove Summary v2 emits exactly one data-free wake for each work generation.
 *
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 * Original request (2026-07-23): "在已有content的时候，服务端推送变更，然后客户端收到推送通知，于是开始加载更新数据。"
 * Original request (2026-07-27): "Dashboard页面每次页面刷新的时候，它仍然要加载很多？"
 */
import type {
  DashboardGitSnapshot,
  DashboardSummaryProjection,
  DashboardTrendsProjection,
} from '@openspecui/core'
import { describe, expect, it, vi } from 'vitest'
import {
  DashboardProjectionService,
  createDashboardProjectionWorkOwner,
} from './dashboard-projection-service.js'
import type { ProjectionWorkIdentity } from './projection-work/index.js'
import { createServerProjectionWorkRuntime } from './projection-work/runtime.js'

interface Deferred<T> {
  promise: Promise<T>
  resolve(value: T): void
  reject(reason: unknown): void
}

function createDeferred<T>(): Deferred<T> {
  let resolvePromise: ((value: T) => void) | undefined
  let rejectPromise: ((reason: unknown) => void) | undefined
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })
  if (!resolvePromise || !rejectPromise) {
    throw new Error('Deferred promise resolver was not initialized.')
  }
  return { promise, resolve: resolvePromise, reject: rejectPromise }
}

function createSummary(specifications: number): DashboardSummaryProjection {
  return {
    summary: {
      specifications,
      requirements: 0,
      activeChanges: 0,
      inProgressChanges: 0,
      completedChanges: 0,
      archivedTasksCompleted: 0,
      tasksTotal: 0,
      tasksCompleted: 0,
      taskCompletionPercent: null,
    },
    specifications: [],
    activeChanges: [],
    trackedTaskPhaseCounts: { 'no-tasks': 0, 'in-progress': 0, complete: 0 },
    recentArchives: [],
  }
}

function createTrends(): DashboardTrendsProjection {
  return {
    trends: {
      specifications: [],
      requirements: [],
      activeChanges: [],
      inProgressChanges: [],
      completedChanges: [],
      taskCompletionPercent: [],
    },
    triColorTrends: {
      specifications: [],
      requirements: [],
      activeChanges: [],
      inProgressChanges: [],
      completedChanges: [],
      taskCompletionPercent: [],
    },
    trendKinds: {
      specifications: 'monotonic',
      requirements: 'monotonic',
      activeChanges: 'bidirectional',
      inProgressChanges: 'bidirectional',
      completedChanges: 'monotonic',
      taskCompletionPercent: 'bidirectional',
    },
    cardAvailability: {
      specifications: { state: 'ok' },
      requirements: { state: 'ok' },
      activeChanges: { state: 'invalid', reason: 'objective-history-unavailable' },
      inProgressChanges: { state: 'invalid', reason: 'objective-history-unavailable' },
      completedChanges: { state: 'ok' },
      taskCompletionPercent: { state: 'invalid', reason: 'semantic-uncomputable' },
    },
    trendMeta: { pointLimit: 20, lastUpdatedAt: 1 },
  }
}

function createGit(bindingToken: string): DashboardGitSnapshot {
  return { bindingToken, defaultBranch: 'main', worktrees: [] }
}

function createSummaryIdentity(): ProjectionWorkIdentity {
  return {
    projectionKind: 'dashboard-summary',
    planningRoot: { identity: '/planning-root', source: 'nearest', storeSelector: null },
    owner: { generation: 'planning-generation-a', gitBindingToken: null },
    selector: 'dashboard:summary',
    inputFingerprint: 'reactive-filesystem:v1',
    protocolVersion: 1,
  }
}

function createService(options: {
  owner: ReturnType<typeof createDashboardProjectionWorkOwner>
  gitBindingToken?: string
  loadSummary?: () => Promise<DashboardSummaryProjection>
  loadTrends?: () => Promise<DashboardTrendsProjection>
  loadGit?: () => Promise<DashboardGitSnapshot>
}) {
  return new DashboardProjectionService({
    workOwner: options.owner,
    root: {
      path: '/planning-root',
      source: 'nearest',
      storeSelector: null,
      generation: 'planning-generation-a',
    },
    codeGitBindingToken: options.gitBindingToken ?? 'code-binding-a',
    loaders: {
      loadSummary: options.loadSummary ?? (async () => createSummary(1)),
      loadTrends: options.loadTrends ?? (async () => createTrends()),
      loadGit:
        options.loadGit ?? (async () => createGit(options.gitBindingToken ?? 'code-binding-a')),
    },
  })
}

describe('DashboardProjectionService', () => {
  it('emits a data-free Summary wake before a slow Git leaf settles', async () => {
    const runtime = createServerProjectionWorkRuntime()
    const owner = createDashboardProjectionWorkOwner(runtime)
    const slowGit = createDeferred<DashboardGitSnapshot>()
    const summaryData = createDeferred<DashboardSummaryProjection>()
    const summaryInvalidations: unknown[] = []
    const gitSnapshots: DashboardGitSnapshot[] = []
    const service = createService({
      owner,
      loadSummary: () => summaryData.promise,
      loadGit: () => slowGit.promise,
    })
    const summarySubscription = service.subscribeSummaryInvalidation((event) =>
      summaryInvalidations.push(event)
    )
    const gitSubscription = service.subscribeGit((event) => {
      if (event.type === 'snapshot') gitSnapshots.push(event.snapshot.data)
    })

    await vi.waitFor(() => expect(summaryInvalidations).toHaveLength(1))
    expect(summaryInvalidations[0]).toEqual({
      identity: expect.stringMatching(/^dashboard-summary-v2:/),
      workGeneration: 1,
      snapshotGeneration: null,
      state: 'loading',
      cause: 'initial',
    })
    expect(summaryInvalidations[0]).not.toHaveProperty('data')
    summaryData.resolve(createSummary(7))
    await vi.waitFor(() => expect(summaryInvalidations).toHaveLength(2))
    expect(gitSnapshots).toEqual([])

    slowGit.resolve(createGit('code-binding-a'))
    await vi.waitFor(() => expect(gitSnapshots).toEqual([createGit('code-binding-a')]))

    summarySubscription.unsubscribe()
    gitSubscription.unsubscribe()
    service.dispose()
    runtime.clear()
  })

  it('emits one initial wake from a current Summary cache hit', async () => {
    const runtime = createServerProjectionWorkRuntime()
    const owner = createDashboardProjectionWorkOwner(runtime)
    const loadSummary = vi.fn(async () => createSummary(8))
    const service = createService({ owner, loadSummary })

    const firstSubscription = service.subscribeSummaryInvalidation(() => {})
    await vi.waitFor(() => expect(loadSummary).toHaveBeenCalledOnce())
    const invalidations: unknown[] = []
    const subscription = service.subscribeSummaryInvalidation((event) => invalidations.push(event))

    await vi.waitFor(() => expect(invalidations).toHaveLength(1))
    expect(invalidations[0]).toMatchObject({
      cause: 'initial',
      state: 'ready',
      workGeneration: 1,
      snapshotGeneration: 1,
    })
    expect(loadSummary).toHaveBeenCalledOnce()

    subscription.unsubscribe()
    firstSubscription.unsubscribe()
    service.dispose()
    runtime.clear()
  })

  it('emits one new server-push wake only when Summary recomputes', async () => {
    const runtime = createServerProjectionWorkRuntime()
    const owner = createDashboardProjectionWorkOwner(runtime)
    const loadSummary = vi.fn(async () => createSummary(9))
    const service = createService({ owner, loadSummary })
    const invalidations: Array<{ cause: string; workGeneration: number }> = []
    const subscription = service.subscribeSummaryInvalidation((event) => invalidations.push(event))

    await vi.waitFor(() => expect(invalidations).toHaveLength(2))
    owner.summary.invalidate(createSummaryIdentity())
    await vi.waitFor(() => expect(invalidations).toHaveLength(4))
    expect(invalidations[0]).toMatchObject({
      cause: 'initial',
      state: 'loading',
      workGeneration: 1,
    })
    expect(invalidations[1]).toMatchObject({
      cause: 'initial',
      state: 'ready',
      workGeneration: 1,
    })
    expect(invalidations[2]).toMatchObject({
      cause: 'server-push',
      state: 'revalidating',
      workGeneration: 2,
    })
    expect(invalidations[3]).toMatchObject({
      cause: 'server-push',
      state: 'ready',
      workGeneration: 2,
    })

    subscription.unsubscribe()
    service.dispose()
    runtime.clear()
  })

  it('returns an opaque current Summary read through the same work owner', async () => {
    const runtime = createServerProjectionWorkRuntime()
    const owner = createDashboardProjectionWorkOwner(runtime)
    const loadSummary = vi.fn(async () => createSummary(3))
    const service = createService({ owner, loadSummary })

    const read = await service.getSummary()

    expect(read).toMatchObject({
      state: 'ready',
      identity: expect.stringMatching(/^dashboard-summary-v2:/),
      workGeneration: 1,
      snapshotGeneration: 1,
      freshness: 'current',
      data: createSummary(3),
    })
    expect(read.identity).not.toContain('/planning-root')
    expect(loadSummary).toHaveBeenCalledOnce()
    service.dispose()
    runtime.clear()
  })

  it('returns a dormant retained Summary before its replacement Work settles', async () => {
    const runtime = createServerProjectionWorkRuntime()
    const owner = createDashboardProjectionWorkOwner(runtime)
    const replacement = createDeferred<DashboardSummaryProjection>()
    const loadSummary = vi
      .fn<() => Promise<DashboardSummaryProjection>>()
      .mockResolvedValueOnce(createSummary(3))
      .mockReturnValueOnce(replacement.promise)
    const service = createService({ owner, loadSummary })
    const initialSubscription = service.subscribeSummaryInvalidation(() => {})

    try {
      const initial = await service.getSummary()
      expect(initial).toMatchObject({ freshness: 'current', data: createSummary(3) })
      initialSubscription.unsubscribe()

      const replacementSubscription = service.subscribeSummaryInvalidation(() => {})
      await vi.waitFor(() => expect(loadSummary).toHaveBeenCalledTimes(2))
      const outcome = await Promise.race([
        service.getSummary().then((read) => ({ kind: 'read' as const, read })),
        new Promise<{ kind: 'timeout' }>((resolvePromise) => {
          setTimeout(() => resolvePromise({ kind: 'timeout' }), 50)
        }),
      ])

      expect(outcome).toMatchObject({
        kind: 'read',
        read: {
          freshness: 'stale-display-only',
          data: createSummary(3),
        },
      })
      replacementSubscription.unsubscribe()
    } finally {
      replacement.resolve(createSummary(4))
      service.dispose()
      runtime.clear()
    }
  })

  it('retires a one-shot Summary query before later invalidation', async () => {
    const runtime = createServerProjectionWorkRuntime()
    const owner = createDashboardProjectionWorkOwner(runtime)
    const loadSummary = vi.fn(async () => createSummary(4))
    const service = createService({ owner, loadSummary })

    await service.getSummary()
    owner.summary.invalidate(createSummaryIdentity())
    await new Promise<void>((resolvePromise) => setTimeout(resolvePromise, 20))

    expect(loadSummary).toHaveBeenCalledOnce()

    service.dispose()
    runtime.clear()
  })

  it('does not reuse Git A after the Code binding changes to B', async () => {
    const runtime = createServerProjectionWorkRuntime()
    const owner = createDashboardProjectionWorkOwner(runtime)
    const loadGitA = vi.fn(async () => createGit('code-binding-a'))
    const loadGitB = vi.fn(async () => createGit('code-binding-b'))
    const serviceA = createService({ owner, gitBindingToken: 'code-binding-a', loadGit: loadGitA })
    const serviceB = createService({ owner, gitBindingToken: 'code-binding-b', loadGit: loadGitB })

    await serviceA.getGit()
    const gitB = await serviceB.getGit()

    expect(gitB.bindingToken).toBe('code-binding-b')
    expect(loadGitA).toHaveBeenCalledOnce()
    expect(loadGitB).toHaveBeenCalledOnce()

    serviceA.dispose()
    serviceB.dispose()
    runtime.clear()
  })
})
