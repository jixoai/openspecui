const RETRYABLE_STATUS_CODES = new Set([
  408, 409, 425, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524,
])

const RETRYABLE_ERROR_CODES = new Set([
  'ECONNABORTED',
  'ECONNREFUSED',
  'ECONNRESET',
  'EAI_AGAIN',
  'ENETDOWN',
  'ENETRESET',
  'ENETUNREACH',
  'ENOTFOUND',
  'ETIMEDOUT',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_SOCKET',
])

const RETRYABLE_MESSAGE_FRAGMENTS = [
  'fetch failed',
  'timeout',
  'timed out',
  'socket hang up',
  'econnreset',
  'econnrefused',
  'eai_again',
  'enotfound',
  'terminated',
  'too many requests',
  'rate limit',
  'bad gateway',
  'service unavailable',
  'gateway timeout',
  'temporarily unavailable',
  'connection reset',
  'connection refused',
]

export interface RetryableNetworkErrorOptions {
  treatUnknownAsRetryable?: boolean
}

export function isRetryableNetworkStatusCode(statusCode: number): boolean {
  return RETRYABLE_STATUS_CODES.has(statusCode)
}

export function isRetryableNetworkError(
  error: unknown,
  options: RetryableNetworkErrorOptions = {}
): boolean {
  return isRetryableNetworkErrorInternal(error, options, new Set<unknown>())
}

function isRetryableNetworkErrorInternal(
  error: unknown,
  options: RetryableNetworkErrorOptions,
  seen: Set<unknown>
): boolean {
  if (error === undefined || error === null) {
    return options.treatUnknownAsRetryable ?? false
  }
  if (typeof error === 'string') {
    return isRetryableNetworkMessage(error)
  }
  if (typeof error !== 'object') {
    return options.treatUnknownAsRetryable ?? false
  }
  if (seen.has(error)) {
    return false
  }
  seen.add(error)

  const record = error as Record<string, unknown>
  if (record.name === 'AbortError') {
    return false
  }

  const statusCode = readNumericField(record, ['statusCode', 'status'])
  if (statusCode !== undefined && isRetryableNetworkStatusCode(statusCode)) {
    return true
  }

  const code = typeof record.code === 'string' ? record.code.toUpperCase() : undefined
  if (code && RETRYABLE_ERROR_CODES.has(code)) {
    return true
  }

  if (typeof record.message === 'string' && isRetryableNetworkMessage(record.message)) {
    return true
  }

  if ('cause' in record) {
    return isRetryableNetworkErrorInternal(record.cause, options, seen)
  }

  return options.treatUnknownAsRetryable ?? false
}

function readNumericField(
  record: Record<string, unknown>,
  keys: ReadonlyArray<string>
): number | undefined {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
  }
  return undefined
}

function isRetryableNetworkMessage(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    RETRYABLE_MESSAGE_FRAGMENTS.some((fragment) => lower.includes(fragment)) ||
    hasRetryableStatusInMessage(lower)
  )
}

function hasRetryableStatusInMessage(message: string): boolean {
  const statusMatch = message.match(/status\s+(\d{3})/)
  if (!statusMatch) return false
  const statusCode = Number(statusMatch[1])
  return isRetryableNetworkStatusCode(statusCode)
}
