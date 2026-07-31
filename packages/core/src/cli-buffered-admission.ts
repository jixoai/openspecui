/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Own the process-local FIFO admission boundary for buffered CLI child processes.
 * 2. Expose queue/running observations without owning command semantics or subprocess lifecycle.
 * 3. Retire queued admissions when the owning CliExecutor is disposed.
 *
 * Original request (2026-07-31): "系统性地进行修复，因为List页面也有类似的问题。所有可能其它页面都有类似的问题。"
 * Owner evidence (2026-07-31): a spawned `openspec doctor --json` emitted no stdout for 12.95s
 *   while other Dashboard-originated CLI projection work was active.
 */
import { performance } from 'node:perf_hooks'

export interface CliBufferedAdmissionStats {
  active: number
  waiting: number
}

export interface CliBufferedAdmissionEvidence {
  activeAtEnqueue: number
  waitingAtEnqueue: number
  waitMs: number
}

export interface CliBufferedAdmissionLease {
  readonly evidence: CliBufferedAdmissionEvidence
  release(): void
}

interface AdmissionWaiter {
  readonly enqueuedAt: number
  readonly activeAtEnqueue: number
  readonly waitingAtEnqueue: number
  readonly resolve: (lease: CliBufferedAdmissionLease | null) => void
  detachAbort(): void
  settled: boolean
}

/** One CliExecutor-wide buffered subprocess slot. Streaming terminal commands remain independent. */
export class CliBufferedAdmission {
  readonly limit = 1
  private active = 0
  private readonly queue: AdmissionWaiter[] = []

  acquire(signal: AbortSignal): Promise<CliBufferedAdmissionLease | null> {
    if (signal.aborted) return Promise.resolve(null)

    return new Promise((resolve) => {
      const waiter: AdmissionWaiter = {
        enqueuedAt: performance.now(),
        activeAtEnqueue: this.active,
        waitingAtEnqueue: this.queue.length,
        resolve,
        detachAbort: () => {},
        settled: false,
      }
      const abort = () => {
        if (waiter.settled) return
        waiter.settled = true
        waiter.detachAbort()
        const index = this.queue.indexOf(waiter)
        if (index >= 0) this.queue.splice(index, 1)
        resolve(null)
      }
      signal.addEventListener('abort', abort, { once: true })
      waiter.detachAbort = () => signal.removeEventListener('abort', abort)
      this.queue.push(waiter)
      this.drain()
    })
  }

  stats(): CliBufferedAdmissionStats {
    return { active: this.active, waiting: this.queue.length }
  }

  private drain(): void {
    if (this.active >= this.limit) return
    const waiter = this.queue.shift()
    if (!waiter) return
    if (waiter.settled) {
      this.drain()
      return
    }

    waiter.settled = true
    waiter.detachAbort()
    this.active += 1
    let released = false
    waiter.resolve({
      evidence: {
        activeAtEnqueue: waiter.activeAtEnqueue,
        waitingAtEnqueue: waiter.waitingAtEnqueue,
        waitMs: performance.now() - waiter.enqueuedAt,
      },
      release: () => {
        if (released) return
        released = true
        this.active -= 1
        this.drain()
      },
    })
  }
}
