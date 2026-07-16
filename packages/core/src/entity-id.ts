/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Validate filesystem-backed OpenSpec entity ids as canonical single path segments.
 * 2. Share one traversal guard across Core adapters and Server path resolvers.
 *
 * Original request (2026-07-16): "实际文件变更只能发生在选定的 planning root 内。"
 */

export type OpenSpecEntityIdField = 'changeId' | 'specId'

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
