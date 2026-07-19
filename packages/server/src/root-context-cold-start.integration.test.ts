/**
 * Orthogonal intents (created 2026-07-19 Asia/Shanghai):
 * 1. Separate HTTP server readiness from pinned OpenSpec CLI root resolution.
 * 2. Exercise typed HTTP and WebSocket Root Context contracts from a cold fixture.
 * 3. Preserve pinned CLI runner start/exit timing for timeout classification.
 *
 * Original request (2026-07-19): "设计并（必要时）实现一个 type-safe、可 checked 的
 * cold-start/rootContext HTTP+WS fixture test，隔离 pinned OpenSpec 1.6 CLI。"
 * Derived requirement (2026-07-19): Checkpoint 6.11 needs bounded startup/readiness evidence.
 */
import {
  ConfigManager,
  type RootContextResolvedState,
  type RootContextState,
} from '@openspecui/core'
import { createTRPCClient, createWSClient, httpBatchLink, wsLink } from '@trpc/client'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
import WebSocket from 'ws'
import { z } from 'zod'
import { findAvailablePort } from './port-utils.js'
import type { AppRouter, RunningServer } from './server.js'
import { startServer } from './server.js'

const execFileAsync = promisify(execFile)
const CLI_BIN = resolve(import.meta.dirname, '../node_modules/openspec-cli-16/bin/openspec.js')

const temporaryDirs: string[] = []
const runningServers: RunningServer[] = []
const wsClients: Array<ReturnType<typeof createWSClient>> = []

interface RuntimePaths {
  globalSettingsPath: string
  translationCacheDatabasePath: string
}

const RunnerTraceSchema = z.object({
  phase: z.enum(['start', 'exit']),
  args: z.array(z.string()),
  at: z.number(),
  code: z.number().nullable().optional(),
})

function timeoutAfter(milliseconds: number, label: string): Promise<never> {
  return new Promise((_, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for ${label}.`)),
      milliseconds
    )
    timer.unref?.()
  })
}

function createDeferred<T>(): {
  promise: Promise<T>
  resolve(value: T): void
  reject(reason?: unknown): void
} {
  let resolvePromise: ((value: T) => void) | undefined
  let rejectPromise: ((reason?: unknown) => void) | undefined
  const promise = new Promise<T>((resolveNext, rejectNext) => {
    resolvePromise = resolveNext
    rejectPromise = rejectNext
  })
  return {
    promise,
    resolve(value) {
      if (!resolvePromise) throw new Error('Deferred resolver is not initialized.')
      resolvePromise(value)
    },
    reject(reason) {
      if (!rejectPromise) throw new Error('Deferred rejecter is not initialized.')
      rejectPromise(reason)
    },
  }
}

function isReadyRootState(state: RootContextState): state is RootContextState & { state: 'ready' } {
  return state.state === 'ready'
}

async function runPinnedCli(
  args: readonly string[],
  cwd: string,
  env: NodeJS.ProcessEnv
): Promise<void> {
  await execFileAsync(process.execPath, [CLI_BIN, ...args], {
    cwd,
    env,
    maxBuffer: 4 * 1024 * 1024,
    timeout: 30_000,
  })
}

function buildFixtureEnv(dataHome: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    HOME: join(dataHome, 'home'),
    XDG_CONFIG_HOME: join(dataHome, 'config'),
    XDG_DATA_HOME: dataHome,
    XDG_STATE_HOME: join(dataHome, 'state'),
    XDG_CACHE_HOME: join(dataHome, 'cache'),
    OPEN_SPEC_INTERACTIVE: '0',
    OPENSPEC_TELEMETRY: '0',
    NO_COLOR: '1',
  }
}

async function writePinnedRunner(
  launchProject: string,
  dataHome: string,
  tracePath: string
): Promise<string> {
  const runnerPath = join(launchProject, 'pinned-openspec-runner.cjs')
  const runnerSource = `
const fs = require('node:fs')
const cliPath = ${JSON.stringify(CLI_BIN)}
const dataHome = ${JSON.stringify(dataHome)}
const tracePath = ${JSON.stringify(tracePath)}
const args = process.argv.slice(2)
const writeTrace = (event) => fs.appendFileSync(tracePath, JSON.stringify(event) + '\\n')
writeTrace({ phase: 'start', args, at: Date.now() })
process.env.XDG_DATA_HOME = dataHome
process.env.OPEN_SPEC_INTERACTIVE = '0'
process.env.OPENSPEC_TELEMETRY = '0'
process.env.NO_COLOR = '1'
process.on('exit', (code) => writeTrace({ phase: 'exit', args, at: Date.now(), code }))
import(cliPath)
`
  await writeFile(runnerPath, runnerSource, 'utf8')
  return runnerPath
}

function runtimePaths(base: string): RuntimePaths {
  return {
    globalSettingsPath: join(base, 'settings.json'),
    translationCacheDatabasePath: join(base, 'translation-cache.sqlite'),
  }
}

function rootStateReady(state: RootContextResolvedState): RootContextResolvedState & {
  state: 'ready'
} {
  if (state.state !== 'ready') {
    throw new Error(`Root Context did not become ready: ${JSON.stringify(state)}`)
  }
  return state
}

describe('pinned OpenSpec 1.6 Root Context cold start', () => {
  afterEach(async () => {
    for (const client of wsClients.splice(0)) client.close()
    await Promise.all(runningServers.splice(0).map((server) => server.close()))
    await Promise.all(
      temporaryDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
    )
  })

  it('separates HTTP readiness from typed HTTP/WS Root Context readiness', async () => {
    const base = await mkdtemp(join(tmpdir(), 'openspecui-root-cold-start-'))
    temporaryDirs.push(base)
    const launchProject = join(base, 'launch')
    const planningRoot = join(base, 'planning')
    const dataHome = join(base, 'data')
    const runtimeDir = join(base, 'runtime')
    const tracePath = join(base, 'runner-trace.jsonl')
    const env = buildFixtureEnv(dataHome)
    const previousDataHome = process.env.XDG_DATA_HOME
    process.env.XDG_DATA_HOME = dataHome

    try {
      await mkdir(join(launchProject, 'openspec'), { recursive: true })
      await runPinnedCli(
        ['store', 'setup', 'plan-a', '--path', planningRoot, '--no-init-git', '--json'],
        launchProject,
        env
      )
      await writeFile(join(launchProject, 'openspec', 'config.yaml'), 'store: plan-a\n', 'utf8')
      const planningRootPath = await realpath(planningRoot)
      const runnerPath = await writePinnedRunner(launchProject, dataHome, tracePath)
      await new ConfigManager(launchProject).writeConfig({
        cli: { command: `${process.execPath} ${runnerPath}` },
      })

      const serverStartedAt = Date.now()
      const server = await startServer({
        projectDir: launchProject,
        port: await findAvailablePort(35_100, 100),
        enableWatcher: false,
        runtimePaths: runtimePaths(runtimeDir),
      })
      runningServers.push(server)
      const serverReadyAt = Date.now()
      expect(serverReadyAt - serverStartedAt).toBeLessThan(5_000)

      const healthResponse = await Promise.race([
        fetch(`${server.url}/api/health`),
        timeoutAfter(5_000, 'HTTP health readiness'),
      ])
      expect(healthResponse.ok).toBe(true)
      await expect(healthResponse.json()).resolves.toMatchObject({ status: 'ok' })

      const httpClient = createTRPCClient<AppRouter>({
        links: [httpBatchLink({ url: `${server.url}/trpc` })],
      })
      const wsClient = createWSClient({
        url: `ws://localhost:${server.port}/trpc`,
        WebSocket: WebSocket as unknown as typeof globalThis.WebSocket,
      })
      wsClients.push(wsClient)
      const typedWsClient = createTRPCClient<AppRouter>({ links: [wsLink({ client: wsClient })] })
      const wsReady = createDeferred<RootContextResolvedState & { state: 'ready' }>()
      const wsStates: RootContextState['state'][] = []
      const subscription = typedWsClient.rootContext.subscribe.subscribe(undefined, {
        onData(state: RootContextState) {
          wsStates.push(state.state)
          if (isReadyRootState(state)) wsReady.resolve(state)
        },
        onError: wsReady.reject,
      })

      const httpQueryStartedAt = Date.now()
      const httpState = rootStateReady(
        await Promise.race([
          httpClient.rootContext.get.query(),
          timeoutAfter(20_000, 'HTTP Root Context query'),
        ])
      )
      const httpQueryFinishedAt = Date.now()
      const wsState = await Promise.race([
        wsReady.promise,
        timeoutAfter(20_000, 'WebSocket Root Context subscription'),
      ])
      subscription.unsubscribe()

      expect(httpState.data).toMatchObject({
        planningRoot: { path: planningRootPath, source: 'declared', store_id: 'plan-a' },
        storeId: 'plan-a',
        cli: { available: true, version: '1.6.0' },
      })
      expect(wsState.data).toMatchObject({
        planningRoot: { path: planningRootPath, source: 'declared', store_id: 'plan-a' },
        storeId: 'plan-a',
        cli: { available: true, version: '1.6.0' },
      })
      expect(wsStates).toContain('ready')

      const traceContent = await readFile(tracePath, 'utf8')
      const traces = traceContent
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => RunnerTraceSchema.parse(JSON.parse(line)))
      expect(
        traces.some((trace) => trace.phase === 'start' && trace.args.includes('--version'))
      ).toBe(true)
      expect(traces.some((trace) => trace.phase === 'start' && trace.args[0] === 'doctor')).toBe(
        true
      )
      expect(traces.some((trace) => trace.phase === 'start' && trace.args[0] === 'context')).toBe(
        true
      )
      expect(httpQueryFinishedAt).toBeGreaterThanOrEqual(httpQueryStartedAt)
      expect(serverReadyAt).toBeLessThanOrEqual(httpQueryStartedAt)
    } finally {
      if (previousDataHome === undefined) delete process.env.XDG_DATA_HOME
      else process.env.XDG_DATA_HOME = previousDataHome
    }
  }, 60_000)
})
