/**
 * Orthogonal intents (updated 2026-07-23 Asia/Shanghai):
 * 1. Bound preparation waits with a cancellable timeout and wait indicator.
 * 2. Preserve cancellation, timeout, and error facts for the navigation coordinator.
 * 3. Keep late preparation settlement harmless after a non-blocking route commit.
 *
 * Original request (2026-07-23): "页面数据的加载数据非常慢...切换个页面也等"
 * Derived requirement (2026-07-23): Detail prefetch must not hold cold navigation past its commit budget.
 */
import { createViewTransitionWaitIndicatorController } from './wait-indicator'

interface WaitForPrepareTaskOptions {
  /** Maximum time a caller may wait before it must commit without preparation. */
  deadlineMs?: number
  /** Legacy full preparation timeout used when no caller-specific deadline is supplied. */
  timeoutMs?: number
  indicatorDelayMs?: number
  /** Consume a rejection that arrives after the caller has already committed. */
  onLateError?: (error: unknown) => void
}

type WaitForPrepareTaskResult<T> =
  | { status: 'ready'; value: T }
  | { status: 'cancelled' }
  | { status: 'timeout' }
  | { status: 'error'; error: unknown }

const PREPARE_WAIT_TIMEOUT_MS = 2_500
const PREPARE_WAIT_INDICATOR_DELAY_MS = 140

export function waitForPrepareTask<T>(
  task: () => Promise<T>,
  options: WaitForPrepareTaskOptions = {}
): Promise<WaitForPrepareTaskResult<T>> {
  const {
    deadlineMs,
    timeoutMs = PREPARE_WAIT_TIMEOUT_MS,
    indicatorDelayMs = PREPARE_WAIT_INDICATOR_DELAY_MS,
    onLateError,
  } = options
  const effectiveDeadlineMs = deadlineMs ?? timeoutMs

  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return task()
      .then((value) => ({ status: 'ready', value }) as const)
      .catch((error) => ({ status: 'error', error }) as const)
  }

  const indicator = createViewTransitionWaitIndicatorController()
  indicator.schedule(indicatorDelayMs)

  return new Promise<WaitForPrepareTaskResult<T>>((resolve) => {
    let settled = false

    const finish = (result: WaitForPrepareTaskResult<T>) => {
      if (settled) return
      settled = true
      if (deadlineId !== null) {
        window.clearTimeout(deadlineId)
      }
      document.removeEventListener('keydown', onKeyDown, true)
      indicator.hide()
      resolve(result)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      finish({ status: 'cancelled' })
    }

    document.addEventListener('keydown', onKeyDown, true)

    const deadlineId =
      effectiveDeadlineMs > 0
        ? window.setTimeout(() => {
            finish({ status: 'timeout' })
          }, effectiveDeadlineMs)
        : null

    void Promise.resolve()
      .then(task)
      .then((value) => {
        finish({ status: 'ready', value })
      })
      .catch((error) => {
        if (settled) {
          try {
            onLateError?.(error)
          } catch {
            // Late diagnostics must never become an unhandled rejection.
          }
          return
        }
        finish({ status: 'error', error })
      })
  })
}
