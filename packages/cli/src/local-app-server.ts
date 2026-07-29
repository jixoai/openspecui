/**
 * Orthogonal intents (updated 2026-07-30 Asia/Shanghai):
 * 1. Serve the same-release App shell from a loopback-only HTTP endpoint.
 * 2. Enforce bounded static paths, MIME types, cache policy, and SPA fallback.
 * 3. Publish transient Workspace authority through snapshot Pull, invalidation Push, and open-by-id.
 *
 * Original request (2026-07-29): "daemon 使用随 CLI 发布的本地 App 外壳。"
 */
import { AppDaemonOpenWorkspaceResponseSchema } from '@openspecui/core/app-daemon-control'
import { createReadStream } from 'node:fs'
import { access, stat } from 'node:fs/promises'
import type { ServerResponse } from 'node:http'
import { createServer } from 'node:http'
import { extname, join, relative, resolve, sep } from 'node:path'
import { DaemonWorkspaceSnapshotSchema, type DaemonWorkspaceBinding } from './daemon-protocol.js'

const MIME_TYPES: Readonly<Record<string, string>> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
}

export interface LocalAppServer {
  url: string
  setWorkspaces(workspaces: readonly DaemonWorkspaceBinding[]): void
  close(): Promise<void>
}

function isInsideRoot(root: string, candidate: string): boolean {
  const path = relative(root, candidate)
  return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !path.startsWith(sep))
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile()
  } catch {
    return false
  }
}

/** Start an ephemeral loopback server over one immutable App asset directory. */
export async function startLocalAppServer(options: {
  assetsDir: string
  openWorkspaceInBrowser(workspaceId: string): Promise<'not-found' | 'opened'>
  host?: string
  port?: number
}): Promise<LocalAppServer> {
  const assetsDir = resolve(options.assetsDir)
  const indexPath = join(assetsDir, 'index.html')
  await access(indexPath)
  const eventStreams = new Set<ServerResponse>()
  let revision = 0
  let workspaces: readonly DaemonWorkspaceBinding[] = []
  const server = createServer((request, response) => {
    void (async () => {
      const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1')
      const openWorkspaceMatch = requestUrl.pathname.match(
        /^\/api\/daemon\/workspaces\/([^/]+)\/open$/
      )
      if (request.method === 'POST' && openWorkspaceMatch) {
        const workspaceId = decodeURIComponent(openWorkspaceMatch[1] ?? '')
        try {
          const result = await options.openWorkspaceInBrowser(workspaceId)
          const payload = AppDaemonOpenWorkspaceResponseSchema.parse(
            result === 'opened'
              ? { ok: true }
              : {
                  ok: false,
                  error: { code: 'NOT_FOUND', message: 'Workspace is no longer registered.' },
                }
          )
          response.writeHead(result === 'opened' ? 200 : 404, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
          })
          response.end(JSON.stringify(payload))
        } catch {
          const payload = AppDaemonOpenWorkspaceResponseSchema.parse({
            ok: false,
            error: {
              code: 'PRESENTATION_FAILED',
              message: 'Failed to open the registered Workspace in the system browser.',
            },
          })
          response.writeHead(502, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
          })
          response.end(JSON.stringify(payload))
        }
        return
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405, { Allow: 'GET, HEAD, POST' })
        response.end()
        return
      }
      if (requestUrl.pathname === '/api/daemon/workspaces') {
        const snapshot = DaemonWorkspaceSnapshotSchema.parse({ revision, workspaces })
        response.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        })
        response.end(request.method === 'HEAD' ? undefined : JSON.stringify(snapshot))
        return
      }
      if (requestUrl.pathname === '/api/daemon/events') {
        response.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-store',
          Connection: 'keep-alive',
        })
        eventStreams.add(response)
        response.write(`event: invalidate\ndata: ${JSON.stringify({ revision })}\n\n`)
        request.once('close', () => eventStreams.delete(response))
        return
      }
      const decodedPath = decodeURIComponent(requestUrl.pathname)
      const requestedPath = resolve(assetsDir, decodedPath.replace(/^[/\\]+/, ''))
      if (!isInsideRoot(assetsDir, requestedPath)) {
        response.writeHead(404)
        response.end()
        return
      }

      const selectedPath = (await isFile(requestedPath)) ? requestedPath : indexPath
      const extension = extname(selectedPath).toLowerCase()
      const isHashedAsset = selectedPath.includes(`${sep}assets${sep}`)
      response.writeHead(200, {
        'Content-Type': MIME_TYPES[extension] ?? 'application/octet-stream',
        'Cache-Control': isHashedAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      })
      if (request.method === 'HEAD') {
        response.end()
        return
      }
      createReadStream(selectedPath).pipe(response)
    })().catch((error: unknown) => {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end(error instanceof Error ? error.message : 'App server failure.')
    })
  })

  const host = options.host ?? '127.0.0.1'
  await new Promise<void>((resolveReady, reject) => {
    server.once('error', reject)
    server.listen(options.port ?? 0, host, () => {
      server.off('error', reject)
      resolveReady()
    })
  })
  const address = server.address()
  if (!address || typeof address === 'string') {
    server.close()
    throw new Error('Local App server did not expose a TCP address.')
  }
  return {
    url: `http://${host}:${address.port}`,
    setWorkspaces(nextWorkspaces) {
      workspaces = nextWorkspaces.map((workspace) => ({ ...workspace }))
      revision += 1
      const notice = `event: invalidate\ndata: ${JSON.stringify({ revision })}\n\n`
      for (const stream of eventStreams) stream.write(notice)
    },
    close: () => {
      for (const stream of eventStreams) stream.end()
      eventStreams.clear()
      return new Promise<void>((resolveClose) => server.close(() => resolveClose()))
    },
  }
}
