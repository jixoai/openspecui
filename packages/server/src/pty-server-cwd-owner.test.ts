/**
 * Orthogonal intents (created 2026-07-20 Asia/Shanghai):
 * 1. Prove production Server composition resolves Launch and current Planning cwd at PTY spawn.
 *
 * Original request (2026-07-16): "3.8 Terminal exposes explicit launch-project cwd and planning-root cwd while preserving inherited XDG_DATA_HOME"
 * Review correction (2026-07-20): production cwd evidence must cross createWebSocketServer and PlanningRootServiceManager.runOperation.
 */
import type { IEvent, IPty } from '@lydell/node-pty'
import {
  CliContextSchema,
  CliDoctorSchema,
  PtyServerMessageSchema,
  parseCliCommandResult,
  type CliCommandResult,
  type PtyServerMessage,
} from '@openspecui/core'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { createServer as createHttpServer, type Server as HttpServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import WebSocket, { type RawData } from 'ws'
import type { ZodType } from 'zod'
import { createServer as createApplicationServer, createWebSocketServer } from './server.js'

const { spawnMock } = vi.hoisted(() => ({
  spawnMock: vi.fn<typeof import('@lydell/node-pty').spawn>(),
}))

vi.mock('@lydell/node-pty', () => ({
  spawn: spawnMock,
}))

interface ProductionSocketHarness {
  client: WebSocket
  httpServer: HttpServer
  runtime: Awaited<ReturnType<typeof createWebSocketServer>>
  tempDir: string
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

function createPtyEvent<T>(): IEvent<T> {
  return () => ({ dispose: () => {} })
}

function createMockPty(): IPty {
  return {
    pid: 42,
    cols: 80,
    rows: 24,
    process: 'mock-shell',
    handleFlowControl: false,
    onData: createPtyEvent<string>(),
    onExit: createPtyEvent<{ exitCode: number; signal?: number }>(),
    resize: () => {},
    clear: () => {},
    write: () => {},
    kill: () => {},
    pause: () => {},
    resume: () => {},
  }
}

function waitForOpen(client: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    client.once('open', resolve)
    client.once('error', reject)
  })
}

function waitForHttpListening(server: HttpServer): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
}

function waitForMessage(client: WebSocket): Promise<PtyServerMessage> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => {
      client.off('message', onMessage)
      reject(error)
    }
    const onMessage = (raw: RawData) => {
      client.off('error', onError)
      try {
        const payload: unknown = JSON.parse(raw.toString())
        resolve(PtyServerMessageSchema.parse(payload))
      } catch (error) {
        reject(error)
      }
    }
    client.once('error', onError)
    client.once('message', onMessage)
  })
}

function closeHttpServer(server: HttpServer): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error)
      else resolve()
    })
  })
}

async function disposeProductionSocketHarness(harness: ProductionSocketHarness): Promise<void> {
  harness.client.terminate()
  await harness.runtime.close()
  await closeHttpServer(harness.httpServer)
  await rm(harness.tempDir, { recursive: true, force: true })
}

describe('production PTY cwd owner', () => {
  const harnesses: ProductionSocketHarness[] = []

  beforeEach(() => {
    spawnMock.mockReset()
    spawnMock.mockImplementation(() => createMockPty())
  })

  afterEach(async () => {
    await Promise.all(harnesses.splice(0).map(disposeProductionSocketHarness))
    vi.restoreAllMocks()
  })

  it('resolves Launch and changing Planning cwd through the production Server owner', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'openspecui-pty-cwd-owner-'))
    const launchRoot = join(tempDir, 'launch')
    const planningRootA = join(tempDir, 'planning-a')
    const planningRootB = join(tempDir, 'planning-b')
    const runtimeDir = join(tempDir, 'runtime')
    await Promise.all(
      [launchRoot, planningRootA, planningRootB].map((root) =>
        mkdir(join(root, 'openspec'), { recursive: true })
      )
    )
    await mkdir(runtimeDir, { recursive: true })

    const server = createApplicationServer({
      projectDir: launchRoot,
      enableWatcher: false,
      runtimePaths: {
        globalSettingsPath: join(runtimeDir, 'settings.json'),
        translationCacheDatabasePath: join(runtimeDir, 'translations.sqlite'),
        localModelCacheDir: join(runtimeDir, 'models'),
        localModelAssetIndexPath: join(runtimeDir, 'models.json'),
        localModelProfileManifestPath: join(runtimeDir, 'model-profiles.json'),
        localModelFetchCachePath: join(runtimeDir, 'model-fetch.json'),
        localCt2ModelCacheDir: join(runtimeDir, 'ct2-models'),
        localCt2ModelAssetIndexPath: join(runtimeDir, 'ct2-models.json'),
        localCt2ModelProfileManifestPath: join(runtimeDir, 'ct2-model-profiles.json'),
        localCt2ModelFetchCachePath: join(runtimeDir, 'ct2-model-fetch.json'),
        localLlamaModelCacheDir: join(runtimeDir, 'llama-models'),
        localLlamaModelAssetIndexPath: join(runtimeDir, 'llama-models.json'),
        localLlamaModelProfileManifestPath: join(runtimeDir, 'llama-model-profiles.json'),
        localLlamaModelFetchCachePath: join(runtimeDir, 'llama-model-fetch.json'),
      },
    })
    let planningRoot = planningRootA
    vi.spyOn(server.cliExecutor, 'checkAvailability').mockResolvedValue({
      available: true,
      version: '1.6.0',
    })
    vi.spyOn(server.cliExecutor.contracts, 'doctorRoot').mockImplementation(async () =>
      commandResult(
        {
          root: { path: planningRoot, source: 'nearest', healthy: true, status: [] },
          store: null,
          references: [],
          status: [],
        },
        CliDoctorSchema
      )
    )
    vi.spyOn(server.cliExecutor.contracts, 'context').mockImplementation(async () =>
      commandResult(
        {
          root: { path: planningRoot, source: 'nearest', role: 'openspec_root' },
          members: [],
          status: [],
        },
        CliContextSchema
      )
    )
    const runOperation = vi.spyOn(server.planningRootServices, 'runOperation')

    const httpServer = createHttpServer()
    httpServer.listen(0, '127.0.0.1')
    await waitForHttpListening(httpServer)
    const address = httpServer.address()
    if (!address || typeof address === 'string') throw new Error('Expected TCP server address')
    const runtime = await createWebSocketServer(server, httpServer, { projectDir: launchRoot })
    const client = new WebSocket(`ws://127.0.0.1:${address.port}/ws/pty`)
    const harness = { client, httpServer, runtime, tempDir }
    harnesses.push(harness)
    await waitForOpen(client)

    const launchReply = waitForMessage(client)
    client.send(
      JSON.stringify({ type: 'create', requestId: 'launch-terminal', cwdTarget: 'launch-project' })
    )
    await expect(launchReply).resolves.toMatchObject({
      type: 'created',
      requestId: 'launch-terminal',
      cwdTarget: 'launch-project',
      initialCwd: launchRoot,
    })

    const planningAReply = waitForMessage(client)
    client.send(
      JSON.stringify({
        type: 'create',
        requestId: 'planning-a-terminal',
        cwdTarget: 'planning-root',
      })
    )
    expect.soft(await planningAReply).toMatchObject({
      type: 'created',
      requestId: 'planning-a-terminal',
      cwdTarget: 'planning-root',
      initialCwd: planningRootA,
    })

    const planningAState = await server.planningRootServices.resolveRootContext()
    if (planningAState.state !== 'ready' || !planningAState.data.generation) {
      throw new Error('Expected Planning-root A generation evidence.')
    }
    planningRoot = planningRootB

    const staleGenerationReply = waitForMessage(client)
    client.send(
      JSON.stringify({
        type: 'create',
        requestId: 'planning-stale-terminal',
        cwdTarget: 'planning-root',
        expectedRootGeneration: planningAState.data.generation,
      })
    )
    await expect(staleGenerationReply).resolves.toMatchObject({
      type: 'error',
      code: 'PTY_CREATE_FAILED',
      sessionId: 'planning-stale-terminal',
    })

    const planningBReply = waitForMessage(client)
    client.send(
      JSON.stringify({
        type: 'create',
        requestId: 'planning-b-terminal',
        cwdTarget: 'planning-root',
      })
    )
    expect.soft(await planningBReply).toMatchObject({
      type: 'created',
      requestId: 'planning-b-terminal',
      cwdTarget: 'planning-root',
      initialCwd: planningRootB,
    })

    expect
      .soft(spawnMock.mock.calls.map((call) => call[2].cwd))
      .toEqual([launchRoot, planningRootA, planningRootB])
    expect(runOperation).toHaveBeenCalledTimes(3)
  })
})
