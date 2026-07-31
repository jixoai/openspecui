/**
 * Orthogonal intents (created 2026-07-31 Asia/Shanghai):
 * 1. Provide a writer-preference async read-write lock for PlanningRootServiceManager.
 * 2. Multiple readers can hold the lock concurrently; writers get exclusive access.
 * 3. Writer preference prevents write starvation: when a writer is waiting, new readers queue.
 * 4. Export queue-to-release OTel evidence with explicit source stacks and reader blockers.
 *
 * Original request (2026-07-31): "使用读写锁的概念进行改进:Read 并行,Write 独占"
 * Original request (2026-07-31): "把所有write-lock打印上时间日志和来源堆栈，使用otel来进行trace。"
 *
 * Design: a single Promise chain resolves readers in batches and writers one-at-a-time.
 * Writers wait for all active readers to finish; readers arriving while a writer is pending
 * (or active) wait behind that writer. This guarantees writers are not starved by a continuous
 * stream of readers, at the cost of slightly higher reader latency when a write is pending.
 */

import {
  SpanStatusCode,
  trace,
  type Attributes,
  type Exception,
  type SpanAttributeValue,
  type SpanStatus,
  type Tracer,
} from '@opentelemetry/api'

/** One explicit caller identity crossing the lock boundary. */
export interface LockOperationSource {
  source: string
  stack: string
}

/** Minimal span boundary used by the lock and by typechecked test recorders. */
export interface LockSpan {
  setAttribute(key: string, value: SpanAttributeValue): void
  setAttributes(attributes: Attributes): void
  addEvent(name: string, attributes?: Attributes, startTime?: number): void
  recordException(exception: Exception): void
  setStatus(status: SpanStatus): void
  end(endTime?: number): void
}

/** Minimal tracer boundary used by the lock and by typechecked test recorders. */
export interface LockTracer {
  startActiveSpan<T>(
    name: string,
    options: { attributes: Attributes; startTime: number },
    callback: (span: LockSpan) => Promise<T>
  ): Promise<T>
}

/** Convert an application Tracer into the narrow lock instrumentation boundary. */
export function createLockTracer(tracer: Tracer): LockTracer {
  return {
    startActiveSpan: (name, options, callback) =>
      tracer.startActiveSpan(name, options, (span) => callback(span)),
  }
}

export interface AsyncReadWriteLockOptions {
  name: string
  tracer?: LockTracer
}

interface LockOperation extends LockOperationSource {
  id: number
  queuedAt: number
}

interface ReadWaiter {
  resolve: () => void
  blockers: LockOperation[]
}

interface WriteWaiter {
  resolve: () => void
  operation: LockOperation
}

function timestampAttributes(timestamp: number): Attributes {
  return {
    'lock.timestamp': new Date(timestamp).toISOString(),
    'lock.timestamp_unix_ms': timestamp,
  }
}

export class AsyncReadWriteLock {
  private readonly name: string
  private readonly tracer: LockTracer
  private nextOperationId = 1
  private activeReaders = 0
  private activeWriter: LockOperation | null = null
  private waitingReaders: ReadWaiter[] = []
  private waitingWriters: WriteWaiter[] = []

  constructor(options: AsyncReadWriteLockOptions = { name: 'async-read-write-lock' }) {
    this.name = options.name
    this.tracer =
      options.tracer ??
      createLockTracer(trace.getTracer('openspecui-server', 'lock-instrumentation'))
  }

  /**
   * Acquire a shared (read) lock and run `fn`. Multiple read locks can be held simultaneously.
   * If a writer is waiting or active, this queues behind it (writer preference).
   */
  async withReadLock<T>(source: LockOperationSource, fn: () => Promise<T> | T): Promise<T> {
    const operation = this.createOperation(source)
    return this.tracer.startActiveSpan(
      'lock.read',
      {
        attributes: this.baseAttributes('read', operation),
        startTime: operation.queuedAt,
      },
      async (span) => {
        const blockers = await this.acquireRead()
        const acquiredAt = Date.now()
        const waitMs = acquiredAt - operation.queuedAt
        span.setAttributes({
          'lock.blocked': blockers.length > 0,
          'lock.wait_ms': waitMs,
        })
        if (blockers.length > 0) {
          const firstBlocker = blockers[0]
          if (firstBlocker) {
            span.setAttributes({
              'lock.blocked_by.source': firstBlocker.source,
              'lock.blocked_by.stack': firstBlocker.stack,
              'lock.blocked_by.wait_ms': waitMs,
              'lock.blocked_by.sources': blockers.map((blocker) => blocker.source),
              'lock.blocked_by.stacks': blockers.map((blocker) => blocker.stack),
            })
          }
        }
        span.addEvent('read-lock.acquired', timestampAttributes(acquiredAt), acquiredAt)
        try {
          return await fn()
        } catch (error) {
          this.recordError(span, error)
          throw error
        } finally {
          this.releaseRead()
          const releasedAt = Date.now()
          span.setAttribute('lock.hold_ms', releasedAt - acquiredAt)
          span.addEvent('read-lock.released', timestampAttributes(releasedAt), releasedAt)
          span.end(releasedAt)
        }
      }
    )
  }

  /**
   * Acquire an exclusive (write) lock and run `fn`. Waits for all active readers/writers to finish.
   * While active, new readers and writers queue behind this writer.
   */
  async withWriteLock<T>(source: LockOperationSource, fn: () => Promise<T> | T): Promise<T> {
    const operation = this.createOperation(source)
    return this.tracer.startActiveSpan(
      'lock.write',
      {
        attributes: this.baseAttributes('write', operation),
        startTime: operation.queuedAt,
      },
      async (span) => {
        span.addEvent(
          'write-lock.queued',
          {
            ...timestampAttributes(operation.queuedAt),
            'lock.active_readers': this.activeReaders,
            'lock.waiting_readers': this.waitingReaders.length,
            'lock.waiting_writers': this.waitingWriters.length,
          },
          operation.queuedAt
        )
        await this.acquireWrite(operation)
        const acquiredAt = Date.now()
        span.setAttribute('lock.wait_ms', acquiredAt - operation.queuedAt)
        span.addEvent('write-lock.acquired', timestampAttributes(acquiredAt), acquiredAt)
        try {
          return await fn()
        } catch (error) {
          this.recordError(span, error)
          throw error
        } finally {
          this.releaseWrite()
          const releasedAt = Date.now()
          span.setAttribute('lock.hold_ms', releasedAt - acquiredAt)
          span.addEvent('write-lock.released', timestampAttributes(releasedAt), releasedAt)
          span.end(releasedAt)
        }
      }
    )
  }

  private createOperation(source: LockOperationSource): LockOperation {
    return {
      ...source,
      id: this.nextOperationId++,
      queuedAt: Date.now(),
    }
  }

  private baseAttributes(mode: 'read' | 'write', operation: LockOperation): Attributes {
    return {
      'lock.name': this.name,
      'lock.mode': mode,
      'lock.source': operation.source,
      'lock.stack': operation.stack,
      'lock.queue_started_at': new Date(operation.queuedAt).toISOString(),
      'lock.queue_started_at_unix_ms': operation.queuedAt,
    }
  }

  private recordError(span: LockSpan, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error)
    span.recordException(error instanceof Error ? error : message)
    span.setStatus({ code: SpanStatusCode.ERROR, message })
  }

  private acquireRead(): Promise<LockOperation[]> {
    // Writer preference: if a writer is active or waiting, queue the reader.
    if (this.activeWriter === null && this.waitingWriters.length === 0) {
      this.activeReaders += 1
      return Promise.resolve([])
    }
    const blockers = [
      ...(this.activeWriter ? [this.activeWriter] : []),
      ...this.waitingWriters.map((writer) => writer.operation),
    ]
    return new Promise<LockOperation[]>((resolve) => {
      this.waitingReaders.push({ resolve: () => resolve(blockers), blockers })
    })
  }

  private releaseRead(): void {
    this.activeReaders -= 1
    if (this.activeReaders === 0 && this.waitingWriters.length > 0) {
      this.drainNextWriter()
    }
  }

  private acquireWrite(operation: LockOperation): Promise<void> {
    if (
      this.activeWriter === null &&
      this.activeReaders === 0 &&
      this.waitingWriters.length === 0
    ) {
      this.activeWriter = operation
      return Promise.resolve()
    }
    for (const reader of this.waitingReaders) {
      reader.blockers.push(operation)
    }
    return new Promise<void>((resolve) => {
      this.waitingWriters.push({ resolve, operation })
    })
  }

  private releaseWrite(): void {
    this.activeWriter = null
    // Writer preference: if another writer is waiting, let it go next.
    if (this.waitingWriters.length > 0) {
      this.drainNextWriter()
      return
    }
    // No writers waiting — release all queued readers in a batch.
    this.drainWaitingReaders()
  }

  private drainNextWriter(): void {
    const writer = this.waitingWriters.shift()
    if (!writer) return
    this.activeWriter = writer.operation
    writer.resolve()
  }

  private drainWaitingReaders(): void {
    const readers = this.waitingReaders.splice(0)
    this.activeReaders += readers.length
    for (const reader of readers) reader.resolve()
  }
}
