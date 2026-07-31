/**
 * Orthogonal intents (created 2026-07-31 Asia/Shanghai):
 * 1. Prove multiple readers run concurrently.
 * 2. Prove a writer gets exclusive access (no reader overlaps it).
 * 3. Prove writer preference: readers arriving while a writer waits queue behind it.
 * 4. Prove OTel identifies queued/acquired/released writers and the writer blocking each read.
 *
 * Original request (2026-07-31): "使用读写锁的概念进行改进"
 * Original request (2026-07-31): "把所有write-lock打印上时间日志和来源堆栈，使用otel来进行trace。"
 */
import type { Attributes } from '@opentelemetry/api'
import { describe, expect, it } from 'vitest'
import { AsyncReadWriteLock, type LockTracer } from './read-write-lock.js'

interface RecordedLockEvent {
  name: string
  attributes?: Attributes
}

interface RecordedLockSpan {
  name: string
  attributes: Attributes
  events: RecordedLockEvent[]
  ended: boolean
}

function createRecordingLockTracer(): {
  spans: RecordedLockSpan[]
  tracer: LockTracer
} {
  const spans: RecordedLockSpan[] = []
  return {
    spans,
    tracer: {
      startActiveSpan: async (name, options, callback) => {
        const recorded: RecordedLockSpan = {
          name,
          attributes: { ...options.attributes },
          events: [],
          ended: false,
        }
        spans.push(recorded)
        return callback({
          setAttribute(key, value) {
            recorded.attributes[key] = value
            return this
          },
          setAttributes(attributes) {
            Object.assign(recorded.attributes, attributes)
            return this
          },
          addEvent(eventName, attributes) {
            recorded.events.push({
              name: eventName,
              attributes: attributes ? { ...attributes } : undefined,
            })
          },
          recordException() {},
          setStatus() {},
          end() {
            recorded.ended = true
          },
        })
      },
    },
  }
}

// A deferred promise for orchestrating async test timing.
function deferred<T = void>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: Error) => void
} {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('AsyncReadWriteLock', () => {
  it('allows multiple readers to run concurrently', async () => {
    const lock = new AsyncReadWriteLock()
    const order: string[] = []
    let readerBInside = false

    const readerA = lock.withReadLock({ source: 'reader-a', stack: 'reader-a-stack' }, async () => {
      order.push('A-start')
      // Yield to let B acquire; if lock were exclusive, B would block.
      await new Promise((r) => setTimeout(r, 20))
      expect(readerBInside).toBe(true) // B entered concurrently
      order.push('A-end')
    })
    const readerB = lock.withReadLock({ source: 'reader-b', stack: 'reader-b-stack' }, async () => {
      readerBInside = true
      order.push('B-start')
      await new Promise((r) => setTimeout(r, 10))
      order.push('B-end')
    })

    await Promise.all([readerA, readerB])
    expect(order).toContain('B-start')
  })

  it('gives a writer exclusive access — no reader overlaps', async () => {
    const lock = new AsyncReadWriteLock()
    let writerInside = false
    let readerInside = false
    const writerDone = deferred()

    // Writer goes first, holds lock for a bit.
    const writer = lock.withWriteLock(
      { source: 'exclusive-writer', stack: 'exclusive-writer-stack' },
      async () => {
        writerInside = true
        await new Promise((r) => setTimeout(r, 30))
        writerInside = false
        writerDone.resolve()
      }
    )

    // Reader starts concurrently but must wait.
    const reader = lock.withReadLock(
      { source: 'exclusive-reader', stack: 'exclusive-reader-stack' },
      async () => {
        await writerDone.promise // ensure writer finished first
        readerInside = true
        expect(writerInside).toBe(false)
      }
    )

    await Promise.all([writer, reader])
    expect(readerInside).toBe(true)
  })

  it('writer preference: reader arriving while writer waits queues behind it', async () => {
    const lock = new AsyncReadWriteLock()
    const sequence: string[] = []

    // Reader 1 holds the lock.
    const reader1Release = deferred()
    const reader1 = lock.withReadLock(
      { source: 'preexisting-reader', stack: 'preexisting-reader-stack' },
      async () => {
        sequence.push('reader1-start')
        await reader1Release.promise
        sequence.push('reader1-end')
      }
    )

    // Writer waits behind reader1.
    const writer = lock.withWriteLock(
      { source: 'preferred-writer', stack: 'preferred-writer-stack' },
      async () => {
        sequence.push('writer')
      }
    )

    // Reader 2 arrives while writer is waiting — must queue behind writer (writer preference).
    const reader2 = lock.withReadLock(
      { source: 'queued-reader', stack: 'queued-reader-stack' },
      async () => {
        sequence.push('reader2')
      }
    )

    // Release reader1 → writer should go next (before reader2).
    await new Promise((r) => setTimeout(r, 10)) // ensure reader1 acquired first
    reader1Release.resolve()

    await Promise.all([reader1, writer, reader2])
    // Writer must appear before reader2 in the sequence.
    const writerIdx = sequence.indexOf('writer')
    const reader2Idx = sequence.indexOf('reader2')
    expect(writerIdx).toBeGreaterThanOrEqual(0)
    expect(reader2Idx).toBeGreaterThan(writerIdx)
  })

  it('traces writer timing and identifies the queued writer blocking a read', async () => {
    const { spans, tracer } = createRecordingLockTracer()
    const lock = new AsyncReadWriteLock({ name: 'planning-root-transition', tracer })
    const firstReaderRelease = deferred()
    const writerRelease = deferred()

    const firstReader = lock.withReadLock(
      { source: 'cache-hit-check', stack: 'read-stack' },
      async () => firstReaderRelease.promise
    )
    const writer = lock.withWriteLock(
      { source: 'resolve-root-cache-miss', stack: 'writer-stack' },
      async () => writerRelease.promise
    )
    const blockedReader = lock.withReadLock(
      { source: 'detail-projection-read', stack: 'blocked-read-stack' },
      async () => undefined
    )

    await Promise.resolve()
    firstReaderRelease.resolve()
    await Promise.resolve()
    writerRelease.resolve()
    await Promise.all([firstReader, writer, blockedReader])

    const writerSpan = spans.find(
      (span) => span.attributes['lock.source'] === 'resolve-root-cache-miss'
    )
    expect(writerSpan).toMatchObject({
      name: 'lock.write',
      ended: true,
      attributes: {
        'lock.name': 'planning-root-transition',
        'lock.mode': 'write',
        'lock.source': 'resolve-root-cache-miss',
        'lock.stack': 'writer-stack',
      },
    })
    expect(writerSpan?.attributes['lock.wait_ms']).toEqual(expect.any(Number))
    expect(writerSpan?.attributes['lock.hold_ms']).toEqual(expect.any(Number))
    expect(writerSpan?.events.map((event) => event.name)).toEqual([
      'write-lock.queued',
      'write-lock.acquired',
      'write-lock.released',
    ])
    expect(writerSpan?.events[0]?.attributes?.['lock.timestamp']).toEqual(expect.any(String))

    const readSpan = spans.find(
      (span) => span.attributes['lock.source'] === 'detail-projection-read'
    )
    expect(readSpan).toMatchObject({
      name: 'lock.read',
      ended: true,
      attributes: {
        'lock.blocked': true,
        'lock.blocked_by.source': 'resolve-root-cache-miss',
        'lock.blocked_by.stack': 'writer-stack',
      },
    })
  })
})
