import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const coreMockState = vi.hoisted(() => ({
  initWatcherPool: vi.fn<() => Promise<void>>(),
}))

vi.mock('@openspecui/core', async () => {
  const actual = await vi.importActual<typeof import('@openspecui/core')>('@openspecui/core')
  return {
    ...actual,
    initWatcherPool: coreMockState.initWatcherPool,
    isWatcherPoolInitialized: vi.fn(() => false),
  }
})

import { findAvailablePort } from './port-utils.js'
import { startServer, type RunningServer } from './server.js'

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
    coreMockState.initWatcherPool.mockResolvedValue(undefined)
    const projectDir = await createProjectDir()
    const port = await findAvailablePort(34_800, 100)

    const started = await startServer({
      projectDir,
      port,
      enableWatcher: false,
    })
    runningServers.push(started)

    expect(coreMockState.initWatcherPool).not.toHaveBeenCalled()
  })

  it('returns a healthy HTTP runtime before watcher initialization resolves', async () => {
    coreMockState.initWatcherPool.mockReturnValue(new Promise(() => {}))
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
    expect(coreMockState.initWatcherPool).toHaveBeenCalledWith(projectDir)
  })
})
