/**
 * Orthogonal intents (created 2026-07-22 Asia/Shanghai):
 * 1. Coalesce one PTY client's output into bounded batches.
 * 2. Yield between batches so shared Server work can enter the event loop.
 * 3. Retire queued output when the socket attachment is replaced or closed.
 *
 * Owner clarification (2026-07-22): Starting an Agent can make the whole application unresponsive.
 */

const MAX_PTY_OUTPUT_BATCH_BYTES = 16 * 1024
const MAX_PTY_PENDING_OUTPUT_BYTES = 1024 * 1024

function isUtf8ContinuationByte(value: number | undefined): boolean {
  return value !== undefined && (value & 0xc0) === 0x80
}

function takeWholeUtf8Prefix(buffer: Buffer, offset: number, maximumBytes: number): number {
  const available = buffer.byteLength - offset
  if (available <= maximumBytes) return available

  let end = offset + maximumBytes
  while (end > offset && isUtf8ContinuationByte(buffer[end])) {
    end -= 1
  }
  return end - offset
}

/** Fair event-loop pump for output already retained by the Server-owned PTY session buffer. */
export class PtyOutputBatcher {
  private chunks: Buffer[] = []
  private firstChunkIndex = 0
  private firstChunkOffset = 0
  private pendingBytes = 0
  private scheduledFlush: ReturnType<typeof setImmediate> | null = null
  private idleCallbacks: Array<() => void> = []
  private closed = false

  constructor(
    private readonly flushBatch: (data: string) => void,
    private readonly overflow: () => void
  ) {}

  enqueue(data: string): boolean {
    if (this.closed || data.length === 0) return false
    const chunk = Buffer.from(data)
    if (this.pendingBytes + chunk.byteLength > MAX_PTY_PENDING_OUTPUT_BYTES) {
      this.close()
      this.overflow()
      return false
    }

    this.chunks.push(chunk)
    this.pendingBytes += chunk.byteLength
    this.scheduleFlush()
    return true
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    if (this.scheduledFlush) clearImmediate(this.scheduledFlush)
    this.scheduledFlush = null
    this.chunks = []
    this.firstChunkIndex = 0
    this.firstChunkOffset = 0
    this.pendingBytes = 0
    this.idleCallbacks = []
  }

  /** Run a lifecycle event only after output already accepted by this attachment is delivered. */
  afterFlush(callback: () => void): void {
    if (this.closed) return
    if (this.pendingBytes === 0 && this.scheduledFlush === null) {
      callback()
      return
    }
    this.idleCallbacks.push(callback)
  }

  private scheduleFlush(): void {
    if (this.closed || this.scheduledFlush) return
    this.scheduledFlush = setImmediate(() => {
      this.scheduledFlush = null
      this.flushNextBatch()
    })
  }

  private flushNextBatch(): void {
    if (this.closed || this.pendingBytes === 0) return

    const parts: Buffer[] = []
    let remaining = MAX_PTY_OUTPUT_BATCH_BYTES
    while (remaining > 0) {
      const chunk = this.chunks[this.firstChunkIndex]
      if (chunk === undefined) break

      const count = takeWholeUtf8Prefix(chunk, this.firstChunkOffset, remaining)
      if (count === 0) break

      parts.push(chunk.subarray(this.firstChunkOffset, this.firstChunkOffset + count))
      this.firstChunkOffset += count
      this.pendingBytes -= count
      remaining -= count

      if (this.firstChunkOffset === chunk.byteLength) {
        this.firstChunkIndex += 1
        this.firstChunkOffset = 0
      }
    }

    if (this.firstChunkIndex > 0 && this.firstChunkIndex * 2 >= this.chunks.length) {
      this.chunks = this.chunks.slice(this.firstChunkIndex)
      this.firstChunkIndex = 0
    }

    if (parts.length > 0) this.flushBatch(Buffer.concat(parts).toString('utf8'))
    if (this.pendingBytes > 0) {
      this.scheduleFlush()
      return
    }

    const callbacks = this.idleCallbacks
    this.idleCallbacks = []
    for (const callback of callbacks) callback()
  }
}
