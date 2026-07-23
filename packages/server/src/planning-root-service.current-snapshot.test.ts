/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Prove one Manager-owned Root Context resolution serves same-generation reactive operations.
 * 2. Prove reactive cache-hit subscribers retain invalidation dependencies.
 * 3. Prove one invalidation produces one B resolution while A remains a refreshing display snapshot.
 * 4. Prove CLI-owned Root Context failures are never retained as reusable snapshots.
 *
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 */
import {
  CliExecutor,
  ConfigManager,
  RuntimeInvalidationIndex,
  type CliCommandResult,
  type CliContext,
  type CliDoctor,
  type ObservationRootOwner,
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
})
