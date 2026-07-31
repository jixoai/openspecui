/**
 * Orthogonal intents (created 2026-07-31 Asia/Shanghai):
 * 1. Prove same-generation readonly cache misses share one lock-free Root Context resolution.
 * 2. Prove a newer invalidation generation resolves independently and rejects a late stale result.
 * 3. Prove replacement waits for an admitted operation outside the short detach write lock.
 * 4. Prove imperative snapshots require one dependency-tracked validation before reactive replay.
 *
 * Original request (2026-07-31): "系统性地进行修复，因为List页面也有类似的问题。所有可能其它页面都有类似的问题。"
 * Owner diagnosis (2026-07-31): readonly cache misses must single-flight before a short generation-checked write commit.
 * Full-gate correction (2026-07-31): imperative snapshots must not mask a later reactive Planning-root failure or replacement.
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
import { AsyncReadWriteLock } from './read-write-lock.js'

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

function rootDoctor(path: string): CliCommandResult<CliDoctor> {
  return commandResult({
    root: { path, source: 'nearest', healthy: true, status: [] },
    store: null,
    references: [],
    status: [],
  })
}

function rootContext(path: string): CliCommandResult<CliContext> {
  return commandResult({
    root: { path, source: 'nearest', role: 'openspec_root' },
    members: [],
    status: [],
  })
}

async function createFixture() {
  const tempDir = await mkdtemp(join(tmpdir(), 'openspecui-root-concurrency-'))
  tempDirs.push(tempDir)
  const launchProjectDir = join(tempDir, 'launch')
  const rootA = join(tempDir, 'root-a')
  const rootB = join(tempDir, 'root-b')
  await Promise.all(
    [launchProjectDir, rootA, rootB].map((path) =>
      mkdir(join(path, 'openspec'), { recursive: true })
    )
  )

  const configManager = new ConfigManager(launchProjectDir)
  const cliExecutor = new CliExecutor(configManager, launchProjectDir)
  const checkAvailability = vi.spyOn(cliExecutor, 'checkAvailability').mockResolvedValue({
    available: true,
    version: '1.6.0',
  })
  const doctorRoot = vi.spyOn(cliExecutor.contracts, 'doctorRoot')
  const contextCommand = vi.spyOn(cliExecutor.contracts, 'context')
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

describe('PlanningRootServiceManager concurrency', () => {
  it('revalidates an imperative snapshot once before granting reactive replay authority', async () => {
    const fixture = await createFixture()
    fixture.doctorRoot
      .mockResolvedValueOnce(rootDoctor(fixture.rootA))
      .mockResolvedValueOnce(rootDoctor(fixture.rootB))
    fixture.contextCommand
      .mockResolvedValueOnce(rootContext(fixture.rootA))
      .mockResolvedValueOnce(rootContext(fixture.rootB))

    await expect(
      fixture.manager.runOperation(({ rootContext: current }) => current)
    ).resolves.toMatchObject({ planningRoot: { path: fixture.rootA } })
    await expect(
      fixture.manager.runReactiveOperation(({ rootContext: current }) => current)
    ).resolves.toMatchObject({ planningRoot: { path: fixture.rootB } })
    await expect(
      fixture.manager.runReactiveOperation(({ rootContext: current }) => current)
    ).resolves.toMatchObject({ planningRoot: { path: fixture.rootB } })

    expect(fixture.doctorRoot).toHaveBeenCalledTimes(2)
    expect(fixture.contextCommand).toHaveBeenCalledTimes(2)

    await fixture.manager.dispose()
  })

  it('single-flights same-generation cache misses without holding a write lock during CLI I/O', async () => {
    const fixture = await createFixture()
    const doctor = createDeferred<CliCommandResult<CliDoctor>>()
    const context = createDeferred<CliCommandResult<CliContext>>()
    fixture.doctorRoot.mockReturnValue(doctor.promise)
    fixture.contextCommand.mockReturnValue(context.promise)
    const writeLock = vi.spyOn(AsyncReadWriteLock.prototype, 'withWriteLock')

    const reads = Array.from({ length: 6 }, () =>
      fixture.manager.runReactiveOperation(({ rootContext: current }) => current)
    )
    await vi.waitFor(() => {
      expect(fixture.doctorRoot).toHaveBeenCalledOnce()
      expect(fixture.contextCommand).toHaveBeenCalledOnce()
    })

    expect(writeLock).not.toHaveBeenCalled()

    doctor.resolve(rootDoctor(fixture.rootA))
    context.resolve(rootContext(fixture.rootA))
    const roots = await Promise.all(reads)
    expect(roots.every((root) => root.planningRoot?.path === fixture.rootA)).toBe(true)
    expect(fixture.checkAvailability).toHaveBeenCalledOnce()
    expect(writeLock.mock.calls.map(([source]) => source.source)).toEqual([
      'root-transition.commit',
    ])

    await fixture.manager.dispose()
  })

  it('lets generation B resolve before late A and never publishes A after B invalidates it', async () => {
    const fixture = await createFixture()
    const doctorA = createDeferred<CliCommandResult<CliDoctor>>()
    const contextA = createDeferred<CliCommandResult<CliContext>>()
    const doctorB = createDeferred<CliCommandResult<CliDoctor>>()
    const contextB = createDeferred<CliCommandResult<CliContext>>()
    fixture.doctorRoot.mockReturnValueOnce(doctorA.promise).mockReturnValueOnce(doctorB.promise)
    fixture.contextCommand
      .mockReturnValueOnce(contextA.promise)
      .mockReturnValueOnce(contextB.promise)

    const resolvingA = fixture.manager.runReactiveOperation(({ rootContext: current }) => current)
    await vi.waitFor(() => expect(fixture.doctorRoot).toHaveBeenCalledOnce())

    fixture.runtimeInvalidation.invalidate(['context'])
    const resolvingB = fixture.manager.runReactiveOperation(({ rootContext: current }) => current)
    await vi.waitFor(() => {
      expect(fixture.doctorRoot).toHaveBeenCalledTimes(2)
      expect(fixture.contextCommand).toHaveBeenCalledTimes(2)
    })

    doctorB.resolve(rootDoctor(fixture.rootB))
    contextB.resolve(rootContext(fixture.rootB))
    await expect(resolvingB).resolves.toMatchObject({
      planningRoot: { path: fixture.rootB },
    })

    doctorA.resolve(rootDoctor(fixture.rootA))
    contextA.resolve(rootContext(fixture.rootA))
    await expect(resolvingA).resolves.toMatchObject({
      planningRoot: { path: fixture.rootB },
    })
    expect(fixture.checkAvailability).toHaveBeenCalledTimes(2)

    await fixture.manager.dispose()
  })

  it('waits for retiring A outside the write lock before committing B', async () => {
    const fixture = await createFixture()
    fixture.doctorRoot.mockResolvedValue(rootDoctor(fixture.rootA))
    fixture.contextCommand.mockResolvedValue(rootContext(fixture.rootA))
    await fixture.manager.runReactiveOperation(({ rootContext: current }) => current)

    const operationStarted = createDeferred<void>()
    const releaseOperation = createDeferred<void>()
    const heldOperation = fixture.manager.runReactiveOperation(async ({ rootContext: current }) => {
      operationStarted.resolve()
      await releaseOperation.promise
      return current
    })
    await operationStarted.promise

    fixture.doctorRoot.mockResolvedValue(rootDoctor(fixture.rootB))
    fixture.contextCommand.mockResolvedValue(rootContext(fixture.rootB))
    const writeLock = vi.spyOn(AsyncReadWriteLock.prototype, 'withWriteLock')
    fixture.runtimeInvalidation.invalidate(['context'])
    const replacement = fixture.manager.resolveRootContextReactive()
    await vi.waitFor(() => {
      expect(writeLock.mock.calls.map(([source]) => source.source)).toEqual([
        'root-transition.detach',
      ])
    })

    const detachResult = writeLock.mock.results[0]?.value
    if (!(detachResult instanceof Promise)) throw new Error('Expected an async detach lock result.')
    const detachSettlement = await Promise.race([
      detachResult.then(() => 'released' as const),
      new Promise<'blocked'>((resolve) => setTimeout(() => resolve('blocked'), 50)),
    ])
    expect(detachSettlement).toBe('released')

    let replacementSettled = false
    void replacement.finally(() => {
      replacementSettled = true
    })
    await Promise.resolve()
    expect(replacementSettled).toBe(false)

    releaseOperation.resolve()
    await expect(heldOperation).resolves.toMatchObject({
      planningRoot: { path: fixture.rootA },
    })
    await expect(replacement).resolves.toMatchObject({
      state: 'ready',
      data: { planningRoot: { path: fixture.rootB } },
    })
    expect(writeLock.mock.calls.map(([source]) => source.source)).toEqual([
      'root-transition.detach',
      'root-transition.commit',
    ])

    await fixture.manager.dispose()
  })
})
