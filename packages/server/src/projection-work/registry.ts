/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Share same-identity in-flight projection work across Server subscribers.
 * 2. Retain bounded display snapshots while preserving freshness and provenance.
 * 3. Retire generations so late A work cannot publish into current B state.
 * 4. Expose explicit invalidation, cancellation, batches, and typed failures.
 *
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 */
import { ReactiveContext } from '@openspecui/core'
import { ProjectionWorkPhaseTrace } from './phase-trace.js'
import { ProjectionWorkScheduler } from './scheduler.js'
import {
  projectionWorkIdentityKey,
  type ProjectionWorkEvent,
  type ProjectionWorkIdentity,
  type ProjectionWorkLoaderPhase,
  type ProjectionWorkPriority,
  type ProjectionWorkProgress,
  type ProjectionWorkResourceClass,
  type ProjectionWorkSnapshot,
} from './types.js'

export interface ProjectionWorkLoaderContext<TBatch> {
  signal: AbortSignal
  workGeneration: number
  reportStage(phase: ProjectionWorkLoaderPhase): void
  emitBatch(batch: TBatch, progress: ProjectionWorkProgress): void
}

export interface ProjectionWorkRequest<T, TBatch> {
  identity: ProjectionWorkIdentity
  resourceClass: ProjectionWorkResourceClass
  priority: ProjectionWorkPriority
  /** The owner must provide a bounded estimate before a snapshot can enter the memory cache. */
  estimateSnapshotBytes(data: T): number
  load(context: ProjectionWorkLoaderContext<TBatch>): Promise<T>
}

export interface ProjectionWorkSubscription {
  unsubscribe(): void
}

export interface ProjectionWorkRegistryOptions {
  scheduler: ProjectionWorkScheduler
  phaseTrace: ProjectionWorkPhaseTrace
  cache: {
    maxEntries: number
    maxBytes: number
  }
  /** Bounds distinct active and cached work identities, including queued work. */
  maxWorkEntries: number
}

export interface ProjectionWorkRegistryStats {
  workEntries: number
  cachedEntries: number
  cachedBytes: number
}

export class ProjectionWorkCapacityError extends Error {
  constructor() {
    super('Projection Work registry capacity is exhausted.')
    this.name = 'ProjectionWorkCapacityError'
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function normalizeSnapshotBytes(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError('Projection Work snapshot size must be a finite non-negative number.')
  }
  return Math.ceil(value)
}

function validateLimit(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${label} must be a positive integer.`)
  }
}

type ProjectionWorkListener<T, TBatch> = (event: ProjectionWorkEvent<T, TBatch>) => void

class ProjectionWork<T, TBatch> {
  private readonly listeners = new Set<ProjectionWorkListener<T, TBatch>>()
  private snapshot: ProjectionWorkSnapshot<T> | null = null
  private snapshotBytes = 0
  private workGeneration = 0
  private workId = ''
  private activeRun = false
  private loading = false
  private controller: AbortController | null = null
  private reactiveContext: ReactiveContext | null = null
  private disposed = false
  private touchedAt = 0

  constructor(
    private readonly registry: ProjectionWorkRegistry<T, TBatch>,
    private readonly request: ProjectionWorkRequest<T, TBatch>,
    readonly key: string,
    workId: string
  ) {
    this.workId = workId
  }

  get listenerCount(): number {
    return this.listeners.size
  }

  get hasSnapshot(): boolean {
    return this.snapshot !== null
  }

  get cachedBytes(): number {
    return this.snapshotBytes
  }

  get lastTouchedAt(): number {
    return this.touchedAt
  }

  get isActive(): boolean {
    return this.activeRun
  }

  get isLoading(): boolean {
    return this.loading
  }

  touch(sequence: number): void {
    this.touchedAt = sequence
  }

  subscribe(listener: ProjectionWorkListener<T, TBatch>): ProjectionWorkSubscription {
    if (this.disposed) throw new Error('Projection Work has been retired.')
    this.listeners.add(listener)
    this.touch(this.registry.nextTouch())
    this.record('request', this.workGeneration)
    this.publishTo(listener, {
      type: 'stage',
      phase: 'request',
      workGeneration: this.workGeneration,
    })
    this.record('transport-start', this.workGeneration)
    this.publishTo(listener, {
      type: 'stage',
      phase: 'transport-start',
      workGeneration: this.workGeneration,
    })

    if (this.snapshot) {
      this.publishTo(listener, { type: 'snapshot', snapshot: this.snapshot })
    }

    if (this.activeRun && this.loading) {
      this.record('join', this.workGeneration)
      this.publishTo(listener, {
        type: 'stage',
        phase: 'join',
        workGeneration: this.workGeneration,
      })
    } else if (this.snapshot?.freshness === 'current') {
      this.record('cache-hit', this.workGeneration)
      this.publishTo(listener, {
        type: 'stage',
        phase: 'cache-hit',
        workGeneration: this.workGeneration,
      })
    } else {
      this.start()
    }

    let subscribed = true
    return {
      unsubscribe: () => {
        if (!subscribed) return
        subscribed = false
        this.listeners.delete(listener)
        if (this.listeners.size === 0) this.becomeDormant()
      },
    }
  }

  invalidate(): void {
    if (this.disposed) return
    this.retireActiveRun()
    this.markSnapshotStale()
    if (this.listeners.size > 0) this.start()
    else this.registry.onDormant(this)
  }

  evict(): void {
    if (this.listeners.size > 0) return
    this.retireActiveRun()
    this.disposed = true
    this.snapshot = null
    this.snapshotBytes = 0
    this.registry.remove(this)
  }

  dispose(): void {
    this.listeners.clear()
    this.retireActiveRun()
    this.disposed = true
    this.snapshot = null
    this.snapshotBytes = 0
  }

  private becomeDormant(): void {
    this.retireActiveRun()
    this.markSnapshotStale()
    if (!this.snapshot || this.snapshotBytes > this.registry.cacheMaxBytes) {
      this.disposed = true
      this.registry.remove(this)
      return
    }
    this.registry.onDormant(this)
  }

  private start(): void {
    if (this.disposed || this.listeners.size === 0 || this.activeRun) return
    this.workGeneration += 1
    const generation = this.workGeneration
    const controller = new AbortController()
    this.controller = controller
    this.reactiveContext = new ReactiveContext()
    this.activeRun = true
    this.loading = true
    this.record('start', generation)
    this.publishStage('start', generation)

    void this.run(controller, this.reactiveContext)
  }

  private async run(controller: AbortController, context: ReactiveContext): Promise<void> {
    try {
      for await (const result of context.stream(
        async () => {
          const generation = this.workGeneration
          const data = await this.registry.scheduler.schedule({
            resourceClass: this.request.resourceClass,
            priority: this.request.priority,
            signal: controller.signal,
            run: (scheduleSignal) =>
              this.request.load({
                signal: scheduleSignal,
                workGeneration: generation,
                reportStage: (phase) => {
                  if (this.isCurrentRun(generation, controller)) {
                    this.record(phase, generation)
                    this.publishStage(phase, generation)
                  }
                },
                emitBatch: (batch, progress) => {
                  if (!this.isCurrentRun(generation, controller)) return
                  this.publish({
                    type: 'batch',
                    batch,
                    progress,
                    identity: this.request.identity,
                    workGeneration: generation,
                  })
                },
              }),
          })
          return { data, generation }
        },
        controller.signal,
        {
          onRecomputeStarted: () => this.beginReactiveReplacement(controller),
        }
      )) {
        if (!this.isCurrentRun(result.generation, controller)) continue
        this.loading = false
        const snapshot: ProjectionWorkSnapshot<T> = {
          data: result.data,
          freshness: 'current',
          identity: this.request.identity,
          workGeneration: result.generation,
        }
        this.snapshot = snapshot
        this.snapshotBytes = normalizeSnapshotBytes(this.request.estimateSnapshotBytes(result.data))
        this.registry.onSnapshot(this)
        this.record('first-stable-payload', snapshot.workGeneration)
        this.publish({ type: 'snapshot', snapshot })
        this.record('complete', snapshot.workGeneration)
        this.publish({ type: 'complete', snapshot })
      }
    } catch (error: unknown) {
      if (
        !this.isCurrentController(controller) ||
        controller.signal.aborted ||
        isAbortError(error)
      ) {
        return
      }
      this.loading = false
      this.record('error', this.workGeneration)
      this.publishStage('error', this.workGeneration)
      this.publish({
        type: 'failed',
        error: error instanceof Error ? error : new Error(String(error)),
        retainedSnapshot: this.snapshot,
        workGeneration: this.workGeneration,
      })
    } finally {
      if (this.controller === controller) {
        this.activeRun = false
        this.loading = false
        this.controller = null
        this.reactiveContext = null
      }
    }
  }

  private beginReactiveReplacement(controller: AbortController): void {
    if (!this.isCurrentController(controller) || this.listeners.size === 0) return
    this.workGeneration += 1
    this.loading = true
    this.markSnapshotStale()
    this.record('start', this.workGeneration)
    this.publishStage('start', this.workGeneration)
    // The same ReactiveContext owns the dependency set; only the work generation changes.
  }

  private retireActiveRun(): void {
    if (!this.activeRun) return
    const generation = this.workGeneration
    const controller = this.controller
    this.activeRun = false
    this.loading = false
    this.controller = null
    this.reactiveContext = null
    controller?.abort()
    this.record('cancel', generation)
    this.publishStage('cancel', generation)
  }

  private markSnapshotStale(): void {
    if (!this.snapshot || this.snapshot.freshness === 'stale-display-only') return
    this.snapshot = { ...this.snapshot, freshness: 'stale-display-only' }
    this.publish({ type: 'snapshot', snapshot: this.snapshot })
  }

  private isCurrentRun(generation: number, controller: AbortController): boolean {
    return this.isCurrentController(controller) && this.workGeneration === generation
  }

  private isCurrentController(controller: AbortController): boolean {
    return !this.disposed && this.controller === controller
  }

  private record(
    phase: Parameters<ProjectionWorkPhaseTrace['record']>[0]['phase'],
    generation: number
  ): void {
    this.registry.phaseTrace.record({
      workId: this.workId,
      projectionKind: this.request.identity.projectionKind,
      workGeneration: generation,
      phase,
    })
  }

  private publishStage(
    phase: Parameters<ProjectionWorkPhaseTrace['record']>[0]['phase'],
    generation: number
  ): void {
    this.publish({ type: 'stage', phase, workGeneration: generation })
  }

  private publish(event: ProjectionWorkEvent<T, TBatch>): void {
    for (const listener of this.listeners) listener(event)
  }

  private publishTo(
    listener: ProjectionWorkListener<T, TBatch>,
    event: ProjectionWorkEvent<T, TBatch>
  ): void {
    listener(event)
  }
}

/** Server-owned registry for bounded, provenance-keyed live projection work. */
export class ProjectionWorkRegistry<T, TBatch = never> {
  private readonly works = new Map<string, ProjectionWork<T, TBatch>>()
  private touchSequence = 0
  private workSequence = 0

  constructor(private readonly options: ProjectionWorkRegistryOptions) {
    validateLimit(options.cache.maxEntries, 'Projection Work cache maxEntries')
    validateLimit(options.cache.maxBytes, 'Projection Work cache maxBytes')
    validateLimit(options.maxWorkEntries, 'Projection Work maxWorkEntries')
  }

  get scheduler(): ProjectionWorkScheduler {
    return this.options.scheduler
  }

  get phaseTrace(): ProjectionWorkPhaseTrace {
    return this.options.phaseTrace
  }

  get cacheMaxBytes(): number {
    return this.options.cache.maxBytes
  }

  subscribe(
    request: ProjectionWorkRequest<T, TBatch>,
    listener: ProjectionWorkListener<T, TBatch>
  ): ProjectionWorkSubscription {
    const key = projectionWorkIdentityKey(request.identity)
    let work = this.works.get(key)
    if (!work) {
      this.trimCache()
      if (this.works.size >= this.options.maxWorkEntries) {
        throw new ProjectionWorkCapacityError()
      }
      work = new ProjectionWork(
        this,
        request,
        key,
        `${request.identity.projectionKind}:${++this.workSequence}`
      )
      this.works.set(key, work)
    }
    work.touch(this.nextTouch())
    return work.subscribe(listener)
  }

  invalidate(identity: ProjectionWorkIdentity): void {
    const work = this.works.get(projectionWorkIdentityKey(identity))
    work?.invalidate()
  }

  clear(): void {
    for (const work of this.works.values()) work.dispose()
    this.works.clear()
  }

  getStats(): ProjectionWorkRegistryStats {
    let cachedEntries = 0
    let cachedBytes = 0
    for (const work of this.works.values()) {
      if (!work.hasSnapshot) continue
      cachedEntries += 1
      cachedBytes += work.cachedBytes
    }
    return { workEntries: this.works.size, cachedEntries, cachedBytes }
  }

  nextTouch(): number {
    this.touchSequence += 1
    return this.touchSequence
  }

  onSnapshot(work: ProjectionWork<T, TBatch>): void {
    work.touch(this.nextTouch())
    this.trimCache()
  }

  onDormant(work: ProjectionWork<T, TBatch>): void {
    work.touch(this.nextTouch())
    this.trimCache()
  }

  remove(work: ProjectionWork<T, TBatch>): void {
    if (this.works.get(work.key) === work) this.works.delete(work.key)
  }

  private trimCache(): void {
    const dormant = [...this.works.values()].filter((work) => work.listenerCount === 0)
    for (const work of dormant) {
      if (!work.hasSnapshot || work.cachedBytes > this.options.cache.maxBytes) work.evict()
    }

    const cached = () =>
      dormant.filter((work) => work.hasSnapshot && this.works.get(work.key) === work)
    let entries = cached()
    let bytes = entries.reduce((total, work) => total + work.cachedBytes, 0)
    while (entries.length > this.options.cache.maxEntries || bytes > this.options.cache.maxBytes) {
      const oldest = entries.sort((left, right) => left.lastTouchedAt - right.lastTouchedAt)[0]
      if (!oldest) break
      bytes -= oldest.cachedBytes
      oldest.evict()
      entries = cached()
    }
  }
}

export type { ProjectionWorkEvent, ProjectionWorkIdentity, ProjectionWorkSnapshot }
