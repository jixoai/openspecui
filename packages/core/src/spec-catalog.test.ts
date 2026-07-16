/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Prove compound Spec keys, routes, and lookup remain collision-safe across sources.
 *
 * Original request (2026-07-15): "Live and static modes share one source-aware Spec Catalog."
 */
import { describe, expect, it } from 'vitest'
import {
  buildSpecCatalog,
  getSpecCatalogEntry,
  specIdentityFromRoute,
  specIdentityKey,
  specRoutePath,
} from './spec-catalog.js'

describe('Spec Catalog', () => {
  const catalog = buildSpecCatalog({
    owned: [{ id: 'auth', name: 'Owned Auth', updatedAt: 3 }],
    references: [
      {
        store_id: 'platform-a',
        specs: [{ id: 'auth', summary: 'Platform A auth' }],
        status: [],
      },
      {
        store_id: 'platform-b',
        specs: [{ id: 'auth', summary: 'Platform B auth' }],
        status: [],
      },
    ],
    observedAt: 10,
  })

  it('keeps duplicate ids across owned and multiple Store sources', () => {
    expect(catalog.entries).toHaveLength(3)
    expect(catalog.entries.map((entry) => specIdentityKey(entry.identity))).toEqual([
      'owned:auth',
      'referenced:platform-a:auth',
      'referenced:platform-b:auth',
    ])
    expect(catalog.entries.map((entry) => entry.readOnly)).toEqual([false, true, true])
  })

  it('looks up the exact compound identity instead of bare specId', () => {
    expect(
      getSpecCatalogEntry(catalog, {
        kind: 'referenced',
        storeId: 'platform-b',
        specId: 'auth',
      })
    ).toMatchObject({ summary: 'Platform B auth', readOnly: true })
  })

  it('uses compound live/static routes and round-trips route params', () => {
    expect(specRoutePath({ kind: 'owned', specId: 'auth' })).toBe('/specs/owned/auth')
    expect(specRoutePath({ kind: 'referenced', storeId: 'platform-a', specId: 'auth' })).toBe(
      '/specs/referenced/platform-a/auth'
    )
    expect(specIdentityFromRoute({ specId: 'auth' })).toEqual({ kind: 'owned', specId: 'auth' })
    expect(specIdentityFromRoute({ storeId: 'platform-a', specId: 'auth' })).toEqual({
      kind: 'referenced',
      storeId: 'platform-a',
      specId: 'auth',
    })
  })

  it('encodes route and key segments so delimiters cannot collide', () => {
    expect(specIdentityKey({ kind: 'referenced', storeId: 'a:b', specId: 'c/d' })).toBe(
      'referenced:a%3Ab:c%2Fd'
    )
    expect(specRoutePath({ kind: 'owned', specId: 'a/b c' })).toBe('/specs/owned/a%2Fb%20c')
  })
})
