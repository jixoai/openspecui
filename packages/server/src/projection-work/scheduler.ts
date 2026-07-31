/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Bound Projection Work by CLI, filesystem, Git, and CPU resource class.
 * 2. Give foreground requests priority without creating an unbounded queue.
 * 3. Cancel cooperative background work when it would starve foreground work.
 * 4. Expose queue-entry and resource-admission boundaries without owning projection traces.
 *
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 * Original request (2026-07-31): "检查它的工作到底做了什么，为什么需要那么多的时间"
 */
import type { ProjectionWorkPriority, ProjectionWorkResourceClass } from './types.js'

export type ProjectionWorkResourceLimits = Readonly<Record<ProjectionWorkResourceClass, number>>

export interface ProjectionWorkSchedulerOptions {
  limits: ProjectionWorkResourceLimits
}

export interface ProjectionWorkScheduleRequest<T> {
  resourceClass: ProjectionWorkResourceClass
  priority: ProjectionWorkPriority
  signal: AbortSignal
  onQueued?(): void
  onStarted?(): void
  run(signal: AbortSignal): Promise<T>
}

interface ScheduledWork {
  resourceClass: ProjectionWorkResourceClass
  priority: ProjectionWorkPriority
  controller: AbortController
  started: boolean
  settled: boolean
  cancel(): void
  start(): void
}

interface ResourceQueue {
  foreground: ScheduledWork[]
  background: ScheduledWork[]
  running: Set<ScheduledWork>
}

function createAbortError(): DOMException {
  return new DOMException('Projection Work was cancelled.', 'AbortError')
}

/**
 * Scheduler is intentionally small: it limits work already admitted by a Projection Work identity. It does not
 * inspect payloads or decide freshness, so it cannot become a second projection owner.
 */
export class ProjectionWorkScheduler {
  private readonly queues: Record<ProjectionWorkResourceClass, ResourceQueue>

  constructor(private readonly options: ProjectionWorkSchedulerOptions) {
    for (const [resourceClass, limit] of Object.entries(options.limits)) {
      if (!Number.isInteger(limit) || limit < 1) {
        throw new RangeError(
          `Projection Work ${resourceClass} concurrency must be a positive integer.`
        )
      }
    }
    this.queues = {
      cli: this.createQueue(),
      filesystem: this.createQueue(),
      git: this.createQueue(),
      cpu: this.createQueue(),
    }
  }

  schedule<T>(request: ProjectionWorkScheduleRequest<T>): Promise<T> {
    if (request.signal.aborted) return Promise.reject(createAbortError())

    return new Promise<T>((resolve, reject) => {
      const controller = new AbortController()
      let detachParentAbort = () => {}
      let work: ScheduledWork
      const settle = (callback: () => void) => {
        if (work.settled) return
        work.settled = true
        detachParentAbort()
        callback()
      }

      work = {
        resourceClass: request.resourceClass,
        priority: request.priority,
        controller,
        started: false,
        settled: false,
        cancel: () => {
          if (work.settled) return
          controller.abort()
          if (!work.started) {
            settle(() => reject(createAbortError()))
            this.removeQueued(work)
            this.drain(work.resourceClass)
          }
        },
        start: () => {
          if (work.settled || controller.signal.aborted) {
            if (!work.settled) settle(() => reject(createAbortError()))
            return
          }
          work.started = true
          const queue = this.queues[work.resourceClass]
          queue.running.add(work)
          request.onStarted?.()
          void request.run(controller.signal).then(
            (value) => {
              settle(() => resolve(value))
              queue.running.delete(work)
              this.drain(work.resourceClass)
            },
            (error: unknown) => {
              settle(() => reject(error))
              queue.running.delete(work)
              this.drain(work.resourceClass)
            }
          )
        },
      }

      const parentAbort = () => work.cancel()
      request.signal.addEventListener('abort', parentAbort, { once: true })
      detachParentAbort = () => request.signal.removeEventListener('abort', parentAbort)

      const queue = this.queues[request.resourceClass]
      if (request.priority === 'foreground') {
        queue.foreground.push(work)
        this.cancelOneBackgroundWork(request.resourceClass)
      } else {
        queue.background.push(work)
      }
      request.onQueued?.()
      this.drain(request.resourceClass)
    })
  }

  /** Snapshot only scheduling metadata; it intentionally exposes neither payload nor identity. */
  getStats(): Readonly<Record<ProjectionWorkResourceClass, { running: number; queued: number }>> {
    return {
      cli: this.statsFor('cli'),
      filesystem: this.statsFor('filesystem'),
      git: this.statsFor('git'),
      cpu: this.statsFor('cpu'),
    }
  }

  private createQueue(): ResourceQueue {
    return { foreground: [], background: [], running: new Set() }
  }

  private statsFor(resourceClass: ProjectionWorkResourceClass): {
    running: number
    queued: number
  } {
    const queue = this.queues[resourceClass]
    return {
      running: queue.running.size,
      queued: queue.foreground.length + queue.background.length,
    }
  }

  private cancelOneBackgroundWork(resourceClass: ProjectionWorkResourceClass): void {
    const queue = this.queues[resourceClass]
    if (queue.running.size < this.options.limits[resourceClass]) return
    for (const work of queue.running) {
      if (work.priority === 'background') {
        work.cancel()
        return
      }
    }
  }

  private drain(resourceClass: ProjectionWorkResourceClass): void {
    const queue = this.queues[resourceClass]
    const limit = this.options.limits[resourceClass]
    while (queue.running.size < limit) {
      const work = queue.foreground.shift() ?? queue.background.shift()
      if (!work) return
      work.start()
    }
  }

  private removeQueued(work: ScheduledWork): void {
    const queue = this.queues[work.resourceClass]
    const pending = work.priority === 'foreground' ? queue.foreground : queue.background
    const index = pending.indexOf(work)
    if (index >= 0) pending.splice(index, 1)
  }
}
