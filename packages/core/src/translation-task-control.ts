export const BATCH_TRANSLATION_ERROR_KINDS = [
  'timeout',
  'memory-limit',
  'runtime',
  'abort',
] as const

export type BatchTranslationErrorKind = (typeof BATCH_TRANSLATION_ERROR_KINDS)[number]

export interface BatchTranslationError {
  kind: BatchTranslationErrorKind
  message: string
}

export interface ControlledTranslationTaskOptions {
  signal?: AbortSignal
  timeoutMs?: number
}

type ControlledTranslationTaskResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: BatchTranslationError }

export async function runControlledTranslationTask<T>(
  task: (signal: AbortSignal) => Promise<T>,
  options: ControlledTranslationTaskOptions = {}
): Promise<ControlledTranslationTaskResult<T>> {
  const controller = new AbortController()
  const cleanupCallbacks: Array<() => void> = []
  const parentSignal = options.signal
  const timeoutMs = normalizeTimeoutMs(options.timeoutMs)

  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort(parentSignal.reason)
    } else {
      const onAbort = () => controller.abort(parentSignal.reason)
      parentSignal.addEventListener('abort', onAbort, { once: true })
      cleanupCallbacks.push(() => parentSignal.removeEventListener('abort', onAbort))
    }
  }

  if (controller.signal.aborted) {
    cleanupCallbacks.forEach((callback) => callback())
    return {
      ok: false,
      error: normalizeBatchTranslationError(controller.signal.reason, parentSignal),
    }
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  let timeoutError: Error | undefined
  const taskPromise = Promise.resolve().then(() => task(controller.signal))
  void taskPromise.catch(() => undefined)

  const races: Promise<T>[] = [taskPromise]
  if (!controller.signal.aborted) {
    races.push(
      new Promise<T>((_, reject) => {
        const onAbort = () => reject(new DOMException('Translation cancelled.', 'AbortError'))
        controller.signal.addEventListener('abort', onAbort, { once: true })
        cleanupCallbacks.push(() => controller.signal.removeEventListener('abort', onAbort))
      })
    )
  }
  if (timeoutMs !== undefined) {
    races.push(
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          timeoutError = new Error(`Translation task timed out after ${timeoutMs}ms.`)
          controller.abort(timeoutError)
          reject(timeoutError)
        }, timeoutMs)
      })
    )
  }

  try {
    return { ok: true, value: await Promise.race(races) }
  } catch (error) {
    controller.abort(error)
    if (timeoutError && controller.signal.reason === timeoutError) {
      return {
        ok: false,
        error: {
          kind: 'timeout',
          message: timeoutError.message,
        },
      }
    }
    return {
      ok: false,
      error: normalizeBatchTranslationError(error, parentSignal),
    }
  } finally {
    if (timer) clearTimeout(timer)
    cleanupCallbacks.forEach((callback) => callback())
  }
}

export function normalizeBatchTranslationError(
  error: unknown,
  parentSignal?: AbortSignal
): BatchTranslationError {
  if (isBatchTranslationError(error)) {
    return error
  }
  if (parentSignal?.aborted) {
    return {
      kind: 'abort',
      message: readAbortMessage(parentSignal.reason) ?? 'Translation cancelled.',
    }
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    return {
      kind: 'abort',
      message: readAbortMessage(error) ?? 'Translation cancelled.',
    }
  }

  const message = getErrorMessage(error)
  if (isTimeoutMessage(message)) {
    return { kind: 'timeout', message }
  }
  if (isMemoryLimitMessage(message)) {
    return { kind: 'memory-limit', message }
  }
  return { kind: 'runtime', message }
}

export function isBatchTranslationAbort(
  error: BatchTranslationError,
  signal: AbortSignal | undefined
): boolean {
  return error.kind === 'abort' && !!signal?.aborted
}

function normalizeTimeoutMs(timeoutMs: number | undefined): number | undefined {
  return typeof timeoutMs === 'number' && Number.isFinite(timeoutMs) && timeoutMs > 0
    ? Math.floor(timeoutMs)
    : undefined
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }
  if (typeof error === 'string' && error.trim().length > 0) {
    return error
  }
  return 'Translation failed.'
}

function readAbortMessage(reason: unknown): string | undefined {
  if (reason instanceof Error && reason.message.trim().length > 0) return reason.message
  if (typeof reason === 'string' && reason.trim().length > 0) return reason
  return undefined
}

function isTimeoutMessage(message: string): boolean {
  return /\btime(?:d)?\s*out\b/i.test(message)
}

function isMemoryLimitMessage(message: string): boolean {
  return (
    /out of memory/i.test(message) ||
    /memory limit/i.test(message) ||
    /insufficient memory/i.test(message) ||
    /ERR_WORKER_OUT_OF_MEMORY/i.test(message)
  )
}

function isBatchTranslationError(value: unknown): value is BatchTranslationError {
  if (typeof value !== 'object' || value === null) return false
  const kind = Reflect.get(value, 'kind')
  const message = Reflect.get(value, 'message')
  return (
    typeof kind === 'string' &&
    BATCH_TRANSLATION_ERROR_KINDS.includes(kind as BatchTranslationErrorKind) &&
    typeof message === 'string' &&
    message.length > 0
  )
}
