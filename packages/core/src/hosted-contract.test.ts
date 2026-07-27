/**
 * Orthogonal intents (created 2026-07-25 Asia/Shanghai):
 * 1. Prove the shared hosted tRPC decoder accepts typed Store projections.
 * 2. Prove malformed successful envelopes retain explicit contract-error parse evidence.
 * 3. Prove the browser-safe entry exposes protocol facts without Node-only environment computation.
 *
 * Original request (2026-07-24): "可以归档旧change了，然后我们继续新的change 的开发推进"
 * P4.1 contract boundary: browser consumers may not assert successful hosted JSON into public contracts.
 */
import { describe, expect, it } from 'vitest'
import * as hostedContract from './hosted-contract.js'
import {
  decodeHostedTrpcData,
  HostedBackendContractError,
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
})
