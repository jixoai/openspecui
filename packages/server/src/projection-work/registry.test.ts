/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Prove same-identity subscribers share one owner loader and one ReactiveContext.
 * 2. Prove a retired generation cannot publish a late result into its replacement.
 * 3. Prove phase tracing is bounded and payload-free.
 *
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 */
import { ReactiveState } from '@openspecui/core'
import { describe, expect, it } from 'vitest'
import { ProjectionWorkPhaseTrace } from './phase-trace.js'
import { ProjectionWorkRegistry, type ProjectionWorkRequest } from './registry.js'
import { ProjectionWorkScheduler } from './scheduler.js'
import type { ProjectionWorkEvent, ProjectionWorkIdentity } from './types.js'

interface Deferred<T> {
  promise: Promise<T>
  resolve(value: T): void
  reject(reason: unknown): void
}

function createDeferred<T>(): Deferred<T> {
  let resolvePromise: ((value: T) => void) | undefined
  let rejectPromise: ((reason: unknown) => void) | undefined
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })
  return {
    promise,
    resolve(value) {
      if (!resolvePromise) throw new Error('Deferred resolver was not initialized.')
      resolvePromise(value)
    },
    reject(reason) {
      if (!rejectPromise) throw new Error('Deferred rejecter was not initialized.')
      rejectPromise(reason)
    },
  }
}

function createIdentity(inputFingerprint = 'fixture-input'): ProjectionWorkIdentity {
  return {
    projectionKind: 'fixture',
    planningRoot: {
      identity: '/fixture/root',
      source: 'nearest',
      storeSelector: null,
    },
    owner: {
      generation: 'root-A',
      gitBindingToken: null,
    },
    selector: 'overview',
    inputFingerprint,
    protocolVersion: 1,
  }
}

function createRegistry(
  trace = new ProjectionWorkPhaseTrace({ capacity: 32 }),
  cache: { maxEntries: number; maxBytes: number } = { maxEntries: 4, maxBytes: 1024 }
) {
  return {
    trace,
    registry: new ProjectionWorkRegistry<string>({
      scheduler: new ProjectionWorkScheduler({
        limits: { cli: 1, filesystem: 1, git: 1, cpu: 1 },
      }),
      phaseTrace: trace,
      cache,
      maxWorkEntries: 8,
    }),
  }
}

async function settleAsyncWork(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

function dataValues(events: readonly ProjectionWorkEvent<string, never>[]): string[] {
  return events.flatMap((event) => (event.type === 'snapshot' ? [event.snapshot.data] : []))
}

describe('ProjectionWorkRegistry', () => {
  it('shares one same-identity leaf and one reactive dependency owner across subscribers', async () => {
    const { registry } = createRegistry()
    const state = new ReactiveState('current')
    const firstLoadStarted = createDeferred<void>()
    const releaseLoad = createDeferred<void>()
    const firstData = createDeferred<void>()
    const secondData = createDeferred<void>()
    const replayedData = createDeferred<void>()
    const firstEvents: ProjectionWorkEvent<string, never>[] = []
    const secondEvents: ProjectionWorkEvent<string, never>[] = []
    let leafCalls = 0

    const request: ProjectionWorkRequest<string, never> = {
      identity: createIdentity(),
      resourceClass: 'filesystem',
      priority: 'foreground',
      estimateSnapshotBytes: (value) => value.length,
      load: async () => {
        leafCalls += 1
        const value = state.get()
        firstLoadStarted.resolve()
        await releaseLoad.promise
        return value
      },
    }

    const first = registry.subscribe(request, (event) => {
      firstEvents.push(event)
      if (event.type === 'snapshot' && event.snapshot.data === 'current') firstData.resolve()
    })

    try {
      await firstLoadStarted.promise
      expect({ leafCalls, reactiveSubscribers: state.subscriberCount }).toEqual({
        leafCalls: 1,
        reactiveSubscribers: 1,
      })

      const second = registry.subscribe(request, (event) => {
        secondEvents.push(event)
        if (event.type === 'snapshot' && event.snapshot.data === 'current') secondData.resolve()
      })
      try {
        expect({ leafCalls, reactiveSubscribers: state.subscriberCount }).toEqual({
          leafCalls: 1,
          reactiveSubscribers: 1,
        })
        releaseLoad.resolve()
        await Promise.all([firstData.promise, secondData.promise])
        expect({ first: dataValues(firstEvents), second: dataValues(secondEvents) }).toEqual({
          first: ['current'],
          second: ['current'],
        })
        const replayEvents: ProjectionWorkEvent<string, never>[] = []
        const replay = registry.subscribe(request, (event) => {
          replayEvents.push(event)
          if (event.type === 'snapshot' && event.snapshot.data === 'current') replayedData.resolve()
        })
        try {
          await replayedData.promise
          expect({ leafCalls, replay: dataValues(replayEvents) }).toEqual({
            leafCalls: 1,
            replay: ['current'],
          })
          expect(replayEvents).toContainEqual({
            type: 'stage',
            phase: 'cache-hit',
            workGeneration: 1,
          })
        } finally {
          replay.unsubscribe()
        }
      } finally {
        second.unsubscribe()
      }
    } finally {
      releaseLoad.resolve()
      first.unsubscribe()
    }
  })

  it('retires A before a late A result can publish into the replacement generation', async () => {
    const { registry, trace } = createRegistry()
    const firstLoadStarted = createDeferred<void>()
    const releaseA = createDeferred<void>()
    const bData = createDeferred<void>()
    const events: ProjectionWorkEvent<string, never>[] = []
    let leafCalls = 0
    const identity = createIdentity()

    const request: ProjectionWorkRequest<string, never> = {
      identity,
      resourceClass: 'filesystem',
      priority: 'foreground',
      estimateSnapshotBytes: (value) => value.length,
      load: async () => {
        leafCalls += 1
        if (leafCalls === 1) {
          firstLoadStarted.resolve()
          await releaseA.promise
          return 'A'
        }
        return 'B'
      },
    }

    const subscription = registry.subscribe(request, (event) => {
      events.push(event)
      if (event.type === 'snapshot' && event.snapshot.data === 'B') bData.resolve()
    })

    try {
      await firstLoadStarted.promise
      registry.invalidate(identity)
      releaseA.resolve()
      await bData.promise

      expect(dataValues(events)).toEqual(['B'])
      expect(
        trace
          .read()
          .filter((entry) => entry.phase === 'first-stable-payload')
          .map((entry) => entry.workGeneration)
      ).toEqual([2])
    } finally {
      releaseA.resolve()
      subscription.unsubscribe()
    }
  })

  it('replays a current snapshot with no reactive dependencies until explicit invalidation', async () => {
    const { registry } = createRegistry()
    const firstData = createDeferred<void>()
    const replayData = createDeferred<void>()
    let leafCalls = 0
    const request: ProjectionWorkRequest<string, never> = {
      identity: createIdentity(),
      resourceClass: 'filesystem',
      priority: 'foreground',
      estimateSnapshotBytes: (value) => value.length,
      load: async () => {
        leafCalls += 1
        return 'current'
      },
    }

    const first = registry.subscribe(request, (event) => {
      if (event.type === 'snapshot' && event.snapshot.data === 'current') firstData.resolve()
    })
    try {
      await firstData.promise
      await settleAsyncWork()
      const replay = registry.subscribe(request, (event) => {
        if (event.type === 'snapshot' && event.snapshot.data === 'current') replayData.resolve()
      })
      try {
        await replayData.promise
        expect(leafCalls).toBe(1)
      } finally {
        replay.unsubscribe()
      }
    } finally {
      first.unsubscribe()
    }
  })

  it('evicts the least-recent dormant snapshot when its configured cache bound is exceeded', async () => {
    const { registry } = createRegistry(undefined, { maxEntries: 1, maxBytes: 1024 })
    const firstData = createDeferred<void>()
    const secondData = createDeferred<void>()
    const firstRequest: ProjectionWorkRequest<string, never> = {
      identity: createIdentity('first'),
      resourceClass: 'filesystem',
      priority: 'foreground',
      estimateSnapshotBytes: (value) => value.length,
      load: async () => 'first',
    }
    const secondRequest: ProjectionWorkRequest<string, never> = {
      identity: createIdentity('second'),
      resourceClass: 'filesystem',
      priority: 'foreground',
      estimateSnapshotBytes: (value) => value.length,
      load: async () => 'second',
    }

    const first = registry.subscribe(firstRequest, (event) => {
      if (event.type === 'snapshot' && event.snapshot.data === 'first') firstData.resolve()
    })
    await firstData.promise
    first.unsubscribe()

    const second = registry.subscribe(secondRequest, (event) => {
      if (event.type === 'snapshot' && event.snapshot.data === 'second') secondData.resolve()
    })
    try {
      await secondData.promise
    } finally {
      second.unsubscribe()
    }

    expect(registry.getStats()).toEqual({ workEntries: 1, cachedEntries: 1, cachedBytes: 6 })
  })

  it('retains only the newest bounded phase records', () => {
    let now = 0
    const trace = new ProjectionWorkPhaseTrace({ capacity: 2, now: () => ++now })

    trace.record({
      workId: 'work-1',
      projectionKind: 'fixture',
      workGeneration: 1,
      phase: 'request',
    })
    trace.record({ workId: 'work-1', projectionKind: 'fixture', workGeneration: 1, phase: 'start' })
    trace.record({
      workId: 'work-1',
      projectionKind: 'fixture',
      workGeneration: 1,
      phase: 'complete',
    })

    expect(trace.read()).toEqual([
      { at: 2, workId: 'work-1', projectionKind: 'fixture', workGeneration: 1, phase: 'start' },
      { at: 3, workId: 'work-1', projectionKind: 'fixture', workGeneration: 1, phase: 'complete' },
    ])
  })
})
