/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Prove Dashboard Summary is independently deliverable while Git remains slow.
 * 2. Prove a dormant regional snapshot replays as display-only before revalidation.
 * 3. Prove a changed Code Git binding cannot reuse the previous Git snapshot.
 * 4. Prove one-shot Dashboard queries retire their listener before later invalidation.
 *
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
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
  it('delivers Summary before a slow Git leaf settles', async () => {
    const runtime = createServerProjectionWorkRuntime()
    const owner = createDashboardProjectionWorkOwner(runtime)
    const slowGit = createDeferred<DashboardGitSnapshot>()
    const summaryData = createDeferred<DashboardSummaryProjection>()
    const summaries: DashboardSummaryProjection[] = []
    const gitSnapshots: DashboardGitSnapshot[] = []
    const service = createService({
      owner,
      loadSummary: () => summaryData.promise,
      loadGit: () => slowGit.promise,
    })
    const summarySubscription = service.subscribeSummary((event) => {
      if (event.type === 'snapshot') summaries.push(event.snapshot.data)
    })
    const gitSubscription = service.subscribeGit((event) => {
      if (event.type === 'snapshot') gitSnapshots.push(event.snapshot.data)
    })

    summaryData.resolve(createSummary(7))
    await vi.waitFor(() => expect(summaries).toEqual([createSummary(7)]))
    expect(gitSnapshots).toEqual([])

    slowGit.resolve(createGit('code-binding-a'))
    await vi.waitFor(() => expect(gitSnapshots).toEqual([createGit('code-binding-a')]))

    summarySubscription.unsubscribe()
    gitSubscription.unsubscribe()
    service.dispose()
    runtime.clear()
  })

  it('replays a dormant Summary snapshot as display-only before revalidation', async () => {
    const runtime = createServerProjectionWorkRuntime()
    const owner = createDashboardProjectionWorkOwner(runtime)
    const loadSummary = vi.fn(async () => createSummary(3))
    const service = createService({ owner, loadSummary })

    await service.getSummary()
    const replayed: Array<{ data: DashboardSummaryProjection; freshness: string }> = []
    const subscription = service.subscribeSummary((event) => {
      if (event.type === 'snapshot') {
        replayed.push({ data: event.snapshot.data, freshness: event.snapshot.freshness })
      }
    })

    expect(replayed).toContainEqual({ data: createSummary(3), freshness: 'stale-display-only' })
    await vi.waitFor(() => expect(loadSummary).toHaveBeenCalledTimes(2))

    subscription.unsubscribe()
    service.dispose()
    runtime.clear()
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
