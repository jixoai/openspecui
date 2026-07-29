/**
 * Orthogonal intents (created 2026-07-29 Asia/Shanghai):
 * 1. Prove the loopback App server owns immutable assets, SPA fallback, and bounded paths.
 * 2. Prove Workspace control follows invalidation Push then typed replacement Pull.
 *
 * Original request (2026-07-29): "daemon 使用随 CLI 发布的本地 App 外壳。"
 */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { request } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DaemonWorkspaceSnapshotSchema } from './daemon-protocol.js'
import { startLocalAppServer, type LocalAppServer } from './local-app-server.js'

const tempDirs: string[] = []
const servers: LocalAppServer[] = []

afterEach(async () => {
  await Promise.allSettled(servers.splice(0).map((server) => server.close()))
  await Promise.all(tempDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

async function startFixture(): Promise<LocalAppServer> {
  const assetsDir = await mkdtemp(join(tmpdir(), 'openspecui-local-app-'))
  tempDirs.push(assetsDir)
  await mkdir(join(assetsDir, 'assets'))
  await writeFile(join(assetsDir, 'index.html'), '<main>OpenSpecUI App</main>')
  await writeFile(join(assetsDir, 'assets', 'app-a1b2c3.js'), 'globalThis.appReady = true')
  const server = await startLocalAppServer({ assetsDir })
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
        },
      ],
    })

    await events.cancel()
  })
})
