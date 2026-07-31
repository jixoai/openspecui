/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Own the single-instance daemon IPC bind and credential-memory Workspace ledger.
 * 2. Route validated presentation commands and exact managed-child control.
 * 3. Recover stale Unix endpoints only after a failed liveness probe.
 * 4. Teardown host, connections, and endpoint in a bounded order even when one owner fails.
 *
 * Original request (2026-07-29): "start/stop/restart 只针对 daemon，不污染 serve 的项目语义。"
 */
import { createHash } from 'node:crypto'
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
  type OpenSpecSpawnMode,
} from './daemon-protocol.js'
import { DaemonUnavailableError, sendDaemonCommand } from './daemon-transport.js'

const MAX_DAEMON_MESSAGE_BYTES = 1024 * 1024

interface PrivateWorkspace extends DaemonWorkspace {
  credential: string | null
  owner: Socket | null
  git: DaemonWorkspaceBinding['git']
  shutdown: DaemonWorkspaceBinding['shutdown']
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

/** Daemon wire error codes a managed-project control surface may emit. */
export type DaemonManagedProjectErrorCode =
  | 'MANAGED_PROJECT_INVALID_DIRECTORY'
  | 'MANAGED_PROJECT_REMOTE_CALLER'
  | 'MANAGED_PROJECT_SPAWN_FAILED'
  | 'MANAGED_PROJECT_GENERATION_MISMATCH'

/**
 * Authenticated managed-project control delegated to the daemon IPC server. The server forwards
 * directory-start/stop intents to this owner; it never spawns children itself. External foreground
 * `serve` leases remain physically distinct and are never adopted through this surface.
 */
export interface DaemonManagedProjectControl {
  start(rawProjectDir: string): Promise<
    | {
        ok: true
        startup: {
          canonicalProjectDir: string
          backendUrl: string
          credential: string | null
          generation: number
        }
        alreadyRunning: boolean
      }
    | { ok: false; code: DaemonManagedProjectErrorCode; message: string }
  >
  stop(
    generation: number
  ): Promise<
    | { ok: true; generation: number }
    | { ok: false; code: DaemonManagedProjectErrorCode; message: string }
  >
  settleAllForDaemonStop(): Promise<void>
  captureManagedDirectorySet(): readonly string[]
}

export interface RunningDaemonServer {
  status: DaemonStatus
  closed: Promise<void>
  openWorkspaceInBrowser(workspaceId: string): Promise<'not-found' | 'opened'>
  registerManagedWorkspace(startup: {
    canonicalProjectDir: string
    backendUrl: string
    credential: string | null
    generation: number
    git: DaemonWorkspaceBinding['git']
  }): Promise<{ workspace: DaemonWorkspaceBinding; close(): Promise<void> }>
  resolveManagedWorkspace(generation: number): DaemonWorkspaceBinding | null
  startManagedProject(rawProjectDir: string): ReturnType<DaemonManagedProjectControl['start']>
  stopManagedProject(generation: number): ReturnType<DaemonManagedProjectControl['stop']>
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
  openSpecSpawnMode?: OpenSpecSpawnMode
  host: DaemonPresentationHost
  /**
   * Optional authenticated managed-project control. When absent, managed start/stop commands are
   * rejected as unsupported (e.g. a standalone/remote App delivery with no local daemon authority).
   */
  managedProject?: DaemonManagedProjectControl
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
    openSpecSpawnMode: options.openSpecSpawnMode ?? 'process',
    appUrl: options.host.appUrl,
    capabilities: options.host.capabilities,
  }
  const publishWorkspaces = () =>
    options.host.setWorkspaces(
      [...workspaces.values()].map((workspace) => ({
        id: workspace.id,
        backendUrl: workspace.backendUrl,
        credential: workspace.credential,
        projectDir: workspace.projectDir,
        ownership: workspace.ownership,
        registeredAt: workspace.registeredAt,
        managedGeneration: workspace.managedGeneration,
        shutdown: workspace.shutdown,
        git: workspace.git,
      }))
    )
  const openWorkspaceInBrowser = async (workspaceId: string): Promise<'not-found' | 'opened'> => {
    const workspace = workspaces.get(workspaceId)
    if (!workspace) return 'not-found'
    await options.host.openProjectInBrowser({
      id: workspace.id,
      backendUrl: workspace.backendUrl,
      credential: workspace.credential,
    })
    return 'opened'
  }
  const registerManagedWorkspace: RunningDaemonServer['registerManagedWorkspace'] = async (
    startup
  ) => {
    const id = `workspace-${createHash('sha256')
      .update(startup.canonicalProjectDir)
      .digest('hex')
      .slice(0, 20)}`
    const workspace: PrivateWorkspace = {
      id,
      projectDir: startup.canonicalProjectDir,
      backendUrl: startup.backendUrl,
      credential: startup.credential,
      registeredAt: Date.now(),
      ownership: 'daemon-managed',
      managedGeneration: startup.generation,
      shutdown: 'managed',
      git: startup.git,
      owner: null,
    }
    workspaces.set(id, workspace)
    await publishWorkspaces()
    const publicWorkspace: DaemonWorkspaceBinding = {
      id,
      backendUrl: workspace.backendUrl,
      credential: workspace.credential,
      projectDir: workspace.projectDir,
      ownership: workspace.ownership,
      registeredAt: workspace.registeredAt,
      managedGeneration: workspace.managedGeneration,
      shutdown: workspace.shutdown,
      git: workspace.git,
    }
    return {
      workspace: publicWorkspace,
      async close() {
        const current = workspaces.get(id)
        if (current?.managedGeneration !== startup.generation) return
        workspaces.delete(id)
        await publishWorkspaces()
      },
    }
  }
  const resolveManagedWorkspace = (generation: number): DaemonWorkspaceBinding | null => {
    const workspace = [...workspaces.values()].find(
      (candidate) => candidate.managedGeneration === generation
    )
    if (!workspace) return null
    return {
      id: workspace.id,
      backendUrl: workspace.backendUrl,
      credential: workspace.credential,
      projectDir: workspace.projectDir,
      ownership: workspace.ownership,
      registeredAt: workspace.registeredAt,
      managedGeneration: workspace.managedGeneration,
      shutdown: workspace.shutdown,
      git: workspace.git,
    }
  }
  const startManagedProject: RunningDaemonServer['startManagedProject'] = async (rawProjectDir) => {
    if (!options.managedProject) {
      return {
        ok: false,
        code: 'MANAGED_PROJECT_REMOTE_CALLER',
        message: 'This App daemon does not own managed project services.',
      }
    }
    return options.managedProject.start(rawProjectDir)
  }
  const stopManagedProject: RunningDaemonServer['stopManagedProject'] = async (generation) => {
    if (!options.managedProject) {
      return {
        ok: false,
        code: 'MANAGED_PROJECT_REMOTE_CALLER',
        message: 'This App daemon does not own managed project services.',
      }
    }
    return options.managedProject.stop(generation)
  }

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
                ownership: 'external',
                managedGeneration: null,
                shutdown: 'close-only',
                git: null,
                owner: socket,
              })
              await publishWorkspaces()
              response = {
                protocol: DAEMON_PROTOCOL_VERSION,
                id: request.id,
                ok: true,
                data: { kind: 'ack' },
              }
            } else if (command.type === 'start-managed-project') {
              if (!options.managedProject) {
                response = {
                  protocol: DAEMON_PROTOCOL_VERSION,
                  id: request.id,
                  ok: false,
                  error: {
                    code: 'MANAGED_PROJECT_REMOTE_CALLER',
                    message: 'This App daemon does not own managed project services.',
                  },
                }
              } else {
                const result = await options.managedProject.start(command.projectDir)
                if (result.ok) {
                  await publishWorkspaces()
                  response = {
                    protocol: DAEMON_PROTOCOL_VERSION,
                    id: request.id,
                    ok: true,
                    data: {
                      kind: 'managed-project-started',
                      startup: {
                        canonicalProjectDir: result.startup.canonicalProjectDir,
                        backendUrl: result.startup.backendUrl,
                        credential: result.startup.credential,
                        generation: result.startup.generation,
                        alreadyRunning: result.alreadyRunning,
                      },
                    },
                  }
                } else {
                  response = {
                    protocol: DAEMON_PROTOCOL_VERSION,
                    id: request.id,
                    ok: false,
                    error: { code: result.code, message: result.message },
                  }
                }
              }
            } else if (command.type === 'stop-managed-project') {
              if (!options.managedProject) {
                response = {
                  protocol: DAEMON_PROTOCOL_VERSION,
                  id: request.id,
                  ok: false,
                  error: {
                    code: 'MANAGED_PROJECT_REMOTE_CALLER',
                    message: 'This App daemon does not own managed project services.',
                  },
                }
              } else {
                const result = await options.managedProject.stop(command.generation)
                if (result.ok) {
                  await publishWorkspaces()
                  response = {
                    protocol: DAEMON_PROTOCOL_VERSION,
                    id: request.id,
                    ok: true,
                    data: { kind: 'managed-project-stopped', generation: result.generation },
                  }
                } else {
                  response = {
                    protocol: DAEMON_PROTOCOL_VERSION,
                    id: request.id,
                    ok: false,
                    error: { code: result.code, message: result.message },
                  }
                }
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
            } else if (command.type === 'prepare-restart') {
              response = {
                protocol: DAEMON_PROTOCOL_VERSION,
                id: request.id,
                ok: true,
                data: {
                  kind: 'restart-prepared',
                  projectDirs: [...(options.managedProject?.captureManagedDirectorySet() ?? [])],
                },
              }
              setImmediate(() => {
                void close().catch(() => {
                  process.stderr.write('App daemon restart preparation did not settle cleanly.\n')
                })
              })
            } else if (command.type === 'open-workspace-in-browser') {
              if ((await openWorkspaceInBrowser(command.workspaceId)) === 'not-found') {
                response = {
                  protocol: DAEMON_PROTOCOL_VERSION,
                  id: request.id,
                  ok: false,
                  error: { code: 'NOT_FOUND', message: 'Workspace is no longer registered.' },
                }
              } else {
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
              setImmediate(() => {
                void close().catch(() => {
                  process.stderr.write('App daemon shutdown did not release every host resource.\n')
                })
              })
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
      let firstFailure: unknown
      const attempt = async (operation: () => Promise<void>): Promise<void> => {
        try {
          await operation()
        } catch (error) {
          firstFailure ??= error
        }
      }
      for (const socket of sockets) socket.destroy()
      await attempt(() => new Promise<void>((resolve) => server.close(() => resolve())))
      // Settle every daemon-managed project child before releasing presentation. External foreground
      // `serve` leases are untouched; they remain owned by their own processes.
      if (options.managedProject) {
        await attempt(() => options.managedProject!.settleAllForDaemonStop())
      }
      workspaces.clear()
      await attempt(async () => void (await publishWorkspaces()))
      await attempt(() => options.host.close())
      if (platform !== 'win32') {
        await attempt(() => rm(options.endpoint, { force: true }))
      }
      resolveClosed?.()
      if (firstFailure !== undefined) throw firstFailure
    })()
    return closePromise
  }

  await bindEndpoint({ server, endpoint: options.endpoint, runDir: options.runDir, platform })
  server.on('error', (error) => {
    if (!closing) process.stderr.write(`App daemon IPC error: ${error.message}\n`)
  })
  return {
    status,
    closed,
    openWorkspaceInBrowser,
    registerManagedWorkspace,
    resolveManagedWorkspace,
    startManagedProject,
    stopManagedProject,
    close,
  }
}
