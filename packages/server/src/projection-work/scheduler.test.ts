/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Prove a configured resource limit bounds Projection Work.
 * 2. Prove foreground work cancels cooperative background work before it can starve the queue.
 *
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 */
import { describe, expect, it } from 'vitest'
import { ProjectionWorkScheduler } from './scheduler.js'

interface Deferred<T> {
  promise: Promise<T>
  resolve(value: T): void
}

function createDeferred<T>(): Deferred<T> {
  let resolvePromise: ((value: T) => void) | undefined
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve
  })
  return {
    promise,
    resolve(value) {
      if (!resolvePromise) throw new Error('Deferred resolver was not initialized.')
      resolvePromise(value)
    },
  }
}

function waitForAbort(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve()
      return
    }
    signal.addEventListener('abort', () => resolve(), { once: true })
  })
}

describe('ProjectionWorkScheduler', () => {
  it('cancels cooperative background work so foreground work owns the configured slot', async () => {
    const scheduler = new ProjectionWorkScheduler({
      limits: { cli: 1, filesystem: 1, git: 1, cpu: 1 },
    })
    const backgroundStarted = createDeferred<void>()
    const foregroundStarted = createDeferred<void>()
    const parent = new AbortController()

    const backgroundResult = scheduler.schedule({
      resourceClass: 'cli',
      priority: 'background',
      signal: parent.signal,
      run: async (signal) => {
        backgroundStarted.resolve()
        await waitForAbort(signal)
        throw new DOMException('Background yielded.', 'AbortError')
      },
    })
    const settledBackground = backgroundResult.then(
      () => 'completed' as const,
      (error: unknown) => error
    )

    await backgroundStarted.promise
    const foreground = scheduler.schedule({
      resourceClass: 'cli',
      priority: 'foreground',
      signal: parent.signal,
      run: async () => {
        foregroundStarted.resolve()
        return 'foreground'
      },
    })

    expect((await settledBackground) instanceof DOMException).toBe(true)
    await foregroundStarted.promise
    expect(await foreground).toBe('foreground')
    expect(scheduler.getStats().cli).toEqual({ running: 0, queued: 0 })
  })
})
