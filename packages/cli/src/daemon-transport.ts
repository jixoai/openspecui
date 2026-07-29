/**
 * Orthogonal intents (created 2026-07-29 Asia/Shanghai):
 * 1. Exchange one bounded newline-delimited daemon command over local IPC.
 * 2. Validate both request and response envelopes at the transport boundary.
 * 3. Distinguish absent endpoints, timeouts, protocol failures, and daemon errors.
 *
 * Original request (2026-07-29): "多次执行 openspecui --app 其实只是在激活同一个 daemon。"
 */
import { randomUUID } from 'node:crypto'
import { connect, type Socket } from 'node:net'
import {
  DAEMON_PROTOCOL_VERSION,
  DaemonRequestSchema,
  DaemonResponseSchema,
  type DaemonCommand,
  type DaemonSuccessData,
} from './daemon-protocol.js'

const MAX_DAEMON_MESSAGE_BYTES = 1024 * 1024

export class DaemonUnavailableError extends Error {
  constructor(message = 'OpenSpecUI App daemon is not running.', options?: ErrorOptions) {
    super(message, options)
    this.name = 'DaemonUnavailableError'
  }
}

export class DaemonCommandError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'DaemonCommandError'
  }
}

export interface DaemonWorkspaceLease {
  close(): Promise<void>
}

/** Keep one Workspace registration bound to a reconnecting serve-owned IPC connection. */
export async function createDaemonWorkspaceLease(options: {
  endpoint: string
  workspace: {
    id: string
    projectDir: string
    backendUrl: string
    credential: string | null
  }
  initialTimeoutMs?: number
  retryDelayMs?: number
}): Promise<DaemonWorkspaceLease> {
  const initialDeadline = Date.now() + (options.initialTimeoutMs ?? 10_000)
  const retryDelayMs = options.retryDelayMs ?? 250
  let socket: Socket | null = null
  let retryTimer: NodeJS.Timeout | null = null
  let closed = false
  let connectedOnce = false
  let resolveInitial: (() => void) | null = null
  let rejectInitial: ((error: Error) => void) | null = null
  const initial = new Promise<void>((resolve, reject) => {
    resolveInitial = resolve
    rejectInitial = reject
  })

  const failInitial = (error: Error) => {
    if (connectedOnce || closed) return
    closed = true
    rejectInitial?.(error)
  }
  const scheduleReconnect = (lastError: Error) => {
    if (closed) return
    if (!connectedOnce && Date.now() >= initialDeadline) {
      failInitial(lastError)
      return
    }
    retryTimer = setTimeout(connectLease, retryDelayMs)
    retryTimer.unref()
  }
  const connectLease = () => {
    if (closed) return
    const request = DaemonRequestSchema.parse({
      protocol: DAEMON_PROTOCOL_VERSION,
      id: randomUUID(),
      command: { type: 'register-workspace', workspace: options.workspace },
    })
    const nextSocket = connect(options.endpoint)
    socket = nextSocket
    let acknowledged = false
    let buffer = ''
    let reconnectError: Error = new DaemonUnavailableError()
    nextSocket.setEncoding('utf8')
    nextSocket.once('connect', () => nextSocket.write(`${JSON.stringify(request)}\n`))
    nextSocket.on('data', (chunk: string) => {
      buffer += chunk
      if (Buffer.byteLength(buffer) > MAX_DAEMON_MESSAGE_BYTES) {
        reconnectError = new Error('Daemon lease response exceeded the message limit.')
        nextSocket.destroy(reconnectError)
        return
      }
      const lineEnd = buffer.indexOf('\n')
      if (lineEnd < 0) return
      try {
        const response = DaemonResponseSchema.parse(JSON.parse(buffer.slice(0, lineEnd)))
        if (response.id !== request.id || !response.ok || response.data.kind !== 'ack') {
          const message = response.ok
            ? 'Daemon rejected Workspace lease acknowledgement.'
            : response.error.message
          reconnectError = new Error(message)
          nextSocket.destroy(reconnectError)
          return
        }
        acknowledged = true
        if (!connectedOnce) {
          connectedOnce = true
          resolveInitial?.()
        }
      } catch (error) {
        reconnectError = new Error('Daemon returned an invalid Workspace lease response.', {
          cause: error,
        })
        nextSocket.destroy(reconnectError)
      }
    })
    nextSocket.once('error', (error) => {
      reconnectError = new DaemonUnavailableError(undefined, { cause: error })
    })
    nextSocket.once('close', () => {
      if (socket === nextSocket) socket = null
      if (!closed) {
        scheduleReconnect(
          acknowledged
            ? new DaemonUnavailableError('App daemon disconnected from Workspace lease.')
            : reconnectError
        )
      }
    })
  }

  connectLease()
  await initial
  return {
    async close() {
      if (closed) return
      closed = true
      if (retryTimer) clearTimeout(retryTimer)
      socket?.destroy()
    },
  }
}

/** Send one validated request and close its short-lived control connection. */
export function sendDaemonCommand(options: {
  endpoint: string
  command: DaemonCommand
  timeoutMs?: number
}): Promise<DaemonSuccessData> {
  const request = DaemonRequestSchema.parse({
    protocol: DAEMON_PROTOCOL_VERSION,
    id: randomUUID(),
    command: options.command,
  })
  const timeoutMs = options.timeoutMs ?? 2_000

  return new Promise((resolve, reject) => {
    const socket = connect(options.endpoint)
    let settled = false
    let buffer = ''
    const settle = (
      result: { ok: true; data: DaemonSuccessData } | { ok: false; error: Error }
    ) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      socket.destroy()
      if (result.ok) resolve(result.data)
      else reject(result.error)
    }
    const timeout = setTimeout(() => {
      settle({ ok: false, error: new DaemonUnavailableError('Timed out contacting App daemon.') })
    }, timeoutMs)

    socket.setEncoding('utf8')
    socket.once('connect', () => socket.write(`${JSON.stringify(request)}\n`))
    socket.on('data', (chunk: string) => {
      buffer += chunk
      if (Buffer.byteLength(buffer) > MAX_DAEMON_MESSAGE_BYTES) {
        settle({ ok: false, error: new Error('Daemon response exceeded the message limit.') })
        return
      }
      const lineEnd = buffer.indexOf('\n')
      if (lineEnd < 0) return
      try {
        const response = DaemonResponseSchema.parse(JSON.parse(buffer.slice(0, lineEnd)))
        if (response.id !== request.id) {
          settle({ ok: false, error: new Error('Daemon response id did not match the request.') })
        } else if (response.ok) {
          settle({ ok: true, data: response.data })
        } else {
          settle({
            ok: false,
            error: new DaemonCommandError(response.error.code, response.error.message),
          })
        }
      } catch (error) {
        settle({
          ok: false,
          error: new Error('Daemon returned an invalid protocol response.', { cause: error }),
        })
      }
    })
    socket.once('error', (error) => {
      settle({ ok: false, error: new DaemonUnavailableError(undefined, { cause: error }) })
    })
    socket.once('end', () => {
      if (!settled) {
        settle({
          ok: false,
          error: new DaemonUnavailableError('App daemon closed without a response.'),
        })
      }
    })
  })
}
