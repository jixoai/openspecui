/**
 * Orthogonal intents (updated 2026-07-27 Asia/Shanghai):
 * 1. Prove Store CLI Work retains A while invalidation-driven B runs and settles.
 * 2. Prove two subscribers share one CLI run and Push contains only the typed lifecycle notice.
 * 3. Prove List ignores Store content while selected/all Doctor track exact typed-list roots.
 * 4. Prove concurrent healthy Store List and Doctor Work install no polling timer.
 * 5. Prove typed add/move/remove and the Server-owned list lease keep dynamic roots current.
 *
 * Original request (2026-07-26): "从轮询这种模式中彻底解放出来，真正基于文件、甚至是文件内容结构的变更去拉取更新。"
 */
import {
  closeAllWatchers,
  OpenSpecCliContractExecutor,
  ReactiveObservationEnvironment,
  RuntimeInvalidationIndex,
  type CliProjectionNotice,
  type CliResult,
  type ObservationRootOwner,
} from '@openspecui/core'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createServerProjectionWorkRuntime } from './projection-work/runtime.js'
import type { StoreDoctorDependencyObservationFactory } from './store-doctor-dependency-observer.js'
import { StoreObservationService } from './store-observation-service.js'
import {
  createStoreProjectionWorkOwner,
  StoreProjectionService,
  type StoreProjectionServiceOptions,
} from './store-projection-service.js'

const CLI_PROJECTION_NOTICE_KEYS = [
  'identity',
  'invalidationCause',
  'snapshotGeneration',
  'state',
  'workGeneration',
] satisfies Array<keyof CliProjectionNotice>

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
  return {
    success: true,
    stdout: JSON.stringify(payload),
    stderr: '',
    exitCode: 0,
  }
}

function expectLifecycleOnlyNotices(notices: readonly CliProjectionNotice[]): void {
  expect(notices.length).toBeGreaterThan(0)
  for (const notice of notices) {
    expect(Object.keys(notice).sort()).toEqual(CLI_PROJECTION_NOTICE_KEYS)
  }
}

function createDoctorDependencyFactory(): StoreDoctorDependencyObservationFactory {
  return vi.fn(async () => ({ dispose: vi.fn(async () => {}) }))
}

async function seedNonGitStore(rootPath: string, storeId: string): Promise<void> {
  await Promise.all([
    mkdir(join(rootPath, 'openspec', 'specs'), { recursive: true }),
    mkdir(join(rootPath, 'openspec', 'changes', 'archive'), { recursive: true }),
    mkdir(join(rootPath, '.openspec-store'), { recursive: true }),
  ])
  await Promise.all([
    writeFile(join(rootPath, 'openspec', 'config.yaml'), 'schema: spec-driven\n', 'utf8'),
    writeFile(join(rootPath, '.openspec-store', 'store.yaml'), `id: ${storeId}\n`, 'utf8'),
  ])
}

function createFixture(
  execute: (args: string[]) => Promise<CliResult>,
  storeObservation?: StoreProjectionServiceOptions['storeObservation'],
  invalidation = new RuntimeInvalidationIndex()
) {
  const runtime = createServerProjectionWorkRuntime()
  const reconcile = vi.fn<StoreProjectionServiceOptions['storeObservation']['reconcile']>(
    async () => {}
  )
  const contracts = new OpenSpecCliContractExecutor(execute)
  const service = new StoreProjectionService({
    dataScopePath: '/runtime/data/openspec',
    cliExecutor: {
      checkAvailability: async () => ({ available: true, version: '1.6.0' }),
      contracts,
    },
    invalidation,
    storeObservation: storeObservation ?? {
      reconcile,
      subscribe: () => () => {},
      dispose: async () => {},
    },
    workOwner: createStoreProjectionWorkOwner(runtime),
  })
  return { invalidation, reconcile, runtime, service }
}

const tempDirs: string[] = []

afterEach(async () => {
  await closeAllWatchers()
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('StoreProjectionService', () => {
  it('joins one invalidation-driven CLI replacement and retains A until B settles', async () => {
    const releaseB = createDeferred<CliResult>()
    const firstReady = createDeferred<void>()
    const replacementStarted = createDeferred<void>()
    const secondReady = createDeferred<void>()
    const notices: CliProjectionNotice[] = []
    let listCalls = 0
    const fixture = createFixture(async (args) => {
      expect(args).toEqual(['store', 'list', '--json'])
      listCalls += 1
      if (listCalls === 1) {
        return cliResult({ stores: [{ id: 'team', root: '/stores/A' }] })
      }
      replacementStarted.resolve()
      return releaseB.promise
    })
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')

    const observe = (notice: CliProjectionNotice) => {
      notices.push(notice)
      if (notice.state === 'ready' && listCalls === 1) firstReady.resolve()
      if (notice.state === 'ready' && listCalls === 2) secondReady.resolve()
    }
    const first = fixture.service.subscribeList(observe)
    const second = fixture.service.subscribeList(observe)

    try {
      await firstReady.promise
      expect(listCalls).toBe(1)
      expect(fixture.service.readList()).toMatchObject({
        state: 'ready',
        data: { available: true, stores: [{ id: 'team', root: '/stores/A' }] },
      })

      fixture.invalidation.invalidate(['stores'])
      await replacementStarted.promise
      expect(listCalls).toBe(2)
      expect(fixture.service.readList()).toMatchObject({
        state: 'revalidating',
        data: { stores: [{ id: 'team', root: '/stores/A' }] },
        freshness: 'stale-display-only',
        workGeneration: 2,
        snapshotGeneration: 1,
      })

      releaseB.resolve(cliResult({ stores: [{ id: 'team', root: '/stores/B' }] }))
      await secondReady.promise
      expect(fixture.service.readList()).toMatchObject({
        state: 'ready',
        data: { stores: [{ id: 'team', root: '/stores/B' }] },
        workGeneration: 2,
        snapshotGeneration: 2,
      })
      expect(fixture.reconcile).toHaveBeenNthCalledWith(1, [{ id: 'team', root: '/stores/A' }])
      expect(fixture.reconcile).toHaveBeenNthCalledWith(2, [{ id: 'team', root: '/stores/B' }])
      expectLifecycleOnlyNotices(notices)
      const replacementNotices = notices.filter((notice) => notice.workGeneration === 2)
      expect(replacementNotices.length).toBeGreaterThan(0)
      expect(replacementNotices.every((notice) => notice.invalidationCause === 'dependency')).toBe(
        true
      )
      expect(setIntervalSpy).not.toHaveBeenCalled()
    } finally {
      first.unsubscribe()
      second.unsubscribe()
      setIntervalSpy.mockRestore()
      fixture.runtime.clear()
    }
  })

  it('preserves absent and explicitly empty Doctor selectors by presence', async () => {
    const calls: string[][] = []
    const fixture = createFixture(async (args) => {
      calls.push(args)
      return cliResult({ stores: [] })
    })
    const absentReady = createDeferred<void>()
    const emptyReady = createDeferred<void>()
    const absent = fixture.service.subscribeDoctor(undefined, (notice) => {
      if (notice.state === 'ready') absentReady.resolve()
    })
    const empty = fixture.service.subscribeDoctor('', (notice) => {
      if (notice.state === 'ready') emptyReady.resolve()
    })

    try {
      await Promise.all([absentReady.promise, emptyReady.promise])
      expect(calls).toEqual([
        ['store', 'doctor', '--json'],
        ['store', 'doctor', '', '--json'],
      ])
      expect(fixture.reconcile).not.toHaveBeenCalled()
    } finally {
      absent.unsubscribe()
      empty.unsubscribe()
      fixture.runtime.clear()
    }
  })

  it('routes Store-root changes to all Doctor and only the matching selected Doctor', async () => {
    const alphaRoot = await mkdtemp(join(tmpdir(), 'openspecui-store-alpha-'))
    const alphaMovedRoot = await mkdtemp(join(tmpdir(), 'openspecui-store-alpha-moved-'))
    const betaRoot = await mkdtemp(join(tmpdir(), 'openspecui-store-beta-'))
    const gammaRoot = await mkdtemp(join(tmpdir(), 'openspecui-store-gamma-'))
    tempDirs.push(alphaRoot, alphaMovedRoot, betaRoot, gammaRoot)
    await Promise.all([
      seedNonGitStore(alphaRoot, 'alpha'),
      seedNonGitStore(alphaMovedRoot, 'alpha'),
      seedNonGitStore(betaRoot, 'beta'),
      seedNonGitStore(gammaRoot, 'gamma'),
    ])

    const environment = new ReactiveObservationEnvironment()
    const invalidation = new RuntimeInvalidationIndex()
    const storeObservation = new StoreObservationService(environment, invalidation)
    let listedStores = [
      { id: 'alpha', root: alphaRoot },
      { id: 'beta', root: betaRoot },
    ]
    let listCalls = 0
    let allDoctorCalls = 0
    let alphaDoctorCalls = 0
    let betaDoctorCalls = 0
    const fixture = createFixture(
      async (args) => {
        if (args[1] === 'list') {
          listCalls += 1
          return cliResult({ stores: listedStores })
        }
        const selector = args[2] === '--json' ? undefined : args[2]
        if (selector === undefined) allDoctorCalls += 1
        if (selector === 'alpha') alphaDoctorCalls += 1
        if (selector === 'beta') betaDoctorCalls += 1
        return cliResult({ stores: [] })
      },
      storeObservation,
      invalidation
    )
    const list = fixture.service.subscribeList(() => {})

    await vi.waitFor(() => {
      expect(fixture.service.readList()).toMatchObject({ state: 'ready' })
      expect(storeObservation.getObservedStores()).toHaveLength(2)
    })
    const allDoctor = fixture.service.subscribeDoctor(undefined, () => {})
    const alphaDoctor = fixture.service.subscribeDoctor('alpha', () => {})
    const betaDoctor = fixture.service.subscribeDoctor('beta', () => {})

    try {
      await vi.waitFor(() => {
        expect(fixture.service.readDoctor()).toMatchObject({ state: 'ready' })
        expect(fixture.service.readDoctor('alpha')).toMatchObject({ state: 'ready' })
        expect(fixture.service.readDoctor('beta')).toMatchObject({ state: 'ready' })
      })
      const listBeforeBetaEdit = listCalls
      const allBeforeBetaEdit = allDoctorCalls
      const alphaBeforeBetaEdit = alphaDoctorCalls
      const betaBeforeBetaEdit = betaDoctorCalls

      await writeFile(join(betaRoot, 'unrelated.md'), '# unrelated\n', 'utf8')
      await new Promise((resolve) => setTimeout(resolve, 300))
      expect(allDoctorCalls).toBe(allBeforeBetaEdit)
      expect(betaDoctorCalls).toBe(betaBeforeBetaEdit)
      await writeFile(
        join(betaRoot, '.openspec-store', 'store.yaml'),
        'id: beta\nremote: ssh://example/beta.git\n',
        'utf8'
      )
      await vi.waitFor(() => expect(allDoctorCalls).toBeGreaterThan(allBeforeBetaEdit))
      await vi.waitFor(() => expect(betaDoctorCalls).toBeGreaterThan(betaBeforeBetaEdit))
      expect(alphaDoctorCalls).toBe(alphaBeforeBetaEdit)
      expect(listCalls).toBe(listBeforeBetaEdit)

      const listBeforeMutation = listCalls
      const allBeforeMutation = allDoctorCalls
      const alphaBeforeMutation = alphaDoctorCalls
      const betaBeforeMutation = betaDoctorCalls
      invalidation.invalidate(['stores'])
      await vi.waitFor(() => expect(listCalls).toBeGreaterThan(listBeforeMutation))
      await vi.waitFor(() => expect(allDoctorCalls).toBeGreaterThan(allBeforeMutation))
      await vi.waitFor(() => expect(alphaDoctorCalls).toBeGreaterThan(alphaBeforeMutation))
      await vi.waitFor(() => expect(betaDoctorCalls).toBeGreaterThan(betaBeforeMutation))

      const allBeforeReconcile = allDoctorCalls
      const alphaBeforeReconcile = alphaDoctorCalls
      const betaBeforeReconcile = betaDoctorCalls
      listedStores = [
        { id: 'alpha', root: alphaMovedRoot },
        { id: 'gamma', root: gammaRoot },
      ]
      const listGeneration = fixture.service.readList().workGeneration
      fixture.service.refreshList()
      await vi.waitFor(() => {
        expect(fixture.service.readList()).toMatchObject({
          state: 'ready',
          workGeneration: listGeneration + 1,
        })
        expect(storeObservation.getObservedStores()).toEqual([
          { storeId: 'alpha', rootPath: alphaMovedRoot },
          { storeId: 'gamma', rootPath: gammaRoot },
        ])
      })
      await vi.waitFor(() => expect(allDoctorCalls).toBeGreaterThan(allBeforeReconcile))
      await vi.waitFor(() => expect(alphaDoctorCalls).toBeGreaterThan(alphaBeforeReconcile))
      await vi.waitFor(() => expect(betaDoctorCalls).toBeGreaterThan(betaBeforeReconcile))

      const allBeforeRetiredRootEdit = allDoctorCalls
      await writeFile(
        join(betaRoot, '.openspec-store', 'store.yaml'),
        'id: beta\nremote: ssh://example/retired.git\n',
        'utf8'
      )
      await new Promise((resolve) => setTimeout(resolve, 250))
      expect(allDoctorCalls).toBe(allBeforeRetiredRootEdit)

      const allBeforeAddedRootEdit = allDoctorCalls
      const alphaBeforeAddedRootEdit = alphaDoctorCalls
      await writeFile(
        join(gammaRoot, '.openspec-store', 'store.yaml'),
        'id: gamma\nremote: ssh://example/gamma.git\n',
        'utf8'
      )
      await vi.waitFor(() => expect(allDoctorCalls).toBeGreaterThan(allBeforeAddedRootEdit))
      expect(alphaDoctorCalls).toBe(alphaBeforeAddedRootEdit)

      const alphaBeforeMovedRootEdit = alphaDoctorCalls
      await writeFile(
        join(alphaMovedRoot, '.openspec-store', 'store.yaml'),
        'id: alpha\nremote: ssh://example/alpha.git\n',
        'utf8'
      )
      await vi.waitFor(() => expect(alphaDoctorCalls).toBeGreaterThan(alphaBeforeMovedRootEdit))
    } finally {
      list.unsubscribe()
      allDoctor.unsubscribe()
      alphaDoctor.unsubscribe()
      betaDoctor.unsubscribe()
      fixture.runtime.clear()
      await storeObservation.dispose()
      await environment.dispose()
    }
  })

  it('runs concurrent healthy Store List and Doctor Work without freshness timers', async () => {
    const calls: string[][] = []
    const fixture = createFixture(async (args) => {
      calls.push(args)
      return cliResult({ stores: [] })
    })
    const listReady = createDeferred<void>()
    const doctorReady = createDeferred<void>()
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')
    const list = fixture.service.subscribeList((notice) => {
      if (notice.state === 'ready') listReady.resolve()
    })
    const doctor = fixture.service.subscribeDoctor('team', (notice) => {
      if (notice.state === 'ready') doctorReady.resolve()
    })

    try {
      await Promise.all([listReady.promise, doctorReady.promise])
      expect(calls).toHaveLength(2)
      expect(calls).toEqual(
        expect.arrayContaining([
          ['store', 'list', '--json'],
          ['store', 'doctor', 'team', '--json'],
        ])
      )
      expect(setIntervalSpy).not.toHaveBeenCalled()
    } finally {
      list.unsubscribe()
      doctor.unsubscribe()
      setIntervalSpy.mockRestore()
      fixture.runtime.clear()
    }
  })

  it('reconciles typed CLI list truth through real Store root leases', async () => {
    const observationReleases = new Map<string, ReturnType<typeof vi.fn>>()
    const acquireObservationRoot = vi.fn<ObservationRootOwner['acquireRoot']>(async (rootPath) => {
      const release = vi.fn(async () => {})
      observationReleases.set(rootPath, release)
      return release
    })
    const storeObservation = new StoreObservationService(
      { acquireRoot: acquireObservationRoot },
      new RuntimeInvalidationIndex(),
      createDoctorDependencyFactory()
    )
    const listResults = [
      [
        { id: 'alpha', root: '/stores/A' },
        { id: 'beta', root: '/stores/B' },
      ],
      [{ id: 'alpha', root: '/stores/A-v2' }],
      [],
    ]
    let listCalls = 0
    const fixture = createFixture(async (args) => {
      expect(args).toEqual(['store', 'list', '--json'])
      const stores = listResults[listCalls]
      listCalls += 1
      if (!stores) throw new Error(`Unexpected Store list call ${listCalls}.`)
      return cliResult({ stores })
    }, storeObservation)
    const subscription = fixture.service.subscribeList(() => {})

    try {
      await vi.waitFor(() => {
        expect(fixture.service.readList()).toMatchObject({ state: 'ready', workGeneration: 1 })
      })
      expect(storeObservation.getObservedStores()).toEqual([
        { storeId: 'alpha', rootPath: '/stores/A' },
        { storeId: 'beta', rootPath: '/stores/B' },
      ])
      expect(acquireObservationRoot.mock.calls.map(([rootPath]) => rootPath)).toEqual([
        '/stores/A',
        '/stores/B',
      ])

      fixture.invalidation.invalidate(['stores'])
      await vi.waitFor(() => {
        expect(fixture.service.readList()).toMatchObject({ state: 'ready', workGeneration: 2 })
      })
      expect(storeObservation.getObservedStores()).toEqual([
        { storeId: 'alpha', rootPath: '/stores/A-v2' },
      ])
      expect(observationReleases.get('/stores/A')).toHaveBeenCalledTimes(1)
      expect(observationReleases.get('/stores/B')).toHaveBeenCalledTimes(1)
      expect(acquireObservationRoot.mock.calls.map(([rootPath]) => rootPath)).toEqual([
        '/stores/A',
        '/stores/B',
        '/stores/A-v2',
      ])

      fixture.invalidation.invalidate(['stores'])
      await vi.waitFor(() => {
        expect(fixture.service.readList()).toMatchObject({ state: 'ready', workGeneration: 3 })
      })
      expect(storeObservation.getObservedStores()).toEqual([])
      expect(observationReleases.get('/stores/A-v2')).toHaveBeenCalledTimes(1)
      expect(listCalls).toBe(3)
    } finally {
      subscription.unsubscribe()
      await storeObservation.dispose()
      fixture.runtime.clear()
    }
  })

  it('keeps Store-root reconciliation resident until the Server-owned list lease is disposed', async () => {
    let listCalls = 0
    const fixture = createFixture(async (args) => {
      expect(args).toEqual(['store', 'list', '--json'])
      listCalls += 1
      return cliResult({
        stores: [{ id: 'team', root: listCalls === 1 ? '/stores/A' : '/stores/B' }],
      })
    })

    fixture.service.start()
    await vi.waitFor(() => {
      expect(fixture.reconcile).toHaveBeenLastCalledWith([{ id: 'team', root: '/stores/A' }])
    })

    fixture.invalidation.invalidate(['stores'])
    await vi.waitFor(() => {
      expect(fixture.reconcile).toHaveBeenLastCalledWith([{ id: 'team', root: '/stores/B' }])
    })
    expect(listCalls).toBe(2)

    fixture.service.dispose()
    fixture.invalidation.invalidate(['stores'])
    await Promise.resolve()
    expect(listCalls).toBe(2)
    fixture.runtime.clear()
  })
})
