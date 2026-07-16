/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Run strict validation before archive without exposing an intermediate terminal exit.
 * 2. Keep one cancel boundary across both CLI processes and asynchronous phase changes.
 * 3. Preserve validation failure and archive startup evidence as terminal stream outcomes.
 *
 * Original request (2026-07-15): "Archive readiness remains a CLI validate/archive outcome."
 */
import type { CliStreamEvent } from '@openspecui/core'

type StartCliStream = (
  onEvent: (event: CliStreamEvent) => void
) => Promise<() => void> | (() => void)

/** Validation, Archive, cancellation, and event boundaries for one strict Archive stream. */
export interface StrictArchiveStreamOptions {
  skipValidation: boolean
  startValidate: StartCliStream
  startArchive: StartCliStream
  onEvent: (event: CliStreamEvent) => void
}

/** Run validate then archive as one terminal stream while retaining CLI-owned evidence. */
export async function startStrictArchiveStream(
  options: StrictArchiveStreamOptions
): Promise<() => void> {
  if (options.skipValidation) {
    return await options.startArchive(options.onEvent)
  }

  let activeCancel: (() => void) | null = null
  let activePhase = 0
  let cancelled = false

  const installCancel = (phase: number, cancel: () => void) => {
    if (cancelled || phase !== activePhase) {
      cancel()
      return
    }
    activeCancel = cancel
  }

  const emitArchiveStartFailure = (error: unknown) => {
    if (cancelled) return
    options.onEvent({
      type: 'stderr',
      data: error instanceof Error ? error.message : String(error),
    })
    options.onEvent({ type: 'exit', exitCode: null })
  }

  const startArchive = () => {
    const phase = ++activePhase
    void Promise.resolve(options.startArchive(options.onEvent)).then(
      (cancel) => installCancel(phase, cancel),
      emitArchiveStartFailure
    )
  }

  const validatePhase = ++activePhase
  const validateCancel = await options.startValidate((event) => {
    if (cancelled) return
    if (event.type !== 'exit') {
      options.onEvent(event)
      return
    }
    if (event.exitCode !== 0) {
      options.onEvent(event)
      return
    }
    startArchive()
  })
  installCancel(validatePhase, validateCancel)

  return () => {
    cancelled = true
    activePhase += 1
    activeCancel?.()
    activeCancel = null
  }
}
