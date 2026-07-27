/**
 * Orthogonal intents (created 2026-07-24 Asia/Shanghai):
 * 1. Prove mutation lifecycle transport records are runtime-decoded.
 * 2. Prove start/rejoin and snapshot/change envelopes remain correlated.
 *
 * Original request (2026-07-24): "apply openspec-change: close-openspec-cli16-delivery-gaps"
 */
import { describe, expect, it } from 'vitest'
import {
  StoreMutationLifecycleEventSchema,
  StoreMutationStartResponseSchema,
} from './store-mutation-protocol.js'

const record = {
  requestId: 'request-a',
  envUri: 'openspecui-env://1/opaque',
  kind: 'remove' as const,
  status: 'failed' as const,
  storeId: 'store-a',
  result: { exitStatus: 1, stderr: 'CLI rejected remove.', contractError: 'drift' },
  observedAt: 1,
}

describe('Store mutation protocol', () => {
  it('decodes correlated admission/rejoin evidence', () => {
    expect(StoreMutationStartResponseSchema.parse({ ...record, rejoined: true })).toEqual({
      ...record,
      rejoined: true,
    })
    expect(StoreMutationStartResponseSchema.safeParse({ record, rejoined: true }).success).toBe(
      false
    )
  })

  it('decodes ledger snapshot and changed records but rejects malformed terminal evidence', () => {
    expect(
      StoreMutationLifecycleEventSchema.parse({ type: 'snapshot', cursor: 3, records: [record] })
    ).toMatchObject({ type: 'snapshot', cursor: 3 })
    expect(
      StoreMutationLifecycleEventSchema.parse({ type: 'changed', cursor: 4, record })
    ).toMatchObject({ type: 'changed', cursor: 4 })
    expect(
      StoreMutationLifecycleEventSchema.safeParse({
        type: 'changed',
        cursor: 5,
        record: {
          ...record,
          result: {
            exitStatus: 1,
            diagnostics: [{ severity: 'warning', code: 42, message: 'bad' }],
          },
        },
      }).success
    ).toBe(false)
    expect(
      StoreMutationLifecycleEventSchema.safeParse({
        type: 'changed',
        cursor: 6,
        record: { ...record, status: 'succeeded', result: undefined },
      }).success
    ).toBe(false)
  })
})
