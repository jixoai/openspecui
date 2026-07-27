/**
 * Orthogonal intents (updated 2026-07-27 Asia/Shanghai):
 * 1. Prove Root Context retains settled A while one shared invalidation-driven B runs.
 * 2. Prove lifecycle Push contains no Root business data.
 * 3. Prove explicit refresh joins the same Root Projection Work owner.
 * 4. Prove real watcher events rebind exact config, registry, Store Git, and Reference paths.
 * 5. Prove selected and referenced Store metadata participate in official Doctor invalidation.
 *
 * Original request (2026-07-26): "缓存现在正在被更新中。"
 */
import {
  clearCache,
  closeAllWatchers,
  ReactiveObservationEnvironment,
  RuntimeInvalidationIndex,
  type RootContext,
  type RootContextResolvedState,
} from '@openspecui/core'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createServerProjectionWorkRuntime } from './projection-work/runtime.js'
import {
  createRootContextProjectionWorkOwner,
  RootContextProjectionService,
} from './root-context-projection-service.js'
import { createUnavailablePlanningRootServices } from './test-support/planning-root-services.js'

function deferred<T>(): { promise: Promise<T>; resolve(value: T): void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolver) => {
    resolve = resolver
  })
  return { promise, resolve }
}

function readyRoot(
  path: string,
  observedAt: number,
  launchProject = '/launch',
  dataScopePath = '/data/openspec',
  referenceRoot?: string
): RootContextResolvedState {
  const data: RootContext = {
    launchProject: { path: launchProject },
    planningRoot: { path, source: 'nearest', healthy: true, status: [] },
    storeId: null,
    cli: { available: true, version: '1.6.0' },
    references: referenceRoot ? [{ store_id: 'reference', root: referenceRoot, status: [] }] : [],
    contextMembers: [],
    dataScope: {
      path: dataScopePath,
      source: 'user-home-default',
      environmentVariable: null,
    },
    diagnostics: { root: [], doctor: [], context: [] },
    evidence: { doctor: null, context: null },
    observedAt,
  }
  return { state: 'ready', data, attempt: null, error: null, observedAt }
}

const tempDirs: string[] = []
const observationEnvironments: ReactiveObservationEnvironment[] = []

/** Own a real watcher root so these fixtures exercise filesystem-to-Work invalidation. */
async function observeFixtureRoot(rootPath: string): Promise<void> {
  const environment = new ReactiveObservationEnvironment()
  observationEnvironments.push(environment)
  await environment.acquireRoot(rootPath)
}

afterEach(async () => {
  await Promise.all(observationEnvironments.splice(0).map((environment) => environment.dispose()))
  clearCache()
  await closeAllWatchers()
  await Promise.all(tempDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

describe('RootContextProjectionService', () => {
  it('ignores broad runtime facets but reruns for exact launch config and Store registry files', async () => {
    clearCache()
    const baseDir = await mkdtemp(join(tmpdir(), 'openspecui-root-projection-'))
    tempDirs.push(baseDir)
    const launchProjectDir = join(baseDir, 'launch')
    const dataScopePath = join(baseDir, 'data', 'openspec')
    const planningRoot = join(baseDir, 'planning')
    const launchConfig = join(launchProjectDir, 'openspec', 'config.yaml')
    const registryPath = join(dataScopePath, 'stores', 'registry.yaml')
    await Promise.all([
      mkdir(join(launchProjectDir, 'openspec'), { recursive: true }),
      mkdir(join(dataScopePath, 'stores'), { recursive: true }),
      mkdir(join(planningRoot, 'openspec'), { recursive: true }),
    ])
    await Promise.all([
      writeFile(launchConfig, 'schema: spec-driven\n', 'utf8'),
      writeFile(registryPath, 'stores: {}\n', 'utf8'),
    ])
    await observeFixtureRoot(baseDir)
    const runtime = createServerProjectionWorkRuntime()
    const invalidation = new RuntimeInvalidationIndex()
    let calls = 0
    const services = {
      ...createUnavailablePlanningRootServices(),
      resolveRootContextReactive: vi.fn(async () => {
        calls += 1
        return readyRoot(planningRoot, calls, launchProjectDir, dataScopePath)
      }),
    }
    const service = new RootContextProjectionService({
      launchProjectDir,
      dataScopePath,
      planningRootServices: services,
      workOwner: createRootContextProjectionWorkOwner(runtime),
    })
    const subscription = service.subscribe(() => {})

    try {
      await vi.waitFor(() => expect(calls).toBe(1))
      invalidation.invalidate(['project', 'context'])
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(calls).toBe(1)
      expect(service.read()).toMatchObject({ state: 'ready', workGeneration: 1 })

      await writeFile(launchConfig, 'schema: custom\n', 'utf8')
      await vi.waitFor(() => expect(calls).toBe(2))

      await writeFile(registryPath, 'stores:\n  team: /stores/team\n', 'utf8')
      await vi.waitFor(() => expect(calls).toBe(3))
      expect(service.read()).toMatchObject({ state: 'ready', workGeneration: 3 })
    } finally {
      subscription.unsubscribe()
      runtime.clear()
    }
  })

  it('shares replacement work and exposes retained A through data-free lifecycle Push', async () => {
    const runtime = createServerProjectionWorkRuntime()
    const invalidation = new RuntimeInvalidationIndex()
    const releaseB = deferred<RootContextResolvedState>()
    const releaseC = deferred<RootContextResolvedState>()
    const firstReady = deferred<void>()
    const revalidating = deferred<void>()
    const secondReady = deferred<void>()
    let calls = 0
    const services = {
      ...createUnavailablePlanningRootServices(),
      resolveRootContextReactive: vi.fn(async () => {
        invalidation.track('project', 'stores', 'context')
        calls += 1
        if (calls === 1) return readyRoot('/planning-a', 1)
        return calls === 2 ? releaseB.promise : releaseC.promise
      }),
    }
    const service = new RootContextProjectionService({
      launchProjectDir: '/launch',
      dataScopePath: '/data/openspec',
      planningRootServices: services,
      workOwner: createRootContextProjectionWorkOwner(runtime),
    })
    const notices: unknown[] = []
    const observe = (notice: { state: string }) => {
      notices.push(notice)
      if (notice.state === 'ready' && calls === 1) firstReady.resolve()
      if (notice.state === 'revalidating') revalidating.resolve()
      if (notice.state === 'ready' && calls === 3) secondReady.resolve()
    }
    const first = service.subscribe(observe)
    const second = service.subscribe(observe)

    try {
      await firstReady.promise
      expect(calls).toBe(1)
      service.refresh()
      await revalidating.promise
      await vi.waitFor(() => expect(calls).toBe(2))
      expect(service.read()).toMatchObject({
        state: 'revalidating',
        freshness: 'stale-display-only',
        data: { state: 'ready', data: { planningRoot: { path: '/planning-a' } } },
        workGeneration: 2,
        snapshotGeneration: 1,
      })

      service.refresh()
      releaseB.resolve(readyRoot('/retired-b', 2))
      await vi.waitFor(() => expect(calls).toBe(3))
      expect(service.read()).toMatchObject({
        state: 'revalidating',
        data: { data: { planningRoot: { path: '/planning-a' } } },
      })
      releaseC.resolve(readyRoot('/planning-c', 3))
      await secondReady.promise
      expect(service.read()).toMatchObject({
        state: 'ready',
        data: { data: { planningRoot: { path: '/planning-c' } } },
      })
      expect(notices.every((notice) => !Object.hasOwn(Object(notice), 'data'))).toBe(true)
    } finally {
      first.unsubscribe()
      second.unsubscribe()
      runtime.clear()
    }
  })

  it('reconciles add, move, and remove dependencies from typed Root Reference output', async () => {
    clearCache()
    const baseDir = await mkdtemp(join(tmpdir(), 'openspecui-root-references-'))
    tempDirs.push(baseDir)
    const launchProjectDir = join(baseDir, 'launch')
    const dataScopePath = join(baseDir, 'data', 'openspec')
    const planningRoot = join(baseDir, 'planning')
    const referenceA = join(baseDir, 'reference-a')
    const referenceB = join(baseDir, 'reference-b')
    const registryPath = join(dataScopePath, 'stores', 'registry.yaml')
    const referenceAConfig = join(referenceA, 'openspec', 'config.yaml')
    const referenceBConfig = join(referenceB, 'openspec', 'config.yaml')
    await Promise.all(
      [launchProjectDir, planningRoot, referenceA, referenceB].map((root) =>
        mkdir(join(root, 'openspec'), { recursive: true })
      )
    )
    await mkdir(join(dataScopePath, 'stores'), { recursive: true })
    await writeFile(registryPath, 'stores: {}\n', 'utf8')
    await observeFixtureRoot(baseDir)

    const runtime = createServerProjectionWorkRuntime()
    let calls = 0
    let currentReference: string | undefined
    const services = {
      ...createUnavailablePlanningRootServices(),
      resolveRootContextReactive: vi.fn(async () => {
        calls += 1
        return readyRoot(planningRoot, calls, launchProjectDir, dataScopePath, currentReference)
      }),
    }
    const service = new RootContextProjectionService({
      launchProjectDir,
      dataScopePath,
      planningRootServices: services,
      workOwner: createRootContextProjectionWorkOwner(runtime),
    })
    const subscription = service.subscribe(() => {})

    try {
      await vi.waitFor(() => expect(calls).toBe(1))

      currentReference = referenceA
      await writeFile(registryPath, 'stores:\n  reference: reference-a\n', 'utf8')
      await vi.waitFor(() => expect(calls).toBe(2))

      await writeFile(referenceAConfig, 'schema: spec-driven\n', 'utf8')
      await vi.waitFor(() => expect(calls).toBe(3))

      currentReference = referenceB
      await writeFile(registryPath, 'stores:\n  reference: reference-b\n', 'utf8')
      await vi.waitFor(() => expect(calls).toBe(4))

      await writeFile(referenceAConfig, 'schema: legacy\n', 'utf8')
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(calls).toBe(4)

      await writeFile(referenceBConfig, 'schema: custom\n', 'utf8')
      await vi.waitFor(() => expect(calls).toBe(5))

      currentReference = undefined
      await writeFile(registryPath, 'stores: {}\n', 'utf8')
      await vi.waitFor(() => expect(calls).toBe(6))

      await writeFile(referenceBConfig, 'schema: retired\n', 'utf8')
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(calls).toBe(6)
    } finally {
      subscription.unsubscribe()
      runtime.clear()
    }
  })

  it('revalidates Store-backed Root Doctor evidence when Git origin config changes', async () => {
    clearCache()
    const baseDir = await mkdtemp(join(tmpdir(), 'openspecui-root-store-git-'))
    tempDirs.push(baseDir)
    const launchProjectDir = join(baseDir, 'launch')
    const dataScopePath = join(baseDir, 'data', 'openspec')
    const planningRoot = join(baseDir, 'planning-store')
    const gitConfigPath = join(planningRoot, '.git', 'config')
    await Promise.all([
      mkdir(join(launchProjectDir, 'openspec'), { recursive: true }),
      mkdir(join(dataScopePath, 'stores'), { recursive: true }),
      mkdir(join(planningRoot, 'openspec'), { recursive: true }),
      mkdir(join(planningRoot, '.git'), { recursive: true }),
    ])
    await writeFile(gitConfigPath, '[remote "origin"]\n  url = first\n', 'utf8')
    await observeFixtureRoot(baseDir)

    const runtime = createServerProjectionWorkRuntime()
    let calls = 0
    const services = {
      ...createUnavailablePlanningRootServices(),
      resolveRootContextReactive: vi.fn(async () => {
        calls += 1
        const state = readyRoot(planningRoot, calls, launchProjectDir, dataScopePath)
        if (state.state === 'ready' && state.data.planningRoot) {
          state.data.planningRoot = {
            ...state.data.planningRoot,
            source: 'store',
            store_id: 'selected-store',
          }
          state.data.storeId = 'selected-store'
        }
        return state
      }),
    }
    const service = new RootContextProjectionService({
      launchProjectDir,
      dataScopePath,
      planningRootServices: services,
      workOwner: createRootContextProjectionWorkOwner(runtime),
    })
    const subscription = service.subscribe(() => {})

    try {
      await vi.waitFor(() => expect(calls).toBe(1))
      const changedConfig = '[remote "origin"]\n  url = second\n'
      await writeFile(gitConfigPath, changedConfig, 'utf8')
      await vi.waitFor(() => expect(calls).toBe(2))
    } finally {
      subscription.unsubscribe()
      runtime.clear()
    }
  })

  it('revalidates Doctor and Context when selected or referenced Store metadata changes', async () => {
    clearCache()
    const baseDir = await mkdtemp(join(tmpdir(), 'openspecui-root-store-metadata-'))
    tempDirs.push(baseDir)
    const launchProjectDir = join(baseDir, 'launch')
    const dataScopePath = join(baseDir, 'data', 'openspec')
    const planningRoot = join(baseDir, 'planning-store')
    const referenceRoot = join(baseDir, 'reference-store')
    const planningMetadata = join(planningRoot, '.openspec-store', 'store.yaml')
    const referenceMetadata = join(referenceRoot, '.openspec-store', 'store.yaml')
    await Promise.all([
      mkdir(join(launchProjectDir, 'openspec'), { recursive: true }),
      mkdir(join(dataScopePath, 'stores'), { recursive: true }),
      mkdir(join(planningRoot, 'openspec'), { recursive: true }),
      mkdir(join(planningRoot, '.openspec-store'), { recursive: true }),
      mkdir(join(referenceRoot, 'openspec'), { recursive: true }),
      mkdir(join(referenceRoot, '.openspec-store'), { recursive: true }),
    ])
    await observeFixtureRoot(baseDir)

    const runtime = createServerProjectionWorkRuntime()
    let calls = 0
    const services = {
      ...createUnavailablePlanningRootServices(),
      resolveRootContextReactive: vi.fn(async () => {
        calls += 1
        const state = readyRoot(planningRoot, calls, launchProjectDir, dataScopePath, referenceRoot)
        if (state.state === 'ready' && state.data.planningRoot) {
          state.data.planningRoot = {
            ...state.data.planningRoot,
            source: 'store',
            store_id: 'selected-store',
          }
          state.data.storeId = 'selected-store'
        }
        return state
      }),
    }
    const service = new RootContextProjectionService({
      launchProjectDir,
      dataScopePath,
      planningRootServices: services,
      workOwner: createRootContextProjectionWorkOwner(runtime),
    })
    const subscription = service.subscribe(() => {})

    try {
      await vi.waitFor(() => expect(calls).toBe(1))
      const selectedContent = 'version: 1\nid: selected-store\n'
      await writeFile(planningMetadata, selectedContent, 'utf8')
      await vi.waitFor(() => expect(calls).toBe(2))

      const referenceContent = 'version: 1\nid: reference\n'
      await writeFile(referenceMetadata, referenceContent, 'utf8')
      await vi.waitFor(() => expect(calls).toBe(3))
    } finally {
      subscription.unsubscribe()
      runtime.clear()
    }
  })
})
