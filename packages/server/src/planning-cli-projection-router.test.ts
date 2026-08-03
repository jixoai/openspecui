/**
 * Orthogonal intents (updated 2026-08-03 Asia/Shanghai):
 * 1. Prove public Planning CLI lifecycle subscriptions rebind across real Manager Root replacement.
 * 2. Reject late Archive-instructions callbacks from Root A after Root B becomes current.
 * 3. Keep the fixture typechecked through createServer, Context, and the public tRPC caller.
 * 4. Prove the compatibility Change-list query reads the same typed CLI Projection Work.
 *
 * Original request (2026-07-26): "操作成功底层是要推送变更的，然后让多端基于订阅拉取更新。"
 * Owner architecture clarification (2026-07-26): "最终计算结果本质是来自于 OpenSpec CLI 所提供的内容。"
 */
import {
  CliContextSchema,
  CliDoctorSchema,
  OpsxKernel,
  parseCliCommandResult,
  type CliCommandResult,
  type CliContext,
  type CliDoctor,
  type CliProjectionNotice,
} from '@openspecui/core'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PlanningCliProjectionService } from './planning-cli-projection-service.js'
import { appRouter } from './router.js'
import { createServer } from './server.js'

const disposers: Array<() => Promise<void>> = []

function commandResult<T>(
  data: T,
  schema: Parameters<typeof parseCliCommandResult<T>>[1]
): CliCommandResult<T> {
  return parseCliCommandResult(
    { success: true, stdout: JSON.stringify(data), stderr: '', exitCode: 0 },
    schema
  )
}

function lifecycleNotice(identity: string): CliProjectionNotice {
  return {
    identity,
    workGeneration: 1,
    snapshotGeneration: 1,
    state: 'ready',
    invalidationCause: 'initial',
  }
}

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(disposers.splice(0).map((dispose) => dispose()))
})

describe('public Planning CLI projection Router', () => {
  it('serves the compatibility Change list from typed CLI Projection Work', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'openspecui-planning-cli-list-'))
    const launchRoot = join(tempDir, 'launch')
    await mkdir(join(launchRoot, 'openspec', 'changes', 'physical-only'), { recursive: true })
    const server = createServer({ projectDir: launchRoot, enableWatcher: false })
    disposers.push(async () => {
      await server.storeObservationFallback.dispose()
      await server.planningRootServices.dispose()
      await server.storeObservation.dispose()
      await server.dataHomeObserver.dispose()
      server.projectInvalidation.dispose()
      await server.observationEnvironment.dispose()
      server.projectRecoveryService.dispose()
      server.translationCacheService.close()
      await rm(tempDir, { recursive: true, force: true })
    })
    vi.spyOn(server.cliExecutor, 'checkAvailability').mockResolvedValue({
      available: true,
      version: '1.7.0',
    })
    vi.spyOn(server.cliExecutor.contracts, 'doctorRoot').mockResolvedValue(
      commandResult<CliDoctor>(
        {
          root: { path: launchRoot, source: 'nearest', healthy: true, status: [] },
          store: null,
          references: [],
          status: [],
        },
        CliDoctorSchema
      )
    )
    vi.spyOn(server.cliExecutor.contracts, 'context').mockResolvedValue(
      commandResult<CliContext>(
        {
          root: { path: launchRoot, source: 'nearest', role: 'openspec_root' },
          members: [],
          status: [],
        },
        CliContextSchema
      )
    )
    const readChangeListProjection = vi
      .spyOn(OpsxKernel.prototype, 'readChangeListProjection')
      .mockResolvedValue({
        value: ['cli-owned'],
        evidence: {
          success: true,
          stdout: '{"changes":[{"name":"cli-owned"}]}',
          stderr: '',
          exitCode: 0,
          payload: { changes: [{ name: 'cli-owned' }] },
          diagnostics: [],
        },
      })

    await expect(
      appRouter.createCaller(server.createContext()).opsx.listChanges()
    ).resolves.toEqual(['cli-owned'])
    expect(readChangeListProjection).toHaveBeenCalledOnce()
  }, 15_000)

  it('suppresses a late Root A Archive callback after Root B subscription is current', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'openspecui-planning-cli-router-'))
    const launchRoot = join(tempDir, 'launch')
    const rootA = join(tempDir, 'root-a')
    const rootB = join(tempDir, 'root-b')
    await Promise.all(
      [launchRoot, rootA, rootB].map((root) => mkdir(join(root, 'openspec'), { recursive: true }))
    )
    const server = createServer({ projectDir: launchRoot, enableWatcher: false })
    disposers.push(async () => {
      await server.storeObservationFallback.dispose()
      await server.planningRootServices.dispose()
      await server.storeObservation.dispose()
      await server.dataHomeObserver.dispose()
      server.projectInvalidation.dispose()
      await server.observationEnvironment.dispose()
      server.projectRecoveryService.dispose()
      server.translationCacheService.close()
      await rm(tempDir, { recursive: true, force: true })
    })
    let selectedRoot = rootA
    vi.spyOn(server.cliExecutor, 'checkAvailability').mockResolvedValue({
      available: true,
      version: '1.6.0',
    })
    vi.spyOn(server.cliExecutor.contracts, 'doctorRoot').mockImplementation(async () =>
      commandResult<CliDoctor>(
        {
          root: { path: selectedRoot, source: 'nearest', healthy: true, status: [] },
          store: null,
          references: [],
          status: [],
        },
        CliDoctorSchema
      )
    )
    vi.spyOn(server.cliExecutor.contracts, 'context').mockImplementation(async () =>
      commandResult<CliContext>(
        {
          root: { path: selectedRoot, source: 'nearest', role: 'openspec_root' },
          members: [],
          status: [],
        },
        CliContextSchema
      )
    )

    const regionalListeners: Array<(notice: CliProjectionNotice) => void> = []
    const unsubscribeRegional: Array<ReturnType<typeof vi.fn>> = []
    vi.spyOn(PlanningCliProjectionService.prototype, 'subscribe').mockImplementation(
      (_selector, listener) => {
        const identity = regionalListeners.length === 0 ? 'root-a' : 'root-b'
        const unsubscribe = vi.fn()
        regionalListeners.push(listener)
        unsubscribeRegional.push(unsubscribe)
        listener(lifecycleNotice(identity))
        return { unsubscribe }
      }
    )

    const observable = await appRouter
      .createCaller(server.createContext())
      .planningCliProjection.subscribe({
        kind: 'opsx-archive-instructions',
        change: 'add-auth',
      })
    const received: CliProjectionNotice[] = []
    const errors: unknown[] = []
    const subscription = observable.subscribe({
      next: (notice) => received.push(notice),
      error: (error) => errors.push(error),
    })
    try {
      await vi.waitFor(() => expect(received.map(({ identity }) => identity)).toContain('root-a'))

      selectedRoot = rootB
      server.runtimeInvalidation.invalidate(['context'])
      await vi.waitFor(() => expect(received.map(({ identity }) => identity)).toContain('root-b'))
      const retiredUnsubscribe = unsubscribeRegional[0]
      const retiredListener = regionalListeners[0]
      if (!retiredUnsubscribe || !retiredListener) {
        throw new Error('Expected the retired Root A regional subscription.')
      }
      expect(retiredUnsubscribe).toHaveBeenCalledOnce()

      retiredListener(lifecycleNotice('late-root-a'))
      await Promise.resolve()

      expect(errors).toEqual([])
      expect(received.map(({ identity }) => identity)).not.toContain('late-root-a')
    } finally {
      subscription.unsubscribe()
    }
  })
})
