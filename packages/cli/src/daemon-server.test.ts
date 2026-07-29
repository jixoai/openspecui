/**
 * Orthogonal intents (updated 2026-07-29 Asia/Shanghai):
 * 1. Prove IPC bind ownership, mode-0600 Unix endpoints, and stale-socket recovery.
 * 2. Prove Workspace credentials remain private while opaque-id browser actions resolve server-side.
 * 3. Prove stop tears down only daemon host and endpoint state.
 * 4. Prove endpoint authority is released even when host teardown reports a failure.
 *
 * Original request (2026-07-29): "daemon 不应该拥有或关闭每个 backend。"
 */
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DaemonPresentationHost, RunningDaemonServer } from './daemon-server.js'
import { DaemonAlreadyRunningError, startDaemonServer } from './daemon-server.js'
import { createDaemonWorkspaceLease, sendDaemonCommand } from './daemon-transport.js'

const runningServers: RunningDaemonServer[] = []

const createTempDir = () => mkdtemp(join(tmpdir(), 'openspecui-daemon-'))
const cleanupTempDir = (path: string) => rm(path, { recursive: true, force: true })

afterEach(async () => {
  await Promise.allSettled(runningServers.splice(0).map((server) => server.close()))
})

function createHost() {
  const opened: Array<{ id: string; backendUrl: string; credential: string | null }> = []
  const activate = vi.fn(async () => {})
  const close = vi.fn(async () => {})
  const host: DaemonPresentationHost = {
    appUrl: 'http://127.0.0.1:14000',
    capabilities: { browser: true, nativeWindow: false },
    setWorkspaces: vi.fn(),
    activate,
    openProjectInBrowser: vi.fn(async (workspace) => {
      opened.push(workspace)
    }),
    close,
  }
  return { host, opened, activate, close }
}

async function startFixture(tempDir: string, host: DaemonPresentationHost) {
  const runDir = join(tempDir, 'run')
  const endpoint = join(runDir, 'daemon.sock')
  const server = await startDaemonServer({
    endpoint,
    runDir,
    version: '6.1.0',
    hostMode: 'web',
    host,
    platform: 'darwin',
  })
  runningServers.push(server)
  return { server, endpoint, runDir }
}

describe('daemon IPC server', () => {
  it('publishes credential-free status and a private Unix socket', async () => {
    const tempDir = await createTempDir()
    try {
      const { host } = createHost()
      const { endpoint } = await startFixture(tempDir, host)
      const response = await sendDaemonCommand({ endpoint, command: { type: 'status' } })

      expect(response).toMatchObject({
        kind: 'status',
        status: { version: '6.1.0', hostMode: 'web', appUrl: host.appUrl },
      })
      expect((await stat(endpoint)).mode & 0o777).toBe(0o600)
      expect(JSON.stringify(response)).not.toContain('credential')
    } finally {
      await cleanupTempDir(tempDir)
    }
  })

  it('keeps credentials private and resolves Open in browser by opaque Workspace id', async () => {
    const tempDir = await createTempDir()
    try {
      const harness = createHost()
      const { endpoint } = await startFixture(tempDir, harness.host)
      const lease = await createDaemonWorkspaceLease({
        endpoint,
        workspace: {
          id: 'workspace-a',
          projectDir: '/projects/a',
          backendUrl: 'http://127.0.0.1:3100',
          credential: 'private-secret',
        },
      })

      expect(harness.host.setWorkspaces).toHaveBeenLastCalledWith([
        {
          id: 'workspace-a',
          backendUrl: 'http://127.0.0.1:3100',
          credential: 'private-secret',
        },
      ])

      const list = await sendDaemonCommand({ endpoint, command: { type: 'list-workspaces' } })
      expect(list).toMatchObject({
        kind: 'workspaces',
        workspaces: [{ id: 'workspace-a', backendUrl: 'http://127.0.0.1:3100' }],
      })
      expect(JSON.stringify(list)).not.toContain('private-secret')

      await sendDaemonCommand({
        endpoint,
        command: { type: 'open-workspace-in-browser', workspaceId: 'workspace-a' },
      })
      expect(harness.opened).toEqual([
        {
          id: 'workspace-a',
          backendUrl: 'http://127.0.0.1:3100',
          credential: 'private-secret',
        },
      ])
      await expect(
        sendDaemonCommand({
          endpoint,
          command: { type: 'open-workspace-in-browser', workspaceId: 'https://example.com' },
        })
      ).rejects.toThrow('Workspace is no longer registered.')
      await lease.close()
      await new Promise((resolve) => setTimeout(resolve, 10))
      expect(harness.host.setWorkspaces).toHaveBeenLastCalledWith([])
      await expect(
        sendDaemonCommand({ endpoint, command: { type: 'list-workspaces' } })
      ).resolves.toMatchObject({ kind: 'workspaces', workspaces: [] })
    } finally {
      await cleanupTempDir(tempDir)
    }
  })

  it('rejects a second live owner and recovers a stale Unix endpoint', async () => {
    const tempDir = await createTempDir()
    try {
      const firstHost = createHost()
      const fixture = await startFixture(tempDir, firstHost.host)
      await expect(
        startDaemonServer({
          endpoint: fixture.endpoint,
          runDir: fixture.runDir,
          version: '6.1.0',
          hostMode: 'web',
          host: createHost().host,
          platform: 'darwin',
        })
      ).rejects.toBeInstanceOf(DaemonAlreadyRunningError)

      await fixture.server.close()
      runningServers.splice(runningServers.indexOf(fixture.server), 1)
      await mkdir(fixture.runDir, { recursive: true })
      await writeFile(fixture.endpoint, 'stale')
      const recovered = await startDaemonServer({
        endpoint: fixture.endpoint,
        runDir: fixture.runDir,
        version: '6.1.0',
        hostMode: 'web',
        host: createHost().host,
        platform: 'darwin',
      })
      runningServers.push(recovered)
      await expect(
        sendDaemonCommand({ endpoint: fixture.endpoint, command: { type: 'status' } })
      ).resolves.toMatchObject({ kind: 'status' })
    } finally {
      await cleanupTempDir(tempDir)
    }
  })

  it('releases endpoint authority after a presentation teardown failure', async () => {
    const tempDir = await createTempDir()
    try {
      const harness = createHost()
      harness.host.close = vi.fn(async () => {
        throw new Error('fixture teardown failure')
      })
      const fixture = await startFixture(tempDir, harness.host)

      await expect(fixture.server.close()).rejects.toThrow('fixture teardown failure')
      await expect(stat(fixture.endpoint)).rejects.toMatchObject({ code: 'ENOENT' })
      await expect(fixture.server.closed).resolves.toBeUndefined()
    } finally {
      await cleanupTempDir(tempDir)
    }
  })

  it('admits exactly one winner when two daemon owners race for the same endpoint', async () => {
    const tempDir = await createTempDir()
    let winner: RunningDaemonServer | null = null
    try {
      const runDir = join(tempDir, 'run')
      const endpoint = join(runDir, 'daemon.sock')
      const attempts = await Promise.allSettled(
        [createHost().host, createHost().host].map((host) =>
          startDaemonServer({
            endpoint,
            runDir,
            version: '6.1.0',
            hostMode: 'web',
            host,
            platform: 'darwin',
          })
        )
      )
      const winners = attempts.filter(
        (attempt): attempt is PromiseFulfilledResult<RunningDaemonServer> =>
          attempt.status === 'fulfilled'
      )
      const losers = attempts.filter(
        (attempt): attempt is PromiseRejectedResult => attempt.status === 'rejected'
      )

      expect(winners).toHaveLength(1)
      expect(losers).toHaveLength(1)
      expect(losers[0]?.reason).toBeInstanceOf(DaemonAlreadyRunningError)
      winner = winners[0]?.value ?? null
    } finally {
      await winner?.close()
      await cleanupTempDir(tempDir)
    }
  })

  it('re-registers the active serve lease after daemon replacement', async () => {
    const tempDir = await createTempDir()
    try {
      const first = await startFixture(tempDir, createHost().host)
      const lease = await createDaemonWorkspaceLease({
        endpoint: first.endpoint,
        retryDelayMs: 10,
        workspace: {
          id: 'workspace-reconnect',
          projectDir: '/projects/reconnect',
          backendUrl: 'http://127.0.0.1:3300',
          credential: 'runtime-only',
        },
      })
      await first.server.close()
      runningServers.splice(runningServers.indexOf(first.server), 1)

      const replacement = await startDaemonServer({
        endpoint: first.endpoint,
        runDir: first.runDir,
        version: '6.1.0',
        hostMode: 'web',
        host: createHost().host,
        platform: 'darwin',
      })
      runningServers.push(replacement)

      const deadline = Date.now() + 1_000
      let workspaces: unknown[] = []
      while (Date.now() < deadline) {
        const response = await sendDaemonCommand({
          endpoint: first.endpoint,
          command: { type: 'list-workspaces' },
        })
        if (response.kind === 'workspaces') workspaces = response.workspaces
        if (workspaces.length > 0) break
        await new Promise((resolve) => setTimeout(resolve, 10))
      }
      expect(workspaces).toMatchObject([{ id: 'workspace-reconnect' }])
      await lease.close()
    } finally {
      await cleanupTempDir(tempDir)
    }
  })
})
