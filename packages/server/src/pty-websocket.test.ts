import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { createPtyWebSocketHandler } from './pty-websocket.js'

class MockWebSocket extends EventEmitter {
  readonly OPEN = 1
  readyState = 1
  readonly sent: string[] = []

  send(payload: string): void {
    this.sent.push(payload)
  }
}

describe('createPtyWebSocketHandler', () => {
  it('returns PTY_CREATE_FAILED when session creation throws', () => {
    const ptyManager = {
      create: vi.fn(() => {
        throw new Error('File not found')
      }),
    }

    const ws = new MockWebSocket()
    const handler = createPtyWebSocketHandler(ptyManager as never)

    handler(ws as never)
    ws.emit(
      'message',
      JSON.stringify({
        type: 'create',
        requestId: 'term-1',
      })
    )

    expect(ws.sent.length).toBe(1)
    expect(JSON.parse(ws.sent[0]!)).toMatchObject({
      type: 'error',
      code: 'PTY_CREATE_FAILED',
      sessionId: 'term-1',
      message: 'File not found',
    })
  })
})
