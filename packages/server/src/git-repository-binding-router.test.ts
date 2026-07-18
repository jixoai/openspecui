/**
 * Orthogonal intents (created 2026-07-19 Asia/Shanghai):
 * 1. Prove the typed public Router rejects stale Planning refresh intent.
 * 2. Prove the conflict happens before the rebound repository receives a refresh stamp.
 * 3. Preserve Dashboard projection refresh while Code Git remains Planning-failure independent.
 *
 * Original request (2026-07-19): "代码已经提交，开始review。如果有问题，那么可更新change。"
 * Derived requirement (2026-07-19): Checkpoint 6.11 rejects stale Git repository bindings.
 */
import {
  CliContextSchema,
  CliDoctorSchema,
  parseCliCommandResult,
  type CliCommandResult,
  type DashboardOverview,
  type GitRepositoryScopes,
} from '@openspecui/core'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { describe, expect, it, vi } from 'vitest'
import type { ZodType } from 'zod'
import { appRouter } from './router.js'
import { createServer } from './server.js'

const runCommand = promisify(execFile)

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

function commandFailure<T>(schema: ZodType<T>): CliCommandResult<T> {
  return parseCliCommandResult(
    {
      success: false,
      stdout: '',
      stderr: 'root unavailable',
      exitCode: 1,
    },
    schema
  )
}

async function initRepository(path: string): Promise<void> {
  await mkdir(join(path, 'openspec'), { recursive: true })
  await runCommand('git', ['init', '--quiet'], { cwd: path })
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function createRouterFixture() {
  const tempDir = await mkdtemp(join(tmpdir(), 'openspecui-git-binding-router-'))
  const codeRoot = join(tempDir, 'code')
  const rootA = join(tempDir, 'root-a')
  const rootB = join(tempDir, 'root-b')
  await Promise.all([initRepository(codeRoot), initRepository(rootA), initRepository(rootB)])
  const server = createServer({ projectDir: codeRoot, enableWatcher: false })
  let selectedRoot = rootA
  let rootAvailable = true

  vi.spyOn(server.cliExecutor, 'checkAvailability').mockResolvedValue({
    available: true,
    version: '1.6.0',
  })
  const doctorRootMock = vi
    .spyOn(server.cliExecutor.contracts, 'doctorRoot')
    .mockImplementation(async () =>
      rootAvailable
        ? commandResult(
            {
              root: { path: selectedRoot, source: 'nearest', healthy: true, status: [] },
              store: null,
              references: [],
              status: [],
            },
            CliDoctorSchema
          )
        : commandFailure(CliDoctorSchema)
    )
  vi.spyOn(server.cliExecutor.contracts, 'context').mockImplementation(async () =>
    commandResult(
      {
        root: { path: selectedRoot, source: 'nearest', role: 'openspec_root' },
        members: [],
        status: [],
      },
      CliContextSchema
    )
  )

  return {
    codeRoot,
    rootA,
    rootB,
    server,
    doctorRootMock,
    selectRoot(root: string) {
      selectedRoot = root
    },
    failRoot() {
      rootAvailable = false
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

describe('public Git repository binding Router', () => {
  it('keeps public Code Git usable while the initial Planning transition is deferred', async () => {
    const fixture = await createRouterFixture()
    const deferredDoctor =
      createDeferred<Awaited<ReturnType<typeof fixture.server.cliExecutor.contracts.doctorRoot>>>()
    const readyDoctor = commandResult(
      {
        root: { path: fixture.rootA, source: 'nearest', healthy: true, status: [] },
        store: null,
        references: [],
        status: [],
      },
      CliDoctorSchema
    )
    fixture.doctorRootMock.mockImplementationOnce(() => deferredDoctor.promise)
    const emissions: GitRepositoryScopes[] = []
    const firstEmission = createDeferred<GitRepositoryScopes>()
    const planningEmission = createDeferred<GitRepositoryScopes>()
    let subscription: { unsubscribe(): void } | null = null

    try {
      const caller = appRouter.createCaller(fixture.server.createContext())
      const observable = await caller.git.subscribeScopes()
      subscription = observable.subscribe({
        next(scopes) {
          emissions.push(scopes)
          if (emissions.length === 1) firstEmission.resolve(scopes)
          if (scopes.planning) planningEmission.resolve(scopes)
        },
        error(error) {
          firstEmission.reject(error)
          planningEmission.reject(error)
        },
      })

      const codeOnly = await firstEmission.promise
      expect(codeOnly.planning).toBeNull()
      expect(codeOnly.code.rootPath).toBe(fixture.codeRoot)
      await vi.waitFor(() => expect(fixture.doctorRootMock).toHaveBeenCalledOnce())

      const token = codeOnly.code.bindingToken
      const [code, overview, history, refresh] = await Promise.all([
        caller.git.code(),
        caller.git.overview({ scope: 'code', expectedBindingToken: token }),
        caller.git.listEntries({
          scope: 'code',
          expectedBindingToken: token,
          limit: 10,
        }),
        caller.dashboard.refreshGitSnapshot({
          scope: 'code',
          expectedBindingToken: token,
          reason: 'deferred-planning-code-refresh',
        }),
      ])

      expect(code.bindingToken).toBe(token)
      expect(overview.currentWorktree?.path).toBe(code.repository?.topLevel)
      expect(history.items).toEqual([])
      expect(refresh).toEqual({ success: true })

      deferredDoctor.resolve(readyDoctor)
      const enriched = await planningEmission.promise
      expect(enriched.code.bindingToken).toBe(token)
      expect(enriched.planning?.rootPath).toBe(fixture.rootA)
    } finally {
      deferredDoctor.resolve(readyDoctor)
      subscription?.unsubscribe()
      await fixture.dispose()
    }
  })

  it('stops subscription emission and settles the deferred Manager transition after unsubscribe', async () => {
    const fixture = await createRouterFixture()
    const deferredDoctor =
      createDeferred<Awaited<ReturnType<typeof fixture.server.cliExecutor.contracts.doctorRoot>>>()
    const readyDoctor = commandResult(
      {
        root: { path: fixture.rootA, source: 'nearest', healthy: true, status: [] },
        store: null,
        references: [],
        status: [],
      },
      CliDoctorSchema
    )
    fixture.doctorRootMock.mockImplementationOnce(() => deferredDoctor.promise)
    const emissions: GitRepositoryScopes[] = []
    const firstEmission = createDeferred<void>()

    try {
      const caller = appRouter.createCaller(fixture.server.createContext())
      const observable = await caller.git.subscribeScopes()
      const subscription = observable.subscribe({
        next(scopes) {
          emissions.push(scopes)
          firstEmission.resolve(undefined)
        },
        error: firstEmission.reject,
      })

      await firstEmission.promise
      await vi.waitFor(() => expect(fixture.doctorRootMock).toHaveBeenCalledOnce())
      subscription.unsubscribe()
      deferredDoctor.resolve(readyDoctor)

      await expect(
        fixture.server.planningRootServices.runOperation(({ rootContext }) =>
          Promise.resolve(rootContext.planningRoot?.path)
        )
      ).resolves.toBe(fixture.rootA)
      expect(emissions).toHaveLength(1)
      expect(emissions[0]?.planning).toBeNull()
    } finally {
      deferredDoctor.resolve(readyDoctor)
      await fixture.dispose()
    }
  })

  it('rejects stale Refresh before touching the rebound Planning repository', async () => {
    const fixture = await createRouterFixture()
    const { rootB, server } = fixture

    try {
      const caller = appRouter.createCaller(server.createContext())
      const bindingA = (await caller.git.scopes()).planning
      if (!bindingA) throw new Error('Expected Root A Planning repository binding.')
      fixture.selectRoot(rootB)
      const rootBGitDir = (
        await runCommand('git', ['rev-parse', '--git-dir'], { cwd: rootB })
      ).stdout.trim()
      const rootBStamp = resolve(rootB, rootBGitDir, 'openspecui-dashboard-git-refresh.stamp')

      const staleRefresh = await caller.git
        .refresh({
          scope: 'planning',
          expectedBindingToken: bindingA.bindingToken,
          reason: 'stale-root-a-refresh',
        })
        .then(
          (value) => ({ status: 'fulfilled' as const, value }),
          (reason: unknown) => ({ status: 'rejected' as const, reason })
        )

      await expect(pathExists(rootBStamp)).resolves.toBe(false)
      expect(staleRefresh).toMatchObject({
        status: 'rejected',
        reason: { code: 'CONFLICT' },
      })

      const bindingB = (await caller.git.scopes()).planning
      if (!bindingB) throw new Error('Expected Root B Planning repository binding.')
      await expect(
        caller.git.refresh({
          scope: 'planning',
          expectedBindingToken: bindingB.bindingToken,
          reason: 'current-root-b-refresh',
        })
      ).resolves.toEqual({ success: true })
      await expect(pathExists(rootBStamp)).resolves.toBe(true)
    } finally {
      await fixture.dispose()
    }
  })

  it('pushes a refreshed Dashboard projection after a successful Code Git refresh', async () => {
    const fixture = await createRouterFixture()
    const emissions: DashboardOverview[] = []
    let unsubscribe: () => void = () => undefined

    try {
      const caller = appRouter.createCaller(fixture.server.createContext())
      const expectedBindingToken = (await caller.git.scopes()).code.bindingToken
      await fixture.server.planningRootServices.runOperation(({ dashboardOverviewService }) => {
        unsubscribe = dashboardOverviewService.subscribe((overview) => emissions.push(overview))
      })

      await expect(
        caller.dashboard.refreshGitSnapshot({
          scope: 'code',
          expectedBindingToken,
          reason: 'dashboard-code-refresh',
        })
      ).resolves.toEqual({ success: true })
      await vi.waitFor(() => expect(emissions).toHaveLength(1))
    } finally {
      unsubscribe()
      await fixture.dispose()
    }
  })

  it('keeps Code Git refresh successful when the Planning projection fails', async () => {
    const fixture = await createRouterFixture()

    try {
      const caller = appRouter.createCaller(fixture.server.createContext())
      const expectedBindingToken = (await caller.git.scopes()).code.bindingToken
      fixture.failRoot()
      const codeGitDir = (
        await runCommand('git', ['rev-parse', '--git-dir'], {
          cwd: fixture.codeRoot,
        })
      ).stdout.trim()
      const codeStamp = resolve(
        fixture.codeRoot,
        codeGitDir,
        'openspecui-dashboard-git-refresh.stamp'
      )

      await expect(
        caller.dashboard.refreshGitSnapshot({
          scope: 'code',
          expectedBindingToken,
          reason: 'planning-failed-code-refresh',
        })
      ).resolves.toEqual({ success: true })
      await expect(pathExists(codeStamp)).resolves.toBe(true)
      await vi.waitFor(() => expect(fixture.doctorRootMock).toHaveBeenCalledTimes(2))
    } finally {
      await fixture.dispose()
    }
  })
})
