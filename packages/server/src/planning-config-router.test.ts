/**
 * Orthogonal intents (updated 2026-08-05 Asia/Shanghai):
 * 1. Prove the typed public Project Binding mutation settles after the launch write and preview.
 * 2. Prove a retiring Planning-root lease cannot turn write-then-converge back into a full wait.
 * 3. Require explicit launch-write and asynchronous transition evidence in the public response.
 * 4. Prove the real Root Context subscription observes B only after the A lease is released.
 * 5. Settle shared watcher owners before removing Windows Router fixtures.
 *
 * Original request (2026-07-19): "同意，开始更新 openspec change，然后继续迭代推进。"
 * Derived requirement (2026-07-19): W2 uses write-then-converge and remains independent of W3 transport behavior.
 */
import {
  CliContextSchema,
  CliDoctorSchema,
  parseCliCommandResult,
  resolveOpenSpecDataScope,
  type CliCommandResult,
  type CliResult,
  type ProjectBindingConfig,
  type ProjectBindingUpdateResult,
} from '@openspecui/core'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { ZodType } from 'zod'
import { appRouter } from './router.js'
import {
  removeServerTestDirectories,
  SERVER_FIXTURE_TEST_TIMEOUT_MS,
} from './server-test-cleanup.js'
import { createServer } from './server.js'

type ConvergingUpdateResult = Extract<
  ProjectBindingUpdateResult,
  { transition: { state: 'converging' } }
>
type PreviewErrorUpdateResult = Extract<
  ProjectBindingUpdateResult,
  { transition: { state: 'preview-error' } }
>

const correlatedResultTypeEvidence: {
  convergingExists: [ConvergingUpdateResult] extends [never] ? false : true
  convergingCanContainErrorPreview: Extract<
    ConvergingUpdateResult['rootPreview'],
    { state: 'error' }
  > extends never
    ? false
    : true
  previewErrorExists: [PreviewErrorUpdateResult] extends [never] ? false : true
  previewErrorCanContainReadyPreview: Extract<
    PreviewErrorUpdateResult['rootPreview'],
    { state: 'ready' }
  > extends never
    ? false
    : true
} = {
  convergingExists: true,
  convergingCanContainErrorPreview: false,
  previewErrorExists: true,
  previewErrorCanContainReadyPreview: false,
}

interface Deferred<T> {
  promise: Promise<T>
  resolve(value: T): void
  reject(reason?: unknown): void
}

function createDeferred<T>(): Deferred<T> {
  let resolvePromise: ((value: T) => void) | undefined
  let rejectPromise: ((reason?: unknown) => void) | undefined
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

function commandFailure<T>(
  payload: Record<string, unknown>,
  schema: ZodType<T>,
  input: Pick<CliResult, 'stderr' | 'exitCode'>
): CliCommandResult<T> {
  return parseCliCommandResult(
    {
      success: false,
      stdout: JSON.stringify(payload),
      stderr: input.stderr,
      exitCode: input.exitCode,
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
  const launchConfigPath = join(launchRoot, 'openspec', 'config.yaml')
  await writeFile(launchConfigPath, 'store: store-a\n', 'utf8')

  const server = createServer({ projectDir: launchRoot, enableWatcher: false })
  let contextError = false
  const readSelectedRoot = async () => {
    const config = await readFile(launchConfigPath, 'utf8')
    return config.includes('store: store-b') ? rootB : rootA
  }
  vi.spyOn(server.cliExecutor, 'checkAvailability').mockResolvedValue({
    available: true,
    version: '1.6.0',
  })
  vi.spyOn(server.cliExecutor.contracts, 'doctorRoot').mockImplementation(async () => {
    const selectedRoot = await readSelectedRoot()
    return commandResult(
      {
        root: {
          path: selectedRoot,
          source: 'declared',
          store_id: selectedRoot === rootA ? 'store-a' : 'store-b',
          healthy: true,
          status: [],
        },
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
  })
  vi.spyOn(server.cliExecutor.contracts, 'context').mockImplementation(async () => {
    const selectedRoot = await readSelectedRoot()
    if (contextError) {
      return commandFailure(
        {
          root: {
            path: selectedRoot,
            source: 'declared',
            store_id: selectedRoot === rootA ? 'store-a' : 'store-b',
            role: 'openspec_root',
          },
          members: [],
          status: [
            {
              severity: 'error',
              code: 'context_fixture_failed',
              message: 'Context fixture failed.',
            },
          ],
        },
        CliContextSchema,
        { stderr: 'context fixture stderr', exitCode: 18 }
      )
    }
    return commandResult(
      {
        root: {
          path: selectedRoot,
          source: 'declared',
          store_id: selectedRoot === rootA ? 'store-a' : 'store-b',
          role: 'openspec_root',
        },
        members: [],
        status: [],
      },
      CliContextSchema
    )
  })

  return {
    launchRoot,
    rootA,
    rootB,
    server,
    setContextError(value: boolean) {
      contextError = value
    },
    async dispose() {
      vi.restoreAllMocks()
      await server.storeObservationFallback.dispose()
      await server.planningRootServices.dispose()
      await server.storeObservation.dispose()
      await server.dataHomeObserver.dispose()
      server.projectInvalidation.dispose()
      await server.observationEnvironment.dispose()
      server.projectRecoveryService.dispose()
      server.translationCacheService.close()
      await removeServerTestDirectories([tempDir])
    },
  }
}

function expectWriteThenConvergeEvidence(
  value: ProjectBindingUpdateResult,
  input: { launchRoot: string; rootB: string }
): void {
  const expectedDataScope = resolveOpenSpecDataScope()
  expect(value).toMatchObject({
    kind: 'project-binding-update',
    launchWrite: {
      state: 'write-complete',
      owner: { kind: 'launch-project', path: input.launchRoot },
      binding: {
        store: { state: 'declared', id: 'store-b' },
        references: {
          state: 'declared',
          entries: [{ id: 'platform' }],
        },
        diagnostics: [],
      },
      completedAt: expect.any(Number),
    },
    rootPreview: {
      state: 'ready',
      data: {
        planningRoot: { path: input.rootB, source: 'declared', store_id: 'store-b' },
        storeId: 'store-b',
        dataScope: expectedDataScope,
      },
    },
    transition: {
      id: expect.any(String),
      state: 'converging',
      observedAt: expect.any(Number),
    },
  })
  if (value.rootPreview.state !== 'ready') {
    throw new Error('Expected a ready detached Root Context preview.')
  }
  expect(value.rootPreview.data.evidence.doctor).toMatchObject({
    success: true,
    stdout: JSON.stringify({
      root: {
        path: input.rootB,
        source: 'declared',
        store_id: 'store-b',
        healthy: true,
        status: [],
      },
      store: { id: 'store-b', metadata: { present: true, valid: true }, status: [] },
      references: [],
      status: [],
    }),
    stderr: '',
    exitCode: 0,
    diagnostics: [],
  })
  expect(value.rootPreview.data.evidence.context).toMatchObject({
    success: true,
    stdout: JSON.stringify({
      root: {
        path: input.rootB,
        source: 'declared',
        store_id: 'store-b',
        role: 'openspec_root',
      },
      members: [],
      status: [],
    }),
    stderr: '',
    exitCode: 0,
    diagnostics: [],
  })
  expect(value.rootPreview.data.planningRoot).toEqual({
    path: input.rootB,
    source: 'declared',
    store_id: 'store-b',
    healthy: true,
    status: [],
  })
  expect(value.rootPreview.data.dataScope).toEqual(expectedDataScope)
  expect(value.launchWrite.file.content).toContain('store: store-b')
  expect(value.launchWrite.file.content).toContain('references:\n  - platform')
}

describe('public Project Binding Router', { timeout: SERVER_FIXTURE_TEST_TIMEOUT_MS }, () => {
  it('keeps converging and preview-error Root Context pairs correlated in checked types', () => {
    expect(correlatedResultTypeEvidence).toEqual({
      convergingExists: true,
      convergingCanContainErrorPreview: false,
      previewErrorExists: true,
      previewErrorCanContainReadyPreview: false,
    })
  })

  it('returns launch-write and converging preview evidence before a retiring root lease settles', async () => {
    const fixture = await createRouterFixture()
    const operationStarted = createDeferred<void>()
    const releaseOperation = createDeferred<void>()
    const firstBinding = createDeferred<ProjectBindingConfig>()
    const rootRefreshStarted = createDeferred<void>()
    const bindingBReady = createDeferred<ProjectBindingConfig>()
    let heldOperation: Promise<void> | null = null
    let mutation: ReturnType<
      ReturnType<typeof appRouter.createCaller>['planningConfig']['updateProjectBinding']
    > | null = null
    let subscription: { unsubscribe(): void } | null = null
    let latestBinding: ProjectBindingConfig | null = null

    try {
      const originalResolveRootContextReactive =
        fixture.server.planningRootServices.resolveRootContextReactive.bind(
          fixture.server.planningRootServices
        )
      let refreshExpected = false
      vi.spyOn(
        fixture.server.planningRootServices,
        'resolveRootContextReactive'
      ).mockImplementation(async () => {
        if (refreshExpected) rootRefreshStarted.resolve()
        return originalResolveRootContextReactive()
      })
      const caller = appRouter.createCaller(fixture.server.createContext())
      const observable = await caller.planningConfig.subscribeProjectBinding()
      subscription = observable.subscribe({
        next: (value) => {
          latestBinding = value
          if (
            value.rootPreview.state === 'ready' &&
            value.rootPreview.data.planningRoot?.path === fixture.rootA
          ) {
            firstBinding.resolve(value)
          }
          if (
            value.rootPreview.state === 'ready' &&
            value.rootPreview.data.planningRoot?.path === fixture.rootB
          ) {
            bindingBReady.resolve(value)
          }
        },
        error: (error) => {
          firstBinding.reject(error)
          rootRefreshStarted.reject(error)
          bindingBReady.reject(error)
        },
      })
      const initialBinding = await firstBinding.promise
      expect(initialBinding).toMatchObject({
        kind: 'project-binding',
        binding: { store: { state: 'declared', id: 'store-a' } },
        rootPreview: {
          state: 'ready',
          data: {
            planningRoot: { path: fixture.rootA, source: 'declared', store_id: 'store-a' },
            storeId: 'store-a',
          },
        },
      })
      heldOperation = fixture.server.planningRootServices.runOperation(async ({ rootContext }) => {
        expect(rootContext.planningRoot?.path).toBe(fixture.rootA)
        operationStarted.resolve()
        await releaseOperation.promise
      })
      await operationStarted.promise
      refreshExpected = true

      mutation = caller.planningConfig.updateProjectBinding({
        store: 'store-b',
        references: [{ id: 'platform' }],
      })

      await rootRefreshStarted.promise
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
      expect(latestBinding).toMatchObject({
        kind: 'project-binding',
        binding: { store: { state: 'declared', id: 'store-a' } },
        rootPreview: { state: 'ready', data: { planningRoot: { path: fixture.rootA } } },
      })

      releaseOperation.resolve()
      await heldOperation
      const convergedBinding = await bindingBReady.promise
      expect(convergedBinding).toMatchObject({
        kind: 'project-binding',
        binding: { store: { state: 'declared', id: 'store-b' } },
        rootPreview: {
          state: 'ready',
          data: {
            planningRoot: { path: fixture.rootB, source: 'declared', store_id: 'store-b' },
            storeId: 'store-b',
          },
        },
      })
      subscription.unsubscribe()
      subscription = null
    } finally {
      releaseOperation.resolve()
      await heldOperation
      await mutation
      subscription?.unsubscribe()
      await fixture.dispose()
    }
  })

  it('rejects a response without typed launch-write and transition evidence', async () => {
    const fixture = await createRouterFixture()

    try {
      const value = await appRouter
        .createCaller(fixture.server.createContext())
        .planningConfig.updateProjectBinding({
          store: 'store-b',
          references: [{ id: 'platform' }],
        })

      expectWriteThenConvergeEvidence(value, fixture)
    } finally {
      await fixture.dispose()
    }
  })

  it('retains a failed detached preview envelope without losing the completed launch write', async () => {
    const fixture = await createRouterFixture()
    fixture.setContextError(true)
    const expectedDataScope = resolveOpenSpecDataScope()

    try {
      const value = await appRouter
        .createCaller(fixture.server.createContext())
        .planningConfig.updateProjectBinding({
          store: 'store-b',
          references: [{ id: 'platform' }],
        })

      expect(value).toMatchObject({
        kind: 'project-binding-update',
        launchWrite: {
          state: 'write-complete',
          owner: { kind: 'launch-project', path: fixture.launchRoot },
          binding: {
            store: { state: 'declared', id: 'store-b' },
            references: { state: 'declared', entries: [{ id: 'platform' }] },
            diagnostics: [],
          },
          completedAt: expect.any(Number),
        },
        rootPreview: {
          state: 'error',
          error: { code: 'context-command-failed', message: 'context fixture stderr' },
          attempt: {
            planningRoot: {
              path: fixture.rootB,
              source: 'declared',
              store_id: 'store-b',
              healthy: true,
              status: [],
            },
            storeId: 'store-b',
            dataScope: expectedDataScope,
            evidence: {
              doctor: {
                success: true,
                stdout: JSON.stringify({
                  root: {
                    path: fixture.rootB,
                    source: 'declared',
                    store_id: 'store-b',
                    healthy: true,
                    status: [],
                  },
                  store: {
                    id: 'store-b',
                    metadata: { present: true, valid: true },
                    status: [],
                  },
                  references: [],
                  status: [],
                }),
                stderr: '',
                exitCode: 0,
                diagnostics: [],
              },
              context: {
                success: false,
                stdout: JSON.stringify({
                  root: {
                    path: fixture.rootB,
                    source: 'declared',
                    store_id: 'store-b',
                    role: 'openspec_root',
                  },
                  members: [],
                  status: [
                    {
                      severity: 'error',
                      code: 'context_fixture_failed',
                      message: 'Context fixture failed.',
                    },
                  ],
                }),
                stderr: 'context fixture stderr',
                exitCode: 18,
                diagnostics: [
                  {
                    severity: 'error',
                    code: 'context_fixture_failed',
                    message: 'Context fixture failed.',
                  },
                ],
              },
            },
            diagnostics: {
              root: [],
              doctor: [],
              context: [
                {
                  severity: 'error',
                  code: 'context_fixture_failed',
                  message: 'Context fixture failed.',
                },
              ],
            },
          },
        },
        transition: {
          id: expect.any(String),
          state: 'preview-error',
          observedAt: expect.any(Number),
          error: { code: 'context-command-failed', message: 'context fixture stderr' },
        },
      })
      if (value.rootPreview.state !== 'error' || value.transition.state !== 'preview-error') {
        throw new Error('Expected one correlated preview-error result.')
      }
      expect(value.transition.error).toEqual(value.rootPreview.error)
      expect(value.rootPreview.attempt.evidence.doctor).toEqual({
        success: true,
        stdout: JSON.stringify({
          root: {
            path: fixture.rootB,
            source: 'declared',
            store_id: 'store-b',
            healthy: true,
            status: [],
          },
          store: {
            id: 'store-b',
            metadata: { present: true, valid: true },
            status: [],
          },
          references: [],
          status: [],
        }),
        stderr: '',
        exitCode: 0,
        diagnostics: [],
      })
      expect(value.rootPreview.attempt.evidence.context).toEqual({
        success: false,
        stdout: JSON.stringify({
          root: {
            path: fixture.rootB,
            source: 'declared',
            store_id: 'store-b',
            role: 'openspec_root',
          },
          members: [],
          status: [
            {
              severity: 'error',
              code: 'context_fixture_failed',
              message: 'Context fixture failed.',
            },
          ],
        }),
        stderr: 'context fixture stderr',
        exitCode: 18,
        diagnostics: [
          {
            severity: 'error',
            code: 'context_fixture_failed',
            message: 'Context fixture failed.',
          },
        ],
      })
    } finally {
      await fixture.dispose()
    }
  })
})
