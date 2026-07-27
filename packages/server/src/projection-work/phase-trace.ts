/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Keep bounded, process-local phase evidence for live Projection Work.
 * 2. Avoid a user analytics stream or a second projection fact source.
 *
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 */
import type { ProjectionWorkPhase } from './types.js'

/** A phase record contains no projection payload, CLI output, pathname, or user identity. */
export interface ProjectionWorkPhaseTraceEntry {
  at: number
  workId: string
  projectionKind: string
  workGeneration: number
  phase: ProjectionWorkPhase
}

/** Injectable monotonic clock for deterministic tests and benchmark correlation. */
export type ProjectionWorkClock = () => number

export interface ProjectionWorkPhaseTraceOptions {
  capacity: number
  now?: ProjectionWorkClock
}

/**
 * A bounded ring of phase-only evidence. It is deliberately private to Server infrastructure: callers use it
 * for benchmarks and tests, never as a new client data source.
 */
export class ProjectionWorkPhaseTrace {
  private readonly entries: ProjectionWorkPhaseTraceEntry[] = []
  private readonly now: ProjectionWorkClock

  constructor(private readonly options: ProjectionWorkPhaseTraceOptions) {
    if (!Number.isInteger(options.capacity) || options.capacity < 1) {
      throw new RangeError('Projection Work trace capacity must be a positive integer.')
    }
    this.now = options.now ?? (() => performance.now())
  }

  record(entry: Omit<ProjectionWorkPhaseTraceEntry, 'at'>): void {
    this.entries.push({ ...entry, at: this.now() })
    const overflow = this.entries.length - this.options.capacity
    if (overflow > 0) this.entries.splice(0, overflow)
  }

  /** Return a copy so consumers cannot mutate the trace in place. */
  read(): readonly ProjectionWorkPhaseTraceEntry[] {
    return [...this.entries]
  }

  clear(): void {
    this.entries.length = 0
  }
}
