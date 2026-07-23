/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Own Dashboard Summary, trends, and Code Git regional Projection Work requests.
 * 2. Bind every regional snapshot to Planning-root and Code Git provenance before reuse.
 * 3. Retain reusable display snapshots without allowing a retired root service to keep subscribers alive.
 * 4. Keep explicit Git invalidation separate from broad Dashboard aggregate reloads.
 *
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 */
import type {
  DashboardGitSnapshot,
  DashboardSummaryProjection,
  DashboardTrendsProjection,
} from '@openspecui/core'
import { Buffer } from 'node:buffer'
import {
  ProjectionWorkRegistry,
  type ProjectionWorkEvent,
  type ProjectionWorkIdentity,
  type ProjectionWorkRequest,
  type ProjectionWorkRuntime,
  type ProjectionWorkSubscription,
} from './projection-work/index.js'

type DashboardProjectionKind = 'summary' | 'trends' | 'git'

/** Complete current Root and Code provenance required to build Dashboard work identities. */
export interface DashboardProjectionRoot {
  path: string
  source: string
  storeSelector: string | null
  generation: string
}

/** Concrete loaders stay injectable so the production owner has controlled slow-leaf evidence. */
export interface DashboardProjectionLoaders {
  loadSummary(): Promise<DashboardSummaryProjection>
  loadTrends(): Promise<DashboardTrendsProjection>
  loadGit(): Promise<DashboardGitSnapshot>
}

/** Construction boundary for one root-scoped Dashboard projection service. */
export interface DashboardProjectionServiceOptions {
  workOwner: DashboardProjectionWorkOwner
  root: DashboardProjectionRoot
  codeGitBindingToken: string
  loaders: DashboardProjectionLoaders
}

/** Listener contract exposed to the Planning-root operation lease and Router bridge. */
export type DashboardProjectionSubscription<T> = (event: ProjectionWorkEvent<T, never>) => void

/** Public capability exposed by one active Planning-root record. */
export interface DashboardProjectionServiceContract {
  subscribeSummary(
    listener: DashboardProjectionSubscription<DashboardSummaryProjection>
  ): ProjectionWorkSubscription
  subscribeTrends(
    listener: DashboardProjectionSubscription<DashboardTrendsProjection>
  ): ProjectionWorkSubscription
  subscribeGit(
    listener: DashboardProjectionSubscription<DashboardGitSnapshot>
  ): ProjectionWorkSubscription
  getSummary(): Promise<DashboardSummaryProjection>
  getTrends(): Promise<DashboardTrendsProjection>
  getGit(): Promise<DashboardGitSnapshot>
  invalidateGit(): void
  dispose(): void
}

/**
 * Server-wide typed registry owner. Root records share these registries so identity, rather than record
 * allocation, prevents A -> B reuse. Server shutdown clears the owning ProjectionWorkRuntime.
 */
export class DashboardProjectionWorkOwner {
  readonly summary: ProjectionWorkRegistry<DashboardSummaryProjection>
  readonly trends: ProjectionWorkRegistry<DashboardTrendsProjection>
  readonly git: ProjectionWorkRegistry<DashboardGitSnapshot>

  constructor(runtime: ProjectionWorkRuntime) {
    this.summary = runtime.createRegistry<DashboardSummaryProjection>()
    this.trends = runtime.createRegistry<DashboardTrendsProjection>()
    this.git = runtime.createRegistry<DashboardGitSnapshot>()
  }
}

/** Create the exact typed Dashboard registries once per Server runtime. */
export function createDashboardProjectionWorkOwner(
  runtime: ProjectionWorkRuntime
): DashboardProjectionWorkOwner {
  return new DashboardProjectionWorkOwner(runtime)
}

function estimateSnapshotBytes(data: object): number {
  return Buffer.byteLength(JSON.stringify(data) ?? '', 'utf8')
}

/** Root-scoped facade over Server-owned regional Projection Work registries. */
export class DashboardProjectionService implements DashboardProjectionServiceContract {
  private readonly subscriptions = new Set<ProjectionWorkSubscription>()
  private disposed = false

  constructor(private readonly options: DashboardProjectionServiceOptions) {}

  /** Subscribe to first-screen Summary work; Git and trends cannot delay this request. */
  subscribeSummary(
    listener: DashboardProjectionSubscription<DashboardSummaryProjection>
  ): ProjectionWorkSubscription {
    return this.subscribeRegistry(this.options.workOwner.summary, this.summaryRequest(), listener)
  }

  /** Subscribe to optional historical trend work. */
  subscribeTrends(
    listener: DashboardProjectionSubscription<DashboardTrendsProjection>
  ): ProjectionWorkSubscription {
    return this.subscribeRegistry(this.options.workOwner.trends, this.trendsRequest(), listener)
  }

  /** Subscribe to Code Git work that is independently bound to the observed Code token. */
  subscribeGit(
    listener: DashboardProjectionSubscription<DashboardGitSnapshot>
  ): ProjectionWorkSubscription {
    return this.subscribeRegistry(this.options.workOwner.git, this.gitRequest(), listener)
  }

  /** Query one current Summary snapshot through the same bounded work identity as subscriptions. */
  getSummary(): Promise<DashboardSummaryProjection> {
    return this.getCurrent((listener) => this.subscribeSummary(listener))
  }

  /** Query one current trends snapshot through the same bounded work identity as subscriptions. */
  getTrends(): Promise<DashboardTrendsProjection> {
    return this.getCurrent((listener) => this.subscribeTrends(listener))
  }

  /** Query one current Code Git snapshot through the same binding-bound work identity as subscriptions. */
  getGit(): Promise<DashboardGitSnapshot> {
    return this.getCurrent((listener) => this.subscribeGit(listener))
  }

  /** Retire only the current Code Git projection after an explicit Git refresh mutation succeeds. */
  invalidateGit(): void {
    if (this.disposed) return
    this.options.workOwner.git.invalidate(this.identity('git'))
  }

  /** Detach listeners before the Manager retires this root record. Shared caches remain provenance-bound. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const subscription of this.subscriptions) subscription.unsubscribe()
    this.subscriptions.clear()
  }

  private identity(kind: DashboardProjectionKind): ProjectionWorkIdentity {
    return {
      projectionKind: `dashboard-${kind}`,
      planningRoot: {
        identity: this.options.root.path,
        source: this.options.root.source,
        storeSelector: this.options.root.storeSelector,
      },
      owner: {
        generation: this.options.root.generation,
        gitBindingToken: kind === 'git' ? this.options.codeGitBindingToken : null,
      },
      selector: `dashboard:${kind}`,
      inputFingerprint: 'reactive-filesystem:v1',
      protocolVersion: 1,
    }
  }

  private summaryRequest(): ProjectionWorkRequest<DashboardSummaryProjection, never> {
    return {
      identity: this.identity('summary'),
      resourceClass: 'filesystem',
      priority: 'foreground',
      estimateSnapshotBytes,
      load: async (context) => {
        context.reportStage('root-ready')
        const data = await this.options.loaders.loadSummary()
        context.reportStage('leaf-settled')
        return data
      },
    }
  }

  private trendsRequest(): ProjectionWorkRequest<DashboardTrendsProjection, never> {
    return {
      identity: this.identity('trends'),
      resourceClass: 'filesystem',
      priority: 'foreground',
      estimateSnapshotBytes,
      load: async (context) => {
        context.reportStage('root-ready')
        const data = await this.options.loaders.loadTrends()
        context.reportStage('leaf-settled')
        return data
      },
    }
  }

  private gitRequest(): ProjectionWorkRequest<DashboardGitSnapshot, never> {
    return {
      identity: this.identity('git'),
      resourceClass: 'git',
      priority: 'foreground',
      estimateSnapshotBytes,
      load: async (context) => {
        context.reportStage('root-ready')
        const data = await this.options.loaders.loadGit()
        context.reportStage('leaf-settled')
        return data
      },
    }
  }

  private subscribeRegistry<T>(
    registry: ProjectionWorkRegistry<T>,
    request: ProjectionWorkRequest<T, never>,
    listener: (event: ProjectionWorkEvent<T, never>) => void
  ): ProjectionWorkSubscription {
    if (this.disposed) throw new Error('Dashboard projection service is disposed.')
    const subscription = registry.subscribe(request, listener)
    this.subscriptions.add(subscription)
    let active = true
    return {
      unsubscribe: () => {
        if (!active) return
        active = false
        this.subscriptions.delete(subscription)
        subscription.unsubscribe()
      },
    }
  }

  private getCurrent<T>(
    subscribe: (
      listener: (event: ProjectionWorkEvent<T, never>) => void
    ) => ProjectionWorkSubscription
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      let settled = false
      let subscription: ProjectionWorkSubscription | null = null
      const settle = (callback: () => void) => {
        if (settled) return
        settled = true
        try {
          callback()
        } finally {
          subscription?.unsubscribe()
        }
      }
      subscription = subscribe((event) => {
        if (event.type === 'snapshot' && event.snapshot.freshness === 'current') {
          settle(() => resolve(event.snapshot.data))
          return
        }
        if (event.type === 'failed') {
          settle(() => reject(event.error))
        }
      })
      if (settled) subscription.unsubscribe()
    })
  }
}
