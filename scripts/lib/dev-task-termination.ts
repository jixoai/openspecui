/**
 * Orthogonal intents (created 2026-08-09 Asia/Shanghai):
 * 1. Settle interactive development Stop/Restart failures without unhandled promise rejection.
 *
 * Original request (2026-08-09): "Continue the Windows adaptation and handle similar issues together."
 */
export type DevTaskTerminationAction = 'restart' | 'stop'

export interface DevTaskTerminationFailure {
  readonly action: DevTaskTerminationAction
  readonly error: unknown
  readonly message: string
  readonly taskId: string
}

/** Execute one termination request and convert every rejection into explicit task evidence. */
export async function settleDevTaskTermination(options: {
  readonly action: DevTaskTerminationAction
  readonly taskId: string
  readonly terminate: () => Promise<void>
  readonly onFailure: (failure: DevTaskTerminationFailure) => void
}): Promise<void> {
  try {
    await options.terminate()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    try {
      options.onFailure({ action: options.action, error, message, taskId: options.taskId })
    } catch (reportError) {
      console.error(
        `[${options.taskId}] ${options.action} failed: ${message}; reporting also failed: ${String(reportError)}`
      )
    }
  }
}
