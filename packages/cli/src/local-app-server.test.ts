/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Prove the loopback App server owns immutable assets, SPA fallback, and bounded paths.
 * 2. Prove Workspace control follows invalidation Push then typed replacement Pull.
 * 3. Prove browser actions carry only encoded opaque Workspace ids to daemon authority.
 * 4. Prove managed directory start/Stop is runtime-parsed and delegated only when locally supported.
 * 5. Prove the daemon-owned directory catalog is pulled and favorite writes are exact-origin invalidations.
 *
 * Original request (2026-07-29): "daemon 使用随 CLI 发布的本地 App 外壳。"
 */
import {
  AppDaemonOpenWorkspaceResponseSchema,
  AppDaemonStartManagedProjectResponseSchema,
  AppDaemonStopManagedProjectResponseSchema,
  type AppDaemonStartManagedProjectResponse,
  type AppDaemonStopManagedProjectResponse,
} from '@openspecui/core/app-daemon-control'
import {
  AppDaemonSetWorkspaceDirectoryFavoriteResponseSchema,
  AppDaemonWorkspaceDirectorySnapshotSchema,
  setDirectoryFavorite,
  type WorkspaceDirectoryCatalog,
} from '@openspecui/core/workspace-directory-catalog'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { request } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DaemonWorkspaceSnapshotSchema } from './daemon-protocol.js'
import { startLocalAppServer, type LocalAppServer } from './local-app-server.js'

const tempDirs: string[] = []
const servers: LocalAppServer[] = []

afterEach(async () => {
  await Promise.allSettled(servers.splice(0).map((server) => server.close()))
  await Promise.all(tempDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

async function startFixture(
  options: {
    openWorkspaceInBrowser?: (workspaceId: string) => Promise<'not-found' | 'opened'>
    startManagedProject?: (projectDir: string) => Promise<AppDaemonStartManagedProjectResponse>
    stopManagedProject?: (generation: number) => Promise<AppDaemonStopManagedProjectResponse>
    initialWorkspaceDirectoryCatalog?: WorkspaceDirectoryCatalog
    recordSuccessfulDirectoryOpen?: (canonicalPath: string) => Promise<WorkspaceDirectoryCatalog>
    setWorkspaceDirectoryFavorite?: (
      canonicalPath: string,
      favorite: boolean
    ) => Promise<WorkspaceDirectoryCatalog>
  } = {}
): Promise<LocalAppServer> {
  const assetsDir = await mkdtemp(join(tmpdir(), 'openspecui-local-app-'))
  tempDirs.push(assetsDir)
  await mkdir(join(assetsDir, 'assets'))
  await writeFile(join(assetsDir, 'index.html'), '<main>OpenSpecUI App</main>')
  await writeFile(join(assetsDir, 'assets', 'app-a1b2c3.js'), 'globalThis.appReady = true')
  const server = await startLocalAppServer({
    assetsDir,
    openWorkspaceInBrowser: options.openWorkspaceInBrowser ?? (async () => 'not-found'),
    startManagedProject: options.startManagedProject,
    stopManagedProject: options.stopManagedProject,
    initialWorkspaceDirectoryCatalog: options.initialWorkspaceDirectoryCatalog,
    recordSuccessfulDirectoryOpen: options.recordSuccessfulDirectoryOpen,
    setWorkspaceDirectoryFavorite: options.setWorkspaceDirectoryFavorite,
  })
  servers.push(server)
  return server
}

function requestRawStatus(serverUrl: string, path: string): Promise<number> {
  const target = new URL(serverUrl)
  return new Promise((resolve, reject) => {
    const outgoing = request(
      {
        hostname: target.hostname,
        port: target.port,
        path,
      },
      (response) => {
        response.resume()
        resolve(response.statusCode ?? 0)
      }
    )
    outgoing.once('error', reject)
    outgoing.end()
  })
}

function createEventReader(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  return {
    async next(): Promise<string> {
      while (!buffer.includes('\n\n')) {
        const chunk = await reader.read()
        if (chunk.done) throw new Error('Daemon event stream ended before the next event.')
        buffer += decoder.decode(chunk.value, { stream: true })
      }
      const boundary = buffer.indexOf('\n\n')
      const event = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)
      return event
    },
    cancel: () => reader.cancel(),
  }
}

describe('local App server', () => {
  it('serves hashed assets and SPA routes with distinct cache contracts', async () => {
    const server = await startFixture()

    const asset = await fetch(`${server.url}/assets/app-a1b2c3.js`)
    expect(asset.headers.get('content-type')).toBe('text/javascript; charset=utf-8')
    expect(asset.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    expect(await asset.text()).toContain('appReady')

    const route = await fetch(`${server.url}/workspaces/example`)
    expect(route.headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(route.headers.get('cache-control')).toBe('no-cache')
    expect(await route.text()).toContain('OpenSpecUI App')

    expect(await requestRawStatus(server.url, '/..%2Foutside.txt')).toBe(404)
    const rejected = await fetch(server.url, { method: 'POST' })
    expect(rejected.status).toBe(405)
  })

  it('publishes invalidation notices before clients pull the replacement snapshot', async () => {
    const server = await startFixture()
    const eventResponse = await fetch(`${server.url}/api/daemon/events`)
    expect(eventResponse.body).not.toBeNull()
    const events = createEventReader(eventResponse.body!)

    expect(await events.next()).toContain('"revision":0')
    const binding = {
      id: 'workspace-a',
      backendUrl: 'http://127.0.0.1:3100',
      credential: 'runtime-only',
      projectDir: '/projects/a',
      ownership: 'daemon-managed' as const,
      registeredAt: 1,
      managedGeneration: 7,
      shutdown: 'managed' as const,
      git: null,
    }
    server.setWorkspaces([binding])
    binding.credential = 'mutated-after-publication'

    expect(await events.next()).toContain('"revision":1')
    const response = await fetch(`${server.url}/api/daemon/workspaces`)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(DaemonWorkspaceSnapshotSchema.parse(await response.json())).toEqual({
      revision: 1,
      workspaces: [
        {
          id: 'workspace-a',
          backendUrl: 'http://127.0.0.1:3100',
          credential: 'runtime-only',
          projectDir: '/projects/a',
          ownership: 'daemon-managed',
          registeredAt: 1,
          managedGeneration: 7,
          shutdown: 'managed',
          git: null,
        },
      ],
    })

    await events.cancel()
  })

  it('opens only an encoded opaque Workspace id and reports stale authority', async () => {
    const received: string[] = []
    const server = await startFixture({
      openWorkspaceInBrowser: async (workspaceId) => {
        received.push(workspaceId)
        return workspaceId === 'workspace/a' ? 'opened' : 'not-found'
      },
    })

    const opened = await fetch(`${server.url}/api/daemon/workspaces/workspace%2Fa/open`, {
      method: 'POST',
      headers: { Origin: server.url },
    })
    expect(AppDaemonOpenWorkspaceResponseSchema.parse(await opened.json())).toEqual({ ok: true })
    expect(received).toEqual(['workspace/a'])

    const stale = await fetch(`${server.url}/api/daemon/workspaces/https%3A%2F%2Fevil.test/open`, {
      method: 'POST',
      headers: { Origin: server.url },
    })
    expect(stale.status).toBe(404)
    expect(AppDaemonOpenWorkspaceResponseSchema.parse(await stale.json())).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' },
    })
    expect(received).toEqual(['workspace/a', 'https://evil.test'])
  })

  it('delegates managed directory start and exact Stop through typed same-origin controls', async () => {
    const starts: string[] = []
    const stops: number[] = []
    const workspace = {
      id: 'managed-a',
      backendUrl: 'http://127.0.0.1:3100',
      credential: 'runtime-only',
      projectDir: '/real/project-a',
      ownership: 'daemon-managed' as const,
      registeredAt: 1,
      managedGeneration: 7,
      shutdown: 'managed' as const,
      git: null,
    }
    const server = await startFixture({
      startManagedProject: async (projectDir) => {
        starts.push(projectDir)
        return { ok: true, workspace, alreadyRunning: false }
      },
      stopManagedProject: async (generation) => {
        stops.push(generation)
        return { ok: true, generation }
      },
    })

    const started = await fetch(`${server.url}/api/daemon/managed-projects/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: server.url },
      body: JSON.stringify({ projectDir: '/project-a' }),
    })
    expect(started.status).toBe(200)
    expect(AppDaemonStartManagedProjectResponseSchema.parse(await started.json())).toEqual({
      ok: true,
      workspace,
      alreadyRunning: false,
    })
    expect(starts).toEqual(['/project-a'])

    const stopped = await fetch(`${server.url}/api/daemon/managed-projects/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: server.url },
      body: JSON.stringify({ generation: 7 }),
    })
    expect(stopped.status).toBe(200)
    expect(AppDaemonStopManagedProjectResponseSchema.parse(await stopped.json())).toEqual({
      ok: true,
      generation: 7,
    })
    expect(stops).toEqual([7])
  })

  it('rejects malformed and unsupported managed controls without invoking an owner', async () => {
    const server = await startFixture()
    const malformed = await fetch(`${server.url}/api/daemon/managed-projects/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: server.url },
      body: JSON.stringify({ projectDir: '' }),
    })
    expect(malformed.status).toBe(400)
    expect(AppDaemonStartManagedProjectResponseSchema.parse(await malformed.json())).toMatchObject({
      ok: false,
      error: { code: 'INVALID_REQUEST' },
    })

    const unsupported = await fetch(`${server.url}/api/daemon/managed-projects/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: server.url },
      body: JSON.stringify({ generation: 1 }),
    })
    expect(unsupported.status).toBe(404)
    expect(AppDaemonStopManagedProjectResponseSchema.parse(await unsupported.json())).toMatchObject(
      {
        ok: false,
        error: { code: 'UNSUPPORTED' },
      }
    )
  })

  it('records Recent only after a managed start settles successfully', async () => {
    const workspace = {
      id: 'managed-a',
      backendUrl: 'http://127.0.0.1:3100',
      credential: null,
      projectDir: '/real/project-a',
      ownership: 'daemon-managed' as const,
      registeredAt: 1,
      managedGeneration: 7,
      shutdown: 'managed' as const,
      git: null,
    }
    const recordOpen = vi.fn(async (canonicalPath: string) => ({
      version: 1 as const,
      entries: [{ canonicalPath, favorite: false, lastOpenedAt: 10 }],
    }))
    const successful = await startFixture({
      startManagedProject: async () => ({ ok: true, workspace, alreadyRunning: false }),
      recordSuccessfulDirectoryOpen: recordOpen,
    })
    await fetch(`${successful.url}/api/daemon/managed-projects/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: successful.url },
      body: JSON.stringify({ projectDir: '/typed/by-user' }),
    })
    expect(recordOpen).toHaveBeenCalledWith('/real/project-a')

    const failedRecord = vi.fn(async () => ({ version: 1 as const, entries: [] }))
    const failed = await startFixture({
      startManagedProject: async () => ({
        ok: false,
        error: { code: 'INVALID_DIRECTORY', message: 'not a directory' },
      }),
      recordSuccessfulDirectoryOpen: failedRecord,
    })
    await fetch(`${failed.url}/api/daemon/managed-projects/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: failed.url },
      body: JSON.stringify({ projectDir: '/missing' }),
    })
    expect(failedRecord).not.toHaveBeenCalled()
  })

  it('rejects cross-origin control before invoking a managed owner', async () => {
    const startManagedProject = vi.fn(async () => ({
      ok: false as const,
      error: { code: 'SPAWN_FAILED' as const, message: 'must not run' },
    }))
    const server = await startFixture({ startManagedProject })

    const response = await fetch(`${server.url}/api/daemon/managed-projects/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', Origin: 'https://attacker.example' },
      body: JSON.stringify({ projectDir: '/project-a' }),
    })

    expect(response.status).toBe(403)
    expect(startManagedProject).not.toHaveBeenCalled()
  })

  it('persists favorite state, invalidates, and publishes the replacement catalog snapshot', async () => {
    let catalog: WorkspaceDirectoryCatalog = {
      version: 1,
      entries: [{ canonicalPath: '/projects/a', favorite: false, lastOpenedAt: 7 }],
    }
    const setFavorite = vi.fn(async (canonicalPath: string, favorite: boolean) => {
      catalog = setDirectoryFavorite(catalog, canonicalPath, favorite)
      return catalog
    })
    const server = await startFixture({
      initialWorkspaceDirectoryCatalog: catalog,
      setWorkspaceDirectoryFavorite: setFavorite,
    })
    const eventResponse = await fetch(`${server.url}/api/daemon/events`)
    const events = createEventReader(eventResponse.body!)
    expect(await events.next()).toContain('"revision":0')

    const mutation = await fetch(`${server.url}/api/daemon/workspace-directories/favorite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: server.url },
      body: JSON.stringify({ canonicalPath: '/projects/a', favorite: true }),
    })
    expect(
      AppDaemonSetWorkspaceDirectoryFavoriteResponseSchema.parse(await mutation.json())
    ).toEqual({ ok: true })
    expect(setFavorite).toHaveBeenCalledWith('/projects/a', true)
    expect(await events.next()).toContain('"revision":1')

    const snapshot = await fetch(`${server.url}/api/daemon/workspace-directories`)
    expect(AppDaemonWorkspaceDirectorySnapshotSchema.parse(await snapshot.json())).toEqual({
      revision: 1,
      catalog: {
        version: 1,
        entries: [{ canonicalPath: '/projects/a', favorite: true, lastOpenedAt: 7 }],
      },
    })
    await events.cancel()
  })

  it('rejects a cross-origin favorite write before invoking persistence', async () => {
    const setFavorite = vi.fn(async () => ({ version: 1 as const, entries: [] }))
    const server = await startFixture({ setWorkspaceDirectoryFavorite: setFavorite })
    const response = await fetch(`${server.url}/api/daemon/workspace-directories/favorite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://attacker.example' },
      body: JSON.stringify({ canonicalPath: '/projects/a', favorite: true }),
    })
    expect(response.status).toBe(403)
    expect(setFavorite).not.toHaveBeenCalled()
  })
})
