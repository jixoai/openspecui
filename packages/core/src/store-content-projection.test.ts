/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Prove the browser-safe Store-content schemas accept additive CLI Spec/Change entries.
 * 2. Prove the additive content capability is a compatibility fact, distinct from baseline Store capability.
 * 3. Prove Store-content projection states decode through the shared CLI Projection Work lifecycle.
 *
 * Original request (2026-07-30): "Stores 完全可以融入 `Environment Center` 这个东西。"
 * Spec: hosted-environment-delivery › "Environment-Scoped Store Content Projection".
 * P4.1 contract boundary: capability visibility is never permission; absence is unsupported, never empty.
 */
import { describe, expect, it } from 'vitest'
import {
  decodeHostedTrpcData,
  HOSTED_STORE_ADVERTISED_CAPABILITIES,
  HOSTED_STORE_CAPABILITIES,
  HOSTED_STORE_CONTENT_CAPABILITY,
  HostedStoreContentChangesEnvelopeSchema,
  HostedStoreContentChangesProjectionStateSchema,
  HostedStoreContentKindSchema,
  HostedStoreContentSpecsEnvelopeSchema,
  HostedStoreContentSpecsProjectionStateSchema,
} from './hosted-contract.js'
import {
  STORE_CONTENT_INSPECT_CAPABILITY,
  StoreContentChangeEntrySchema,
  StoreContentChangeListSchema,
  StoreContentKindSchema,
  StoreContentSpecEntrySchema,
  StoreContentSpecListSchema,
} from './store-content-projection.js'

describe('Store-content entry schemas (lenient additive tolerance)', () => {
  it('accepts an additive Spec entry from `list --specs --store <id>`', () => {
    const parsed = StoreContentSpecEntrySchema.parse({
      id: 'auth',
      requirementCount: 3,
      future_requirement_fact: true,
    })
    expect(parsed).toMatchObject({ id: 'auth', requirementCount: 3 })
  })

  it('accepts an additive active-Change entry from `list --store <id>`', () => {
    const parsed = StoreContentChangeEntrySchema.parse({
      name: 'reshape-stores',
      completedTasks: 2,
      totalTasks: 5,
      lastModified: '2026-07-30T00:00:00Z',
      status: 'in-progress',
      future_change_fact: true,
    })
    expect(parsed).toMatchObject({ name: 'reshape-stores', status: 'in-progress' })
  })

  it('defaults to an empty healthy Spec list when the CLI omits the specs array', () => {
    expect(StoreContentSpecListSchema.parse({ status: [] }).specs).toEqual([])
    expect(StoreContentChangeListSchema.parse({ status: [] }).changes).toEqual([])
  })

  it('rejects an unknown active-Change status rather than inferring progress', () => {
    expect(() =>
      StoreContentChangeEntrySchema.parse({
        name: 'x',
        completedTasks: 0,
        totalTasks: 0,
        lastModified: '2026-07-30T00:00:00Z',
        status: 'verified',
      })
    ).toThrow()
  })
})

describe('Store-content compatibility capability (additive, not baseline)', () => {
  it('exposes the additive content capability distinct from the baseline Store vocabulary', () => {
    expect(STORE_CONTENT_INSPECT_CAPABILITY).toBe('stores.content.inspect')
    expect(HOSTED_STORE_CONTENT_CAPABILITY).toBe(STORE_CONTENT_INSPECT_CAPABILITY)
    expect(HOSTED_STORE_CAPABILITIES).not.toContain(HOSTED_STORE_CONTENT_CAPABILITY)
    expect(HOSTED_STORE_ADVERTISED_CAPABILITIES).toContain(HOSTED_STORE_CONTENT_CAPABILITY)
  })

  it('keeps the content kind vocabulary exactly specs | changes', () => {
    expect(StoreContentKindSchema.options).toEqual(['specs', 'changes'])
    expect(HostedStoreContentKindSchema.options).toEqual(['specs', 'changes'])
  })
})

describe('Store-content projection envelopes and lifecycle states', () => {
  it('decodes a successful Specs envelope carrying Store identity and evidence', () => {
    const decoded = decodeHostedTrpcData(HostedStoreContentSpecsEnvelopeSchema, {
      result: {
        data: {
          available: true,
          specs: [{ id: 'auth', requirementCount: 3 }],
          storeId: 'team',
          cliVersion: '1.6.0',
        },
      },
    })
    expect(decoded).toMatchObject({
      kind: 'success',
      data: { available: true, storeId: 'team', specs: [{ id: 'auth', requirementCount: 3 }] },
    })
  })

  it('decodes a successful active-Changes envelope carrying Store identity', () => {
    const decoded = decodeHostedTrpcData(HostedStoreContentChangesEnvelopeSchema, {
      result: {
        data: {
          available: true,
          changes: [
            {
              name: 'reshape',
              completedTasks: 1,
              totalTasks: 4,
              lastModified: '2026-07-30T00:00:00Z',
              status: 'in-progress',
            },
          ],
          storeId: 'team',
        },
      },
    })
    expect(decoded.kind).toBe('success')
  })

  it('retains a contract error when a malformed successful Specs envelope omits Store identity', () => {
    const decoded = decodeHostedTrpcData(HostedStoreContentSpecsEnvelopeSchema, {
      result: { data: { available: true, specs: [] } },
    })
    expect(decoded.kind).toBe('contract-error')
  })

  it('keeps Specs and active-Changes Projection Work states independent through distinct identities', () => {
    const specsState = HostedStoreContentSpecsProjectionStateSchema.parse({
      identity: 'env://1|team|specs',
      workGeneration: 1,
      snapshotGeneration: 1,
      state: 'ready',
      data: { available: true, specs: [], storeId: 'team' },
      freshness: 'current',
      error: null,
      invalidationCause: 'initial',
    })
    const changesState = HostedStoreContentChangesProjectionStateSchema.parse({
      identity: 'env://1|team|changes',
      workGeneration: 2,
      invalidationCause: 'dependency',
      state: 'error',
      data: null,
      freshness: null,
      snapshotGeneration: null,
      error: { name: 'Error', message: 'change list failed', cliEvidence: null },
    })

    expect(specsState.state).toBe('ready')
    expect(changesState.state).toBe('error')
    expect(specsState.identity).not.toBe(changesState.identity)
  })
})
