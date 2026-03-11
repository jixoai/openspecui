import { describe, expect, it } from 'vitest'
import { buildHostedChannelPlan } from './channel-plan'

describe('buildHostedChannelPlan', () => {
  it('builds latest, major, and minor channels from stable versions >= 2', () => {
    const plan = buildHostedChannelPlan([
      '1.9.0',
      '2.0.1',
      '2.0.3',
      '2.1.0',
      '2.1.2',
      '3.0.0-beta.1',
    ])

    expect(plan.map((entry) => entry.id)).toEqual(['latest', 'v2', 'v2.0', 'v2.1'])
    expect(plan.find((entry) => entry.id === 'latest')?.resolvedVersion).toBe('2.1.2')
    expect(plan.find((entry) => entry.id === 'v2.0')?.resolvedVersion).toBe('2.0.3')
  })
})
