import type { DashboardOverview } from '@openspecui/core'
import { describe, expect, it } from 'vitest'
import { buildDashboardTimeTrends, type DashboardTrendEvent } from './dashboard-time-trends.js'

const DAY_MS = 24 * 60 * 60 * 1000

function createAvailability(
  overrides: Partial<DashboardOverview['cardAvailability']> = {}
): DashboardOverview['cardAvailability'] {
  return {
    specifications: { state: 'ok' },
    requirements: { state: 'ok' },
    activeChanges: { state: 'ok' },
    inProgressChanges: { state: 'ok' },
    completedChanges: { state: 'ok' },
    taskCompletionPercent: { state: 'ok' },
    ...overrides,
  }
}

function createEvents(
  overrides: Partial<Record<keyof DashboardOverview['trends'], DashboardTrendEvent[]>>
) {
  return {
    specifications: [],
    requirements: [],
    activeChanges: [],
    inProgressChanges: [],
    completedChanges: [],
    taskCompletionPercent: [],
    ...overrides,
  }
}

describe('dashboard time trends', () => {
  it('uses recent time window and resamples cumulative values by time', () => {
    const base = DAY_MS * 100
    const events = Array.from({ length: 30 }, (_, index) => ({
      ts: base + index * DAY_MS,
      value: 1,
    }))
    const result = buildDashboardTimeTrends({
      pointLimit: 20,
      timestamp: 9999,
      availability: createAvailability(),
      events: createEvents({ specifications: events }),
      reducers: { specifications: 'sum-cumulative' },
    })

    expect(result.trends.specifications).toHaveLength(20)
    expect(result.trends.specifications[0]?.ts).toBe(base + 10 * DAY_MS)
    expect(result.trends.specifications[19]?.ts).toBe(base + 29 * DAY_MS)
    expect(result.trends.specifications[0]?.value).toBe(1)
    expect(result.trends.specifications[19]?.value).toBe(20)
    const values = result.trends.specifications.map((point) => point.value)
    expect(values.every((value, index) => index === 0 || value >= values[index - 1]!)).toBe(true)
  })

  it('returns fixed-size window when only one timestamp exists', () => {
    const result = buildDashboardTimeTrends({
      pointLimit: 100,
      timestamp: 9999,
      availability: createAvailability(),
      events: createEvents({
        activeChanges: [{ ts: DAY_MS * 200, value: 1 }],
      }),
    })

    expect(result.trends.activeChanges).toHaveLength(20)
    expect(result.trends.activeChanges[19]?.ts).toBe(DAY_MS * 200)
    expect(result.trends.activeChanges[19]?.value).toBe(1)
  })

  it('skips invalid metrics', () => {
    const result = buildDashboardTimeTrends({
      pointLimit: 100,
      timestamp: 9999,
      availability: createAvailability({
        taskCompletionPercent: { state: 'invalid', reason: 'semantic-uncomputable' },
      }),
      events: createEvents({
        taskCompletionPercent: [
          { ts: 1000, value: 20 },
          { ts: 2000, value: 60 },
        ],
      }),
    })

    expect(result.trends.taskCompletionPercent).toEqual([])
  })

  it('uses carry-forward averaging for task completion trend', () => {
    const base = DAY_MS * 200
    const result = buildDashboardTimeTrends({
      pointLimit: 100,
      timestamp: 9999,
      availability: createAvailability(),
      events: createEvents({
        taskCompletionPercent: [
          { ts: base, value: 10 },
          { ts: base + DAY_MS * 4, value: 30 },
          { ts: base + DAY_MS * 8, value: 90 },
        ],
      }),
      reducers: { taskCompletionPercent: 'avg-carry' },
    })

    expect(result.trends.taskCompletionPercent).toHaveLength(20)
    expect(result.trends.taskCompletionPercent[0]?.value).toBe(10)
    expect(result.trends.taskCompletionPercent[19]?.value).toBe(90)
  })

  it('keeps negative deltas for bidirectional trends', () => {
    const base = DAY_MS * 300
    const result = buildDashboardTimeTrends({
      pointLimit: 100,
      timestamp: 9999,
      availability: createAvailability(),
      events: createEvents({
        activeChanges: [
          { ts: base, value: 3 },
          { ts: base + DAY_MS, value: -1 },
        ],
      }),
      reducers: { activeChanges: 'sum' },
    })

    expect(result.trends.activeChanges).toHaveLength(20)
    const values = result.trends.activeChanges.map((point) => point.value)
    expect(values.some((value) => value < 0)).toBe(true)
  })

  it('renders two equal spikes for two completed-change events in sum mode', () => {
    const base = DAY_MS * 400
    const result = buildDashboardTimeTrends({
      pointLimit: 100,
      timestamp: 9999,
      availability: createAvailability(),
      events: createEvents({
        completedChanges: [
          { ts: base + DAY_MS * 1, value: 1 },
          { ts: base + DAY_MS * 10, value: 1 },
        ],
      }),
      reducers: { completedChanges: 'sum' },
    })

    const nonZero = result.trends.completedChanges.filter((point) => point.value > 0)
    expect(result.trends.completedChanges).toHaveLength(20)
    expect(nonZero).toHaveLength(2)
    expect(nonZero[0]?.value).toBe(1)
    expect(nonZero[1]?.value).toBe(1)
  })

  it('uses explicit right edge timestamp as the final bucket time', () => {
    const base = DAY_MS * 500
    const explicitRightEdge = base + DAY_MS * 30
    const result = buildDashboardTimeTrends({
      pointLimit: 100,
      timestamp: 9999,
      rightEdgeTs: explicitRightEdge,
      availability: createAvailability(),
      events: createEvents({
        specifications: [
          { ts: base + DAY_MS * 1, value: 1 },
          { ts: base + DAY_MS * 10, value: 1 },
        ],
      }),
      reducers: { specifications: 'sum' },
    })

    expect(result.trends.specifications).toHaveLength(20)
    expect(result.trends.specifications[19]?.ts).toBe(explicitRightEdge)
  })
})
