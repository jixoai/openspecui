/**
 * Orthogonal intents (updated 2026-07-27 Asia/Shanghai):
 * 1. Prove one Manager-owned Root Context resolution serves same-generation reactive operations.
 * 2. Prove reactive cache-hit subscribers retain invalidation dependencies.
 * 3. Prove one invalidation produces one B resolution while A remains a refreshing display snapshot.
 * 4. Prove CLI-owned Root Context failures are never retained as reusable snapshots.
 * 5. Prove same-root Root evidence wakes dependent Spec and Instructions CLI Work with retained A.
 *
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 * Owner architecture clarification (2026-07-26): "最终计算结果本质是来自于 OpenSpec CLI 所提供的内容。"
 */
import {
  CliExecutor,
  ConfigManager,
  OpsxKernel,
  RuntimeInvalidationIndex,
  type ArtifactInstructions,
  type CliCommandResult,
  type CliContext,
  type CliDoctor,
  type CliDoctorReferenceEntry,
  type CliProjectionNotice,
  type CliSpecList,
  type ObservationRootOwner,
  type PlanningCliProjectionSelector,
  type RuntimeRootInvalidationOwner,
} from '@openspecui/core'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PlanningRootServiceManager } from './planning-root-service.js'
import { createRootContextSubscription } from './root-context-service.js'

const tempDirs: string[] = []

function commandResult<T>(data: T): CliCommandResult<T> {
  return {
    success: true,
    stdout: JSON.stringify(data),
    stderr: '',
    exitCode: 0,
    data,
    payload: null,
    diagnostics: [],
  }
}

function createDeferred<T>(): {
  promise: Promise<T>
  resolve(value: T | PromiseLike<T>): void
  reject(reason?: unknown): void
} {
  let resolvePromise: (value: T | PromiseLike<T>) => void = () => {
    throw new Error('Deferred promise resolver was not initialized.')
  }
  let rejectPromise: (reason?: unknown) => void = () => {
    throw new Error('Deferred promise rejecter was not initialized.')
  }
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })
  return { promise, resolve: resolvePromise, reject: rejectPromise }
}

async function createFixture() {
  const tempDir = await mkdtemp(join(tmpdir(), 'openspecui-root-snapshot-'))
  tempDirs.push(tempDir)
  const launchProjectDir = join(tempDir, 'launch')
  const rootA = join(tempDir, 'root-a')
  const rootB = join(tempDir, 'root-b')
  await Promise.all([
    mkdir(join(launchProjectDir, 'openspec'), { recursive: true }),
    mkdir(join(rootA, 'openspec'), { recursive: true }),
    mkdir(join(rootB, 'openspec'), { recursive: true }),
  ])

  const configManager = new ConfigManager(launchProjectDir)
  const cliExecutor = new CliExecutor(configManager, launchProjectDir)
  let selectedRoot = rootA
  const checkAvailability = vi.spyOn(cliExecutor, 'checkAvailability').mockResolvedValue({
    available: true,
    version: '1.6.0',
  })
  const doctorRoot = vi.spyOn(cliExecutor.contracts, 'doctorRoot').mockImplementation(async () =>
    commandResult<CliDoctor>({
      root: { path: selectedRoot, source: 'nearest', healthy: true, status: [] },
      store: null,
      references: [],
      status: [],
    })
  )
  const contextCommand = vi.spyOn(cliExecutor.contracts, 'context').mockImplementation(async () =>
    commandResult<CliContext>({
      root: { path: selectedRoot, source: 'nearest', role: 'openspec_root' },
      members: [],
      status: [],
    })
  )
  const listSpecs = vi.spyOn(cliExecutor.contracts, 'listSpecs')
  const observationEnvironment: ObservationRootOwner = {
    acquireRoot: vi.fn(async () => async () => {}),
  }
  const projectInvalidation: RuntimeRootInvalidationOwner = {
    acquireRoot: vi.fn(() => () => {}),
  }
  const runtimeInvalidation = new RuntimeInvalidationIndex()
  const manager = new PlanningRootServiceManager({
    launchProjectDir,
    previewAssetsDir: join(tempDir, 'preview-assets'),
    configManager,
    cliExecutor,
    observationEnvironment,
    projectInvalidation,
    runtimeInvalidation,
    storeObservation: { subscribe: () => () => {} },
    codeBinding: { bindingToken: 'code-binding' },
  })

  return {
    manager,
    rootA,
    rootB,
    setSelectedRoot: (root: string) => {
      selectedRoot = root
    },
    runtimeInvalidation,
    checkAvailability,
    doctorRoot,
    contextCommand,
    listSpecs,
  }
}

function instructions(marker: string): ArtifactInstructions {
  return {
    changeName: 'alpha',
    artifactId: 'proposal',
    schemaName: 'spec-driven',
    changeDir: '/planning/openspec/changes/alpha',
    outputPath: 'proposal.md',
    description: marker,
    instruction: 'Write the proposal.',
    context: null,
    rules: [],
    template: '# Proposal',
    dependencies: [],
    unlocks: [],
    evidence: {
      command: 'instructions',
      success: true,
      stdout: JSON.stringify({ marker }),
      stderr: '',
      exitCode: 0,
      payload: { marker },
      diagnostics: [],
      selector: {},
      root: { path: '/planning', source: 'nearest' },
    },
  }
}

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(tempDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

describe('PlanningRootServiceManager current Root Context snapshot', () => {
  it('shares one successful Root Context resolution across same-generation reactive operations', async () => {
    const fixture = await createFixture()

    const [first, second] = await Promise.all([
      fixture.manager.runReactiveOperation(({ rootContext }) => rootContext),
      fixture.manager.runReactiveOperation(({ rootContext }) => rootContext),
    ])

    expect(first.planningRoot?.path).toBe(fixture.rootA)
    expect(second.planningRoot?.path).toBe(fixture.rootA)
    expect(fixture.checkAvailability).toHaveBeenCalledOnce()
    expect(fixture.doctorRoot).toHaveBeenCalledOnce()
    expect(fixture.contextCommand).toHaveBeenCalledOnce()

    await fixture.manager.dispose()
  })

  it('tracks cache-hit reactive subscribers and resolves exactly one B after invalidation', async () => {
    const fixture = await createFixture()
    const readyA = [createDeferred<void>(), createDeferred<void>()] as const
    const readyB = [createDeferred<void>(), createDeferred<void>()] as const
    const refreshingRoots: Array<string | null> = [null, null]

    const subscribe = (index: number) =>
      (() => {
        const currentReadyA = readyA[index]
        const currentReadyB = readyB[index]
        if (!currentReadyA || !currentReadyB)
          throw new Error(`Unexpected subscriber index: ${index}`)
        return createRootContextSubscription(fixture.manager).subscribe({
          next: (state) => {
            if (state.state === 'refreshing') {
              refreshingRoots[index] = state.data?.planningRoot?.path ?? null
              return
            }
            if (state.state !== 'ready') return
            if (state.data.planningRoot?.path === fixture.rootA) currentReadyA.resolve()
            if (state.data.planningRoot?.path === fixture.rootB) currentReadyB.resolve()
          },
          error: (error) => {
            currentReadyA.reject(error)
            currentReadyB.reject(error)
          },
        })
      })()

    const first = subscribe(0)
    const second = subscribe(1)
    await Promise.all(readyA.map(({ promise }) => promise))
    expect(fixture.doctorRoot).toHaveBeenCalledOnce()
    expect(fixture.contextCommand).toHaveBeenCalledOnce()

    fixture.setSelectedRoot(fixture.rootB)
    fixture.runtimeInvalidation.invalidate(['context'])
    await Promise.all(readyB.map(({ promise }) => promise))

    expect(refreshingRoots).toEqual([fixture.rootA, fixture.rootA])
    expect(fixture.doctorRoot).toHaveBeenCalledTimes(2)
    expect(fixture.contextCommand).toHaveBeenCalledTimes(2)

    first.unsubscribe()
    second.unsubscribe()
    await fixture.manager.dispose()
  })

  it('does not retain CLI-owned error states as current Root Context snapshots', async () => {
    const fixture = await createFixture()
    fixture.doctorRoot.mockResolvedValueOnce({
      success: false,
      stdout: '{"status":[]}',
      stderr: 'doctor failed',
      exitCode: 1,
      data: null,
      payload: { status: [] },
      diagnostics: [],
    })
    fixture.contextCommand.mockResolvedValueOnce({
      success: false,
      stdout: '{"status":[]}',
      stderr: 'context failed',
      exitCode: 1,
      data: null,
      payload: { status: [] },
      diagnostics: [],
    })

    await expect(fixture.manager.resolveRootContext()).resolves.toMatchObject({ state: 'error' })
    await expect(fixture.manager.resolveRootContext()).resolves.toMatchObject({
      state: 'ready',
      data: { planningRoot: { path: fixture.rootA } },
    })
    expect(fixture.doctorRoot).toHaveBeenCalledTimes(2)
    expect(fixture.contextCommand).toHaveBeenCalledTimes(2)

    await fixture.manager.dispose()
  })

  it('revalidates Spec and Instructions Work from same-root Root Context evidence', async () => {
    const fixture = await createFixture()
    let references: CliDoctorReferenceEntry[] = [{ store_id: 'reference-a', status: [] }]
    fixture.doctorRoot.mockImplementation(async () =>
      commandResult<CliDoctor>({
        root: { path: fixture.rootA, source: 'nearest', healthy: true, status: [] },
        store: null,
        references,
        status: [],
      })
    )
    const catalogB = createDeferred<CliCommandResult<CliSpecList>>()
    fixture.listSpecs.mockImplementation(async ({ store } = {}) => {
      if (store === 'reference-b') return catalogB.promise
      if (store === undefined) {
        return commandResult<CliSpecList>({
          specs: [{ id: 'owned-spec', requirementCount: 1 }],
          root: { path: fixture.rootA, source: 'nearest' },
          status: [],
        })
      }
      const data: CliSpecList = {
        specs: [{ id: `${store}-spec`, requirementCount: 1 }],
        root: { path: `/stores/${store}`, source: 'store', store_id: store },
        status: [],
      }
      return commandResult(data)
    })
    const instructionsB = createDeferred<ArtifactInstructions>()
    let instructionReads = 0
    vi.spyOn(OpsxKernel.prototype, 'readInstructionsProjection').mockImplementation(async () => {
      instructionReads += 1
      return instructionReads === 1 ? instructions('instructions-a') : instructionsB.promise
    })

    const rootReadyA = createDeferred<void>()
    const rootReadyB = createDeferred<void>()
    const rootSubscription = createRootContextSubscription(fixture.manager).subscribe({
      next: (state) => {
        if (state.state !== 'ready') return
        const storeId = state.data.references[0]?.store_id
        if (storeId === 'reference-a') rootReadyA.resolve()
        if (storeId === 'reference-b') rootReadyB.resolve()
      },
      error: (error) => {
        rootReadyA.reject(error)
        rootReadyB.reject(error)
      },
    })
    await rootReadyA.promise

    const catalogSelector = { kind: 'spec-catalog' } satisfies PlanningCliProjectionSelector
    const instructionsSelector = {
      kind: 'opsx-instructions',
      change: 'alpha',
      artifact: 'proposal',
    } satisfies PlanningCliProjectionSelector
    const notices: CliProjectionNotice[] = []
    const [catalogSubscription, instructionsSubscription] =
      await fixture.manager.runReactiveOperation(({ planningCliProjectionService }) =>
        Promise.all([
          planningCliProjectionService.subscribe(catalogSelector, (notice) => notices.push(notice)),
          planningCliProjectionService.subscribe(instructionsSelector, (notice) =>
            notices.push(notice)
          ),
        ])
      )
    const read = (selector: PlanningCliProjectionSelector) =>
      fixture.manager.runReactiveOperation(({ planningCliProjectionService }) =>
        planningCliProjectionService.read(selector)
      )

    try {
      await vi.waitFor(async () => {
        await expect(read(catalogSelector)).resolves.toMatchObject({
          state: 'ready',
          data: { value: { referenceSources: [{ storeId: 'reference-a', state: 'ready' }] } },
        })
        await expect(read(instructionsSelector)).resolves.toMatchObject({
          state: 'ready',
          data: { value: { description: 'instructions-a' } },
        })
      })

      references = [{ store_id: 'reference-b', status: [] }]
      fixture.runtimeInvalidation.invalidate(['context'])
      await rootReadyB.promise

      await vi.waitFor(async () => {
        await expect(read(catalogSelector)).resolves.toMatchObject({
          state: 'revalidating',
          freshness: 'stale-display-only',
          data: { value: { referenceSources: [{ storeId: 'reference-a', state: 'ready' }] } },
        })
        await expect(read(instructionsSelector)).resolves.toMatchObject({
          state: 'revalidating',
          freshness: 'stale-display-only',
          data: { value: { description: 'instructions-a' } },
        })
      })

      const catalogData: CliSpecList = {
        specs: [{ id: 'reference-b-spec', requirementCount: 2 }],
        root: {
          path: '/stores/reference-b',
          source: 'store',
          store_id: 'reference-b',
        },
        status: [],
      }
      catalogB.resolve(commandResult(catalogData))
      instructionsB.resolve(instructions('instructions-b'))

      await vi.waitFor(async () => {
        await expect(read(catalogSelector)).resolves.toMatchObject({
          state: 'ready',
          freshness: 'current',
          data: { value: { referenceSources: [{ storeId: 'reference-b', state: 'ready' }] } },
        })
        await expect(read(instructionsSelector)).resolves.toMatchObject({
          state: 'ready',
          freshness: 'current',
          data: { value: { description: 'instructions-b' } },
        })
      })
      expect(fixture.listSpecs).toHaveBeenCalledTimes(4)
      expect(instructionReads).toBe(2)
      expect(notices).toContainEqual(
        expect.objectContaining({ state: 'revalidating', invalidationCause: 'dependency' })
      )
      expect(
        notices.every((notice) => !Object.hasOwn(notice, 'data') && !Object.hasOwn(notice, 'error'))
      ).toBe(true)
    } finally {
      catalogSubscription.unsubscribe()
      instructionsSubscription.unsubscribe()
      rootSubscription.unsubscribe()
      await fixture.manager.dispose()
    }
  })
})
