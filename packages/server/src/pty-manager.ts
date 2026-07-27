/**
 * Orthogonal intents (updated 2026-07-22 Asia/Shanghai):
 * 1. Own PTY session process, ordered input, buffer, title, and lifecycle state.
 * 2. Spawn each session at an explicitly resolved launch-project or planning-root cwd and retain its immutable Root generation.
 * 3. Preserve the inherited backend environment, including XDG_DATA_HOME, across cwd targets.
 * 4. List and close server-owned sessions for reconnect and teardown.
 *
 * Original request (2026-07-16): "3.8 Terminal exposes explicit launch-project cwd and planning-root cwd while preserving inherited XDG_DATA_HOME"
 * Owner-reported defect (2026-07-21): Pre-created Agent terminals are absent from Compose Send.
 * Owner-reported defect (2026-07-22): Starting Claude can freeze the Server and prevent page refresh.
 */
import * as pty from '@lydell/node-pty'
import {
  resolveTerminalShellDefaults,
  type TerminalCwdTarget,
  type TerminalShellDefaults,
  type TerminalTitleTarget,
} from '@openspecui/core'
import { EventEmitter } from 'events'
import { PtyInputWriter } from './pty-input-writer.js'

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
  cwdTarget: TerminalCwdTarget
  initialCwd: string
  /** Immutable Server-stamped generation for a Planning terminal; Launch terminals carry null. */
  rootGeneration: string | null
}

/** Build the PTY environment without project-owned overlays or target-specific mutation. */
export function resolvePtySpawnEnvironment(env: NodeJS.ProcessEnv): Record<string, string> {
  const inherited: Record<string, string> = {}
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) inherited[key] = value
  }
  inherited.TERM = 'xterm-256color'
  return inherited
}

function resolveDefaultShell(platform: PtyPlatform, env: NodeJS.ProcessEnv): string {
  if (platform === 'windows') {
    return env.ComSpec?.trim() || 'cmd.exe'
  }
  return env.SHELL?.trim() || '/bin/sh'
}

export function resolvePtyShellDefaults(opts: {
  platform: PtyPlatform
  env: NodeJS.ProcessEnv
}): TerminalShellDefaults {
  return resolveTerminalShellDefaults({
    platform: opts.platform,
    env: {
      SHELL: opts.env.SHELL,
      ComSpec: opts.env.ComSpec,
    },
  })
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
  readonly cwdTarget: TerminalCwdTarget
  readonly initialCwd: string
  readonly rootGeneration: string | null
  private process: pty.IPty
  private inputWriter: PtyInputWriter
  private titleInterval: ReturnType<typeof setInterval> | null = null
  private lastTitle = ''
  private lastOscIconTitle = ''
  private lastOscWindowTitle = ''
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
      cwdTarget: TerminalCwdTarget
      rootGeneration: string | null
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
    this.cwdTarget = opts.cwdTarget
    this.initialCwd = opts.cwd
    this.rootGeneration = opts.rootGeneration
    this.maxBufferLines = opts.scrollback ?? DEFAULT_SCROLLBACK
    this.maxBufferBytes = opts.maxBufferBytes ?? DEFAULT_MAX_BUFFER_BYTES

    this.process = pty.spawn(this.command, this.args, {
      name: 'xterm-256color',
      cols: opts.cols ?? 80,
      rows: opts.rows ?? 24,
      cwd: opts.cwd,
      env: resolvePtySpawnEnvironment(process.env),
    })
    this.inputWriter = new PtyInputWriter(this.process, { platform: this.platform })

    this.process.onData((data) => {
      this.appendBuffer(data)
      this.emit('data', data)
    })

    this.process.onExit(({ exitCode }) => {
      this.inputWriter.close()
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

  get targetTitle(): string {
    return this.lastOscIconTitle || this.lastOscWindowTitle || this.lastTitle || this.command
  }

  get oscTitle(): string {
    return this.lastOscIconTitle || this.lastOscWindowTitle
  }

  setTargetTitle(title: string, target: TerminalTitleTarget): void {
    const trimmed = title.trim()
    if (!trimmed) return
    if (target === 'icon' || target === 'both') {
      this.lastOscIconTitle = trimmed
    }
    if (target === 'window' || target === 'both') {
      this.lastOscWindowTitle = trimmed
    }
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

  write(data: string): boolean {
    return !this.isExited && this.inputWriter.write(data)
  }

  resize(cols: number, rows: number): void {
    if (!this.isExited) {
      this.process.resize(cols, rows)
    }
  }

  close(): void {
    this.inputWriter.close()
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
      cwdTarget: this.cwdTarget,
      initialCwd: this.initialCwd,
      rootGeneration: this.rootGeneration,
    }
  }
}

export class PtyManager {
  private sessions = new Map<string, PtySession>()
  private idCounter = 0
  private readonly platform: PtyPlatform

  constructor() {
    this.platform = detectPtyPlatform()
  }

  getShellDefaults(): TerminalShellDefaults {
    return resolvePtyShellDefaults({
      platform: this.platform,
      env: process.env,
    })
  }

  create(opts: {
    cols?: number
    rows?: number
    command?: string
    args?: string[]
    closeTip?: string
    closeCallbackUrl?: string | Record<string, string>
    cwdTarget: TerminalCwdTarget
    cwd: string
    rootGeneration: string | null
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
      cwd: opts.cwd,
      cwdTarget: opts.cwdTarget,
      rootGeneration: opts.rootGeneration,
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

  write(id: string, data: string): boolean {
    return this.sessions.get(id)?.write(data) ?? false
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
