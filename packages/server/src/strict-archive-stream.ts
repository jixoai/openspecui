/**
 * Orthogonal intents (updated 2026-07-17 Asia/Shanghai):
 * 1. Run strict validation before archive without exposing an intermediate terminal exit.
 * 2. Keep one settlement-aware cancel boundary across validation and Archive phase changes.
 * 3. Preserve validation failure and archive startup evidence as terminal stream outcomes.
 *
 * Original request (2026-07-15): "Archive readiness remains a CLI validate/archive outcome."
 * Original request (2026-07-17): "Strict Archive owns one lease through validation and Archive settlement."
 */
import type { CliStreamEvent, CliStreamHandle, CliStreamSettlement } from '@openspecui/core'

type StartCliStream = (onEvent: (event: CliStreamEvent) => void) => CliStreamHandle

function createSettlementDeferred(): {
  promise: Promise<CliStreamSettlement>
  resolve(value: CliStreamSettlement): void
  reject(reason?: unknown): void
} {
  let resolve!: (value: CliStreamSettlement) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<CliStreamSettlement>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

/** Validation, Archive, cancellation, and event boundaries for one strict Archive stream. */
export interface StrictArchiveStreamOptions {
  skipValidation: boolean
  startValidate: StartCliStream
  startArchive: StartCliStream
  onEvent: (event: CliStreamEvent) => void
}

/** Run validate then archive as one terminal stream while retaining CLI-owned evidence. */
export function startStrictArchiveStream(options: StrictArchiveStreamOptions): CliStreamHandle {
  const startupFailure = (error: unknown): CliStreamHandle => {
    options.onEvent({
      type: 'stderr',
      data: error instanceof Error ? error.message : String(error),
    })
    options.onEvent({ type: 'exit', exitCode: null })
    const settlement: CliStreamSettlement = { reason: 'startup-failed', exitCode: null }
    return {
      settled: Promise.resolve(settlement),
      cancel: () => Promise.resolve(settlement),
    }
  }

  if (options.skipValidation) {
    try {
      return options.startArchive(options.onEvent)
    } catch (error) {
      return startupFailure(error)
    }
  }

  const composite = createSettlementDeferred()
  let activeStream: CliStreamHandle | null = null
  let validationSucceeded = false
  let cancelRequested = false
  let cancelStarted = false

  const forwardSettlement = (stream: CliStreamHandle) => {
    void stream.settled.then(composite.resolve, composite.reject)
  }

  const startArchive = () => {
    if (cancelRequested) return
    try {
      const archive = options.startArchive(options.onEvent)
      activeStream = archive
      forwardSettlement(archive)
    } catch (error) {
      forwardSettlement(startupFailure(error))
    }
  }

  let validate: CliStreamHandle
  try {
    validate = options.startValidate((event) => {
      if (cancelRequested) return
      if (event.type === 'exit') {
        validationSucceeded = event.exitCode === 0
        if (!validationSucceeded) options.onEvent(event)
        return
      }
      options.onEvent(event)
    })
  } catch (error) {
    return startupFailure(error)
  }
  activeStream = validate
  void validate.settled.then((settlement) => {
    if (cancelRequested || !validationSucceeded) {
      composite.resolve(settlement)
      return
    }
    startArchive()
  }, composite.reject)

  const handle: CliStreamHandle = {
    settled: composite.promise,
    cancel: () => {
      if (!cancelStarted) {
        cancelStarted = true
        cancelRequested = true
        const stream = activeStream
        if (stream) void stream.cancel().catch(composite.reject)
      }
      return composite.promise
    },
  }
  void composite.promise.catch(() => {})
  return handle
}
