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

import { FilePreviewService } from './file-preview-service.js'
import { findAvailablePort } from './port-utils.js'
import { createServer, startServer, type RunningServer } from './server.js'

const tempDirs: string[] = []
const runningServers: RunningServer[] = []

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

  it('serves prepared preview entry assets and guarded resources through the API route', async () => {
    coreMockState.acquireObservationRoot.mockResolvedValue(async () => {})
    coreMockState.disposeObservationEnvironment.mockResolvedValue(undefined)
    coreMockState.startDataHomeObservation.mockResolvedValue(undefined)
    coreMockState.disposeDataHomeObservation.mockResolvedValue(undefined)
    const projectDir = await createProjectDir()
    const previewAssetsDir = join(projectDir, '.preview-assets')
    await mkdir(join(projectDir, 'openspec', 'changes', 'preview-demo', 'site'), {
      recursive: true,
    })
    await mkdir(join(projectDir, 'openspec', 'changes', 'preview-demo', 'docs'), {
      recursive: true,
    })
    await mkdir(previewAssetsDir, { recursive: true })
    await mkdir(join(previewAssetsDir, 'assets'), { recursive: true })
    await writeFile(
      join(projectDir, 'openspec', 'changes', 'preview-demo', 'site', 'index.html'),
      '<!doctype html><h1>demo</h1>',
      'utf8'
    )
    await writeFile(
      join(projectDir, 'openspec', 'changes', 'preview-demo', 'docs', 'guide.pdf'),
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
    const previewService = new FilePreviewService(projectDir, previewAssetsDir)
    const preparedHtml = previewService.prepareEntityFilePreview({
      stage: 'change',
      changeId: 'preview-demo',
      path: 'site/index.html',
    })
    const preparedPdf = previewService.prepareEntityFilePreview({
      stage: 'change',
      changeId: 'preview-demo',
      path: 'docs/guide.pdf',
    })
    const appPreviewService = server.filePreviewService
    appPreviewService.prepareEntityFilePreview({
      stage: 'change',
      changeId: 'preview-demo',
      path: 'site/index.html',
    })
    appPreviewService.prepareEntityFilePreview({
      stage: 'change',
      changeId: 'preview-demo',
      path: 'docs/guide.pdf',
    })

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
    server.projectInvalidation.dispose()
  })
})
