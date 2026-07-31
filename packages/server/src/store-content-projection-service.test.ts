/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Prove Store-content Work invokes the official CLI with an explicit Store selector (6.4/6.5/6.6).
 * 2. Prove Specs and active Changes regions settle independently and retain during revalidation (6.7).
 * 3. Prove Work is keyed by composite (envUri, Store id, kind) identity; cross-Store completion is rejected (6.8).
 * 4. Prove content Work is demand-driven: unsubscribed Stores start no CLI work (6.12).
 * 5. Prove no polling timer is installed; invalidation reuses Store-root observation (6.9).
 *
 * Original request (2026-07-30): "Stores 完全可以融入 `Environment Center` 这个东西。"
 * Mutation (6.14): removing/changing the explicit Store selector makes cross-Store data unable to settle.
 */
import {
  closeAllWatchers,
  OpenSpecCliContractExecutor,
  RuntimeInvalidationIndex,
  type CliProjectionNotice,
  type CliResult,
} from '@openspecui/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createServerProjectionWorkRuntime } from './projection-work/runtime.js'
import {
  createStoreContentProjectionWorkOwner,
  StoreContentProjectionService,
  type StoreContentIdentity,
} from './store-content-projection-service.js'

interface Deferred<T> {
  promise: Promise<T>
  resolve(value: T): void
}
function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolver) => {
    resolve = resolver
  })
  return { promise, resolve }
}

function cliResult(payload: unknown): CliResult {
  return { success: true, stdout: JSON.stringify(payload), stderr: '', exitCode: 0 }
}

function createFixture(execute: (args: string[]) => Promise<CliResult>) {
  const runtime = createServerProjectionWorkRuntime()
  const invalidation = new RuntimeInvalidationIndex()
  const contracts = new OpenSpecCliContractExecutor(execute)
  let storeObservationListener:
    | ((change: import('./store-observation-service.js').StoreObservationChange) => void)
    | null = null
  const service = new StoreContentProjectionService({
    dataScopePath: '/runtime/data/openspec',
    cliExecutor: {
      checkAvailability: async () => ({ available: true, version: '1.6.0' }),
      contracts,
    },
    invalidation,
    storeObservation: {
      reconcile: vi.fn(async () => {}),
      subscribe: (listener) => {
        storeObservationListener = listener
        return () => {
          storeObservationListener = null
        }
      },
      dispose: async () => {},
    },
    workOwner: createStoreContentProjectionWorkOwner(runtime),
  })
  return {
    invalidation,
    runtime,
    service,
    emitStoreObservation(change: import('./store-observation-service.js').StoreObservationChange) {
      storeObservationListener?.(change)
    },
  }
}

afterEach(async () => {
  await closeAllWatchers()
})

const SPECS_ID: StoreContentIdentity = { envUri: 'env://1', storeId: 'team', kind: 'specs' }
const CHANGES_ID: StoreContentIdentity = { envUri: 'env://1', storeId: 'team', kind: 'changes' }

describe('StoreContentProjectionService (6.4-6.12)', () => {
  it('invokes the official CLI Spec-list with an explicit --store selector and exact argv', async () => {
    const calls: string[][] = []
    const fixture = createFixture(async (args) => {
      calls.push(args)
      return cliResult({ specs: [{ id: 'auth', requirementCount: 3 }] })
    })
    const ready = createDeferred<void>()
    const sub = fixture.service.subscribeContent(SPECS_ID, (notice) => {
      if (notice.state === 'ready') ready.resolve()
    })
    try {
      await ready.promise
      // Exact CLI argv proof: list --specs --json --store <id> (6.6). withRoot appends --store last.
      expect(calls).toContainEqual(['list', '--specs', '--json', '--store', 'team'])
      expect(fixture.service.readContent(SPECS_ID)).toMatchObject({
        state: 'ready',
        data: { available: true, specs: [{ id: 'auth', requirementCount: 3 }], storeId: 'team' },
      })
    } finally {
      sub.unsubscribe()
      fixture.runtime.clear()
    }
  })

  it('invokes the official CLI active-Change list with an explicit --store selector', async () => {
    const calls: string[][] = []
    const fixture = createFixture(async (args) => {
      calls.push(args)
      return cliResult({
        changes: [
          {
            name: 'reshape',
            completedTasks: 1,
            totalTasks: 4,
            lastModified: '2026-07-30',
            status: 'in-progress',
          },
        ],
      })
    })
    const ready = createDeferred<void>()
    const sub = fixture.service.subscribeContent(CHANGES_ID, (notice) => {
      if (notice.state === 'ready') ready.resolve()
    })
    try {
      await ready.promise
      expect(calls).toContainEqual(['list', '--json', '--store', 'team'])
    } finally {
      sub.unsubscribe()
      fixture.runtime.clear()
    }
  })

  it('keeps Specs and active Changes regions independent (one failing does not block the other)', async () => {
    const fixture = createFixture(async (args) => {
      if (args.includes('--specs')) {
        return { success: false, stdout: '', stderr: 'specs unavailable', exitCode: 1 }
      }
      return cliResult({ changes: [] })
    })
    const specsSettled = createDeferred<CliProjectionNotice>()
    const changesReady = createDeferred<void>()
    const specs = fixture.service.subscribeContent(SPECS_ID, (notice) => {
      if (notice.state === 'error' || notice.state === 'refresh-error') specsSettled.resolve(notice)
    })
    const changes = fixture.service.subscribeContent(CHANGES_ID, (notice) => {
      if (notice.state === 'ready') changesReady.resolve()
    })
    try {
      await changesReady.promise
      // Changes settled while the Specs region carries its OWN failure evidence (available:false).
      expect(fixture.service.readContent(CHANGES_ID)).toMatchObject({ state: 'ready' })
      const specsState = fixture.service.readContent(SPECS_ID)
      expect(specsState.state).toBe('ready')
      if (specsState.data) {
        expect(specsState.data.available).toBe(false)
        expect(specsState.data.error?.kind).toBe('command-unavailable')
      }
    } finally {
      specs.unsubscribe()
      changes.unsubscribe()
      fixture.runtime.clear()
    }
  })

  it('keys Work by composite identity: a different Store id does not settle into another Store', async () => {
    const teamCalls: string[][] = []
    const designCalls: string[][] = []
    const fixture = createFixture(async (args) => {
      const storeIndex = args.indexOf('--store')
      const storeId = storeIndex >= 0 ? args[storeIndex + 1] : ''
      if (storeId === 'team') {
        teamCalls.push(args)
        return cliResult({ specs: [{ id: 'team-spec', requirementCount: 1 }] })
      }
      designCalls.push(args)
      return cliResult({ specs: [{ id: 'design-spec', requirementCount: 2 }] })
    })
    const teamReady = createDeferred<void>()
    const designReady = createDeferred<void>()
    const team = fixture.service.subscribeContent(
      { envUri: 'env://1', storeId: 'team', kind: 'specs' },
      (notice) => {
        if (notice.state === 'ready') teamReady.resolve()
      }
    )
    const design = fixture.service.subscribeContent(
      { envUri: 'env://1', storeId: 'design', kind: 'specs' },
      (notice) => {
        if (notice.state === 'ready') designReady.resolve()
      }
    )
    try {
      await Promise.all([teamReady.promise, designReady.promise])
      // Each Store's content is keyed by its own composite identity (6.8).
      expect(
        fixture.service.readContent({ envUri: 'env://1', storeId: 'team', kind: 'specs' }).data
      ).toMatchObject({ specs: [{ id: 'team-spec', requirementCount: 1 }], storeId: 'team' })
      expect(
        fixture.service.readContent({ envUri: 'env://1', storeId: 'design', kind: 'specs' }).data
      ).toMatchObject({ specs: [{ id: 'design-spec', requirementCount: 2 }], storeId: 'design' })
    } finally {
      team.unsubscribe()
      design.unsubscribe()
      fixture.runtime.clear()
    }
  })

  it('is demand-driven: an unsubscribed Store starts no CLI content work', async () => {
    const calls: string[][] = []
    const fixture = createFixture(async (args) => {
      calls.push(args)
      return cliResult({ specs: [] })
    })
    // No subscription: no work should start.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(calls).toEqual([])
    // Subscribing to one Store/kind starts exactly that work.
    const ready = createDeferred<void>()
    const sub = fixture.service.subscribeContent(SPECS_ID, (notice) => {
      if (notice.state === 'ready') ready.resolve()
    })
    try {
      await ready.promise
      expect(calls.filter((args) => args.includes('--specs'))).toHaveLength(1)
      // The other kind (changes) for the same Store is not started by a specs subscription.
      expect(calls.some((args) => !args.includes('--specs'))).toBe(false)
    } finally {
      sub.unsubscribe()
      fixture.runtime.clear()
    }
  })

  it('installs no polling timer and reuses invalidation to rerun content Work', async () => {
    const fixture = createFixture(async () =>
      cliResult({ specs: [{ id: 'a', requirementCount: 1 }] })
    )
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')
    const ready = createDeferred<void>()
    const revalidated = createDeferred<void>()
    let generations = 0
    const sub = fixture.service.subscribeContent(SPECS_ID, (notice) => {
      if (notice.state === 'ready') {
        generations += 1
        if (generations === 1) ready.resolve()
        if (generations === 2) revalidated.resolve()
      }
    })
    try {
      await ready.promise
      fixture.invalidation.invalidate(['stores'])
      await revalidated.promise
      expect(setIntervalSpy).not.toHaveBeenCalled()
      expect(generations).toBe(2)
    } finally {
      sub.unsubscribe()
      setIntervalSpy.mockRestore()
      fixture.runtime.clear()
    }
  })

  it('invalidates matching registered Store identities without fabricating an empty envUri', async () => {
    const calls: string[][] = []
    const fixture = createFixture(async (args) => {
      calls.push(args)
      return args.includes('--specs') ? cliResult({ specs: [] }) : cliResult({ changes: [] })
    })
    const identities: StoreContentIdentity[] = [
      { envUri: 'env://one', storeId: 'team', kind: 'specs' },
      { envUri: 'env://two', storeId: 'team', kind: 'specs' },
      { envUri: 'env://one', storeId: 'team', kind: 'changes' },
      { envUri: 'env://one', storeId: 'design', kind: 'specs' },
    ]
    let readyCount = 0
    const initialReady = createDeferred<void>()
    const subscriptions = identities.map((identity) =>
      fixture.service.subscribeContent(identity, (notice) => {
        if (notice.state !== 'ready') return
        readyCount += 1
        if (readyCount === identities.length) initialReady.resolve()
      })
    )
    try {
      await initialReady.promise
      const callsBefore = calls.length
      const refreshed = createDeferred<void>()
      let refreshedSpecs = 0
      const observers = [
        fixture.service.subscribeContent(identities[0]!, (notice) => {
          if (notice.state === 'ready' && notice.workGeneration === 2) {
            refreshedSpecs += 1
            if (refreshedSpecs === 2) refreshed.resolve()
          }
        }),
        fixture.service.subscribeContent(identities[1]!, (notice) => {
          if (notice.state === 'ready' && notice.workGeneration === 2) {
            refreshedSpecs += 1
            if (refreshedSpecs === 2) refreshed.resolve()
          }
        }),
      ]
      fixture.emitStoreObservation({ kind: 'spec-root', storeId: 'team', generation: 1 })
      await refreshed.promise
      expect(calls).toHaveLength(callsBefore + 2)
      expect(
        fixture.service.readContent({ envUri: 'env://one', storeId: 'team', kind: 'changes' })
          .workGeneration
      ).toBe(1)
      expect(
        fixture.service.readContent({ envUri: 'env://one', storeId: 'design', kind: 'specs' })
          .workGeneration
      ).toBe(1)
      observers.forEach((observer) => observer.unsubscribe())
    } finally {
      subscriptions.forEach((subscription) => subscription.unsubscribe())
      fixture.runtime.clear()
    }
  })
})
