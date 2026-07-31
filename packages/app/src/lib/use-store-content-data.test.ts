/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Prove Specs and active-Changes regions settle independently.
 * 2. Prove refresh failure retains content while surfacing the exact error directly.
 *
 * Original request (2026-07-30): "StoreDetailPage应该如何设计呢？"
 */
import {
  HostedStoreContentChangesProjectionStateSchema,
  HostedStoreContentSpecsProjectionStateSchema,
} from '@openspecui/core/hosted-contract'
import { describe, expect, it } from 'vitest'
import { projectStoreChangesRegion, projectStoreSpecsRegion } from './use-store-content-data'

describe('Store content regional projection', () => {
  it('retains Specs beside a refresh error while Changes can remain ready', () => {
    const specs = HostedStoreContentSpecsProjectionStateSchema.parse({
      identity: 'env://a|team|specs',
      workGeneration: 2,
      invalidationCause: 'dependency',
      state: 'refresh-error',
      data: {
        available: true,
        storeId: 'team',
        specs: [{ id: 'auth', requirementCount: 3 }],
      },
      freshness: 'stale-display-only',
      snapshotGeneration: 1,
      error: { name: 'Error', message: 'Specs refresh failed', cliEvidence: null },
    })
    const changes = HostedStoreContentChangesProjectionStateSchema.parse({
      identity: 'env://a|team|changes',
      workGeneration: 1,
      invalidationCause: 'initial',
      state: 'ready',
      data: { available: true, storeId: 'team', changes: [] },
      freshness: 'current',
      snapshotGeneration: 1,
      error: null,
    })

    expect(projectStoreSpecsRegion(specs, undefined, true)).toEqual({
      state: 'ready',
      entries: [{ id: 'auth', requirementCount: 3 }],
      refreshing: false,
      error: 'Specs refresh failed',
    })
    expect(projectStoreChangesRegion(changes, undefined, true)).toMatchObject({ state: 'empty' })
  })

  it('does not infer unsupported content as an empty Store', () => {
    expect(projectStoreSpecsRegion(undefined, undefined, false)).toEqual({
      state: 'error',
      error: 'Store Specs are not supported by this backend.',
    })
  })
})
