/**
 * Orthogonal intents (created 2026-07-22 Asia/Shanghai):
 * 1. Prove Unix PTY input yields instead of spinning when the kernel returns EAGAIN.
 * 2. Prove partial writes preserve byte order and pending-input accounting.
 * 3. Prove closing the owner retires a permanently blocked input retry.
 * 4. Prove Unix fd discovery fails closed while Windows retains its native writer.
 *
 * Owner-reported defect (2026-07-22): Starting Claude can freeze the entire application and prevent page refresh.
 */
import { describe, expect, it, vi } from 'vitest'
import { PtyInputWriter, type PtyFileDescriptorWrite } from './pty-input-writer.js'

function eagain(): NodeJS.ErrnoException {
  return Object.assign(new Error('resource temporarily unavailable'), { code: 'EAGAIN' })
}

describe('PtyInputWriter', () => {
  it('rejects a Unix target without a visible fd instead of calling its native writer', () => {
    const target = { write: vi.fn() }
    const writer = new PtyInputWriter(target, { platform: 'common' })

    expect(writer.write('agent input')).toBe(false)
    expect(target.write).not.toHaveBeenCalled()
  })

  it('retains the native input writer on Windows', () => {
    const target = { write: vi.fn() }
    const writer = new PtyInputWriter(target, { platform: 'windows' })

    expect(writer.write('agent input')).toBe(true)
    expect(target.write).toHaveBeenCalledExactlyOnceWith('agent input')
  })

  it('yields the shared event loop while a Unix PTY remains backpressured', async () => {
    const writeFd = vi.fn<PtyFileDescriptorWrite>(
      (_fd, buffer, _offset, _length, _position, callback) => {
        queueMicrotask(() => callback(eagain(), 0, buffer))
      }
    )
    const target = { fd: 31, write: vi.fn() }
    const writer = new PtyInputWriter(target, {
      platform: 'macos',
      retryDelayMs: 10,
      writeFd,
    })

    expect(writer.write('x'.repeat(4_662))).toBe(true)
    await new Promise<void>((resolve) => setImmediate(resolve))

    expect(writeFd).toHaveBeenCalledTimes(1)
    expect(target.write).not.toHaveBeenCalled()
    expect(writer.pendingBytes).toBe(4_662)
    writer.close()
  })

  it('retries EAGAIN and advances partial writes without reordering input', async () => {
    const calls: Array<{ offset: number; length: number; value: string }> = []
    let attempt = 0
    const writeFd = vi.fn<PtyFileDescriptorWrite>(
      (_fd, buffer, offset, length, _position, callback) => {
        calls.push({ offset, length, value: buffer.toString('utf8', offset, offset + length) })
        attempt += 1
        queueMicrotask(() => {
          if (attempt === 1) {
            callback(eagain(), 0, buffer)
            return
          }
          const bytesWritten = attempt === 2 ? 2 : length
          callback(null, bytesWritten, buffer)
        })
      }
    )
    const writer = new PtyInputWriter(
      { fd: 31, write: vi.fn() },
      {
        platform: 'macos',
        retryDelayMs: 0,
        writeFd,
      }
    )

    writer.write('abcdef')
    await vi.waitFor(() => expect(writer.pendingBytes).toBe(0))

    expect(calls).toEqual([
      { offset: 0, length: 6, value: 'abcdef' },
      { offset: 0, length: 6, value: 'abcdef' },
      { offset: 2, length: 4, value: 'cdef' },
    ])
  })

  it('bounds queued input and retires scheduled retries on close', async () => {
    const writeFd = vi.fn<PtyFileDescriptorWrite>(
      (_fd, buffer, _offset, _length, _position, callback) => {
        queueMicrotask(() => callback(eagain(), 0, buffer))
      }
    )
    const writer = new PtyInputWriter(
      { fd: 31, write: vi.fn() },
      {
        platform: 'macos',
        maxPendingBytes: 4,
        retryDelayMs: 1,
        writeFd,
      }
    )

    expect(writer.write('1234')).toBe(true)
    expect(writer.write('5')).toBe(false)
    writer.close()
    await new Promise((resolve) => setTimeout(resolve, 5))

    expect(writeFd).toHaveBeenCalledTimes(1)
    expect(writer.pendingBytes).toBe(0)
  })
})
