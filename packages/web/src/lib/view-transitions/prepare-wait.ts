import { createViewTransitionWaitIndicatorController } from './wait-indicator'

interface WaitForPrepareTaskOptions {
  timeoutMs?: number
  indicatorDelayMs?: number
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
    timeoutMs = PREPARE_WAIT_TIMEOUT_MS,
    indicatorDelayMs = PREPARE_WAIT_INDICATOR_DELAY_MS,
  } = options

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
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
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

    const timeoutId =
      timeoutMs > 0
        ? window.setTimeout(() => {
            finish({ status: 'timeout' })
          }, timeoutMs)
        : null

    void task()
      .then((value) => {
        finish({ status: 'ready', value })
      })
      .catch((error) => {
        finish({ status: 'error', error })
      })
  })
}
