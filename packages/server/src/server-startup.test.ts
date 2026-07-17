/**
 * Orthogonal intents (updated 2026-07-17 Asia/Shanghai):
 * 1. Prove server startup remains non-blocking while runtime observers warm up.
 * 2. Prove shutdown is idempotent and continues across independent owner failures.
 * 3. Prove backend shutdown settles attached Planning-root CLI streams without client cooperation.
 * 4. Prove preview assets remain bound to the current Planning-root lifecycle.
 *
 * Original request (2026-07-17): "Backend disposal actively cancels every owned stream and awaits settlement."
 */
import {
  ConfigManager,
  type CliCommandResult,
  type CliContext,
  type CliDoctor,
} from '@openspecui/core'
import { createTRPCClient, createWSClient, wsLink } from '@trpc/client'
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
    payload: data,
    diagnostics: [],
  }
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

    await expect(fetch(`${started.url}/api/health`)).resolves.toMatchObject({
      ok: true,
    })
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
    expect(coreMockState.disposeProjectInvalidation).toHaveBeenCalledTimes(2)
    expect(coreMockState.disposeObservationEnvironment).toHaveBeenCalledOnce()
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
      const streamStarted = Promise.withResolvers<void>()
      const subscription = client.cli.validateStream.subscribe(
        { id: 'demo', type: 'change' },
        {
          onData: (event) => {
            if (event.type === 'stdout' && event.data?.includes('validate-ready')) {
              streamStarted.resolve()
            }
          },
          onError: () => undefined,
        }
      )
      await streamStarted.promise

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
