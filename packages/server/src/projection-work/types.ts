/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Define the provenance-bearing identity for Server-owned Projection Work.
 * 2. Define typed snapshot, phase, batch, completion, and failure events.
 * 3. Keep display freshness explicitly separate from mutation authority.
 * 4. Distinguish resource queue time from admitted leaf execution time.
 *
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 * Original request (2026-07-31): "检查它的工作到底做了什么，为什么需要那么多的时间"
 */

/** Resource classes remain distinct so I/O and CPU work cannot borrow unbounded concurrency. */
export const projectionWorkResourceClasses = ['cli', 'filesystem', 'git', 'cpu'] as const

export type ProjectionWorkResourceClass = (typeof projectionWorkResourceClasses)[number]

/** Foreground work may cancel cooperative background work in the same constrained class. */
export type ProjectionWorkPriority = 'foreground' | 'background'

/** Observable lifecycle phases. These describe actual work, never inferred page copy. */
export const projectionWorkPhases = [
  'request',
  'transport-start',
  'root-ready',
  'cache-hit',
  'join',
  'start',
  'queue-enter',
  'resource-admitted',
  'leaf-settled',
  'first-stable-payload',
  'complete',
  'error',
  'cancel',
] as const

export type ProjectionWorkPhase = (typeof projectionWorkPhases)[number]

/** Phases that only the owner leaf may report while it is doing real work. */
export type ProjectionWorkLoaderPhase = Extract<ProjectionWorkPhase, 'root-ready' | 'leaf-settled'>

/**
 * Complete reuse identity for a live projection.
 *
 * Fields that do not apply to a projection are represented by `null`, never omitted. That keeps the
 * canonical key stable and makes an absent Store or Git binding distinguishable from an accidentally
 * unkeyed implementation.
 */
export interface ProjectionWorkIdentity {
  projectionKind: string
  planningRoot: {
    identity: string
    source: string
    storeSelector: string | null
  }
  owner: {
    generation: string | null
    gitBindingToken: string | null
  }
  selector: string
  inputFingerprint: string
  protocolVersion: number
}

/** Produce a deterministic, collision-resistant-for-fields registry key without relying on object ordering. */
export function projectionWorkIdentityKey(identity: ProjectionWorkIdentity): string {
  return JSON.stringify([
    identity.projectionKind,
    identity.planningRoot.identity,
    identity.planningRoot.source,
    identity.planningRoot.storeSelector,
    identity.owner.generation,
    identity.owner.gitBindingToken,
    identity.selector,
    identity.inputFingerprint,
    identity.protocolVersion,
  ])
}

/** A snapshot may be rendered while stale, but only current snapshots may participate in authority checks. */
export interface ProjectionWorkSnapshot<T> {
  data: T
  freshness: 'current' | 'stale-display-only'
  identity: ProjectionWorkIdentity
  workGeneration: number
}

/** Progress is explicit when known; the literal `unknown` forbids fabricated percentages. */
export interface ProjectionWorkProgress {
  completed: number
  total: number | 'unknown'
}

/** Public lifecycle event emitted to every subscriber of one Projection Work. */
export type ProjectionWorkEvent<T, TBatch> =
  | { type: 'snapshot'; snapshot: ProjectionWorkSnapshot<T> }
  | { type: 'stage'; phase: ProjectionWorkPhase; workGeneration: number }
  | {
      type: 'batch'
      batch: TBatch
      progress: ProjectionWorkProgress
      /** The complete Work identity prevents a new Root/Store generation from merging with old batches. */
      identity: ProjectionWorkIdentity
      workGeneration: number
    }
  | { type: 'complete'; snapshot: ProjectionWorkSnapshot<T> }
  | {
      type: 'failed'
      error: Error
      retainedSnapshot: ProjectionWorkSnapshot<T> | null
      workGeneration: number
    }
