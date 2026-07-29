/**
 * Orthogonal intents (created 2026-07-29 Asia/Shanghai):
 * 1. Prove immutable daemon mode and version diagnostics through the production controller and IPC.
 * 2. Prove mode-unspecified activation and stop affect only the existing daemon host.
 *
 * Original request (2026-07-29): "start 参数变化时提醒用户把 start 改成 restart。"
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDaemonController } from './daemon-controller.js'
import type { DaemonPaths } from './daemon-paths.js'
import type { DaemonPresentationHost, RunningDaemonServer } from './daemon-server.js'
import { startDaemonServer } from './daemon-server.js'

const servers: RunningDaemonServer[] = []
const tempDirs: string[] = []

afterEach(async () => {
  await Promise.allSettled(servers.splice(0).map((server) => server.close()))
  await Promise.all(tempDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

async function createFixture(version = '6.1.0') {
  const homeDir = await mkdtemp(join(tmpdir(), 'openspecui-controller-'))
  tempDirs.push(homeDir)
  const paths: DaemonPaths = {
    homeDir,
    runDir: join(homeDir, 'run'),
    logsDir: join(homeDir, 'logs'),
    endpoint: join(homeDir, 'run', 'daemon.sock'),
    logFile: join(homeDir, 'logs', 'daemon.log'),
  }
  const host: DaemonPresentationHost = {
    appUrl: 'http://127.0.0.1:14000',
    capabilities: { browser: true, nativeWindow: true },
    setWorkspaces: vi.fn(),
    activate: vi.fn(async () => {}),
    openProjectInBrowser: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
  }
  const server = await startDaemonServer({
    endpoint: paths.endpoint,
    runDir: paths.runDir,
    version,
    hostMode: 'native',
    host,
    platform: 'darwin',
  })
  servers.push(server)
  return { paths, host, server }
}

describe('daemon controller', () => {
  it('rejects explicit mode mutation with the exact corrective restart command', async () => {
    const fixture = await createFixture()
    const controller = createDaemonController({
      version: '6.1.0',
      entryPath: '/unused/cli.mjs',
      paths: fixture.paths,
      platform: 'darwin',
    })

    await expect(controller.start('web')).rejects.toThrow(
      'OpenSpecUI App daemon is running in native mode. Run openspecui restart --web to change startup mode.'
    )
    expect(fixture.host.activate).not.toHaveBeenCalled()
  })

  it('activates a compatible daemon when no host mode is requested', async () => {
    const fixture = await createFixture()
    const controller = createDaemonController({
      version: '6.1.0',
      entryPath: '/unused/cli.mjs',
      paths: fixture.paths,
      platform: 'darwin',
    })

    await expect(controller.start(undefined)).resolves.toMatchObject({ hostMode: 'native' })
    expect(fixture.host.activate).toHaveBeenCalledOnce()
  })

  it('rejects a version mismatch with the running mode correction and stops only its host', async () => {
    const fixture = await createFixture('6.0.0')
    const controller = createDaemonController({
      version: '6.1.0',
      entryPath: '/unused/cli.mjs',
      paths: fixture.paths,
      platform: 'darwin',
    })

    await expect(controller.start(undefined)).rejects.toThrow(
      'OpenSpecUI App daemon v6.0.0 is running, but this CLI is v6.1.0. Run openspecui restart.'
    )
    await expect(controller.stop()).resolves.toBe(true)
    expect(fixture.host.close).toHaveBeenCalledOnce()
  })
})
