/**
 * Orthogonal intents (created 2026-07-25 Asia/Shanghai):
 * 1. Prove the shared hosted tRPC decoder accepts typed Store projections.
 * 2. Prove malformed successful envelopes retain explicit contract-error parse evidence.
 * 3. Prove the browser-safe entry exposes protocol facts without Node-only environment computation.
 * 4. Preserve canonical Launch physical identity through browser-safe Root Context decoding.
 *
 * Original request (2026-07-24): "可以归档旧change了，然后我们继续新的change 的开发推进"
 * P4.1 contract boundary: browser consumers may not assert successful hosted JSON into public contracts.
 * Owner same-root direction (2026-07-29): hosted projections retain physical identity for objective topology.
 */
import { describe, expect, it } from 'vitest'
import * as hostedContract from './hosted-contract.js'
import {
  decodeHostedTrpcData,
  HostedBackendContractError,
  HostedRootContextSchema,
  HostedStoreListEnvelopeSchema,
} from './hosted-contract.js'

describe('hosted contract decoder', () => {
  it('decodes one successful tRPC data envelope into the browser-safe Store projection', () => {
    const decoded = decodeHostedTrpcData(HostedStoreListEnvelopeSchema, {
      result: {
        data: {
          available: true,
          stores: [{ id: 'team', root: '/stores/team', future_store_fact: true }],
        },
      },
    })

    expect(decoded).toMatchObject({
      kind: 'success',
      data: { available: true, stores: [{ id: 'team', root: '/stores/team' }] },
    })
  })

  it('returns one contract error with its Zod parse cause for malformed tRPC data', () => {
    const decoded = decodeHostedTrpcData(HostedStoreListEnvelopeSchema, {
      result: { data: { available: true } },
    })

    expect(decoded.kind).toBe('contract-error')
    if (decoded.kind !== 'contract-error') throw new Error('Expected hosted contract failure.')
    expect(decoded.error).toBeInstanceOf(HostedBackendContractError)
    expect(decoded.error.cause).toBeInstanceOf(Error)
  })

  it('exports browser-safe protocol facts without the Node-only envUri calculator', () => {
    expect(hostedContract.asEnvUri('openspecui-env://1/opaque')).toBe('openspecui-env://1/opaque')
    expect(hostedContract.hasCapability(['stores.inspect'], 'stores.inspect')).toBe(true)
    expect(hostedContract.isTerminalMutationStatus('succeeded')).toBe(true)
    expect('computeEnvUri' in hostedContract).toBe(false)
  })

  it('treats the additive Store-content capability as distinct from baseline Store vocabulary', () => {
    expect(hostedContract.HOSTED_STORE_CONTENT_CAPABILITY).toBe('stores.content.inspect')
    expect(hostedContract.HOSTED_STORE_CAPABILITIES).not.toContain(
      hostedContract.HOSTED_STORE_CONTENT_CAPABILITY
    )
    expect(hostedContract.HOSTED_STORE_ADVERTISED_CAPABILITIES).toContain(
      hostedContract.HOSTED_STORE_CONTENT_CAPABILITY
    )
    // Capability visibility authorizes nothing.
    expect(hostedContract.hasCapability(['stores.content.inspect'], 'stores.content.inspect')).toBe(
      true
    )
  })

  it('preserves canonical Launch physical identity in browser-safe Root Context', () => {
    const decoded = HostedRootContextSchema.parse({
      launchProject: { path: '/tmp/project-link', physicalPath: '/private/tmp/project' },
      planningRoot: {
        path: '/private/tmp/project',
        source: 'nearest',
        healthy: true,
        status: [],
      },
      storeId: null,
      cli: { available: true, version: '1.6.0' },
      references: [],
      contextMembers: [],
      dataScope: {
        path: '/tmp/data/openspec',
        source: 'xdg-data-home',
        environmentVariable: 'XDG_DATA_HOME',
      },
      diagnostics: { root: [], doctor: [], context: [] },
      evidence: { doctor: null, context: null },
      observedAt: 1,
    })

    expect(decoded.launchProject).toEqual({
      path: '/tmp/project-link',
      physicalPath: '/private/tmp/project',
    })
  })
})
