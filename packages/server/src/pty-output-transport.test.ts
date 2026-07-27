/**
 * Orthogonal intents (created 2026-07-22 Asia/Shanghai):
 * 1. Prove PTY output batching yields between bounded batches and preserves exit order.
 * 2. Prove a slow socket is terminated without blocking the Server-owned PTY session.
 * 3. Prove reconnect replay stays byte-bounded without splitting Unicode code points.
 *
 * Owner-reported defect (2026-07-21): Starting an Agent terminal can starve the Server and page.
 * Review correction (2026-07-22): A reconnect replay tail must not begin inside a surrogate pair.
 */
import { describe, expect, it, vi } from 'vitest'
import { PtyOutputBatcher } from './pty-output-batcher.js'
import {
  limitPtyReplayBuffer,
  PtySocketSender,
  type PtySocketTransport,
} from './pty-socket-sender.js'

class TestPtySocket implements PtySocketTransport {
  readonly OPEN = 1
  bufferedAmount = 0
  readyState = this.OPEN
  readonly sent: string[] = []
  readonly terminate = vi.fn(() => {
    this.readyState = 3
  })

  send(payload: string): void {
    this.sent.push(payload)
  }
}

function waitForOutputBatch(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve))
}

describe('PTY output transport', () => {
  it('yields between bounded batches and delivers accepted output before exit', async () => {
    const events: string[] = []
    const batcher = new PtyOutputBatcher(
      (data) => events.push(data),
      () => events.push('overflow')
    )

    for (let index = 0; index < 2_000; index += 1) {
      expect(batcher.enqueue(`chunk-${index}\n`)).toBe(true)
    }
    batcher.afterFlush(() => events.push('exit'))

    await waitForOutputBatch()
    expect(events.join('')).toContain('chunk-0\n')
    expect(events.join('')).not.toContain('chunk-1999\n')

    await vi.waitFor(() => {
      expect(events.join('')).toContain('chunk-1999\n')
      expect(events.at(-1)).toBe('exit')
    })
  })

  it('bounds pending and batch output by UTF-8 bytes without splitting code points', async () => {
    const overflow = vi.fn()
    const rejectedBatcher = new PtyOutputBatcher(vi.fn(), overflow)
    const oversized = '😀'.repeat(256 * 1024 + 1)

    expect(rejectedBatcher.enqueue(oversized)).toBe(false)
    expect(overflow).toHaveBeenCalledTimes(1)

    const batches: string[] = []
    const batcher = new PtyOutputBatcher(
      (data) => batches.push(data),
      () => undefined
    )
    const output = '😀'.repeat(5_000)
    const flushed = new Promise<void>((resolve) => {
      expect(batcher.enqueue(output)).toBe(true)
      batcher.afterFlush(resolve)
    })

    await flushed

    expect(batches.length).toBeGreaterThan(1)
    expect(batches.every((batch) => Buffer.byteLength(batch) <= 16 * 1024)).toBe(true)
    expect(batches.join('')).toBe(output)
    expect(batches.every((batch) => !batch.includes('\uFFFD'))).toBe(true)
  })

  it('terminates a slow socket before its buffered output crosses the bound', () => {
    const socket = new TestPtySocket()
    const sender = new PtySocketSender(socket)
    socket.bufferedAmount = Number.MAX_SAFE_INTEGER

    expect(sender.send({ type: 'output', data: 'agent output' })).toBe(false)
    expect(socket.terminate).toHaveBeenCalledTimes(1)
    expect(socket.sent).toEqual([])
  })

  it('fails closed when a protocol object cannot be serialized', () => {
    const socket = new TestPtySocket()
    const sender = new PtySocketSender(socket)
    const cyclic: { self?: object } = {}
    cyclic.self = cyclic

    expect(sender.send({ toJSON: () => undefined })).toBe(false)
    expect(sender.send(cyclic)).toBe(false)
    expect(sender.send({ value: 1n })).toBe(false)
    expect(socket.sent).toEqual([])
  })

  it('keeps reconnect replay valid when the byte tail starts inside an emoji', () => {
    const asciiTail = 'a'.repeat(128 * 1024 - 3)
    const replay = limitPtyReplayBuffer(`😀${asciiTail}`)

    expect(replay).toBe(asciiTail)
    expect(Buffer.byteLength(replay)).toBeLessThanOrEqual(128 * 1024)
  })
})
