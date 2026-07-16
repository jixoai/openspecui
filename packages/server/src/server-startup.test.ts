import type { CliCommandResult, CliContext, CliDoctor } from '@openspecui/core'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

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
import { createServer, startServer, type RunningServer } from './server.js'

const tempDirs: string[] = []
const runningServers: RunningServer[] = []

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
