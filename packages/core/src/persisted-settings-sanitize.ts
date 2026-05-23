import { z } from 'zod'

type PersistedPath = readonly [string, ...string[]]

interface PersistedObjectRule {
  kind: 'object'
  path: PersistedPath
  fallback: Record<string, unknown>
}

interface PersistedFieldRule<T> {
  kind: 'field'
  path: PersistedPath
  schema: z.ZodType<T>
  fallback: T | undefined
}

export type PersistedSanitizeRule = PersistedObjectRule | PersistedFieldRule<unknown>

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function readPath(
  value: unknown,
  path: readonly string[]
): { exists: boolean; value: unknown } {
  let current = value
  for (const key of path) {
    if (!isPlainObject(current) || !Object.prototype.hasOwnProperty.call(current, key)) {
      return { exists: false, value: undefined }
    }
    current = current[key]
  }
  return { exists: true, value: current }
}

function writePath(
  value: unknown,
  path: readonly string[],
  nextValue: unknown
): Record<string, unknown> | unknown {
  if (!isPlainObject(value)) {
    return value
  }

  const [head, ...tail] = path
  const clone: Record<string, unknown> = { ...value }

  if (tail.length === 0) {
    if (nextValue === undefined) {
      delete clone[head]
    } else {
      clone[head] = nextValue
    }
    return clone
  }

  const currentChild = clone[head]
  clone[head] = writePath(isPlainObject(currentChild) ? currentChild : {}, tail, nextValue)
  return clone
}

/**
 * Treat persisted settings/config as untrusted input and repair known invalid
 * fields before the authoritative schema parse runs.
 */
export function sanitizePersistedSettings(
  value: unknown,
  rules: readonly PersistedSanitizeRule[]
): unknown {
  let sanitized = value

  for (const rule of rules) {
    const current = readPath(sanitized, rule.path)
    if (!current.exists) {
      continue
    }

    if (rule.kind === 'object') {
      if (!isPlainObject(current.value)) {
        sanitized = writePath(sanitized, rule.path, rule.fallback)
      }
      continue
    }

    if (!rule.schema.safeParse(current.value).success) {
      sanitized = writePath(sanitized, rule.path, rule.fallback)
    }
  }

  return sanitized
}
