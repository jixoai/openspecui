/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Prove same-id Stores remain distinct across Environment identity.
 * 2. Prove Doctor health and mutation state join only inside the selected composite identity.
 *
 * Original request (2026-07-30): "Stores 完全可以融入 `Environment Center` 这个东西。"
 */
import type { StoreMutationEnvelope } from '@openspecui/core/store-mutation-protocol'
import { describe, expect, it } from 'vitest'
import type { StoreInspectorProjection, StoreInventoryProjection } from '../types/root-context'
import { createStoreEvidenceSignature, projectStoreIndexRows } from './store-product-projection'

const INVENTORY = {
  available: true,
  stores: [{ id: 'team', root: '/stores/team' }],
} satisfies StoreInventoryProjection

const INSPECTOR = {
  available: true,
  stores: [{ id: 'team', root: '/stores/team', openspec_root: { healthy: true } }],
} satisfies StoreInspectorProjection

const MUTATIONS = [
  {
    requestId: 'env-a-remove',
    envUri: 'env://a',
    kind: 'remove',
    storeId: 'team',
    status: 'succeeded',
    observedAt: 10,
    result: { exitStatus: 0 },
  },
  {
    requestId: 'env-b-remove',
    envUri: 'env://b',
    kind: 'remove',
    storeId: 'team',
    status: 'failed',
    observedAt: 20,
    result: { exitStatus: 1, stderr: 'failed in B' },
  },
] satisfies readonly StoreMutationEnvelope[]

describe('Store product projection composite identity', () => {
  it('creates order-stable settled Store evidence signatures', () => {
    const reversedInventory = { ...INVENTORY, stores: [...INVENTORY.stores].reverse() }
    expect(
      createStoreEvidenceSignature({ inventory: reversedInventory, inspector: INSPECTOR })
    ).toBe(createStoreEvidenceSignature({ inventory: INVENTORY, inspector: INSPECTOR }))
  })

  it('does not merge same-id mutation state across Environments', () => {
    const inA = projectStoreIndexRows({
      envUri: 'env://a',
      inventory: INVENTORY,
      inspector: INSPECTOR,
      projectContexts: [],
      mutations: MUTATIONS,
    })
    const inB = projectStoreIndexRows({
      envUri: 'env://b',
      inventory: INVENTORY,
      inspector: INSPECTOR,
      projectContexts: [],
      mutations: MUTATIONS,
    })
    expect(inA[0]).toMatchObject({ storeId: 'team', health: 'healthy', mutationState: 'succeeded' })
    expect(inB[0]).toMatchObject({ storeId: 'team', health: 'healthy', mutationState: 'failed' })
  })
})
