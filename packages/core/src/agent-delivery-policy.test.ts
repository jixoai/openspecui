/**
 * Orthogonal intents (created 2026-08-01 Asia/Shanghai):
 * 1. Prove Agent policy normalization matches official Core and Custom semantics.
 * 2. Prove structured updates preserve team-authored environment-global extension fields.
 *
 * Original request (2026-08-01): keep raw environment config authoring while moving official Agent controls to Config.
 */

import { describe, expect, it } from 'vitest'
import {
  AgentDeliveryPolicyUpdateSchema,
  applyAgentDeliveryPolicy,
  normalizeAgentDeliveryPolicy,
} from './agent-delivery-policy.js'

describe('Agent delivery policy', () => {
  it('applies official omitted defaults and ignores stale workflow arrays for Core', () => {
    expect(
      normalizeAgentDeliveryPolicy({ profile: null, delivery: null, workflows: ['onboard'] })
    ).toEqual({
      profile: 'core',
      delivery: 'both',
      workflows: ['propose', 'explore', 'apply', 'update', 'sync', 'archive'],
    })
  })

  it('preserves official order while normalizing a Custom selection', () => {
    expect(
      normalizeAgentDeliveryPolicy({
        profile: 'custom',
        delivery: 'commands',
        workflows: ['verify', 'explore'],
      })
    ).toEqual({
      profile: 'custom',
      delivery: 'commands',
      workflows: ['explore', 'verify'],
    })
  })

  it('retains unknown team fields while updating only official Agent policy keys', () => {
    expect(
      applyAgentDeliveryPolicy(
        {
          featureFlags: { customSchema: true },
          teamExtension: { owner: 'platform' },
          profile: 'core',
          delivery: 'both',
          workflows: ['propose'],
        },
        { profile: 'custom', delivery: 'skills', workflows: ['onboard', 'verify'] }
      )
    ).toEqual({
      featureFlags: { customSchema: true },
      teamExtension: { owner: 'platform' },
      profile: 'custom',
      delivery: 'skills',
      workflows: ['verify', 'onboard'],
    })
  })

  it('rejects duplicate workflow inputs at the public mutation boundary', () => {
    expect(() =>
      AgentDeliveryPolicyUpdateSchema.parse({
        profile: 'custom',
        delivery: 'both',
        workflows: ['apply', 'apply'],
      })
    ).toThrow('Agent workflows must be unique.')
  })
})
