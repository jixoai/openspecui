/**
 * Orthogonal intents (created 2026-07-29 Asia/Shanghai):
 * 1. Own the single-instance daemon IPC bind and credential-memory Workspace ledger.
 * 2. Route validated presentation commands without owning project backend processes.
 * 3. Recover stale Unix endpoints only after a failed liveness probe.
 * 4. Teardown host, connections, and endpoint in a bounded order.
 *
 * Original request (2026-07-29): "start/stop/restart 只针对 daemon，不污染 serve 的项目语义。"
 */
import { chmod, mkdir, rm } from 'node:fs/promises'
import { createServer, type Server, type Socket } from 'node:net'
import {
  DAEMON_PROTOCOL_VERSION,
  DaemonRequestSchema,
  type DaemonHostMode,
  type DaemonResponse,
  type DaemonStatus,
  type DaemonWorkspace,
  type DaemonWorkspaceBinding,
} from './daemon-protocol.js'
import { DaemonUnavailableError, sendDaemonCommand } from './daemon-transport.js'

const MAX_DAEMON_MESSAGE_BYTES = 1024 * 1024

interface PrivateWorkspace extends DaemonWorkspace {
  credential: string | null
  owner: Socket
}

/** Presentation capabilities owned by the daemon host, independent from IPC and backend lifetime. */
export interface DaemonPresentationHost {
  readonly appUrl: string | null
  readonly capabilities: DaemonStatus['capabilities']
  setWorkspaces(workspaces: readonly DaemonWorkspaceBinding[]): Promise<void> | void
  activate(): Promise<void>
  openProjectInBrowser(workspace: {
    id: string
    backendUrl: string
    credential: string | null
  }): Promise<void>
  close(): Promise<void>
}

export interface RunningDaemonServer {
  status: DaemonStatus
  closed: Promise<void>
  close(): Promise<void>
}

export class DaemonAlreadyRunningError extends Error {
  constructor() {
    super('OpenSpecUI App daemon is already running.')
    this.name = 'DaemonAlreadyRunningError'
  }
}

function createErrorResponse(id: string, error: unknown): DaemonResponse {
  return {
    protocol: DAEMON_PROTOCOL_VERSION,
    id,
    ok: false,
    error: {
      code: 'INTERNAL',
      message: error instanceof Error ? error.message : 'Unknown daemon failure.',
    },
  }
}

async function endpointIsLive(endpoint: string): Promise<boolean> {
  try {
    const result = await sendDaemonCommand({
      endpoint,
      command: { type: 'status' },
      timeoutMs: 500,
    })
    return result.kind === 'status'
  } catch (error) {
    return !(error instanceof DaemonUnavailableError)
  }
}

function listen(server: Server, endpoint: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => {
      server.off('listening', onListening)
      reject(error)
    }
    const onListening = () => {
      server.off('error', onError)
      resolve()
    }
    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(endpoint)
  })
}

async function bindEndpoint(options: {
  server: Server
  endpoint: string
  runDir: string
  platform: NodeJS.Platform
}): Promise<void> {
  await mkdir(options.runDir, { recursive: true, mode: 0o700 })
  try {
    await listen(options.server, options.endpoint)
  } catch (error) {
    const code = error instanceof Error && 'code' in error ? error.code : undefined
    if (code !== 'EADDRINUSE') throw error
    if (await endpointIsLive(options.endpoint)) throw new DaemonAlreadyRunningError()
    if (options.platform === 'win32') throw error
    await rm(options.endpoint, { force: true })
    await listen(options.server, options.endpoint)
  }
  if (options.platform !== 'win32') await chmod(options.endpoint, 0o600)
}

/** Start the authoritative daemon IPC server after acquiring its endpoint bind. */
export async function startDaemonServer(options: {
  endpoint: string
  runDir: string
  version: string
  hostMode: DaemonHostMode
  host: DaemonPresentationHost
  platform?: NodeJS.Platform
}): Promise<RunningDaemonServer> {
  const platform = options.platform ?? process.platform
  const workspaces = new Map<string, PrivateWorkspace>()
  const sockets = new Set<Socket>()
  let closing = false
  let closePromise: Promise<void> | null = null
  let resolveClosed: (() => void) | null = null
  const closed = new Promise<void>((resolve) => {
    resolveClosed = resolve
  })

  const status: DaemonStatus = {
    version: options.version,
    pid: process.pid,
    hostMode: options.hostMode,
    appUrl: options.host.appUrl,
    capabilities: options.host.capabilities,
  }
  const publishWorkspaces = () =>
    options.host.setWorkspaces(
      [...workspaces.values()].map((workspace) => ({
        id: workspace.id,
        backendUrl: workspace.backendUrl,
        credential: workspace.credential,
      }))
    )

  const server = createServer((socket) => {
    sockets.add(socket)
    socket.setEncoding('utf8')
    let buffer = ''
    socket.on('data', (chunk: string) => {
      buffer += chunk
      if (Buffer.byteLength(buffer) > MAX_DAEMON_MESSAGE_BYTES) {
        socket.destroy(new Error('Daemon request exceeded the message limit.'))
        return
      }
      let lineEnd = buffer.indexOf('\n')
      while (lineEnd >= 0) {
        const line = buffer.slice(0, lineEnd)
        buffer = buffer.slice(lineEnd + 1)
        void (async () => {
          let requestId = 'invalid-request'
          try {
            const request = DaemonRequestSchema.parse(JSON.parse(line))
            requestId = request.id
            const command = request.command
            let response: DaemonResponse
            if (command.type === 'status') {
              response = {
                protocol: DAEMON_PROTOCOL_VERSION,
                id: request.id,
                ok: true,
                data: { kind: 'status', status },
              }
            } else if (command.type === 'activate') {
              await options.host.activate()
              response = {
                protocol: DAEMON_PROTOCOL_VERSION,
                id: request.id,
                ok: true,
                data: { kind: 'ack' },
              }
            } else if (command.type === 'register-workspace') {
              workspaces.set(command.workspace.id, {
                ...command.workspace,
                registeredAt: Date.now(),
                owner: socket,
              })
              await publishWorkspaces()
              response = {
                protocol: DAEMON_PROTOCOL_VERSION,
                id: request.id,
                ok: true,
                data: { kind: 'ack' },
              }
            } else if (command.type === 'unregister-workspace') {
              workspaces.delete(command.workspaceId)
              await publishWorkspaces()
              response = {
                protocol: DAEMON_PROTOCOL_VERSION,
                id: request.id,
                ok: true,
                data: { kind: 'ack' },
              }
            } else if (command.type === 'list-workspaces') {
              response = {
                protocol: DAEMON_PROTOCOL_VERSION,
                id: request.id,
                ok: true,
                data: {
                  kind: 'workspaces',
                  workspaces: [...workspaces.values()].map(
                    ({ credential: _credential, owner: _owner, ...workspace }) => workspace
                  ),
                },
              }
            } else if (command.type === 'open-workspace-in-browser') {
              const workspace = workspaces.get(command.workspaceId)
              if (!workspace) {
                response = {
                  protocol: DAEMON_PROTOCOL_VERSION,
                  id: request.id,
                  ok: false,
                  error: { code: 'NOT_FOUND', message: 'Workspace is no longer registered.' },
                }
              } else {
                await options.host.openProjectInBrowser({
                  id: workspace.id,
                  backendUrl: workspace.backendUrl,
                  credential: workspace.credential,
                })
                response = {
                  protocol: DAEMON_PROTOCOL_VERSION,
                  id: request.id,
                  ok: true,
                  data: { kind: 'ack' },
                }
              }
            } else {
              response = {
                protocol: DAEMON_PROTOCOL_VERSION,
                id: request.id,
                ok: true,
                data: { kind: 'stopped' },
              }
              setImmediate(() => void close())
            }
            socket.write(`${JSON.stringify(response)}\n`)
          } catch (error) {
            socket.write(`${JSON.stringify(createErrorResponse(requestId, error))}\n`)
          }
        })()
        lineEnd = buffer.indexOf('\n')
      }
    })
    socket.once('close', () => {
      sockets.delete(socket)
      let changed = false
      for (const [workspaceId, workspace] of workspaces) {
        if (workspace.owner === socket) {
          workspaces.delete(workspaceId)
          changed = true
        }
      }
      if (changed) void publishWorkspaces()
    })
  })

  const close = (): Promise<void> => {
    if (closePromise) return closePromise
    closing = true
    closePromise = (async () => {
      for (const socket of sockets) socket.destroy()
      await new Promise<void>((resolve) => server.close(() => resolve()))
      workspaces.clear()
      await publishWorkspaces()
      await options.host.close()
      if (platform !== 'win32') await rm(options.endpoint, { force: true })
      resolveClosed?.()
    })()
    return closePromise
  }

  await bindEndpoint({ server, endpoint: options.endpoint, runDir: options.runDir, platform })
  server.on('error', (error) => {
    if (!closing) process.stderr.write(`App daemon IPC error: ${error.message}\n`)
  })
  return { status, closed, close }
}
