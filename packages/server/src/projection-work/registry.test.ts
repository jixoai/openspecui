/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Prove same-identity subscribers share one owner loader and one ReactiveContext.
 * 2. Prove pending dependency changes and retired generations cannot publish stale results.
 * 3. Prove retained data, replacement failure/recovery, and late subscribers remain observable.
 * 4. Prove trace/cache bounds, selector retirement, and queued scheduler work preserve exact ownership.
 *
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 * Original request (2026-07-26): "dependency 在 pending load 中变化时旧 A 不得作为 current snapshot 发布。"
 */
import { ReactiveState } from '@openspecui/core'
import { describe, expect, it, vi } from 'vitest'
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
  it('publishes data-free lifecycle notices and exposes retained data while replacement fails', async () => {
    const { registry } = createRegistry()
    const dependency = new ReactiveState('A')
    const initialReady = createDeferred<void>()
    const replacementStarted = createDeferred<void>()
    const replacement = createDeferred<void>()
    const refreshFailed = createDeferred<void>()
    const notices: unknown[] = []
    let calls = 0
    const request: ProjectionWorkRequest<string, never> = {
      identity: createIdentity('cli-lifecycle'),
      resourceClass: 'cli',
      priority: 'foreground',
      estimateSnapshotBytes: (value) => value.length,
      load: async () => {
        calls += 1
        const value = dependency.get()
        if (calls > 1) {
          replacementStarted.resolve()
          await replacement.promise
        }
        return value
      },
    }

    const subscription = registry.subscribeLifecycle(request, (notice) => {
      notices.push(notice)
      if (notice.state === 'ready') initialReady.resolve()
      if (notice.state === 'refresh-error') refreshFailed.resolve()
    })

    try {
      await initialReady.promise
      const ready = registry.read(request.identity)
      expect(ready).toMatchObject({
        state: 'ready',
        invalidationCause: 'initial',
        data: 'A',
        freshness: 'current',
        workGeneration: 1,
        snapshotGeneration: 1,
      })

      dependency.set('B')
      await replacementStarted.promise
      const revalidating = registry.read(request.identity)
      expect(revalidating).toMatchObject({
        state: 'revalidating',
        invalidationCause: 'dependency',
        data: 'A',
        freshness: 'stale-display-only',
        workGeneration: 2,
        snapshotGeneration: 1,
      })

      replacement.reject(new Error('CLI replacement failed.'))
      await refreshFailed.promise
      const failed = registry.read(request.identity)
      expect(failed).toMatchObject({
        state: 'refresh-error',
        invalidationCause: 'dependency',
        data: 'A',
        freshness: 'stale-display-only',
        workGeneration: 2,
        snapshotGeneration: 1,
        error: { name: 'Error', message: 'CLI replacement failed.', cliEvidence: null },
      })
      expect(notices.every((notice) => !Object.hasOwn(Object(notice), 'data'))).toBe(true)
      expect(notices).toContainEqual(
        expect.objectContaining({ state: 'revalidating', invalidationCause: 'dependency' })
      )
    } finally {
      replacement.resolve()
      subscription.unsubscribe()
    }
  })

  it('keeps failed Work dependencies live so a later physical change can recover automatically', async () => {
    const { registry } = createRegistry()
    const dependency = new ReactiveState('A')
    const initialReady = createDeferred<void>()
    const failed = createDeferred<void>()
    const recovered = createDeferred<void>()
    const events: ProjectionWorkEvent<string, never>[] = []
    let calls = 0
    const request: ProjectionWorkRequest<string, never> = {
      identity: createIdentity('failure-recovery'),
      resourceClass: 'cli',
      priority: 'foreground',
      estimateSnapshotBytes: (value) => value.length,
      load: async () => {
        const value = dependency.get()
        calls += 1
        if (value === 'B') throw new Error('invalid intermediate CLI result')
        return value
      },
    }
    const subscription = registry.subscribe(request, (event) => {
      events.push(event)
      if (event.type === 'snapshot' && event.snapshot.data === 'A') initialReady.resolve()
      if (event.type === 'failed') failed.resolve()
      if (event.type === 'snapshot' && event.snapshot.data === 'C') recovered.resolve()
    })

    try {
      await initialReady.promise
      expect(registry.read(request.identity)).toMatchObject({ state: 'ready' })
      dependency.set('B')
      await failed.promise
      expect(registry.read(request.identity)).toMatchObject({
        state: 'refresh-error',
        data: 'A',
        freshness: 'stale-display-only',
        workGeneration: 2,
        snapshotGeneration: 1,
        error: { message: 'invalid intermediate CLI result' },
      })

      dependency.set('C')
      await recovered.promise
      expect(registry.read(request.identity)).toMatchObject({
        state: 'ready',
        data: 'C',
        freshness: 'current',
        workGeneration: 3,
        snapshotGeneration: 3,
        error: null,
      })
      expect(calls).toBe(3)
      expect(dataValues(events)).toEqual(['A', 'A', 'C'])
    } finally {
      subscription.unsubscribe()
      registry.clear()
    }
  })

  it('replays a retained failure to subscribers that arrive before physical recovery', async () => {
    const { registry } = createRegistry()
    const dependency = new ReactiveState('broken')
    const request: ProjectionWorkRequest<string, never> = {
      identity: createIdentity('late-failure-subscriber'),
      resourceClass: 'cli',
      priority: 'foreground',
      estimateSnapshotBytes: (value) => value.length,
      load: async () => {
        dependency.get()
        throw new Error('CLI result is invalid')
      },
    }
    const firstFailure = createDeferred<void>()
    const first = registry.subscribe(request, (event) => {
      if (event.type === 'failed') firstFailure.resolve()
    })

    try {
      await firstFailure.promise
      const lateEvents: ProjectionWorkEvent<string, never>[] = []
      const late = registry.subscribe(request, (event) => lateEvents.push(event))
      try {
        expect(lateEvents).toContainEqual(
          expect.objectContaining({
            type: 'failed',
            retainedSnapshot: null,
            workGeneration: 1,
          })
        )
      } finally {
        late.unsubscribe()
      }
    } finally {
      first.unsubscribe()
      registry.clear()
    }
  })

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

  it('keeps queued Work dependencies bound to the Work that owns the delayed loader', async () => {
    const { registry } = createRegistry()
    const stateA = new ReactiveState('A-1')
    const stateB = new ReactiveState('B-1')
    const aStarted = createDeferred<void>()
    const releaseA = createDeferred<void>()
    const aReady = createDeferred<void>()
    const bReady = createDeferred<void>()
    let callsA = 0
    let callsB = 0
    const requestA: ProjectionWorkRequest<string, never> = {
      identity: createIdentity('queued-owner-a'),
      resourceClass: 'cli',
      priority: 'foreground',
      estimateSnapshotBytes: (value) => value.length,
      load: async () => {
        callsA += 1
        const value = stateA.get()
        if (callsA === 1) {
          aStarted.resolve()
          await releaseA.promise
        }
        return value
      },
    }
    const requestB: ProjectionWorkRequest<string, never> = {
      identity: createIdentity('queued-owner-b'),
      resourceClass: 'cli',
      priority: 'foreground',
      estimateSnapshotBytes: (value) => value.length,
      load: async () => {
        callsB += 1
        return stateB.get()
      },
    }

    const subscriptionA = registry.subscribe(requestA, (event) => {
      if (event.type === 'snapshot' && event.snapshot.data === 'A-1') aReady.resolve()
    })
    await aStarted.promise
    const subscriptionB = registry.subscribe(requestB, (event) => {
      if (event.type !== 'snapshot') return
      if (event.snapshot.data === 'B-1') bReady.resolve()
    })

    try {
      expect(callsB).toBe(0)
      releaseA.resolve()
      await Promise.all([aReady.promise, bReady.promise])
      expect({ callsA, callsB }).toEqual({ callsA: 1, callsB: 1 })

      stateB.set('B-2')
      await vi.waitFor(() => expect({ callsA, callsB }).toEqual({ callsA: 1, callsB: 2 }), {
        timeout: 500,
      })
      expect(registry.read(requestB.identity)).toMatchObject({ state: 'ready', data: 'B-2' })
    } finally {
      releaseA.resolve()
      subscriptionA.unsubscribe()
      subscriptionB.unsubscribe()
      registry.clear()
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

  it('never publishes a loader result invalidated while that CLI work was still running', async () => {
    const { registry, trace } = createRegistry()
    const dependency = new ReactiveState('A')
    const firstLoadStarted = createDeferred<void>()
    const releaseA = createDeferred<void>()
    const bData = createDeferred<void>()
    const events: ProjectionWorkEvent<string, never>[] = []
    let leafCalls = 0

    const request: ProjectionWorkRequest<string, never> = {
      identity: createIdentity('dirty-during-load'),
      resourceClass: 'cli',
      priority: 'foreground',
      estimateSnapshotBytes: (value) => value.length,
      load: async () => {
        leafCalls += 1
        const value = dependency.get()
        if (leafCalls === 1) {
          firstLoadStarted.resolve()
          await releaseA.promise
        }
        return value
      },
    }

    const subscription = registry.subscribe(request, (event) => {
      events.push(event)
      if (event.type === 'snapshot' && event.snapshot.data === 'B') bData.resolve()
    })

    try {
      await firstLoadStarted.promise
      dependency.set('B')
      releaseA.resolve()
      await bData.promise

      expect(dataValues(events)).toEqual(['B'])
      expect(registry.read(request.identity)).toMatchObject({
        state: 'ready',
        invalidationCause: 'dependency',
        data: 'B',
        freshness: 'current',
        workGeneration: 2,
        snapshotGeneration: 2,
      })
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

  it('never publishes a loader failure invalidated while that CLI work was still running', async () => {
    const { registry } = createRegistry()
    const dependency = new ReactiveState('A')
    const firstLoadStarted = createDeferred<void>()
    const releaseA = createDeferred<void>()
    const bData = createDeferred<void>()
    const events: ProjectionWorkEvent<string, never>[] = []
    let leafCalls = 0

    const request: ProjectionWorkRequest<string, never> = {
      identity: createIdentity('dirty-failure-during-load'),
      resourceClass: 'cli',
      priority: 'foreground',
      estimateSnapshotBytes: (value) => value.length,
      load: async () => {
        leafCalls += 1
        const value = dependency.get()
        if (leafCalls === 1) {
          firstLoadStarted.resolve()
          await releaseA.promise
          throw new Error('Retired A failed.')
        }
        return value
      },
    }

    const subscription = registry.subscribe(request, (event) => {
      events.push(event)
      if (event.type === 'snapshot' && event.snapshot.data === 'B') bData.resolve()
    })

    try {
      await firstLoadStarted.promise
      dependency.set('B')
      releaseA.resolve()
      await bData.promise

      expect(events.some((event) => event.type === 'failed')).toBe(false)
      expect(registry.read(request.identity)).toMatchObject({
        state: 'ready',
        data: 'B',
        workGeneration: 2,
        snapshotGeneration: 2,
      })
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

  it('bulk-invalidates only retained matching Work identities after selector eviction', async () => {
    const { registry } = createRegistry(undefined, { maxEntries: 1, maxBytes: 1024 })
    const doctorReady = createDeferred<void>()
    const otherReady = createDeferred<void>()
    const doctorRequest: ProjectionWorkRequest<string, never> = {
      identity: { ...createIdentity('doctor-alpha'), projectionKind: 'store-doctor' },
      resourceClass: 'cli',
      priority: 'foreground',
      estimateSnapshotBytes: (value) => value.length,
      load: async () => 'doctor',
    }
    const doctor = registry.subscribe(doctorRequest, (event) => {
      if (event.type === 'snapshot') doctorReady.resolve()
    })
    await doctorReady.promise
    doctor.unsubscribe()

    const otherRequest: ProjectionWorkRequest<string, never> = {
      identity: { ...createIdentity('other'), projectionKind: 'other-projection' },
      resourceClass: 'cli',
      priority: 'foreground',
      estimateSnapshotBytes: (value) => value.length,
      load: async () => 'other',
    }
    const other = registry.subscribe(otherRequest, (event) => {
      if (event.type === 'snapshot') otherReady.resolve()
    })
    await otherReady.promise
    other.unsubscribe()

    expect(registry.getStats()).toEqual({ workEntries: 1, cachedEntries: 1, cachedBytes: 5 })
    expect(
      registry.invalidateMatching((identity) => identity.projectionKind === 'store-doctor')
    ).toBe(0)
    expect(registry.read(otherRequest.identity)).toMatchObject({
      state: 'revalidating',
      data: 'other',
      freshness: 'stale-display-only',
    })
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
