/**
 * Orthogonal intents (updated 2026-08-01 Asia/Shanghai):
 * 1. Own Root Context as launch-scoped CLI Projection Work.
 * 2. Cache only settled typed Root Context results while dependencies drive invalidation.
 * 3. Expose lifecycle Pull/Push and refresh when OpenSpec 1.7 machine fallback evidence changes.
 *
 * Original request (2026-07-26): "展开全面的接口升级和内核升级和测试升级。"
 */
import {
  type CliProjectionNotice,
  type CliProjectionState,
  type RootContextResolvedState,
} from '@openspecui/core'
import { Buffer } from 'node:buffer'
import type { PlanningRootServiceResolver } from './planning-root-service.js'
import {
  projectionWorkIdentityKey,
  type ProjectionWorkIdentity,
  type ProjectionWorkRegistry,
  type ProjectionWorkRequest,
  type ProjectionWorkRuntime,
  type ProjectionWorkSubscription,
} from './projection-work/index.js'
import {
  trackRootContextDependencies,
  trackRootContextStaticDependencies,
} from './root-context-service.js'

/** Server-local registry for the launch project's Root Context projection. */
export interface RootContextProjectionWorkOwner {
  rootContext: ProjectionWorkRegistry<RootContextResolvedState>
}

export function createRootContextProjectionWorkOwner(
  runtime: ProjectionWorkRuntime
): RootContextProjectionWorkOwner {
  return { rootContext: runtime.createRegistry<RootContextResolvedState>() }
}

export interface RootContextProjectionServiceOptions {
  launchProjectDir: string
  dataScopePath: string
  planningRootServices: PlanningRootServiceResolver
  workOwner: RootContextProjectionWorkOwner
}

function estimateSnapshotBytes(data: RootContextResolvedState): number {
  return Buffer.byteLength(JSON.stringify(data) ?? '', 'utf8')
}

/** CLI-backed Root Context Pull/Push owner for one launch project. */
export class RootContextProjectionService {
  constructor(private readonly options: RootContextProjectionServiceOptions) {}

  getCurrent(): Promise<RootContextResolvedState> {
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
      subscription = this.options.workOwner.rootContext.subscribe(this.request(), (event) => {
        if (event.type === 'snapshot' && event.snapshot.freshness === 'current') {
          settle(() => resolve(event.snapshot.data))
          return
        }
        if (event.type === 'failed') settle(() => reject(event.error))
      })
      if (settled) subscription.unsubscribe()
    })
  }

  read(): CliProjectionState<RootContextResolvedState> {
    return (
      this.options.workOwner.rootContext.read(this.identity()) ?? {
        state: 'loading',
        identity: projectionWorkIdentityKey(this.identity()),
        workGeneration: 0,
        invalidationCause: 'initial',
        data: null,
        freshness: null,
        snapshotGeneration: null,
        error: null,
      }
    )
  }

  subscribe(listener: (notice: CliProjectionNotice) => void): ProjectionWorkSubscription {
    return this.options.workOwner.rootContext.subscribeLifecycle(this.request(), listener)
  }

  refresh(): CliProjectionState<RootContextResolvedState> {
    this.options.workOwner.rootContext.invalidate(this.identity())
    return this.read()
  }

  private identity(): ProjectionWorkIdentity {
    return {
      projectionKind: 'root-context',
      planningRoot: {
        identity: this.options.launchProjectDir,
        source: 'launch-project',
        storeSelector: null,
      },
      owner: { generation: null, gitBindingToken: null },
      selector: JSON.stringify({ dataScopePath: this.options.dataScopePath }),
      inputFingerprint: 'openspec-cli-1.7:doctor+context+global-default',
      protocolVersion: 1,
    }
  }

  private request(): ProjectionWorkRequest<RootContextResolvedState, never> {
    return {
      identity: this.identity(),
      resourceClass: 'cli',
      priority: 'foreground',
      estimateSnapshotBytes,
      load: async ({ reportStage }) => {
        await trackRootContextStaticDependencies({
          launchProjectDir: this.options.launchProjectDir,
          dataScopePath: this.options.dataScopePath,
        })
        reportStage('root-ready')
        const result = await (this.options.planningRootServices.resolveRootContextProjection?.() ??
          this.options.planningRootServices.resolveRootContextReactive())
        await trackRootContextDependencies({ projectDir: this.options.launchProjectDir }, result)
        reportStage('leaf-settled')
        return result
      },
    }
  }
}
