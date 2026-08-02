/**
 * Orthogonal intents (updated 2026-08-01 Asia/Shanghai):
 * 1. Prove compound Spec keys, routes, and lookup remain collision-safe across sources.
 * 2. Prove live and static owned Catalog provenance remain source-distinct.
 * 3. Prove recursive Spec identities remain complete and traversal-safe at schema boundaries.
 *
 * Original request (2026-07-15): "Live and static modes share one source-aware Spec Catalog."
 */
import { describe, expect, it } from 'vitest'
import {
  buildSpecCatalog,
  createStaticSpecCatalogOwnedProjection,
  getSpecCatalogEntry,
  OwnedSpecIdentitySchema,
  ReferencedSpecIdentitySchema,
  specIdentityFromRoute,
  specIdentityKey,
  specRoutePath,
} from './spec-catalog.js'

describe('Spec Catalog', () => {
  const catalog = buildSpecCatalog({
    owned: [{ id: 'auth', requirementCount: 3 }],
    ownedProjection: {
      provenance: 'live',
      root: { path: '/planning', source: 'nearest' },
      evidence: {
        success: true,
        stdout: '{}',
        stderr: '',
        exitCode: 0,
        payload: {},
        diagnostics: [],
      },
    },
    referenced: [
      {
        storeId: 'platform-a',
        specs: [{ id: 'auth', requirementCount: 1 }],
      },
      {
        storeId: 'platform-b',
        specs: [{ id: 'auth', requirementCount: 2 }],
      },
    ],
    referenceSources: ['platform-a', 'platform-b'].map((storeId) => ({
      storeId,
      provenance: 'live' as const,
      state: 'ready' as const,
      diagnostics: [],
      evidence: {
        success: true,
        stdout: '{}',
        stderr: '',
        exitCode: 0,
        payload: {},
        diagnostics: [],
      },
    })),
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
    expect(catalog.entries[0]).toMatchObject({
      name: 'auth',
      requirementCount: 3,
      updatedAt: 0,
    })
    expect(catalog.ownedProjection).toMatchObject({ provenance: 'live' })
  })

  it('does not turn static snapshot inventory into live CLI evidence', () => {
    expect(createStaticSpecCatalogOwnedProjection(2)).toEqual({
      provenance: 'static',
      state: 'available',
      snapshot: { specCount: 2 },
    })
    expect(createStaticSpecCatalogOwnedProjection()).toEqual({
      provenance: 'static',
      state: 'unavailable',
    })
  })

  it('looks up the exact compound identity instead of bare specId', () => {
    expect(
      getSpecCatalogEntry(catalog, {
        kind: 'referenced',
        storeId: 'platform-b',
        specId: 'auth',
      })
    ).toMatchObject({ requirementCount: 2, readOnly: true })
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

  it('parses recursive owned and Store-qualified Spec identities without flattening', () => {
    expect(OwnedSpecIdentitySchema.parse({ kind: 'owned', specId: 'platform/auth' })).toEqual({
      kind: 'owned',
      specId: 'platform/auth',
    })
    expect(
      ReferencedSpecIdentitySchema.parse({
        kind: 'referenced',
        storeId: 'platform-store',
        specId: 'platform/auth',
      })
    ).toEqual({
      kind: 'referenced',
      storeId: 'platform-store',
      specId: 'platform/auth',
    })
    expect(specIdentityFromRoute({ specId: 'platform/auth' })).toEqual({
      kind: 'owned',
      specId: 'platform/auth',
    })
  })

  it.each(['../secret', 'platform//auth', '/platform/auth', '%2e%2e%2fsecret'])(
    'rejects unsafe Spec identity %j at the catalog schema boundary',
    (specId) => {
      expect(() => OwnedSpecIdentitySchema.parse({ kind: 'owned', specId })).toThrow()
      expect(() =>
        ReferencedSpecIdentitySchema.parse({
          kind: 'referenced',
          storeId: 'platform-store',
          specId,
        })
      ).toThrow()
    }
  )
})
