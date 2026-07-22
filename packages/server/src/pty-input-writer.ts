/**
 * Orthogonal intents (created 2026-07-22 Asia/Shanghai):
 * 1. Serialize PTY input without letting a backpressured Unix descriptor spin the Server event loop.
 * 2. Preserve byte order across partial writes and bounded EAGAIN retries.
 * 3. Bound and retire queued input with the owning PTY session.
 *
 * Owner-reported defect (2026-07-22): Starting Claude can freeze the entire application and prevent page refresh.
 */
import { write as writeFileDescriptor } from 'node:fs'

const DEFAULT_MAX_PENDING_BYTES = 1024 * 1024
const DEFAULT_RETRY_DELAY_MS = 10

interface PtyInputTarget {
  /** Runtime-only UnixTerminal accessor omitted by the upstream IPty declaration. */
  readonly fd?: unknown
  write(data: string): void
}

/** Callback-compatible file-descriptor write used by the Unix PTY input owner. */
export type PtyFileDescriptorWrite = (
  fd: number,
  buffer: Buffer,
  offset: number,
  length: number,
  position: null,
  callback: (error: NodeJS.ErrnoException | null, bytesWritten: number, buffer: Buffer) => void
) => void

interface PtyInputWriterOptions {
  platform: 'windows' | 'macos' | 'common'
  maxPendingBytes?: number
  retryDelayMs?: number
  writeFd?: PtyFileDescriptorWrite
  onError?: (error: Error) => void
}

function defaultWriteFd(
  fd: number,
  buffer: Buffer,
  offset: number,
  length: number,
  position: null,
  callback: (error: NodeJS.ErrnoException | null, bytesWritten: number, buffer: Buffer) => void
): void {
  writeFileDescriptor(fd, buffer, offset, length, position, callback)
}

function resolveUnixPtyFd(target: PtyInputTarget): number | null {
  return typeof target.fd === 'number' && Number.isInteger(target.fd) && target.fd >= 0
    ? target.fd
    : null
}

function isRetryableWriteError(error: NodeJS.ErrnoException): boolean {
  return error.code === 'EAGAIN' || error.code === 'EWOULDBLOCK' || error.code === 'EINTR'
}

/**
 * Owns ordered PTY input. Unix writes use the fs thread pool so a descriptor that repeatedly reports
 * writable while returning EAGAIN cannot monopolize the shared HTTP/WebSocket event loop.
 */
export class PtyInputWriter {
  private readonly fd: number | null
  private readonly useNativeWriter: boolean
  private readonly maxPendingBytes: number
  private readonly retryDelayMs: number
  private readonly writeFd: PtyFileDescriptorWrite
  private readonly onError: (error: Error) => void
  private readonly chunks: Buffer[] = []
  private firstChunkOffset = 0
  private writing = false
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private closed = false
  private _pendingBytes = 0

  constructor(
    private readonly target: PtyInputTarget,
    options: PtyInputWriterOptions
  ) {
    this.useNativeWriter = options.platform === 'windows'
    this.fd = options.platform === 'windows' ? null : resolveUnixPtyFd(target)
    this.maxPendingBytes = options.maxPendingBytes ?? DEFAULT_MAX_PENDING_BYTES
    this.retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS
    this.writeFd = options.writeFd ?? defaultWriteFd
    this.onError = options.onError ?? (() => {})
  }

  /** Bytes accepted by this owner but not yet written to the PTY descriptor. */
  get pendingBytes(): number {
    return this._pendingBytes
  }

  /** Enqueue one ordered input payload; false means the owner is closed or its bound would be crossed. */
  write(data: string): boolean {
    if (this.closed) return false
    if (data.length === 0) return true

    if (this.useNativeWriter) {
      this.target.write(data)
      return true
    }
    if (this.fd === null) return false

    const buffer = Buffer.from(data)
    if (this._pendingBytes + buffer.byteLength > this.maxPendingBytes) return false
    this.chunks.push(buffer)
    this._pendingBytes += buffer.byteLength
    this.pump()
    return true
  }

  /** Retire pending input and retries with the PTY session. */
  close(): void {
    if (this.closed) return
    this.closed = true
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.retryTimer = null
    this.chunks.length = 0
    this.firstChunkOffset = 0
    this._pendingBytes = 0
  }

  private pump(): void {
    if (this.closed || this.writing || this.retryTimer) return
    const chunk = this.chunks[0]
    if (!chunk || this.fd === null) return

    this.writing = true
    this.writeFd(
      this.fd,
      chunk,
      this.firstChunkOffset,
      chunk.byteLength - this.firstChunkOffset,
      null,
      (error, bytesWritten) => {
        this.writing = false
        if (this.closed) return

        if (error) {
          if (isRetryableWriteError(error)) {
            this.scheduleRetry()
            return
          }
          this.onError(error)
          this.close()
          return
        }

        if (bytesWritten <= 0) {
          this.scheduleRetry()
          return
        }

        this.firstChunkOffset += bytesWritten
        this._pendingBytes -= bytesWritten
        if (this.firstChunkOffset >= chunk.byteLength) {
          this.chunks.shift()
          this.firstChunkOffset = 0
        }
        setImmediate(() => this.pump())
      }
    )
  }

  private scheduleRetry(): void {
    if (this.closed || this.retryTimer) return
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      this.pump()
    }, this.retryDelayMs)
  }
}
