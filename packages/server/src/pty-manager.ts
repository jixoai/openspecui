import * as pty from '@lydell/node-pty'
import { EventEmitter } from 'events'

const DEFAULT_SCROLLBACK = 1000
const DEFAULT_MAX_BUFFER_BYTES = 2 * 1024 * 1024

export type PtyPlatform = 'windows' | 'macos' | 'common'

function detectPtyPlatform(): PtyPlatform {
  if (process.platform === 'win32') return 'windows'
  if (process.platform === 'darwin') return 'macos'
  return 'common'
}

export interface PtySessionEvents {
  data: (data: string) => void
  exit: (exitCode: number) => void
  title: (title: string) => void
}

export interface PtySessionInfo {
  id: string
  title: string
  command: string
  args: string[]
  platform: PtyPlatform
  isExited: boolean
  exitCode: number | null
  closeTip?: string
  closeCallbackUrl?: string | Record<string, string>
  createdAt: number
}

function resolveDefaultShell(platform: PtyPlatform, env: NodeJS.ProcessEnv): string {
  if (platform === 'windows') {
    return env.ComSpec?.trim() || 'cmd.exe'
  }
  return env.SHELL?.trim() || '/bin/sh'
}

export function resolvePtyCommand(opts: {
  platform: PtyPlatform
  command?: string
  args?: string[]
  env: NodeJS.ProcessEnv
}): { command: string; args: string[] } {
  const command = opts.command?.trim()
  if (command) {
    return {
      command,
      args: opts.args ?? [],
    }
  }

  return {
    command: resolveDefaultShell(opts.platform, opts.env),
    args: [],
  }
}

export class PtySession extends EventEmitter {
  readonly id: string
  readonly command: string
  readonly args: string[]
  readonly platform: PtyPlatform
  readonly closeTip?: string
  readonly closeCallbackUrl?: string | Record<string, string>
  readonly createdAt: number
  private process: pty.IPty
  private titleInterval: ReturnType<typeof setInterval> | null = null
  private lastTitle = ''
  private buffer: string[] = []
  private bufferByteLength = 0
  private maxBufferLines: number
  private maxBufferBytes: number
  isExited = false
  exitCode: number | null = null

  constructor(
    id: string,
    opts: {
      cols?: number
      rows?: number
      command?: string
      args?: string[]
      closeTip?: string
      closeCallbackUrl?: string | Record<string, string>
      cwd: string
      scrollback?: number
      maxBufferBytes?: number
      platform: PtyPlatform
    }
  ) {
    super()
    this.id = id
    this.createdAt = Date.now()
    const resolvedCommand = resolvePtyCommand({
      platform: opts.platform,
      command: opts.command,
      args: opts.args,
      env: process.env,
    })
    this.command = resolvedCommand.command
    this.args = resolvedCommand.args
    this.platform = opts.platform
    this.closeTip = opts.closeTip
    this.closeCallbackUrl = opts.closeCallbackUrl
    this.maxBufferLines = opts.scrollback ?? DEFAULT_SCROLLBACK
    this.maxBufferBytes = opts.maxBufferBytes ?? DEFAULT_MAX_BUFFER_BYTES

    this.process = pty.spawn(this.command, this.args, {
      name: 'xterm-256color',
      cols: opts.cols ?? 80,
      rows: opts.rows ?? 24,
      cwd: opts.cwd,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
      } as Record<string, string>,
    })

    this.process.onData((data) => {
      this.appendBuffer(data)
      this.emit('data', data)
    })

    this.process.onExit(({ exitCode }) => {
      if (this.titleInterval) {
        clearInterval(this.titleInterval)
        this.titleInterval = null
      }
      this.isExited = true
      this.exitCode = exitCode
      this.emit('exit', exitCode)
    })

    // Poll for process title changes (foreground process name)
    this.titleInterval = setInterval(() => {
      try {
        const title = this.process.process
        if (title && title !== this.lastTitle) {
          this.lastTitle = title
          this.emit('title', title)
        }
      } catch {
        // Process may have exited
      }
    }, 1000)
  }

  get title(): string {
    return this.lastTitle
  }

  private appendBuffer(data: string): void {
    let chunk = data
    if (chunk.length > this.maxBufferBytes) {
      chunk = chunk.slice(-this.maxBufferBytes)
    }

    this.buffer.push(chunk)
    this.bufferByteLength += chunk.length

    while (this.bufferByteLength > this.maxBufferBytes && this.buffer.length > 0) {
      const removed = this.buffer.shift()!
      this.bufferByteLength -= removed.length
    }

    // Trim buffer if it exceeds limits (rough line-based trimming)
    while (this.buffer.length > this.maxBufferLines) {
      const removed = this.buffer.shift()!
      this.bufferByteLength -= removed.length
    }
  }

  getBuffer(): string {
    return this.buffer.join('')
  }

  write(data: string): void {
    if (!this.isExited) {
      this.process.write(data)
    }
  }

  resize(cols: number, rows: number): void {
    if (!this.isExited) {
      this.process.resize(cols, rows)
    }
  }

  close(): void {
    if (this.titleInterval) {
      clearInterval(this.titleInterval)
      this.titleInterval = null
    }
    try {
      this.process.kill()
    } catch {
      // Process may already be dead
    }
    this.removeAllListeners()
  }

  toInfo(): PtySessionInfo {
    return {
      id: this.id,
      title: this.lastTitle,
      command: this.command,
      args: this.args,
      platform: this.platform,
      isExited: this.isExited,
      exitCode: this.exitCode,
      closeTip: this.closeTip,
      closeCallbackUrl: this.closeCallbackUrl,
      createdAt: this.createdAt,
    }
  }
}

export class PtyManager {
  private sessions = new Map<string, PtySession>()
  private idCounter = 0
  private readonly platform: PtyPlatform

  constructor(private defaultCwd: string) {
    this.platform = detectPtyPlatform()
  }

  create(opts: {
    cols?: number
    rows?: number
    command?: string
    args?: string[]
    closeTip?: string
    closeCallbackUrl?: string | Record<string, string>
    scrollback?: number
    maxBufferBytes?: number
  }): PtySession {
    const id = `pty-${++this.idCounter}`
    const session = new PtySession(id, {
      cols: opts.cols,
      rows: opts.rows,
      command: opts.command,
      args: opts.args,
      closeTip: opts.closeTip,
      closeCallbackUrl: opts.closeCallbackUrl,
      cwd: this.defaultCwd,
      scrollback: opts.scrollback,
      maxBufferBytes: opts.maxBufferBytes,
      platform: this.platform,
    })

    this.sessions.set(id, session)

    // Don't auto-delete sessions on exit — keep them for reconnection
    // Clients can explicitly close sessions when done

    return session
  }

  get(id: string): PtySession | undefined {
    return this.sessions.get(id)
  }

  list(): PtySessionInfo[] {
    const result: PtySessionInfo[] = []
    for (const session of this.sessions.values()) {
      result.push(session.toInfo())
    }
    return result
  }

  write(id: string, data: string): void {
    this.sessions.get(id)?.write(data)
  }

  resize(id: string, cols: number, rows: number): void {
    this.sessions.get(id)?.resize(cols, rows)
  }

  close(id: string): void {
    const session = this.sessions.get(id)
    if (session) {
      session.close()
      this.sessions.delete(id)
    }
  }

  closeAll(): void {
    for (const session of this.sessions.values()) {
      session.close()
    }
    this.sessions.clear()
  }
}
