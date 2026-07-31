/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Prove server startup publishes its actual bound port and keeps the canonical embedded entry available while runtime observers warm up.
 * 2. Prove shutdown awaits HTTP settlement, remains idempotent, and continues across independent owner failures.
 * 3. Prove backend shutdown settles attached Planning-root streams and buffered projection CLI children without client cooperation.
 * 4. Prove preview assets remain bound to the current Planning-root lifecycle.
 * 5. Prove Root Context health records stay Server-local and retire with the running Server lifecycle.
 *
 * Original request (2026-07-17): "Backend disposal actively cancels every owned stream and awaits settlement."
 * Original checkpoint (2026-07-16): "6.15 Notifications remain project-backend scoped and add root/context health without cross-backend record merging."
 * Owner-reported defect (2026-07-26): "a内容还没加载出来，页面就自动刷新了。"
 * Built-runtime defect (2026-07-30): Direct Web shutdown must await HTTP closure and retire non-cooperative WebSocket and buffered CLI children after one signal.
 * Owner-reported defect (2026-07-31): A managed directory launch published `http://localhost:0`, leaving its Workspace permanently offline.
 * Owner-reported defect (2026-07-31): A healthy external dev backend appeared offline because the dynamic local App origin was rejected by CORS.
 */
import {
  ConfigManager,
  isHostedBackendHealthResponse,
  type CliCommandResult,
  type CliContext,
  type CliDoctor,
  type RootContext,
  type RootContextState,
} from '@openspecui/core'
import { createTRPCClient, createWSClient, wsLink } from '@trpc/client'
import { observable, type Observer } from '@trpc/server/observable'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import WebSocket from 'ws'

const coreMockState = vi.hoisted(() => ({
  acquireObservationRoot: vi.fn<() => Promise<() => Promise<void>>>(),
  disposeObservationEnvironment: vi.fn<() => Promise<void>>(),
  acquireInvalidationRoot: vi.fn(() => () => {}),
  disposeProjectInvalidation: vi.fn(),
  startDataHomeObservation: vi.fn<() => Promise<void>>(),
  disposeDataHomeObservation: vi.fn<() => Promise<void>>(),
}))

vi.mock('@openspecui/core', async () => {
  const actual = await vi.importActual<typeof import('@openspecui/core')>('@openspecui/core')
  return {
    ...actual,
    ReactiveObservationEnvironment: class {
      acquireRoot = coreMockState.acquireObservationRoot
      dispose = coreMockState.disposeObservationEnvironment
      getRoots = () => []
    },
    RuntimeRootInvalidationRegistry: class {
      acquireRoot = coreMockState.acquireInvalidationRoot
      dispose = coreMockState.disposeProjectInvalidation
    },
    OpenSpecDataHomeObserver: class extends actual.RuntimeInvalidationIndex {
      start = coreMockState.startDataHomeObservation
      dispose = coreMockState.disposeDataHomeObservation
      getState = () => 'active' as const
    },
  }
})

import type { NotificationService } from './notification-service.js'
import { findAvailablePort } from './port-utils.js'
import { createServer, startServer, type AppRouter, type RunningServer } from './server.js'

const tempDirs: string[] = []
const runningServers: RunningServer[] = []
const wsClients: Array<ReturnType<typeof createWSClient>> = []

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

function createRootContext(path: string, generation: string, observedAt: number): RootContext {
  return {
    launchProject: { path: '/launch' },
    planningRoot: { path, source: 'nearest', healthy: true, status: [] },
    storeId: null,
    generation,
    cli: { available: true, version: '1.6.0' },
    references: [],
    contextMembers: [],
    dataScope: {
      path: '/data/openspec',
      source: 'xdg-data-home',
      environmentVariable: 'XDG_DATA_HOME',
    },
    diagnostics: { root: [], doctor: [], context: [] },
    evidence: { doctor: null, context: null },
    observedAt,
  }
}

function readyRootContext(path: string, generation: string, observedAt: number): RootContextState {
  return {
    state: 'ready',
    data: createRootContext(path, generation, observedAt),
    attempt: null,
    error: null,
    observedAt,
  }
}

function failedRootContext(path: string, generation: string, observedAt: number): RootContextState {
  return {
    state: 'error',
    data: null,
    attempt: createRootContext(path, generation, observedAt),
    error: { code: 'root-unhealthy', message: 'Fixture failure.' },
    observedAt,
  }
}

function createControlledRootContextObservable() {
  let observer: Observer<RootContextState, unknown> | null = null
  return {
    source: observable<RootContextState>((next) => {
      observer = next
      return () => undefined
    }),
    emit(state: RootContextState): void {
      observer?.next(state)
    },
    emitLate(state: RootContextState): void {
      observer?.next(state)
    },
  }
}

function removeRunningServer(server: RunningServer): void {
  const index = runningServers.indexOf(server)
  if (index >= 0) runningServers.splice(index, 1)
}

afterEach(async () => {
  for (const client of wsClients.splice(0)) client.close()
  await Promise.all(runningServers.splice(0).map((server) => server.close()))
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
  vi.clearAllMocks()
})

async function createProjectDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'openspecui-server-startup-'))
  tempDirs.push(dir)
  return dir
}

describe('server startup runtime contract', () => {
  it('publishes the actual OS-assigned port when the preferred port is zero', async () => {
    coreMockState.acquireObservationRoot.mockResolvedValue(async () => {})
    coreMockState.disposeObservationEnvironment.mockResolvedValue(undefined)
    coreMockState.startDataHomeObservation.mockResolvedValue(undefined)
    coreMockState.disposeDataHomeObservation.mockResolvedValue(undefined)
    const projectDir = await createProjectDir()

    const started = await startServer({ projectDir, port: 0, enableWatcher: false })
    runningServers.push(started)

    expect(started.preferredPort).toBe(0)
    expect(started.port).toBeGreaterThan(0)
    expect(new URL(started.url).port).toBe(String(started.port))
    expect((await fetch(`${started.url}/api/health`)).ok).toBe(true)
  })

  it('admits dynamic loopback App origins without admitting arbitrary remote origins', async () => {
    coreMockState.acquireObservationRoot.mockResolvedValue(async () => {})
    coreMockState.disposeObservationEnvironment.mockResolvedValue(undefined)
    coreMockState.startDataHomeObservation.mockResolvedValue(undefined)
    coreMockState.disposeDataHomeObservation.mockResolvedValue(undefined)
    const projectDir = await createProjectDir()
    const started = await startServer({
      projectDir,
      port: await findAvailablePort(34_900, 100),
      enableWatcher: false,
    })
    runningServers.push(started)

    const loopbackOrigin = 'http://127.0.0.1:61594'
    const loopback = await fetch(`${started.url}/api/health`, {
      headers: { Origin: loopbackOrigin },
    })
    expect(loopback.headers.get('access-control-allow-origin')).toBe(loopbackOrigin)

    const remote = await fetch(`${started.url}/api/health`, {
      headers: { Origin: 'https://untrusted.example' },
    })
    expect(remote.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('returns before background warmup tasks are allowed to start', async () => {
    coreMockState.acquireObservationRoot.mockResolvedValue(async () => {})
    coreMockState.disposeObservationEnvironment.mockResolvedValue(undefined)
    coreMockState.startDataHomeObservation.mockResolvedValue(undefined)
    coreMockState.disposeDataHomeObservation.mockResolvedValue(undefined)
    const projectDir = await createProjectDir()
    const port = await findAvailablePort(34_800, 100)

    const started = await startServer({
      projectDir,
      port,
      enableWatcher: false,
    })
    runningServers.push(started)

    expect(coreMockState.acquireObservationRoot).not.toHaveBeenCalled()
    expect(coreMockState.startDataHomeObservation).not.toHaveBeenCalled()
    expect(coreMockState.acquireInvalidationRoot).toHaveBeenCalledWith(projectDir)

    await started.close()
    runningServers.pop()
    expect(coreMockState.disposeProjectInvalidation).toHaveBeenCalled()
  })

  it('returns a healthy HTTP runtime before watcher initialization resolves', async () => {
    coreMockState.acquireObservationRoot.mockReturnValue(new Promise(() => {}))
    coreMockState.disposeObservationEnvironment.mockResolvedValue(undefined)
    coreMockState.startDataHomeObservation.mockResolvedValue(undefined)
    coreMockState.disposeDataHomeObservation.mockResolvedValue(undefined)
    const projectDir = await createProjectDir()
    const port = await findAvailablePort(34_700, 100)

    const started = await startServer({
      projectDir,
      port,
      enableWatcher: false,
    })
    runningServers.push(started)

    const healthResponse = await fetch(`${started.url}/api/health`)
    expect(healthResponse.ok).toBe(true)
    const health: unknown = await healthResponse.json()
    if (!isHostedBackendHealthResponse(health)) {
      throw new Error('Expected a supported hosted backend health response.')
    }
    expect(new URL(health.embeddedUiUrl).pathname).toBe('/dashboard')
    expect(coreMockState.acquireObservationRoot).toHaveBeenCalledWith(projectDir)
    expect(coreMockState.startDataHomeObservation).toHaveBeenCalledTimes(1)
  })

  it('continues final teardown after one owner fails and memoizes the result', async () => {
    coreMockState.acquireObservationRoot.mockResolvedValue(async () => {})
    coreMockState.disposeObservationEnvironment.mockResolvedValue(undefined)
    coreMockState.startDataHomeObservation.mockResolvedValue(undefined)
    coreMockState.disposeDataHomeObservation.mockRejectedValue(
      new Error('data-home teardown failed')
    )
    const projectDir = await createProjectDir()
    const port = await findAvailablePort(34_600, 100)
    const started = await startServer({
      projectDir,
      port,
      enableWatcher: false,
    })

    const firstClose = started.close()
    expect(started.close()).toBe(firstClose)
    await expect(firstClose).rejects.toBeInstanceOf(AggregateError)
    expect(coreMockState.disposeDataHomeObservation).toHaveBeenCalledOnce()
    expect(coreMockState.disposeProjectInvalidation).toHaveBeenCalledOnce()
    expect(coreMockState.disposeObservationEnvironment).toHaveBeenCalledOnce()
  })

  it('keeps Root Context health records Server-local and retires held observers during running-server close', async () => {
    coreMockState.acquireObservationRoot.mockResolvedValue(async () => {})
    coreMockState.disposeObservationEnvironment.mockResolvedValue(undefined)
    coreMockState.startDataHomeObservation.mockResolvedValue(undefined)
    coreMockState.disposeDataHomeObservation.mockResolvedValue(undefined)
    vi.useFakeTimers()
    const [projectA, projectB] = await Promise.all([createProjectDir(), createProjectDir()])
    const [portA, portB] = await Promise.all([
      findAvailablePort(34_400, 100),
      findAvailablePort(34_200, 100),
    ])
    const sourceA = createControlledRootContextObservable()
    const sourceB = createControlledRootContextObservable()
    const notificationServices: {
      a: NotificationService | null
      b: NotificationService | null
    } = { a: null, b: null }
    let serverA: RunningServer | null = null
    let serverB: RunningServer | null = null
    try {
      serverA = await startServer({
        projectDir: projectA,
        port: portA,
        enableWatcher: false,
        rootContextNotificationSource: (_manager, notificationService) => {
          notificationServices.a = notificationService
          return sourceA.source
        },
      })
      serverB = await startServer({
        projectDir: projectB,
        port: portB,
        enableWatcher: false,
        rootContextNotificationSource: (_manager, notificationService) => {
          notificationServices.b = notificationService
          return sourceB.source
        },
      })
      runningServers.push(serverA, serverB)

      const notificationServiceA = notificationServices.a
      const notificationServiceB = notificationServices.b
      if (!notificationServiceA || !notificationServiceB) {
        throw new Error('Expected each running Server to create its own NotificationService.')
      }

      sourceA.emit(readyRootContext('/planning-a', 'generation-a', 1))
      sourceB.emit(readyRootContext('/planning-b', 'generation-b', 1))
      sourceA.emit(failedRootContext('/planning-a', 'generation-a', 2))

      expect(notificationServiceA.list()).toHaveLength(1)
      expect(notificationServiceB.list()).toEqual([])

      await serverA.close()
      removeRunningServer(serverA)
      serverA = null
      sourceA.emitLate(failedRootContext('/planning-a', 'generation-a', 3))
      expect(notificationServiceA.list()).toHaveLength(1)
      expect(notificationServiceB.list()).toEqual([])

      await serverB.close()
      removeRunningServer(serverB)
      serverB = null
    } finally {
      if (serverA) {
        await serverA.close()
        removeRunningServer(serverA)
      }
      if (serverB) {
        await serverB.close()
        removeRunningServer(serverB)
      }
      vi.useRealTimers()
    }
  })

  it.skipIf(process.platform === 'win32')(
    'waits for an attached Planning-root CLI child to close during backend shutdown',
    async () => {
      coreMockState.acquireObservationRoot.mockResolvedValue(async () => {})
      coreMockState.disposeObservationEnvironment.mockResolvedValue(undefined)
      coreMockState.startDataHomeObservation.mockResolvedValue(undefined)
      coreMockState.disposeDataHomeObservation.mockResolvedValue(undefined)
      const projectDir = await createProjectDir()
      const closingPath = join(projectDir, 'validate-child-closing.txt')
      const runnerPath = join(projectDir, 'fixture-runner.cjs')
      const runnerSource = [
        "const { writeFileSync } = require('node:fs')",
        `const projectDir = ${JSON.stringify(projectDir)}`,
        `const closingPath = ${JSON.stringify(closingPath)}`,
        'const args = process.argv.slice(2)',
        "if (args.includes('--version')) { process.stdout.write('1.6.0\\n'); process.exit(0) }",
        "if (args[0] === 'doctor') { process.stdout.write(JSON.stringify({ root: { path: projectDir, source: 'nearest', healthy: true, status: [] }, store: null, references: [], status: [] })); process.exit(0) }",
        "if (args[0] === 'context') { process.stdout.write(JSON.stringify({ root: { path: projectDir, source: 'nearest', role: 'openspec_root' }, members: [], status: [] })); process.exit(0) }",
        "if (args[0] === 'validate') {",
        "  process.on('SIGTERM', () => setTimeout(() => { writeFileSync(closingPath, String(Date.now())); process.exit(0) }, 180))",
        "  process.stdout.write('validate-ready\\n')",
        '  setInterval(() => {}, 1_000)',
        '} else { process.exit(0) }',
      ].join(';')
      await writeFile(runnerPath, runnerSource, 'utf8')
      await new ConfigManager(projectDir).writeConfig({
        cli: { command: `${process.execPath} ${runnerPath}` },
      })
      const port = await findAvailablePort(34_500, 100)
      const server = await startServer({ projectDir, port, enableWatcher: false })
      runningServers.push(server)
      const wsClient = createWSClient({
        url: `ws://localhost:${server.port}/trpc`,
        WebSocket: WebSocket as unknown as typeof globalThis.WebSocket,
      })
      wsClients.push(wsClient)
      const client = createTRPCClient<AppRouter>({ links: [wsLink({ client: wsClient })] })
      let resolveStreamStarted: (() => void) | null = null
      const streamStarted = new Promise<void>((resolve) => {
        resolveStreamStarted = resolve
      })
      const subscription = client.cli.validateStream.subscribe(
        { id: 'demo', type: 'change' },
        {
          onData: (event) => {
            if (event.type === 'stdout' && event.data?.includes('validate-ready')) {
              resolveStreamStarted?.()
            }
          },
          onError: () => undefined,
        }
      )
      await streamStarted

      const closeStartedAt = Date.now()
      const closePromise = server.close().then(() => Date.now())
      const closedWithoutClientCooperation = await Promise.race([
        closePromise.then(() => true),
        new Promise<false>((resolve) => setTimeout(() => resolve(false), 500)),
      ])
      if (!closedWithoutClientCooperation) {
        subscription.unsubscribe()
        wsClient.close()
      }
      const closeFinishedAt = await closePromise
      runningServers.pop()
      await vi.waitFor(
        async () => {
          const closedAt = Number(await readFile(closingPath, 'utf8'))
          expect(closedAt).toBeGreaterThanOrEqual(closeStartedAt)
        },
        { timeout: 2_000 }
      )
      const closedAt = Number(await readFile(closingPath, 'utf8'))

      expect(closedWithoutClientCooperation).toBe(true)
      expect(closeFinishedAt).toBeGreaterThanOrEqual(closedAt)
    }
  )

  it('terminates non-cooperative WebSocket clients before shutdown completes', async () => {
    coreMockState.acquireObservationRoot.mockResolvedValue(async () => {})
    coreMockState.disposeObservationEnvironment.mockResolvedValue(undefined)
    coreMockState.startDataHomeObservation.mockResolvedValue(undefined)
    coreMockState.disposeDataHomeObservation.mockResolvedValue(undefined)
    const projectDir = await createProjectDir()
    const port = await findAvailablePort(34_600, 100)
    const server = await startServer({ projectDir, port, enableWatcher: false })
    runningServers.push(server)
    const socket = new WebSocket(`ws://localhost:${server.port}/trpc`)
    await new Promise<void>((resolve, reject) => {
      socket.once('open', resolve)
      socket.once('error', reject)
    })
    const socketClosed = new Promise<void>((resolve) => socket.once('close', () => resolve()))

    await server.close()
    runningServers.pop()

    const closedWithoutClientCooperation = await Promise.race([
      socketClosed.then(() => true),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), 500)),
    ])
    if (!closedWithoutClientCooperation) socket.terminate()

    expect(closedWithoutClientCooperation).toBe(true)
    expect(socket.readyState).toBe(WebSocket.CLOSED)
  })

  it.skipIf(process.platform === 'win32')(
    'terminates a non-cooperative buffered Store projection child before shutdown completes',
    async () => {
      coreMockState.acquireObservationRoot.mockResolvedValue(async () => {})
      coreMockState.disposeObservationEnvironment.mockResolvedValue(undefined)
      coreMockState.startDataHomeObservation.mockResolvedValue(undefined)
      coreMockState.disposeDataHomeObservation.mockResolvedValue(undefined)
      const projectDir = await createProjectDir()
      const readyPath = join(projectDir, 'store-list-ready')
      const runnerPath = join(projectDir, 'buffered-store-runner.cjs')
      await writeFile(
        runnerPath,
        [
          "const { writeFileSync } = require('node:fs')",
          "if (process.argv.includes('--version')) process.stdout.write('1.6.0\\n')",
          'else {',
          `  writeFileSync(${JSON.stringify(readyPath)}, process.argv.slice(2).join(' '))`,
          "  process.on('SIGTERM', () => {})",
          '  setInterval(() => {}, 1_000)',
          '}',
        ].join('\n'),
        'utf8'
      )
      const configManager = new ConfigManager(projectDir)
      await configManager.writeConfig({
        cli: { command: `${process.execPath} ${runnerPath}` },
      })
      const port = await findAvailablePort(34_500, 100)
      const server = await startServer({ projectDir, port, enableWatcher: false })
      runningServers.push(server)

      await vi.waitFor(async () => {
        expect(await readFile(readyPath, 'utf8')).toContain('store list --json')
      })
      const closeStartedAt = Date.now()
      await server.close()
      runningServers.pop()

      expect(Date.now() - closeStartedAt).toBeLessThan(3_000)
    }
  )

  it('serves prepared preview entry assets and guarded resources through the API route', async () => {
    coreMockState.acquireObservationRoot.mockResolvedValue(async () => {})
    coreMockState.disposeObservationEnvironment.mockResolvedValue(undefined)
    coreMockState.startDataHomeObservation.mockResolvedValue(undefined)
    coreMockState.disposeDataHomeObservation.mockResolvedValue(undefined)
    const projectDir = await createProjectDir()
    const rootA = join(projectDir, 'planning-a')
    const rootB = join(projectDir, 'planning-b')
    const previewAssetsDir = join(projectDir, '.preview-assets')
    await mkdir(join(rootA, 'openspec', 'changes', 'preview-demo', 'site'), {
      recursive: true,
    })
    await mkdir(join(rootA, 'openspec', 'changes', 'preview-demo', 'docs'), {
      recursive: true,
    })
    await mkdir(join(rootB, 'openspec'), { recursive: true })
    await mkdir(previewAssetsDir, { recursive: true })
    await mkdir(join(previewAssetsDir, 'assets'), { recursive: true })
    await writeFile(
      join(rootA, 'openspec', 'changes', 'preview-demo', 'site', 'index.html'),
      '<!doctype html><h1>demo</h1>',
      'utf8'
    )
    await writeFile(
      join(rootA, 'openspec', 'changes', 'preview-demo', 'docs', 'guide.pdf'),
      '%PDF-1.4\n%',
      'utf8'
    )
    await writeFile(
      join(previewAssetsDir, 'assets', 'pdf-preview.js'),
      'globalThis.worker = "/assets/pdf.worker.min-demo.mjs"',
      'utf8'
    )

    const server = createServer({
      projectDir,
      enableWatcher: false,
      previewAssetsDir,
    })
    let selectedRoot = rootA
    vi.spyOn(server.cliExecutor, 'checkAvailability').mockResolvedValue({
      available: true,
      version: '1.6.0',
    })
    vi.spyOn(server.cliExecutor.contracts, 'doctorRoot').mockImplementation(async () =>
      commandResult<CliDoctor>({
        root: { path: selectedRoot, source: 'nearest', healthy: true, status: [] },
        store: null,
        references: [],
        status: [],
      })
    )
    vi.spyOn(server.cliExecutor.contracts, 'context').mockImplementation(async () =>
      commandResult<CliContext>({
        root: { path: selectedRoot, source: 'nearest', role: 'openspec_root' },
        members: [],
        status: [],
      })
    )
    const [preparedHtml, preparedPdf] = await server.planningRootServices.runOperation(
      ({ filePreviewService }) => [
        filePreviewService.prepareEntityFilePreview({
          stage: 'change',
          changeId: 'preview-demo',
          path: 'site/index.html',
        }),
        filePreviewService.prepareEntityFilePreview({
          stage: 'change',
          changeId: 'preview-demo',
          path: 'docs/guide.pdf',
        }),
      ]
    )
    const removedEntryResponse = await server.app.request(
      new Request(`http://openspecui.test/api/file-preview/${preparedHtml.hash}/html-preview.html`)
    )
    expect(removedEntryResponse.status).toBe(404)

    const htmlEntryResponse = await server.app.request(
      new Request(`http://openspecui.test/api/file-preview/${preparedHtml.hash}/index.html`)
    )
    expect(htmlEntryResponse.ok).toBe(true)
    await expect(htmlEntryResponse.text()).resolves.toContain('<h1>demo</h1>')

    const assetResponse = await server.app.request(
      new Request(
        `http://openspecui.test/api/file-preview/${preparedPdf.hash}/assets/pdf-preview.js`
      )
    )
    expect(assetResponse.ok).toBe(true)
    await expect(assetResponse.text()).resolves.toContain(
      `/api/file-preview/${preparedPdf.hash}/assets/pdf.worker.min-demo.mjs`
    )

    selectedRoot = rootB
    const rootBState = await server.planningRootServices.resolveRootContext()
    expect(rootBState).toMatchObject({
      state: 'ready',
      data: { planningRoot: { path: rootB } },
    })
    const retiredResponse = await server.app.request(
      new Request(`http://openspecui.test/api/file-preview/${preparedHtml.hash}/index.html`)
    )
    expect(retiredResponse.status).toBe(404)

    selectedRoot = rootA
    const replacementPreview = await server.planningRootServices.runOperation(
      ({ filePreviewService }) =>
        filePreviewService.prepareEntityFilePreview({
          stage: 'change',
          changeId: 'preview-demo',
          path: 'site/index.html',
        })
    )
    expect(replacementPreview.hash).not.toBe(preparedHtml.hash)
    const stillRetiredResponse = await server.app.request(
      new Request(`http://openspecui.test/api/file-preview/${preparedHtml.hash}/index.html`)
    )
    expect(stillRetiredResponse.status).toBe(404)
    const replacementResponse = await server.app.request(
      new Request(`http://openspecui.test${replacementPreview.entryPathname}`)
    )
    expect(replacementResponse.ok).toBe(true)
    await server.planningRootServices.dispose()
    server.projectInvalidation.dispose()
    await server.observationEnvironment.dispose()
  })
})
