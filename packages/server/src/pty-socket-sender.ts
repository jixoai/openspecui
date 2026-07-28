/**
 * Orthogonal intents (created 2026-07-22 Asia/Shanghai):
 * 1. Bound one PTY WebSocket client's queued output without pausing shared PTY sessions.
 * 2. Limit reconnect replay so one snapshot cannot recreate a slow-client stall.
 *
 * Owner-reported defect (2026-07-21): Starting an Agent terminal can starve the Server and page.
 */
const MAX_PTY_SOCKET_BUFFERED_BYTES = 256 * 1024
const MAX_PTY_REPLAY_BYTES = 128 * 1024

/** Minimal WebSocket surface owned by the bounded PTY sender. */
export interface PtySocketTransport {
  readonly OPEN: number
  readonly bufferedAmount: number
  readonly readyState: number
  send(payload: string): void
  terminate(): void
}

function takeUtf8Tail(value: string, maximumBytes: number): string {
  const encoded = Buffer.from(value)
  if (encoded.byteLength <= maximumBytes) return value

  let start = encoded.byteLength - maximumBytes
  let firstByte = encoded[start]
  while (firstByte !== undefined && (firstByte & 0xc0) === 0x80) {
    start += 1
    firstByte = encoded[start]
  }
  return encoded.subarray(start).toString('utf8')
}

/** Keep only the newest bounded PTY history when a client reconnects. */
export function limitPtyReplayBuffer(value: string): string {
  return takeUtf8Tail(value, MAX_PTY_REPLAY_BYTES)
}

/**
 * Isolate a slow PTY client before its socket queue can starve the shared HTTP event loop.
 * The PTY session remains Server-owned and can be recovered by reconnect/list/attach.
 */
export class PtySocketSender {
  private terminated = false

  constructor(private readonly socket: PtySocketTransport) {}

  /** Serialize and send one typed PTY protocol object; non-serializable payloads fail closed. */
  send(message: object): boolean {
    if (this.terminated || this.socket.readyState !== this.socket.OPEN) return false

    let payload: string | undefined
    try {
      payload = JSON.stringify(message)
    } catch {
      return false
    }
    if (payload === undefined) return false
    if (this.socket.bufferedAmount + Buffer.byteLength(payload) > MAX_PTY_SOCKET_BUFFERED_BYTES) {
      this.terminate()
      return false
    }

    this.socket.send(payload)
    return true
  }

  /** Retire only this PTY transport when queued parsing or socket output crosses its bound. */
  terminate(): void {
    if (this.terminated) return
    this.terminated = true
    this.socket.terminate()
  }
}
