/**
 * Orthogonal intents (created 2026-07-19 Asia/Shanghai):
 * 1. Prove the typed public Project Binding mutation settles after the launch write and preview.
 * 2. Prove a retiring Planning-root lease cannot turn write-then-converge back into a full wait.
 * 3. Require explicit launch-write and asynchronous transition evidence in the public response.
 *
 * Original request (2026-07-19): "同意，开始更新 openspec change，然后继续迭代推进。"
 * Derived requirement (2026-07-19): W2 uses write-then-converge and remains independent of W3 transport behavior.
 */
import {
  CliContextSchema,
  CliDoctorSchema,
  parseCliCommandResult,
  type CliCommandResult,
} from '@openspecui/core'
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { ZodType } from 'zod'
import { appRouter } from './router.js'
import { createServer } from './server.js'

interface Deferred<T> {
  promise: Promise<T>
  resolve(value: T): void
}

function createDeferred<T>(): Deferred<T> {
  let resolvePromise: ((value: T) => void) | undefined
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve
  })
  return {
    promise,
    resolve(value) {
      if (!resolvePromise) throw new Error('Deferred resolver was not initialized.')
      resolvePromise(value)
    },
  }
}

function commandResult<T>(data: T, schema: ZodType<T>): CliCommandResult<T> {
  return parseCliCommandResult(
    {
      success: true,
      stdout: JSON.stringify(data),
      stderr: '',
      exitCode: 0,
    },
    schema
  )
}

async function createRouterFixture() {
  const tempDir = await mkdtemp(join(tmpdir(), 'openspecui-project-binding-router-'))
  const launchRoot = join(tempDir, 'launch')
  const rootA = join(tempDir, 'root-a')
  const rootB = join(tempDir, 'root-b')
  await Promise.all(
    [launchRoot, rootA, rootB].map((root) => mkdir(join(root, 'openspec'), { recursive: true }))
  )

  const server = createServer({ projectDir: launchRoot, enableWatcher: false })
  let selectedRoot = rootA
  vi.spyOn(server.cliExecutor, 'checkAvailability').mockResolvedValue({
    available: true,
    version: '1.6.0',
  })
  vi.spyOn(server.cliExecutor.contracts, 'doctorRoot').mockImplementation(async () =>
    commandResult(
      {
        root: { path: selectedRoot, source: 'declared', healthy: true, status: [] },
        store: {
          id: selectedRoot === rootA ? 'store-a' : 'store-b',
          metadata: { present: true, valid: true },
          status: [],
        },
        references: [],
        status: [],
      },
      CliDoctorSchema
    )
  )
  vi.spyOn(server.cliExecutor.contracts, 'context').mockImplementation(async () =>
    commandResult(
      {
        root: { path: selectedRoot, source: 'declared', role: 'openspec_root' },
        members: [],
        status: [],
      },
      CliContextSchema
    )
  )

  return {
    launchRoot,
    rootA,
    rootB,
    server,
    selectRoot(root: string) {
      selectedRoot = root
    },
    async dispose() {
      vi.restoreAllMocks()
      await server.storeObservationFallback.dispose()
      await server.planningRootServices.dispose()
      await server.storeObservation.dispose()
      await server.dataHomeObserver.dispose()
      server.storeInvalidation.dispose()
      server.projectInvalidation.dispose()
      await server.observationEnvironment.dispose()
      server.projectRecoveryService.dispose()
      server.translationCacheService.close()
      await rm(tempDir, { recursive: true, force: true })
    },
  }
}

function expectWriteThenConvergeEvidence(
  value: unknown,
  input: { launchRoot: string; rootB: string }
): void {
  expect(value).toMatchObject({
    kind: 'project-binding-update',
    launchWrite: {
      state: 'write-complete',
      owner: { kind: 'launch-project', path: input.launchRoot },
      binding: { store: { state: 'declared', id: 'store-b' } },
      completedAt: expect.any(Number),
    },
    rootPreview: {
      state: 'ready',
      data: {
        planningRoot: { path: input.rootB, source: 'declared' },
        storeId: 'store-b',
      },
    },
    transition: {
      id: expect.any(String),
      state: 'converging',
      observedAt: expect.any(Number),
    },
  })
}

describe('public Project Binding Router', () => {
  it('returns launch-write and converging preview evidence before a retiring root lease settles', async () => {
    const fixture = await createRouterFixture()
    const operationStarted = createDeferred<void>()
    const releaseOperation = createDeferred<void>()
    let heldOperation: Promise<void> | null = null
    let mutation: ReturnType<
      ReturnType<typeof appRouter.createCaller>['planningConfig']['updateProjectBinding']
    > | null = null

    try {
      await expect(fixture.server.planningRootServices.resolveRootContext()).resolves.toMatchObject({
        state: 'ready',
        data: { planningRoot: { path: fixture.rootA } },
      })
      heldOperation = fixture.server.planningRootServices.runOperation(async ({ rootContext }) => {
        expect(rootContext.planningRoot?.path).toBe(fixture.rootA)
        operationStarted.resolve()
        await releaseOperation.promise
      })
      await operationStarted.promise

      fixture.selectRoot(fixture.rootB)
      const caller = appRouter.createCaller(fixture.server.createContext())
      mutation = caller.planningConfig.updateProjectBinding({
        store: 'store-b',
        references: [{ id: 'platform' }],
      })

      await vi.waitFor(async () => {
        await expect(
          readFile(join(fixture.launchRoot, 'openspec', 'config.yaml'), 'utf8')
        ).resolves.toContain('store: store-b')
      })

      const outcome = await Promise.race([
        mutation.then((value) => ({ state: 'returned' as const, value })),
        new Promise<{ state: 'still-waiting' }>((resolve) =>
          setTimeout(() => resolve({ state: 'still-waiting' }), 250)
        ),
      ])

      expect(outcome).toMatchObject({ state: 'returned' })
      if (outcome.state === 'returned') {
        expectWriteThenConvergeEvidence(outcome.value, fixture)
      }
    } finally {
      releaseOperation.resolve()
      await heldOperation
      await mutation
      await fixture.dispose()
    }
  })

  it('rejects a response without typed launch-write and transition evidence', async () => {
    const fixture = await createRouterFixture()

    try {
      fixture.selectRoot(fixture.rootB)
      const value = await appRouter
        .createCaller(fixture.server.createContext())
        .planningConfig.updateProjectBinding({ store: 'store-b' })

      expectWriteThenConvergeEvidence(value, fixture)
    } finally {
      await fixture.dispose()
    }
  })
})
