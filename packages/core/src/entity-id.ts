/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Validate filesystem-backed OpenSpec entity ids as canonical single path segments.
 * 2. Validate entity-relative file and glob paths before filesystem access.
 * 3. Share traversal guards across Core adapters, kernels, and Server path resolvers.
 *
 * Original request (2026-07-16): "实际文件变更只能发生在选定的 planning root 内。"
 */

export type OpenSpecEntityIdField = 'changeId' | 'specId'
export type OpenSpecEntityPathField = 'outputPath' | 'path'

/** Return one path-safe OpenSpec entity id or reject it before filesystem access. */
export function requireCanonicalOpenSpecEntityId(
  value: string,
  field: OpenSpecEntityIdField
): string {
  if (
    value.length === 0 ||
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
