/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Prove composite Store Detail route identity decode/encode round-trips and treats envUri as opaque (7.1).
 * 2. Prove Store id alone is never accepted as sufficient identity.
 *
 * Original request (2026-07-30): "Stores 完全可以融入 `Environment Center` 这个东西。"
 */
import { describe, expect, it } from 'vitest'
import {
  buildStoreDetailPath,
  buildStoresEnvironmentsPath,
  buildStoresIndexPath,
  decodeEnvUriSegment,
  encodeEnvUriSegment,
  parseStoreDetailRouteIdentity,
} from './store-route-identity'

describe('Store route identity (7.1)', () => {
  it('encodes and decodes an opaque envUri as a single path segment', () => {
    const envUri = 'openspecui-env://1/host+data-home'
    const encoded = encodeEnvUriSegment(envUri)
    expect(encoded).not.toContain('/')
    expect(decodeEnvUriSegment(encoded)).toBe(envUri)
  })

  it('parses a composite Store Detail identity from encoded path segments', () => {
    const encoded = encodeEnvUriSegment('env://1')
    const identity = parseStoreDetailRouteIdentity(encoded, 'team')
    expect(identity).toEqual({ envUri: 'env://1', storeId: 'team' })
  })

  it('rejects an incomplete identity (Store id alone is never sufficient)', () => {
    expect(parseStoreDetailRouteIdentity(undefined, 'team')).toBeNull()
    expect(parseStoreDetailRouteIdentity(encodeEnvUriSegment('env://1'), undefined)).toBeNull()
  })

  it('rejects malformed segments', () => {
    expect(parseStoreDetailRouteIdentity('', 'team')).toBeNull()
    expect(parseStoreDetailRouteIdentity(encodeEnvUriSegment('env://1'), '')).toBeNull()
    // A segment containing a raw '/' is invalid.
    expect(parseStoreDetailRouteIdentity('env//1', 'team')).toBeNull()
  })

  it('builds canonical Store routes from a composite identity', () => {
    expect(buildStoresIndexPath()).toBe('/stores')
    expect(buildStoresEnvironmentsPath()).toBe('/stores/environments')
    const path = buildStoreDetailPath({ envUri: 'env://1', storeId: 'team' })
    expect(path).toBe(`/stores/${encodeEnvUriSegment('env://1')}/team`)
    expect(path.startsWith('/stores/')).toBe(true)
  })

  it('treats the envUri as opaque: a URL-shaped envUri is not dereferenced', () => {
    const envUri = 'https://example.com/env/1'
    const encoded = encodeEnvUriSegment(envUri)
    // The opaque value survives as one segment and is never parsed as a route to fetch.
    const identity = parseStoreDetailRouteIdentity(encoded, 'team')
    expect(identity?.envUri).toBe(envUri)
  })
})
