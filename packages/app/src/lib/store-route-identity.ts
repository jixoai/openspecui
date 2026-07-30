/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Validate and decode composite Store Detail route path values (7.1).
 * 2. Treat envUri as an opaque encoded value; never parse it as a dereferenceable URL.
 * 3. Require the complete composite identity; Store id alone must never key a route transition.
 *
 * Original request (2026-07-30): "Stores 完全可以融入 `Environment Center` 这个东西。"
 * Spec: hosted-app-distribution › "Product-Shaped Store Index And Detail".
 *
 * Canonical routes:
 *   /stores                              selected-Environment index
 *   /stores/environments                 Environment evidence subpage
 *   /stores/$encodedEnvUri/$storeId      Store Detail
 *
 * Static child segments (`environments`) take precedence over dynamic detail matching.
 */

/** One decoded composite Store Detail identity from the route path. */
export interface StoreDetailRouteIdentity {
  /** Opaque decoded envUri; never dereferenced or reconstructed. */
  readonly envUri: string
  readonly storeId: string
}

/** Encode an opaque envUri for safe use as a single route path segment. */
export function encodeEnvUriSegment(envUri: string): string {
  // URI-encode the whole value so any '/', '?', '#' inside the opaque envUri becomes a single path segment.
  return encodeURIComponent(envUri)
}

/** Decode an encoded envUri path segment back to its opaque value. */
export function decodeEnvUriSegment(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

/** Whether a string is a valid non-empty Store id segment. */
export function isValidStoreIdSegment(segment: string): boolean {
  return segment.length > 0 && !segment.includes('/')
}

/**
 * Parse composite Store Detail identity from encoded path segments.
 *
 * Returns null when either segment is missing/invalid. The envUri is treated as opaque and is never parsed as a
 * URL. Store id alone is never accepted as sufficient identity.
 */
export function parseStoreDetailRouteIdentity(
  encodedEnvUri: string | undefined,
  storeId: string | undefined
): StoreDetailRouteIdentity | null {
  if (encodedEnvUri === undefined || storeId === undefined) return null
  if (!isValidStoreIdSegment(encodedEnvUri) || !isValidStoreIdSegment(storeId)) return null
  const envUri = decodeEnvUriSegment(encodedEnvUri)
  if (!envUri) return null
  return { envUri, storeId }
}

/** Build the canonical Store Detail path from a composite identity. */
export function buildStoreDetailPath(identity: StoreDetailRouteIdentity): string {
  return `/stores/${encodeEnvUriSegment(identity.envUri)}/${encodeURIComponent(identity.storeId)}`
}

/** Build the canonical Stores index path. */
export function buildStoresIndexPath(): string {
  return '/stores'
}

/** Build the canonical Environment evidence subpage path. */
export function buildStoresEnvironmentsPath(): string {
  return '/stores/environments'
}
