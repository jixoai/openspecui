/**
 * Orthogonal intents (updated 2026-07-22 Asia/Shanghai):
 * 1. Prove completed projections preserve their data event.
 * 2. Prove initial reactive data emits without a lifecycle start.
 * 3. Prove recompute start precedes a blocked replacement result.
 * 4. Prove unsubscribe retires the reactive owner before later invalidation.
 * 5. Prove task rejection emits one original error without data or completion.
 *
 * Original request (2026-07-22): "整个过程中，几乎都在 Loading。"
 */
import { ReactiveState } from '@openspecui/core'
import { describe, expect, it } from 'vitest'
import {
  createReactiveProjectionSubscription,
  type ReactiveProjectionSubscriptionEvent,
} from './reactive-subscription.js'

interface Deferred {
  promise: Promise<void>
  resolve(): void
  reject(reason: unknown): void
}

function createDeferred(): Deferred {
  let resolvePromise: (() => void) | undefined
  let rejectPromise: ((reason: unknown) => void) | undefined
  const promise = new Promise<void>((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })
  return {
    promise,
    resolve() {
      if (!resolvePromise) throw new Error('Deferred resolver was not initialized.')
      resolvePromise()
    },
    reject(reason) {
      if (!rejectPromise) throw new Error('Deferred rejecter was not initialized.')
      rejectPromise(reason)
    },
  }
}

async function settleReactivePromiseChain(): Promise<void> {
  // Settle abort/change -> Promise.race -> generator -> observable runner continuations.
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('createReactiveProjectionSubscription', () => {
  it('emits completed projection data before completing', async () => {
    const completed = createDeferred()
    const errors: unknown[] = []
    const events: ReactiveProjectionSubscriptionEvent<string>[] = []

    createReactiveProjectionSubscription(async () => 'A').subscribe({
      next: (event) => events.push(event),
      error(error) {
        errors.push(error)
        completed.reject(error)
      },
      complete: completed.resolve,
    })

    await completed.promise
    expect(events).toEqual([{ type: 'data', data: 'A' }])
    expect(errors).toEqual([])
  })

  it('emits recompute start before the blocked replacement data', async () => {
    const state = new ReactiveState('A')
    const initialDataEmitted = createDeferred()
    const replacementTaskEntered = createDeferred()
    const releaseReplacement = createDeferred()
    const replacementDataEmitted = createDeferred()
    const errors: unknown[] = []
    const events: ReactiveProjectionSubscriptionEvent<string>[] = []
    let taskRun = 0

    const subscription = createReactiveProjectionSubscription(async () => {
      taskRun += 1
      const data = state.get()
      if (taskRun > 1) {
        replacementTaskEntered.resolve()
        await releaseReplacement.promise
      }
      return data
    }).subscribe({
      next(event) {
        events.push(event)
        if (event.type === 'data' && event.data === 'A') {
          initialDataEmitted.resolve()
        }
        if (event.type === 'data' && event.data === 'B') {
          replacementDataEmitted.resolve()
        }
      },
      error(error) {
        errors.push(error)
        initialDataEmitted.reject(error)
        replacementTaskEntered.reject(error)
        replacementDataEmitted.reject(error)
      },
    })

    try {
      await initialDataEmitted.promise
      expect(events).toEqual([{ type: 'data', data: 'A' }])

      state.set('B')
      await replacementTaskEntered.promise
      expect(events.slice()).toEqual([{ type: 'data', data: 'A' }, { type: 'recompute-started' }])

      releaseReplacement.resolve()
      await replacementDataEmitted.promise
      expect(events).toEqual([
        { type: 'data', data: 'A' },
        { type: 'recompute-started' },
        { type: 'data', data: 'B' },
      ])
      expect(errors).toEqual([])
    } finally {
      releaseReplacement.resolve()
      subscription.unsubscribe()
    }
  })

  it('retires the reactive owner before a later invalidation', async () => {
    const state = new ReactiveState('A')
    const initialDataEmitted = createDeferred()
    const errors: unknown[] = []
    const events: ReactiveProjectionSubscriptionEvent<string>[] = []
    let taskRuns = 0

    const subscription = createReactiveProjectionSubscription(async () => {
      taskRuns += 1
      return state.get()
    }).subscribe({
      next(event) {
        events.push(event)
        if (event.type === 'data' && event.data === 'A') {
          initialDataEmitted.resolve()
        }
      },
      error(error) {
        errors.push(error)
        initialDataEmitted.reject(error)
      },
    })

    await initialDataEmitted.promise
    expect(events).toEqual([{ type: 'data', data: 'A' }])
    expect(state.subscriberCount).toBe(1)
    expect(taskRuns).toBe(1)

    subscription.unsubscribe()
    await settleReactivePromiseChain()
    const afterUnsubscribe = {
      subscriberCount: state.subscriberCount,
      taskRuns,
    }
    state.set('B')
    await settleReactivePromiseChain()

    expect({ afterUnsubscribe, subscriberCount: state.subscriberCount, taskRuns, events }).toEqual({
      afterUnsubscribe: { subscriberCount: 0, taskRuns: 1 },
      subscriberCount: 0,
      taskRuns: 1,
      events: [{ type: 'data', data: 'A' }],
    })
    expect(errors).toEqual([])
  })

  it('emits the original task rejection without data or completion', async () => {
    const taskRejected = createDeferred()
    const rejection = new Error('projection failed')
    const errors: unknown[] = []
    const events: ReactiveProjectionSubscriptionEvent<string>[] = []
    let completionCount = 0

    createReactiveProjectionSubscription<string>(async () => {
      taskRejected.resolve()
      throw rejection
    }).subscribe({
      next: (event) => events.push(event),
      error: (error) => errors.push(error),
      complete: () => {
        completionCount += 1
      },
    })

    await taskRejected.promise
    await settleReactivePromiseChain()

    expect(errors).toHaveLength(1)
    expect(errors[0]).toBe(rejection)
    expect(events).toEqual([])
    expect(completionCount).toBe(0)
  })
})
