/**
 * Orthogonal intents (created 2026-08-02 Asia/Shanghai):
 * 1. Own a bounded replay ledger of request-addressable Launch Project initialization operations.
 * 2. Keep cancellation attached until the underlying CLI process confirms settlement, including pre-start cancellation.
 * 3. Withhold successful terminal delivery until injected replacement postconditions settle.
 *
 * Original request (2026-08-01): initialize a missing Launch Project with explicit confirmation.
 * Review correction (2026-08-02): cancelled and successful UI states require objective Server settlement.
 */
import type { CliStreamEvent, CliStreamHandle, CliStreamSettlement } from '@openspecui/core'

function createDeferred<T>(): {
  promise: Promise<T>
  resolve(value: T): void
  reject(error: unknown): void
} {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, resolve, reject }
}

interface ProjectInitializationRecord {
  requestId: string
  handle: CliStreamHandle
  events: CliStreamEvent[]
  listeners: Set<(event: CliStreamEvent) => void>
}

export interface StartProjectInitializationInput {
  requestId: string
  onEvent(event: CliStreamEvent): void
  start(onEvent: (event: CliStreamEvent) => void): CliStreamHandle
  settleSuccess(): Promise<void>
}

/** Server-local single-operation owner for Launch Project initialization. */
export class ProjectInitializationOperationOwner {
  private active: ProjectInitializationRecord | null = null
  private readonly records = new Map<string, ProjectInitializationRecord>()

  start(input: StartProjectInitializationInput): CliStreamHandle {
    const existing = this.records.get(input.requestId)
    if (existing) {
      for (const event of existing.events) input.onEvent(event)
      if (this.active === existing) existing.listeners.add(input.onEvent)
      return existing.handle
    }
    if (this.active) {
      throw new Error(`Project initialization ${this.active.requestId} is already running.`)
    }

    const terminal = createDeferred<CliStreamSettlement>()
    let successSettlementStarted = false
    let cancelRequested = false
    let rawHandle: CliStreamHandle | null = null
    let record: ProjectInitializationRecord

    const emit = (event: CliStreamEvent) => {
      record.events.push(event)
      for (const listener of record.listeners) listener(event)
    }

    const settleSuccess = (event: CliStreamEvent) => {
      if (successSettlementStarted) return
      successSettlementStarted = true
      void input.settleSuccess().then(
        () => {
          emit(event)
          terminal.resolve({ reason: 'exited', exitCode: 0 })
        },
        (error: unknown) => {
          emit({
            type: 'stderr',
            data: error instanceof Error ? error.message : String(error),
          })
          emit({ type: 'exit', exitCode: 1 })
          terminal.resolve({ reason: 'exited', exitCode: 1 })
        }
      )
    }

    const handle: CliStreamHandle = {
      settled: terminal.promise,
      cancel: () => {
        if (!cancelRequested) {
          cancelRequested = true
          if (rawHandle) {
            void rawHandle.cancel().catch((error: unknown) => terminal.reject(error))
          } else {
            terminal.resolve({ reason: 'cancelled', exitCode: null })
          }
        }
        return terminal.promise
      },
    }
    record = {
      requestId: input.requestId,
      handle,
      events: [],
      listeners: new Set([input.onEvent]),
    }
    this.active = record
    this.retain(record)

    try {
      rawHandle = input.start((event) => {
        if (event.type === 'exit' && event.exitCode === 0) {
          settleSuccess(event)
          return
        }
        emit(event)
      })
    } catch (error) {
      terminal.reject(error)
      throw error
    }

    void rawHandle.settled.then(
      (settlement) => {
        if (settlement.reason === 'exited' && settlement.exitCode === 0) return
        terminal.resolve(settlement)
      },
      (error: unknown) => terminal.reject(error)
    )

    void terminal.promise
      .finally(() => {
        if (this.active === record) this.active = null
      })
      .catch(() => {})
    return handle
  }

  cancel(requestId: string): Promise<CliStreamSettlement> {
    const existing = this.records.get(requestId)
    if (existing) return existing.handle.cancel()
    const settlement: CliStreamSettlement = { reason: 'cancelled', exitCode: null }
    const handle: CliStreamHandle = {
      settled: Promise.resolve(settlement),
      cancel: () => Promise.resolve(settlement),
    }
    this.retain({
      requestId,
      handle,
      events: [{ type: 'exit', exitCode: null }],
      listeners: new Set(),
    })
    return Promise.resolve(settlement)
  }

  private retain(record: ProjectInitializationRecord): void {
    this.records.set(record.requestId, record)
    while (this.records.size > 256) {
      const oldestRequestId = this.records.keys().next().value
      if (!oldestRequestId) return
      const oldest = this.records.get(oldestRequestId)
      if (oldest === this.active) {
        this.records.delete(oldestRequestId)
        this.records.set(oldestRequestId, oldest)
        continue
      }
      this.records.delete(oldestRequestId)
    }
  }
}
