/**
 * Orthogonal intents (updated 2026-08-06 Asia/Shanghai):
 * 1. Prove the public Agent Router exposes complete projection without client-authored policy inputs.
 * 2. Prove structured policy mutation preserves environment-global extension fields and refreshes authority.
 * 3. Prove Agent Init streams use Server-owned profile policy and propagate cancellation to the CLI handle.
 * 4. Prove Init admission rejects unknown and unavailable registry ids before CLI execution.
 * 5. Prove refresh, Push, Update, Repair, and Windows fixture cleanup preserve exact owner settlement.
 *
 * Original request (2026-08-01): move Agent policy, inventory, Init/Update/repair, cancel, and Terminal evidence to Config.
 * Original request (2026-08-06): "Windows compatibility and adaptation, including the core and peripheral scripts."
 */

import {
  clearCache,
  type CliStreamHandle,
  type CliStreamSettlement,
  type EnvironmentGlobalProjectionData,
} from '@openspecui/core'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AgentDeliveryProjection } from './agent-delivery-projection-service.js'
import { appRouter } from './router.js'
import {
  disposeServerTestFixture,
  removeServerTestDirectories,
  SERVER_FIXTURE_TEST_TIMEOUT_MS,
} from './server-test-cleanup.js'
import { createServer } from './server.js'

const disposals: Array<() => Promise<void>> = []

function createDeferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
} {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, resolve, reject }
}

function environmentProjection(configPath: string): EnvironmentGlobalProjectionData {
  return {
    kind: 'environment-global',
    owner: {
      kind: 'runtime-environment',
      dataScope: {
        path: join(configPath, '..', 'data'),
        source: 'user-home-default',
        environmentVariable: null,
      },
    },
    configPath,
    config: {
      profile: 'core',
      delivery: 'both',
      workflows: ['propose'],
      teamExtension: { owner: 'platform' },
    },
    defaultStore: { state: 'absent', id: null },
    profileState: {
      available: true,
      profile: 'core',
      delivery: 'both',
      workflows: ['propose', 'explore', 'apply', 'update', 'sync', 'archive'],
      driftStatus: 'in-sync',
      warningText: null,
    },
    evidence: {
      path: { success: true, stdout: configPath, stderr: '', exitCode: 0 },
      config: {
        success: true,
        stdout: '',
        stderr: '',
        exitCode: 0,
        data: {},
        payload: {},
        diagnostics: [],
      },
      drift: { success: true, stdout: '', stderr: '', exitCode: 0 },
    },
  }
}

async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), 'openspecui-agent-router-'))
  const configPath = join(root, 'config.json')
  const server = createServer({ projectDir: root, enableWatcher: false })
  const releaseRoot = await server.observationEnvironment.acquireRoot(root)
  const environment = environmentProjection(configPath)
  vi.spyOn(server.environmentGlobalProjectionService, 'getCurrent').mockResolvedValue(environment)
  vi.spyOn(server.environmentGlobalProjectionService, 'subscribe').mockReturnValue({
    unsubscribe() {},
  })
  vi.spyOn(server.cliExecutor, 'checkAvailability').mockResolvedValue({
    available: true,
    version: '1.9.0',
  })
  disposals.push(async () => {
    vi.restoreAllMocks()
    await releaseRoot()
    await disposeServerTestFixture(server)
    clearCache()
    await removeServerTestDirectories([root])
  })
  return { configPath, environment, server }
}

afterEach(async () => {
  for (const dispose of disposals.splice(0)) await dispose()
}, SERVER_FIXTURE_TEST_TIMEOUT_MS)

describe('agentIntegrationsRouter', () => {
  it('removes generic CLI Init and Update transports that bypass the Agent owner', async () => {
    const fixture = await createFixture()
    const caller = appRouter.createCaller(fixture.server.createContext())

    for (const bypass of ['init', 'initStream', 'update', 'updateStream']) {
      expect(caller.cli).not.toHaveProperty(bypass)
    }
  })

  it('returns the complete registry and Environment-owned policy without browser inputs', async () => {
    const fixture = await createFixture()
    const projection = await appRouter
      .createCaller(fixture.server.createContext())
      .agentIntegrations.get()

    expect(projection.registry).toHaveLength(38)
    expect(projection.policy).toEqual({
      profile: 'core',
      delivery: 'both',
      workflows: ['propose', 'explore', 'apply', 'update', 'sync', 'archive'],
    })
    expect(projection.registry.find((tool) => tool.value === 'codex')).toMatchObject({
      capability: 'skills-invocable',
      command: null,
      skillsDir: '.agents',
      legacySkillsDirs: ['.codex'],
    })
    expect(projection.registry.find((tool) => tool.value === 'agents')).toMatchObject({
      available: true,
      capability: 'skills-invocable',
    })
  })

  it('delegates explicit refresh and returns the complete replacement projection', async () => {
    const fixture = await createFixture()
    const replacement = {
      registry: [],
      policy: { profile: 'custom', delivery: 'skills', workflows: ['verify'] },
      states: [],
    } satisfies AgentDeliveryProjection
    const refresh = vi
      .spyOn(fixture.server.agentDeliveryProjectionService, 'refresh')
      .mockResolvedValue(replacement)

    const result = await appRouter
      .createCaller(fixture.server.createContext())
      .agentIntegrations.refresh()

    expect(refresh).toHaveBeenCalledOnce()
    expect(result).toEqual(replacement)
  })

  it('projects replacement Push events and retires the Server subscription on detach', async () => {
    const fixture = await createFixture()
    const replacement = {
      registry: [],
      policy: { profile: 'core', delivery: 'both', workflows: ['apply'] },
      states: [],
    } satisfies AgentDeliveryProjection
    const unsubscribe = vi.fn()
    vi.spyOn(fixture.server.agentDeliveryProjectionService, 'subscribe').mockImplementation(
      (listener) => {
        listener({ type: 'snapshot', projection: replacement })
        return { unsubscribe }
      }
    )
    const observable = await appRouter
      .createCaller(fixture.server.createContext())
      .agentIntegrations.subscribe()
    const pushed = createDeferred<AgentDeliveryProjection>()
    const subscription = observable.subscribe({
      next: pushed.resolve,
      error: pushed.reject,
    })

    await expect(pushed.promise).resolves.toEqual(replacement)
    subscription.unsubscribe()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })

  it('preserves extension fields while updating official Agent policy', async () => {
    const fixture = await createFixture()
    const execute = vi.spyOn(fixture.server.cliExecutor, 'execute').mockResolvedValue({
      success: true,
      stdout: fixture.configPath,
      stderr: '',
      exitCode: 0,
    })
    const replacement = {
      registry: [],
      policy: { profile: 'custom', delivery: 'skills', workflows: ['verify', 'onboard'] },
      states: [],
    } satisfies AgentDeliveryProjection
    const refresh = vi
      .spyOn(fixture.server.agentDeliveryProjectionService, 'refresh')
      .mockResolvedValue(replacement)

    const result = await appRouter
      .createCaller(fixture.server.createContext())
      .agentIntegrations.updatePolicy({
        profile: 'custom',
        delivery: 'skills',
        workflows: ['onboard', 'verify'],
      })

    expect(execute).toHaveBeenCalledWith(['config', 'path'])
    expect(JSON.parse(await readFile(fixture.configPath, 'utf8'))).toEqual({
      profile: 'custom',
      delivery: 'skills',
      workflows: ['verify', 'onboard'],
      teamExtension: { owner: 'platform' },
    })
    expect(refresh).toHaveBeenCalledOnce()
    expect(result).toEqual(replacement)
  })

  it('uses Server-owned profile policy and cancels a detached Init stream', async () => {
    const fixture = await createFixture()
    const terminal = createDeferred<CliStreamSettlement>()
    const cancel = vi.fn(() => terminal.promise)
    const handle = { settled: terminal.promise, cancel } satisfies CliStreamHandle
    const initStream = vi.spyOn(fixture.server.cliExecutor, 'initStream').mockReturnValue(handle)
    vi.spyOn(fixture.server.agentDeliveryProjectionService, 'getCurrent').mockResolvedValue({
      registry: [],
      policy: { profile: 'custom', delivery: 'commands', workflows: ['verify'] },
      states: [],
    })
    const stream = await appRouter
      .createCaller(fixture.server.createContext())
      .agentIntegrations.initStream({ tools: ['claude'] })
    const subscription = stream.subscribe({ error() {} })

    await vi.waitFor(() =>
      expect(initStream).toHaveBeenCalledWith(
        { tools: ['claude'], profile: 'custom', force: undefined },
        expect.any(Function)
      )
    )
    subscription.unsubscribe()
    terminal.resolve({ reason: 'cancelled', exitCode: null })
    await vi.waitFor(() => expect(cancel).toHaveBeenCalledOnce())
  })

  it('binds Update to the exact CLI command and completes on its terminal settlement', async () => {
    const fixture = await createFixture()
    const terminal = createDeferred<CliStreamSettlement>()
    const cancel = vi.fn(() => terminal.promise)
    const executeStream = vi
      .spyOn(fixture.server.cliExecutor, 'executeStream')
      .mockReturnValue({ settled: terminal.promise, cancel })
    const observable = await appRouter
      .createCaller(fixture.server.createContext())
      .agentIntegrations.updateStream()
    const completed = createDeferred<void>()
    const subscription = observable.subscribe({
      complete: () => completed.resolve(),
      error: completed.reject,
    })

    await vi.waitFor(() =>
      expect(executeStream).toHaveBeenCalledWith(['update'], expect.any(Function))
    )
    const onEvent = executeStream.mock.calls[0]?.[1]
    if (!onEvent) throw new Error('Update CLI event owner was not bound.')
    onEvent({ type: 'exit', exitCode: 0 })
    terminal.resolve({ reason: 'exited', exitCode: 0 })

    await expect(completed.promise).resolves.toBeUndefined()
    expect(cancel).toHaveBeenCalledOnce()
    subscription.unsubscribe()
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('binds Repair to forced Update and cancels the owned CLI handle on detach', async () => {
    const fixture = await createFixture()
    const terminal = createDeferred<CliStreamSettlement>()
    const cancel = vi.fn(() => terminal.promise)
    const executeStream = vi
      .spyOn(fixture.server.cliExecutor, 'executeStream')
      .mockReturnValue({ settled: terminal.promise, cancel })
    const observable = await appRouter
      .createCaller(fixture.server.createContext())
      .agentIntegrations.repairStream()
    const subscription = observable.subscribe({ error() {} })

    await vi.waitFor(() =>
      expect(executeStream).toHaveBeenCalledWith(['update', '--force'], expect.any(Function))
    )
    subscription.unsubscribe()
    terminal.resolve({ reason: 'cancelled', exitCode: null })

    await vi.waitFor(() => expect(cancel).toHaveBeenCalledOnce())
    await expect(terminal.promise).resolves.toEqual({ reason: 'cancelled', exitCode: null })
  })

  it.each(['not-a-real-agent'])(
    'rejects unavailable Agent Init id %s before CLI execution',
    async (toolId) => {
      const fixture = await createFixture()
      const initStream = vi.spyOn(fixture.server.cliExecutor, 'initStream')

      await expect(
        appRouter
          .createCaller(fixture.server.createContext())
          .agentIntegrations.initStream({ tools: [toolId] })
      ).rejects.toThrow('Agent tool must be an available OpenSpec 1.9 registry id.')
      expect(initStream).not.toHaveBeenCalled()
    }
  )
})
