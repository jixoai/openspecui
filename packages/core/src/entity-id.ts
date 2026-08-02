/**
 * Orthogonal intents (updated 2026-08-01 Asia/Shanghai):
 * 1. Validate filesystem-backed OpenSpec entity ids as canonical single path segments.
 * 2. Validate recursive Spec ids without weakening single-segment Change ids.
 * 3. Validate entity-relative file and glob paths before filesystem access.
 * 4. Share traversal guards across Core adapters, kernels, and Server path resolvers.
 *
 * Original request (2026-07-16): "实际文件变更只能发生在选定的 planning root 内。"
 * Original request (2026-07-17): "Every client-supplied Archive changeId passes the shared canonical entity guard."
 * Original request (2026-08-01): adapt OpenSpec 1.7 nested Spec ids such as `platform/auth`.
 */

export type OpenSpecEntityIdField = 'changeId'
/** Public field names accepted by OpenSpec entity path validation. */
export type OpenSpecEntityPathField = 'outputPath' | 'path'

const MAX_OPENSPEC_SPEC_ID_LENGTH = 4096
const MAX_OPENSPEC_SPEC_ID_DECODE_DEPTH = 8

/** Return one path-safe OpenSpec entity id or reject it before filesystem access. */
export function requireCanonicalOpenSpecEntityId(
  value: string,
  field: OpenSpecEntityIdField
): string {
  if (
    value.length === 0 ||
    value !== value.trim() ||
    value === '.' ||
    value === '..' ||
    value.includes('/') ||
    value.includes('\\') ||
    value.includes('\0')
  ) {
    throw new Error(`Invalid ${field}: expected one canonical path segment.`)
  }
  return value
}

function assertCanonicalSpecPath(value: string): void {
  const segments = value.split('/')
  if (
    value.length === 0 ||
    value !== value.trim() ||
    value.includes('\\') ||
    value.includes('\0') ||
    value.startsWith('/') ||
    /^[A-Za-z]:/.test(value) ||
    segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')
  ) {
    throw new Error('Invalid specId: expected a canonical recursive Spec path.')
  }
}

/** Return one canonical slash-separated Spec id or reject raw and encoded traversal. */
export function requireCanonicalOpenSpecSpecId(value: string): string {
  if (value.length > MAX_OPENSPEC_SPEC_ID_LENGTH) {
    throw new Error('Invalid specId: recursive Spec path exceeds the supported length.')
  }

  let candidate = value
  for (let depth = 0; depth < MAX_OPENSPEC_SPEC_ID_DECODE_DEPTH; depth += 1) {
    assertCanonicalSpecPath(candidate)
    try {
      const decoded = decodeURIComponent(candidate)
      if (decoded === candidate) return value
      candidate = decoded
    } catch {
      return value
    }
  }

  throw new Error('Invalid specId: encoded Spec path exceeds the supported decode depth.')
}

/** Return one normalized entity-relative path or glob without parent traversal. */
export function requireOpenSpecEntityRelativePath(
  value: string,
  field: OpenSpecEntityPathField
): string {
  const normalizedSeparators = value.replace(/\\/g, '/')
  if (
    normalizedSeparators.length === 0 ||
    normalizedSeparators.includes('\0') ||
    normalizedSeparators.startsWith('/') ||
    /^[A-Za-z]:/.test(normalizedSeparators) ||
    normalizedSeparators.split('/').includes('..')
  ) {
    throw new Error(`Invalid ${field}: expected an entity-relative path.`)
  }

  const normalizedPath = normalizedSeparators
    .split('/')
    .filter((segment) => segment.length > 0 && segment !== '.')
    .join('/')
  if (!normalizedPath) {
    throw new Error(`Invalid ${field}: expected an entity-relative path.`)
  }
  return normalizedPath
}
