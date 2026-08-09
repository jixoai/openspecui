/**
 * Orthogonal intents (updated 2026-08-04 Asia/Shanghai):
 * 1. Serve the same-release App shell from a loopback-only HTTP endpoint.
 * 2. Enforce platform-neutral bounded static paths, MIME types, cache policy, and SPA fallback.
 * 3. Publish transient Workspace authority through snapshot Pull, invalidation Push, and open-by-id.
 * 4. Expose same-origin managed directory start/Stop without accepting executable or port input.
 * 5. Publish the daemon-owned Favorites/Recent catalog and same-origin favorite mutations.
 *
 * Original request (2026-07-29): "daemon 使用随 CLI 发布的本地 App 外壳。"
 * Original request (2026-08-04): "Make pnpm openspecui start and equivalent package scripts work on Windows."
 */
import {
  AppDaemonOpenWorkspaceResponseSchema,
  AppDaemonStartManagedProjectRequestSchema,
  AppDaemonStartManagedProjectResponseSchema,
  AppDaemonStopManagedProjectRequestSchema,
  AppDaemonStopManagedProjectResponseSchema,
  type AppDaemonStartManagedProjectResponse,
  type AppDaemonStopManagedProjectResponse,
} from '@openspecui/core/app-daemon-control'
import {
  AppDaemonSetWorkspaceDirectoryFavoriteRequestSchema,
  AppDaemonSetWorkspaceDirectoryFavoriteResponseSchema,
  AppDaemonWorkspaceDirectorySnapshotSchema,
  createEmptyWorkspaceDirectoryCatalog,
  WorkspaceDirectoryCatalogSchema,
  type AppDaemonSetWorkspaceDirectoryFavoriteResponse,
  type WorkspaceDirectoryCatalog,
} from '@openspecui/core/workspace-directory-catalog'
import { createReadStream } from 'node:fs'
import { access, stat } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createServer } from 'node:http'
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
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
const MAX_CONTROL_BODY_BYTES = 64 * 1024

export interface LocalAppServer {
  url: string
  setWorkspaces(workspaces: readonly DaemonWorkspaceBinding[]): void
  setWorkspaceDirectoryCatalog(catalog: WorkspaceDirectoryCatalog): void
  close(): Promise<void>
}

function isInsideRoot(root: string, candidate: string): boolean {
  const path = relative(root, candidate)
  return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path))
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile()
  } catch {
    return false
  }
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  let body = ''
  for await (const chunk of request) {
    body += typeof chunk === 'string' ? chunk : chunk.toString('utf8')
    if (Buffer.byteLength(body) > MAX_CONTROL_BODY_BYTES) {
      throw new Error('Managed project request exceeded the body limit.')
    }
  }
  return JSON.parse(body)
}

function writeJson(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  response.end(JSON.stringify(payload))
}

function isExactOriginControl(request: IncomingMessage, serverOrigin: string | null): boolean {
  if (!serverOrigin) return false
  const origin = request.headers.origin
  if (origin !== serverOrigin) return false
  const fetchSite = request.headers['sec-fetch-site']
  return fetchSite === undefined || fetchSite === 'same-origin'
}

/** Start an ephemeral loopback server over one immutable App asset directory. */
export async function startLocalAppServer(options: {
  assetsDir: string
  openWorkspaceInBrowser(workspaceId: string): Promise<'not-found' | 'opened'>
  startManagedProject?(projectDir: string): Promise<AppDaemonStartManagedProjectResponse>
  stopManagedProject?(generation: number): Promise<AppDaemonStopManagedProjectResponse>
  initialWorkspaceDirectoryCatalog?: WorkspaceDirectoryCatalog
  recordSuccessfulDirectoryOpen?(canonicalPath: string): Promise<WorkspaceDirectoryCatalog>
  setWorkspaceDirectoryFavorite?(
    canonicalPath: string,
    favorite: boolean
  ): Promise<WorkspaceDirectoryCatalog>
  host?: string
  port?: number
}): Promise<LocalAppServer> {
  const assetsDir = resolve(options.assetsDir)
  const indexPath = join(assetsDir, 'index.html')
  await access(indexPath)
  const eventStreams = new Set<ServerResponse>()
  let revision = 0
  let workspaces: readonly DaemonWorkspaceBinding[] = []
  let workspaceDirectoryCatalog = WorkspaceDirectoryCatalogSchema.parse(
    options.initialWorkspaceDirectoryCatalog ?? createEmptyWorkspaceDirectoryCatalog()
  )
  let serverOrigin: string | null = null
  const publishInvalidation = () => {
    revision += 1
    const notice = `event: invalidate\ndata: ${JSON.stringify({ revision })}\n\n`
    for (const stream of eventStreams) stream.write(notice)
  }
  const server = createServer((request, response) => {
    void (async () => {
      const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1')
      const openWorkspaceMatch = requestUrl.pathname.match(
        /^\/api\/daemon\/workspaces\/([^/]+)\/open$/
      )
      const isControlPost =
        request.method === 'POST' &&
        (requestUrl.pathname === '/api/daemon/managed-projects/start' ||
          requestUrl.pathname === '/api/daemon/managed-projects/stop' ||
          requestUrl.pathname === '/api/daemon/workspace-directories/favorite' ||
          openWorkspaceMatch !== null)
      if (isControlPost && !isExactOriginControl(request, serverOrigin)) {
        writeJson(response, 403, { error: 'Daemon control requires the exact local App origin.' })
        return
      }
      if (
        request.method === 'POST' &&
        requestUrl.pathname === '/api/daemon/workspace-directories/favorite'
      ) {
        let payload: AppDaemonSetWorkspaceDirectoryFavoriteResponse
        try {
          const input = AppDaemonSetWorkspaceDirectoryFavoriteRequestSchema.parse(
            await readJsonBody(request)
          )
          if (!options.setWorkspaceDirectoryFavorite) {
            payload = {
              ok: false,
              error: {
                code: 'PERSISTENCE_FAILED',
                message: 'Workspace directory persistence is unavailable.',
              },
            }
          } else {
            try {
              workspaceDirectoryCatalog = WorkspaceDirectoryCatalogSchema.parse(
                await options.setWorkspaceDirectoryFavorite(input.canonicalPath, input.favorite)
              )
              publishInvalidation()
              payload = { ok: true }
            } catch (error) {
              payload = {
                ok: false,
                error: {
                  code: 'PERSISTENCE_FAILED',
                  message:
                    error instanceof Error
                      ? error.message
                      : 'Failed to persist Workspace favorite state.',
                },
              }
            }
          }
        } catch (error) {
          payload = {
            ok: false,
            error: {
              code: 'INVALID_REQUEST',
              message:
                error instanceof Error ? error.message : 'Invalid Workspace favorite request.',
            },
          }
        }
        const parsed = AppDaemonSetWorkspaceDirectoryFavoriteResponseSchema.parse(payload)
        writeJson(
          response,
          parsed.ok ? 200 : parsed.error.code === 'INVALID_REQUEST' ? 400 : 500,
          parsed
        )
        return
      }
      if (
        request.method === 'POST' &&
        requestUrl.pathname === '/api/daemon/managed-projects/start'
      ) {
        let payload: AppDaemonStartManagedProjectResponse
        try {
          const input = AppDaemonStartManagedProjectRequestSchema.parse(await readJsonBody(request))
          payload = options.startManagedProject
            ? await options.startManagedProject(input.projectDir)
            : {
                ok: false,
                error: {
                  code: 'UNSUPPORTED',
                  message: 'This App delivery cannot start local project services.',
                },
              }
        } catch (error) {
          payload = {
            ok: false,
            error: {
              code: 'INVALID_REQUEST',
              message: error instanceof Error ? error.message : 'Invalid managed project request.',
            },
          }
        }
        const parsed = AppDaemonStartManagedProjectResponseSchema.parse(payload)
        if (parsed.ok && options.recordSuccessfulDirectoryOpen) {
          try {
            workspaceDirectoryCatalog = WorkspaceDirectoryCatalogSchema.parse(
              await options.recordSuccessfulDirectoryOpen(parsed.workspace.projectDir)
            )
            publishInvalidation()
          } catch {
            // The backend is already running and admitted. Catalog persistence failure cannot
            // truthfully turn that settled runtime success into a failed start response.
          }
        }
        writeJson(
          response,
          parsed.ok ? 200 : parsed.error.code === 'UNSUPPORTED' ? 404 : 400,
          parsed
        )
        return
      }
      if (
        request.method === 'POST' &&
        requestUrl.pathname === '/api/daemon/managed-projects/stop'
      ) {
        let payload: AppDaemonStopManagedProjectResponse
        try {
          const input = AppDaemonStopManagedProjectRequestSchema.parse(await readJsonBody(request))
          payload = options.stopManagedProject
            ? await options.stopManagedProject(input.generation)
            : {
                ok: false,
                error: {
                  code: 'UNSUPPORTED',
                  message: 'This App delivery cannot stop local project services.',
                },
              }
        } catch (error) {
          payload = {
            ok: false,
            error: {
              code: 'INVALID_REQUEST',
              message: error instanceof Error ? error.message : 'Invalid managed project request.',
            },
          }
        }
        const parsed = AppDaemonStopManagedProjectResponseSchema.parse(payload)
        writeJson(
          response,
          parsed.ok ? 200 : parsed.error.code === 'UNSUPPORTED' ? 404 : 400,
          parsed
        )
        return
      }
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
          writeJson(response, result === 'opened' ? 200 : 404, payload)
        } catch {
          const payload = AppDaemonOpenWorkspaceResponseSchema.parse({
            ok: false,
            error: {
              code: 'PRESENTATION_FAILED',
              message: 'Failed to open the registered Workspace in the system browser.',
            },
          })
          writeJson(response, 502, payload)
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
      if (requestUrl.pathname === '/api/daemon/workspace-directories') {
        const snapshot = AppDaemonWorkspaceDirectorySnapshotSchema.parse({
          revision,
          catalog: workspaceDirectoryCatalog,
        })
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
  serverOrigin = `http://${host}:${address.port}`
  return {
    url: serverOrigin,
    setWorkspaces(nextWorkspaces) {
      workspaces = nextWorkspaces.map((workspace) => ({ ...workspace }))
      publishInvalidation()
    },
    setWorkspaceDirectoryCatalog(nextCatalog) {
      workspaceDirectoryCatalog = WorkspaceDirectoryCatalogSchema.parse(nextCatalog)
      publishInvalidation()
    },
    close: () => {
      for (const stream of eventStreams) stream.end()
      eventStreams.clear()
      return new Promise<void>((resolveClose) => server.close(() => resolveClose()))
    },
  }
}
