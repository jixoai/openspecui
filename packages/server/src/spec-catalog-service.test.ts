/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Prove Catalog composition and exact CLI Store selection for duplicate Spec ids.
 * 2. Prove unrelated Stores cannot become project Reference documents.
 *
 * Original request (2026-07-15): "Referenced Specs are navigable and searchable but visibly read-only."
 */
import type { RootContext } from '@openspecui/core'
import { describe, expect, it, vi } from 'vitest'
import {
  readSpecCatalog,
  readSpecDocument,
  SpecCatalogIdentityNotFoundError,
  type SpecCatalogServiceSource,
} from './spec-catalog-service.js'

function rootContext(): RootContext {
  return {
    launchProject: { path: '/launch' },
    planningRoot: {
      path: '/planning',
      source: 'nearest',
      healthy: true,
      status: [],
    },
    storeId: null,
    cli: { available: true, version: '1.6.0' },
    references: [
      {
        store_id: 'platform-a',
        status: [],
      },
      {
        store_id: 'platform-b',
        status: [],
      },
    ],
    contextMembers: [],
    dataScope: {
      path: '/data/openspec',
      source: 'xdg-data-home',
      environmentVariable: 'XDG_DATA_HOME',
    },
    diagnostics: { root: [], doctor: [], context: [] },
    evidence: { doctor: null, context: null },
    observedAt: 1,
  }
}

function createSource() {
  const listSpecs = vi.fn(async (selector: { store?: string } = {}) => {
    const data = {
      specs: [{ id: 'auth', requirementCount: selector.store === 'platform-a' ? 1 : 2 }],
      root: {
        path: `/stores/${selector.store}`,
        source: 'store' as const,
        store_id: selector.store,
      },
      status: [],
    }
    return {
      success: true,
      stdout: JSON.stringify(data),
      stderr: '',
      exitCode: 0,
      data,
      payload: data,
      diagnostics: [],
    }
  })
  const showSpec = vi.fn(async (specId: string, selector: { store?: string } = {}) => {
    const title = selector.store === 'platform-a' ? 'Platform A Auth' : 'Platform B Auth'
    const data = {
      id: specId,
      title,
      overview: `${title} overview`,
      requirementCount: 1,
      requirements: [
        { text: `${title} SHALL work`, scenarios: [{ rawText: 'WHEN used\nTHEN works' }] },
      ],
      metadata: { version: '1.0.0', format: 'openspec' },
      root: {
        path: `/stores/${selector.store}`,
        source: 'store' as const,
        store_id: selector.store,
      },
    }
    return {
      success: true,
      stdout: JSON.stringify(data),
      stderr: '',
      exitCode: 0,
      data,
      payload: data,
      diagnostics: [],
    }
  })
  const source: SpecCatalogServiceSource = {
    rootContext: rootContext(),
    adapter: {
      listSpecsWithMeta: vi
        .fn()
        .mockResolvedValue([{ id: 'auth', name: 'Owned Auth', createdAt: 1, updatedAt: 2 }]),
    },
    documentService: {
      readSpec: vi.fn().mockResolvedValue({
        id: 'auth',
        name: 'Owned Auth',
        overview: 'Owned overview',
        requirements: [],
      }),
      readSpecRaw: vi.fn().mockResolvedValue({ markdown: '# Owned Auth' }),
    },
    contracts: { listSpecs, showSpec },
  }
  return { source, listSpecs, showSpec }
}

describe('Spec Catalog service', () => {
  it('keeps owned and multiple referenced duplicate ids source-distinct', async () => {
    const { source, listSpecs } = createSource()

    const catalog = await readSpecCatalog(source, { now: () => 10 })

    expect(catalog.observedAt).toBe(10)
    expect(catalog.entries.map((entry) => entry.identity)).toEqual([
      { kind: 'owned', specId: 'auth' },
      { kind: 'referenced', storeId: 'platform-a', specId: 'auth' },
      { kind: 'referenced', storeId: 'platform-b', specId: 'auth' },
    ])
    expect(listSpecs).toHaveBeenNthCalledWith(1, { store: 'platform-a' })
    expect(listSpecs).toHaveBeenNthCalledWith(2, { store: 'platform-b' })
    expect(catalog).toMatchObject({
      referenceSources: [
        { storeId: 'platform-a', state: 'ready' },
        { storeId: 'platform-b', state: 'ready' },
      ],
    })
  })

  it('reads each referenced duplicate through its exact Store selector', async () => {
    const { source, listSpecs, showSpec } = createSource()

    const platformA = await readSpecDocument(source, {
      kind: 'referenced',
      storeId: 'platform-a',
      specId: 'auth',
    })
    const platformB = await readSpecDocument(source, {
      kind: 'referenced',
      storeId: 'platform-b',
      specId: 'auth',
    })

    expect(listSpecs).toHaveBeenNthCalledWith(1, { store: 'platform-a' })
    expect(listSpecs).toHaveBeenNthCalledWith(2, { store: 'platform-b' })
    expect(showSpec).toHaveBeenNthCalledWith(1, 'auth', { store: 'platform-a' })
    expect(showSpec).toHaveBeenNthCalledWith(2, 'auth', { store: 'platform-b' })
    expect(platformA).toMatchObject({
      state: 'ready',
      readOnly: true,
      upstream: { title: 'Platform A Auth' },
    })
    expect(platformB).toMatchObject({
      state: 'ready',
      readOnly: true,
      upstream: { title: 'Platform B Auth' },
    })
    if (platformA.source !== 'referenced') return
    expect(platformA.upstream?.requirements[0]).toEqual({
      text: 'Platform A Auth SHALL work',
      scenarios: [{ rawText: 'WHEN used\nTHEN works' }],
    })
  })

  it('does not expose unrelated registered Stores as project References', async () => {
    const { source, listSpecs, showSpec } = createSource()

    await expect(
      readSpecDocument(source, {
        kind: 'referenced',
        storeId: 'unrelated',
        specId: 'auth',
      })
    ).rejects.toBeInstanceOf(SpecCatalogIdentityNotFoundError)
    expect(listSpecs).not.toHaveBeenCalled()
    expect(showSpec).not.toHaveBeenCalled()
  })

  it('preserves a failed Store enumeration without erasing healthy Store entries', async () => {
    const { source, listSpecs } = createSource()
    source.rootContext.references.splice(1, 0, {
      store_id: 'broken',
      status: [
        {
          severity: 'warning',
          code: 'reference_root_unhealthy',
          message: 'The Store root is unhealthy.',
        },
      ],
    })
    listSpecs.mockImplementation(async (selector: { store?: string } = {}) => {
      if (selector.store === 'broken') {
        return {
          success: false,
          stdout: '{"status":[]}',
          stderr: 'Store is unavailable.',
          exitCode: 1,
          data: null,
          payload: { status: [] },
          diagnostics: [],
        }
      }
      const data = {
        specs: [{ id: 'auth', requirementCount: 1 }],
        root: {
          path: `/stores/${selector.store}`,
          source: 'store' as const,
          store_id: selector.store,
        },
        status: [],
      }
      return {
        success: true,
        stdout: JSON.stringify(data),
        stderr: '',
        exitCode: 0,
        data,
        payload: data,
        diagnostics: [],
      }
    })

    const catalog = await readSpecCatalog(source)

    expect(catalog.entries.filter((entry) => entry.source === 'referenced')).toHaveLength(2)
    expect(catalog).toMatchObject({
      referenceSources: [
        { storeId: 'platform-a', state: 'ready' },
        {
          storeId: 'broken',
          state: 'error',
          diagnostics: [{ code: 'reference_root_unhealthy' }],
          evidence: { exitCode: 1, stderr: 'Store is unavailable.' },
        },
        { storeId: 'platform-b', state: 'ready' },
      ],
    })
  })
})
