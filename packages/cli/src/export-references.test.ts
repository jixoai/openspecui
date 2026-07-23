/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Prove direct Reference materialization enumerates each Store via pinned CLI list/show.
 * 2. Prove atomic failure: any list/show/diagnostic failure throws before bodies are published.
 * 3. Prove omit policy records source count without leaking bodies; include records provenance.
 *
 * Original request (2026-07-15): "我们这个项目本身只是 OpenSpec 的一个可视化投影，所以保持客观中立很重要。"
 * Section 7.3-7.7 unit coverage for the CLI export reference path.
 */
import type {
  CliCommandResult,
  CliContext,
  CliDoctor,
  CliShowSpecDocument,
  CliSpecList,
  OpenSpecCliContractExecutor,
} from '@openspecui/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  hasEffectiveReferences,
  materializeReferences,
  resolveOmitPolicy,
} from './export-references.js'

type ExecutorStub = Pick<
  OpenSpecCliContractExecutor,
  'doctorRoot' | 'context' | 'listSpecs' | 'showSpec'
>

function okDoctor(references: CliDoctor['references']): ExecutorStub {
  return {
    doctorRoot: vi.fn(
      async () =>
        ({
          success: true,
          data: { root: null, store: null, references, status: [] },
          parsedData: null,
          rawPayload: null,
          stdout: '{}',
          stderr: '',
          diagnostics: [],
          contractError: null,
          exitCode: 0,
        }) as unknown as CliCommandResult<CliDoctor>
    ),
    context: vi.fn(async () => Promise.resolve({} as CliCommandResult<CliContext>)),
    listSpecs: vi.fn(async () => Promise.resolve({} as CliCommandResult<CliSpecList>)),
    showSpec: vi.fn(async () => Promise.resolve({} as CliCommandResult<CliShowSpecDocument>)),
  }
}

function okList(specs: CliSpecList['specs']): CliCommandResult<CliSpecList> {
  return {
    success: true,
    data: { specs, root: null, status: [] },
    parsedData: null,
    rawPayload: null,
    stdout: '{}',
    stderr: '',
    diagnostics: [],
    contractError: null,
    exitCode: 0,
  } as unknown as CliCommandResult<CliSpecList>
}

function okShow(doc: CliShowSpecDocument): CliCommandResult<CliShowSpecDocument> {
  return {
    success: true,
    data: doc,
    parsedData: null,
    rawPayload: null,
    stdout: '{}',
    stderr: '',
    diagnostics: [],
    contractError: null,
    exitCode: 0,
  } as unknown as CliCommandResult<CliShowSpecDocument>
}

function specDocument(id: string, title: string): CliShowSpecDocument {
  return {
    id,
    title,
    overview: `Overview of ${id}`,
    requirementCount: 1,
    requirements: [
      {
        text: `# ${title}\nRequirement body`,
        scenarios: [{ rawText: '## Scenario\nGiven x' }],
      },
    ],
    metadata: { version: '1.0.0', format: 'openspec' },
    root: { path: '/store', source: 'store', store_id: 'team' },
  } as CliShowSpecDocument
}

describe('export-references', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('materializes each direct Reference Spec through list and show', async () => {
    const stub = okDoctor([{ store_id: 'team', root: '/store', status: [] }])
    stub.listSpecs = vi.fn(async () => okList([{ id: 'auth', requirementCount: 1 }]))
    stub.showSpec = vi.fn(async () => okShow(specDocument('auth', 'Auth Spec')))

    const result = await materializeReferences(stub as OpenSpecCliContractExecutor)

    expect(result.policy.kind).toBe('include')
    expect(result.policy.referenceSources).toEqual([
      { storeId: 'team', state: 'ready', specCount: 1 },
    ])
    expect(result.referencedSpecs).toHaveLength(1)
    expect(result.referencedSpecs[0]).toMatchObject({
      identity: { kind: 'referenced', storeId: 'team', specId: 'auth' },
      source: 'referenced',
      readOnly: true,
      storeId: 'team',
      id: 'auth',
      name: 'Auth Spec',
    })
    expect(stub.listSpecs).toHaveBeenCalledWith({ store: 'team' })
    expect(stub.showSpec).toHaveBeenCalledWith('auth', { store: 'team' })
  })

  it('throws atomically when a Reference Store is unresolved (diagnostic error)', async () => {
    const stub = okDoctor([
      {
        store_id: 'broken',
        status: [
          { severity: 'error', code: 'reference_unresolved', message: 'cannot resolve broken' },
        ],
      },
    ])

    await expect(materializeReferences(stub as OpenSpecCliContractExecutor)).rejects.toThrow(
      /Reference Store 'broken' is unresolved/
    )
  })

  it('throws atomically when listSpecs fails, before publishing any body', async () => {
    const stub = okDoctor([{ store_id: 'team', status: [] }])
    stub.listSpecs = vi.fn(async () =>
      Promise.resolve({
        success: false,
        data: null,
        exitCode: 1,
        stderr: 'store unreachable',
      } as unknown as CliCommandResult<CliSpecList>)
    )

    await expect(materializeReferences(stub as OpenSpecCliContractExecutor)).rejects.toThrow(
      /Spec enumeration failed/
    )
    expect(stub.showSpec).not.toHaveBeenCalled()
  })

  it('throws atomically when a single showSpec fails', async () => {
    const stub = okDoctor([{ store_id: 'team', status: [] }])
    stub.listSpecs = vi.fn(async () =>
      okList([
        { id: 'auth', requirementCount: 1 },
        { id: 'billing', requirementCount: 1 },
      ])
    )
    stub.showSpec = vi.fn(async (_id: string) =>
      Promise.resolve({
        success: false,
        data: null,
        exitCode: 1,
        stderr: 'spec missing',
      } as unknown as CliCommandResult<CliShowSpecDocument>)
    )

    await expect(materializeReferences(stub as OpenSpecCliContractExecutor)).rejects.toThrow(
      /could not be materialized/
    )
  })

  it('resolveOmitPolicy records the observed Reference source count without materializing bodies', async () => {
    const stub = okDoctor([
      { store_id: 'team', status: [] },
      { store_id: 'platform', status: [] },
    ])
    const result = await resolveOmitPolicy(stub as OpenSpecCliContractExecutor)
    expect(result.policy).toEqual({ kind: 'omit', referenceSourceCount: 2 })
    expect(result.referenceSourceCount).toBe(2)
  })

  it('hasEffectiveReferences reflects direct Reference presence', async () => {
    const withRefs = okDoctor([{ store_id: 'team', status: [] }])
    await expect(hasEffectiveReferences(withRefs as OpenSpecCliContractExecutor)).resolves.toBe(
      true
    )

    const withoutRefs = okDoctor([])
    await expect(hasEffectiveReferences(withoutRefs as OpenSpecCliContractExecutor)).resolves.toBe(
      false
    )
  })
})
