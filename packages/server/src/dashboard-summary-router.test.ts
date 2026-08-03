/**
 * Orthogonal intents (updated 2026-08-03 Asia/Shanghai):
 * 1. Prove the public Dashboard Summary v2 Router serializes a real Server-owned wake-up.
 * 2. Prove the public typed pull correlates retained/current state without exposing Planning-root paths.
 * 3. Keep the fixture fully typed through createServer, createContext, and the tRPC caller.
 * 4. Prove a typed retained Pull reuses the current reactive Root snapshot instead of rerunning CLI resolution.
 *
 * Original request (2026-07-23): "在已有content的时候，服务端推送变更，然后客户端收到推送通知，于是开始加载更新数据。"
 * Original request (2026-07-27): "Dashboard页面每次页面刷新的时候，它仍然要加载很多？"
 * Original request (2026-08-01): OpenSpecUI 7 requires OpenSpec CLI 1.7 for live projection readiness.
 */
import {
  CliExecutor,
  CliContextSchema,
  CliDoctorSchema,
  parseCliCommandResult,
  type CliCommandResult,
  type DashboardSummaryInvalidation,
} from '@openspecui/core'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { ZodType } from 'zod'
import { appRouter } from './router.js'
import { createServer } from './server.js'

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

async function createSummaryRouterFixture() {
  const projectDir = await mkdtemp(join(tmpdir(), 'openspecui-dashboard-summary-router-'))
  await mkdir(join(projectDir, 'openspec'), { recursive: true })
  vi.spyOn(CliExecutor.prototype, 'execute').mockImplementation(async (args) => {
    const command = args.join(' ')
    if (command === 'config path') {
      return {
        success: true,
        stdout: `${join(projectDir, 'global-config.json')}\n`,
        stderr: '',
        exitCode: 0,
      }
    }
    if (command === 'config list --json') {
      return { success: true, stdout: '{}\n', stderr: '', exitCode: 0 }
    }
    if (command === 'config list') {
      return { success: true, stdout: '', stderr: '', exitCode: 0 }
    }
    return {
      success: false,
      stdout: '',
      stderr: `Unexpected Dashboard fixture command: ${command}`,
      exitCode: 1,
    }
  })
  const server = createServer({ projectDir, enableWatcher: false })
  vi.spyOn(server.cliExecutor, 'checkAvailability').mockResolvedValue({
    available: true,
    version: '1.7.0',
  })
  const doctorRoot = vi
    .spyOn(server.cliExecutor.contracts, 'doctorRoot')
    .mockImplementation(async () =>
      commandResult(
        {
          root: { path: projectDir, source: 'nearest', healthy: true, status: [] },
          store: null,
          references: [],
          status: [],
        },
        CliDoctorSchema
      )
    )
  const context = vi.spyOn(server.cliExecutor.contracts, 'context').mockImplementation(async () =>
    commandResult(
      {
        root: { path: projectDir, source: 'nearest', role: 'openspec_root' },
        members: [],
        status: [],
      },
      CliContextSchema
    )
  )

  return {
    projectDir,
    server,
    doctorRoot,
    context,
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
      await rm(projectDir, { recursive: true, force: true })
    },
  }
}

describe('public Dashboard Summary v2 Router', () => {
  it('publishes only a typed wake and returns a correlated opaque Summary read', async () => {
    const fixture = await createSummaryRouterFixture()
    let subscription: { unsubscribe(): void } | null = null

    try {
      const caller = appRouter.createCaller(fixture.server.createContext())
      const observable = await caller.dashboard.subscribeSummary()
      const wakes: DashboardSummaryInvalidation[] = []
      subscription = observable.subscribe({ next: (wake) => wakes.push(wake) })

      await vi.waitFor(
        () => expect(wakes.some((wake) => wake.state === 'ready')).toBe(true),
        { timeout: 5_000 }
      )
      const wake = wakes.find((candidate) => candidate.state === 'ready')
      if (!wake) throw new Error('Expected the initial Dashboard Summary wake.')
      const doctorCallsBeforePull = fixture.doctorRoot.mock.calls.length
      const contextCallsBeforePull = fixture.context.mock.calls.length
      const read = await caller.dashboard.getSummary()

      expect(wake).toEqual({
        identity: read.identity,
        workGeneration: read.workGeneration,
        snapshotGeneration: read.snapshotGeneration,
        state: read.state,
        cause: 'initial',
      })
      expect(wake).not.toHaveProperty('data')
      expect(wake).not.toHaveProperty('snapshot')
      expect(wake).not.toHaveProperty('batch')
      expect(wake).not.toHaveProperty('progress')
      expect(read.identity).not.toContain(fixture.projectDir)
      expect(read.freshness).toBe('current')
      expect(fixture.doctorRoot).toHaveBeenCalledTimes(doctorCallsBeforePull)
      expect(fixture.context).toHaveBeenCalledTimes(contextCallsBeforePull)
    } finally {
      subscription?.unsubscribe()
      await fixture.dispose()
    }
  })
})
