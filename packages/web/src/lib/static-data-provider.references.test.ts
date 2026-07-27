/**
 * Orthogonal intents (updated 2026-07-25 Asia/Shanghai):
 * 1. Prove static provider hydrates compound referenced Spec routes and bodies.
 * 2. Prove static snapshot policy never becomes fabricated live CLI evidence.
 * 3. Prove omit/none policy produces an explicit omission error without leaking Store ids.
 * 4. Prove static Catalog retains omit, none, and unavailable Reference policy facts.
 * 5. Prove static search scopes referenced Specs to 'referenced-specs' only.
 *
 * Original request (2026-07-15): "Live and static modes share one source-aware Spec Catalog."
 * Section 7.9/7.10 static parity coverage.
 */
import type { ExportSnapshot } from '@openspecui/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const staticState = vi.hoisted(() => ({
  snapshot: null as ExportSnapshot | null,
}))

vi.mock('./static-mode', () => ({
  getBasePath: () => '/',
  getInitialData: () => staticState.snapshot,
}))

function baseMeta(): ExportSnapshot['meta'] {
  return {
    timestamp: '2026-07-23T00:00:00.000Z',
    observedAt: 1,
    version: '6.0.0',
    projectName: 'project',
    root: { planningRootPath: 'openspecui/project', rootSource: 'nearest', storeId: null },
    referencePolicy: {
      kind: 'include',
      referenceSources: [{ storeId: 'team', state: 'ready', specCount: 1 }],
    },
  }
}

function referencedSpec(): ExportSnapshot['specs'][number] {
  return {
    identity: { kind: 'referenced', storeId: 'team', specId: 'auth' },
    source: 'referenced',
    readOnly: true,
    storeId: 'team',
    id: 'auth',
    name: 'Team Auth',
    content: '# Team Auth\noverview body',
    overview: 'overview body',
    requirements: [
      {
        id: 'req-1',
        title: 'Requirement 1',
        bodyMarkdown: 'body',
        text: 'body',
        scenarios: [],
      },
    ],
    createdAt: 0,
    updatedAt: 0,
  }
}

function snapshotWith(
  specs: ExportSnapshot['specs'],
  referencePolicy: ExportSnapshot['meta']['referencePolicy']
): ExportSnapshot {
  return {
    meta: { ...baseMeta(), referencePolicy },
    dashboard: { specsCount: specs.length, changesCount: 0, archivesCount: 0 },
    specs,
    changes: [],
    archives: [],
  }
}

describe('static-data-provider references', () => {
  beforeEach(() => {
    staticState.snapshot = null
    vi.resetModules()
  })

  it('hydrates a referenced Spec catalog entry with compound identity and reference source', async () => {
    staticState.snapshot = snapshotWith([referencedSpec()], {
      kind: 'include',
      referenceSources: [{ storeId: 'team', state: 'ready', specCount: 1 }],
    })
    const { getSpecCatalog } = await import('./static-data-provider')
    const catalog = await getSpecCatalog()
    expect(catalog.entries).toHaveLength(1)
    expect(catalog.entries[0]).toMatchObject({
      identity: { kind: 'referenced', storeId: 'team', specId: 'auth' },
      source: 'referenced',
      readOnly: true,
    })
    expect(catalog.ownedProjection).toEqual({
      provenance: 'static',
      state: 'available',
      snapshot: { specCount: 0 },
    })
    expect(catalog.referenceSources).toEqual([
      {
        storeId: 'team',
        provenance: 'static',
        state: 'ready',
        snapshot: { policy: 'include', specCount: 1 },
      },
    ])
    expect(catalog.referenceSources[0]).not.toHaveProperty('evidence')
    expect(catalog.referenceSources[0]).not.toHaveProperty('diagnostics')
  })

  it('returns the materialized referenced Spec document when included', async () => {
    staticState.snapshot = snapshotWith([referencedSpec()], {
      kind: 'include',
      referenceSources: [{ storeId: 'team', state: 'ready', specCount: 1 }],
    })
    const { getSpecDocument } = await import('./static-data-provider')
    const doc = await getSpecDocument({ kind: 'referenced', storeId: 'team', specId: 'auth' })
    expect(doc.state).toBe('ready')
    expect(doc.source).toBe('referenced')
    expect(doc.spec?.id).toBe('auth')
    expect(doc.rawMarkdown).toContain('Team Auth')
    expect(doc.evidence).toBeNull()
    expect(doc).toMatchObject({
      provenance: {
        kind: 'static',
        state: 'included',
        policy: 'include',
        source: {
          storeId: 'team',
          provenance: 'static',
          state: 'ready',
          snapshot: { policy: 'include', specCount: 1 },
        },
      },
    })
  })

  it('distinguishes none, unavailable snapshot, and included-policy missing document facts', async () => {
    const identity = { kind: 'referenced' as const, storeId: 'team', specId: 'missing' }

    staticState.snapshot = snapshotWith([], { kind: 'none' })
    let provider = await import('./static-data-provider')
    await expect(provider.getSpecDocument(identity)).resolves.toMatchObject({
      state: 'error',
      evidence: null,
      provenance: { kind: 'static', state: 'none', policy: 'none' },
    })

    staticState.snapshot = null
    vi.resetModules()
    provider = await import('./static-data-provider')
    await expect(provider.getSpecDocument(identity)).resolves.toMatchObject({
      state: 'error',
      evidence: null,
      provenance: { kind: 'static', state: 'snapshot-unavailable', policy: 'absent' },
    })

    staticState.snapshot = snapshotWith([], {
      kind: 'include',
      referenceSources: [{ storeId: 'team', state: 'error', specCount: 0 }],
    })
    vi.resetModules()
    provider = await import('./static-data-provider')
    await expect(provider.getSpecDocument(identity)).resolves.toMatchObject({
      state: 'error',
      evidence: null,
      provenance: {
        kind: 'static',
        state: 'missing',
        policy: 'include',
        source: {
          storeId: 'team',
          provenance: 'static',
          state: 'error',
          snapshot: { policy: 'include', specCount: 0 },
        },
      },
    })
  })

  it('reports an explicit omission error without leaking bodies when policy is omit', async () => {
    staticState.snapshot = snapshotWith([], { kind: 'omit', referenceSourceCount: 2 })
    const { getSpecDocument } = await import('./static-data-provider')
    const doc = await getSpecDocument({ kind: 'referenced', storeId: 'team', specId: 'auth' })
    expect(doc.state).toBe('error')
    expect(doc.spec).toBeNull()
    if (doc.source === 'referenced') {
      expect(doc.evidence).toBeNull()
      expect(doc).toMatchObject({
        provenance: {
          kind: 'static',
          state: 'omitted',
          policy: 'omit',
          referenceSourceCount: 2,
        },
      })
    }
  })

  it('preserves omit, none, and unavailable Reference policy at the static Catalog boundary', async () => {
    staticState.snapshot = snapshotWith([], { kind: 'omit', referenceSourceCount: 2 })
    let provider = await import('./static-data-provider')
    await expect(provider.getSpecCatalog()).resolves.toMatchObject({
      ownedProjection: { provenance: 'static', state: 'available' },
      referenceProjection: {
        provenance: 'static',
        policy: 'omit',
        referenceSourceCount: 2,
      },
    })

    staticState.snapshot = snapshotWith([], { kind: 'none' })
    vi.resetModules()
    provider = await import('./static-data-provider')
    await expect(provider.getSpecCatalog()).resolves.toMatchObject({
      ownedProjection: { provenance: 'static', state: 'available' },
      referenceProjection: { provenance: 'static', policy: 'none' },
    })

    staticState.snapshot = null
    vi.resetModules()
    provider = await import('./static-data-provider')
    await expect(provider.getSpecCatalog()).resolves.toMatchObject({
      ownedProjection: { provenance: 'static', state: 'unavailable' },
      referenceProjection: { provenance: 'static', policy: 'unavailable' },
    })
  })

  it('scopes referenced Specs to the referenced-specs search scope only', async () => {
    staticState.snapshot = snapshotWith([referencedSpec()], {
      kind: 'include',
      referenceSources: [{ storeId: 'team', state: 'ready', specCount: 1 }],
    })
    const { getSearchDocuments } = await import('./static-data-provider')
    const docs = await getSearchDocuments()
    const specDoc = docs.find((doc) => doc.kind === 'spec')
    expect(specDoc).toBeDefined()
    expect(specDoc?.scope).toBe('referenced-specs')
    expect(specDoc?.href).toBe('/specs/referenced/team/auth')
  })
})
