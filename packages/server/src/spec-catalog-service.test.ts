/**
 * Orthogonal intents (updated 2026-07-27 Asia/Shanghai):
 * 1. Prove owned Catalog membership and requirement counts come from exact-root CLI truth.
 * 2. Prove Catalog composition and exact CLI Store selection for duplicate Spec ids.
 * 3. Prove unrelated Stores cannot become project Reference documents.
 *
 * Original request (2026-07-15): "Referenced Specs are navigable and searchable but visibly read-only."
 */
import {
  CliJsonValueSchema,
  OpenSpecCliContractExecutor,
  type CliCommandResult,
  type CliShowSpec,
  type CliSpecList,
  type RootContext,
} from '@openspecui/core'
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

function createListSpecsResult(selector: { store?: string } = {}): CliCommandResult<CliSpecList> {
  const storeId = selector.store
  const owned = storeId === undefined
  const root = owned
    ? { path: '/planning', source: 'nearest' as const }
    : { path: `/stores/${storeId}`, source: 'store' as const, store_id: storeId }
  const data: CliSpecList = {
    specs: [
      {
        id: 'auth',
        requirementCount: owned ? 3 : storeId === 'platform-a' ? 1 : 2,
      },
    ],
    root,
    status: [],
  }
  return {
    success: true,
    stdout: JSON.stringify(data),
    stderr: '',
    exitCode: 0,
    data,
    payload: CliJsonValueSchema.parse(data),
    diagnostics: [],
  }
}

function createSource() {
  const listSpecs = vi.fn(async (selector: { store?: string } = {}) =>
    createListSpecsResult(selector)
  )
  const showSpec = vi.fn(
    async (
      specId: string,
      selector: { store?: string } = {}
    ): Promise<CliCommandResult<CliShowSpec>> => {
      const storeId = selector.store ?? 'missing-store'
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
          store_id: storeId,
        },
      }
      return {
        success: true,
        stdout: JSON.stringify(data),
        stderr: '',
        exitCode: 0,
        data,
        payload: CliJsonValueSchema.parse(data),
        diagnostics: [],
      }
    }
  )
  const source: SpecCatalogServiceSource = {
    rootContext: rootContext(),
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
    expect(listSpecs).toHaveBeenNthCalledWith(1, {})
    expect(listSpecs).toHaveBeenNthCalledWith(2, { store: 'platform-a' })
    expect(listSpecs).toHaveBeenNthCalledWith(3, { store: 'platform-b' })
    expect(catalog.entries[0]).toMatchObject({
      identity: { kind: 'owned', specId: 'auth' },
      name: 'auth',
      requirementCount: 3,
      updatedAt: 0,
    })
    expect(catalog.entries).not.toContainEqual(
      expect.objectContaining({ identity: { kind: 'owned', specId: 'physical-only' } })
    )
    expect(catalog).toMatchObject({
      ownedProjection: {
        provenance: 'live',
        root: { path: '/planning', source: 'nearest' },
        evidence: {
          success: true,
          payload: {
            specs: [{ id: 'auth', requirementCount: 3 }],
            root: { path: '/planning', source: 'nearest' },
          },
        },
      },
      referenceSources: [
        { storeId: 'platform-a', state: 'ready' },
        { storeId: 'platform-b', state: 'ready' },
      ],
    })
  })

  it('settles from typed CLI membership without touching legacy filesystem metadata', async () => {
    const { source } = createSource()
    const legacyMetadataReader = vi
      .fn()
      .mockRejectedValue(new Error('legacy metadata must not run'))
    const candidate = Object.assign(source, {
      adapter: { listSpecsWithMeta: legacyMetadataReader },
    })

    await expect(readSpecCatalog(candidate)).resolves.toMatchObject({
      entries: expect.arrayContaining([
        expect.objectContaining({ identity: { kind: 'owned', specId: 'auth' } }),
      ]),
    })
    expect(legacyMetadataReader).not.toHaveBeenCalled()
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

  it.each([
    ['missing Root', null],
    ['wrong Root', { path: '/other', source: 'nearest' as const }],
    ['wrong Store', { path: '/planning', source: 'store' as const, store_id: 'unexpected' }],
  ])('rejects owned CLI membership with %s provenance', async (_label, root) => {
    const { source, listSpecs } = createSource()
    listSpecs.mockResolvedValueOnce({
      success: true,
      stdout: JSON.stringify({ specs: [{ id: 'auth', requirementCount: 3 }], root, status: [] }),
      stderr: '',
      exitCode: 0,
      data: { specs: [{ id: 'auth', requirementCount: 3 }], root, status: [] },
      payload: { specs: [{ id: 'auth', requirementCount: 3 }], root, status: [] },
      diagnostics: [],
    })

    await expect(readSpecCatalog(source)).rejects.toMatchObject({
      name: 'CliProjectionCommandError',
      cliEvidence: { contractError: expect.stringMatching(/Root|Store/i) },
    })
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
      return createListSpecsResult(selector)
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

  it.each([
    ['missing', null],
    [
      'mismatched',
      {
        path: '/stores/platform-b',
        source: 'store' as const,
        store_id: 'platform-b',
      },
    ],
  ])('rejects %s Store provenance from referenced list results', async (_label, root) => {
    const { source, listSpecs } = createSource()
    source.rootContext.references.splice(1)
    listSpecs.mockImplementation(async (selector: { store?: string } = {}) => {
      if (selector.store !== 'platform-a') return createListSpecsResult(selector)
      const data = { specs: [{ id: 'auth', requirementCount: 1 }], root, status: [] }
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

    expect(catalog.entries.filter((entry) => entry.source === 'referenced')).toEqual([])
    expect(catalog.referenceSources).toEqual([
      expect.objectContaining({
        storeId: 'platform-a',
        state: 'error',
        evidence: expect.objectContaining({
          contractError: expect.stringMatching(/platform-a/i),
        }),
      }),
    ])
  })

  it('rejects mismatched Store provenance from referenced show results', async () => {
    const { source, showSpec } = createSource()
    const data = {
      id: 'auth',
      title: 'Wrongly attributed auth',
      overview: 'This payload must not be relabeled.',
      requirementCount: 0,
      requirements: [],
      metadata: { version: '1.0.0', format: 'openspec' as const },
      root: {
        path: '/stores/platform-b',
        source: 'store' as const,
        store_id: 'platform-b',
      },
    }
    showSpec.mockResolvedValueOnce({
      success: true,
      stdout: JSON.stringify(data),
      stderr: '',
      exitCode: 0,
      data,
      payload: data,
      diagnostics: [],
    })

    const document = await readSpecDocument(source, {
      kind: 'referenced',
      storeId: 'platform-a',
      specId: 'auth',
    })

    expect(document).toMatchObject({
      state: 'error',
      source: 'referenced',
      upstream: null,
      evidence: {
        contractError: expect.stringMatching(/platform-a/i),
      },
    })
  })

  it('rejects missing Store provenance through the checked CLI contract parser', async () => {
    const { source, listSpecs } = createSource()
    const raw = {
      id: 'auth',
      title: 'Unattributed auth',
      overview: 'This payload must not become a referenced document.',
      requirementCount: 0,
      requirements: [],
      metadata: { version: '1.0.0', format: 'openspec' },
      root: null,
    }
    const contracts = new OpenSpecCliContractExecutor(async () => ({
      success: true,
      stdout: JSON.stringify(raw),
      stderr: '',
      exitCode: 0,
    }))
    source.contracts = {
      listSpecs,
      showSpec: (specId, selector) => contracts.showSpec(specId, selector),
    }

    const document = await readSpecDocument(source, {
      kind: 'referenced',
      storeId: 'platform-a',
      specId: 'auth',
    })

    expect(document).toMatchObject({
      state: 'error',
      source: 'referenced',
      upstream: null,
      evidence: {
        contractError: expect.stringMatching(/root/i),
      },
    })
  })
})
