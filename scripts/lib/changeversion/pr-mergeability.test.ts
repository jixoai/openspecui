import { describe, expect, it, vi } from 'vitest'

import { isPrReadyToMerge, type PrMergeability, waitForPrMergeability } from './pr-mergeability'

describe('isPrReadyToMerge', () => {
  it('accepts open non-draft pull requests in ready merge states', () => {
    expect(
      isPrReadyToMerge({
        isDraft: false,
        mergeStateStatus: 'CLEAN',
        state: 'OPEN',
      })
    ).toBe(true)

    expect(
      isPrReadyToMerge({
        isDraft: false,
        mergeStateStatus: 'UNSTABLE',
        state: 'OPEN',
      })
    ).toBe(true)
  })

  it('rejects blocked, closed, or draft pull requests', () => {
    expect(
      isPrReadyToMerge({
        isDraft: false,
        mergeStateStatus: 'BLOCKED',
        state: 'OPEN',
      })
    ).toBe(false)

    expect(
      isPrReadyToMerge({
        isDraft: true,
        mergeStateStatus: 'CLEAN',
        state: 'OPEN',
      })
    ).toBe(false)

    expect(
      isPrReadyToMerge({
        isDraft: false,
        mergeStateStatus: 'CLEAN',
        state: 'CLOSED',
      })
    ).toBe(false)
  })
})

describe('waitForPrMergeability', () => {
  it('polls until the pull request becomes mergeable', () => {
    const states: PrMergeability[] = [
      { isDraft: false, mergeStateStatus: 'BLOCKED', state: 'OPEN' },
      { isDraft: false, mergeStateStatus: 'CLEAN', state: 'OPEN' },
    ]
    let index = 0
    let now = 0
    const sleep = vi.fn((ms: number) => {
      now += ms
    })

    const result = waitForPrMergeability(() => states[index++] ?? states.at(-1)!, 20_000, {
      now: () => now,
      pollIntervalMs: 1000,
      sleepMs: sleep,
    })

    expect(result.mergeStateStatus).toBe('CLEAN')
    expect(sleep).toHaveBeenCalledTimes(1)
  })

  it('fails fast when the pull request closes while waiting', () => {
    const states: PrMergeability[] = [
      { isDraft: false, mergeStateStatus: 'BLOCKED', state: 'OPEN' },
      { isDraft: false, mergeStateStatus: 'BLOCKED', state: 'CLOSED' },
    ]
    let index = 0
    let now = 0

    expect(() =>
      waitForPrMergeability(() => states[index++] ?? states.at(-1)!, 20_000, {
        now: () => now,
        pollIntervalMs: 1000,
        sleepMs: (ms) => {
          now += ms
        },
      })
    ).toThrow('PR is no longer open')
  })

  it('times out with the last observed merge state', () => {
    let now = 0

    expect(() =>
      waitForPrMergeability(
        () => ({ isDraft: false, mergeStateStatus: 'BLOCKED', state: 'OPEN' }),
        2000,
        {
          now: () => now,
          pollIntervalMs: 1000,
          sleepMs: (ms) => {
            now += ms
          },
        }
      )
    ).toThrow('Last mergeStateStatus=BLOCKED')
  })
})
