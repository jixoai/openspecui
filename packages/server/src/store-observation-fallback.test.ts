/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Verify healthy watcher observation produces no periodic Store pull signal.
 * 2. Verify data-home, Store-root, and watcher gaps produce bounded fallback invalidation.
 * 3. Verify data-home retry and timer teardown are deterministic.
 *
 * Original request (2026-07-15): "Polling is only a watcher-failure or missing-path fallback."
 */
import {
  RuntimeInvalidationIndex,
  type OpenSpecDataHomeObservationState,
  type WatcherRuntimeStatus,
} from '@openspecui/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StoreObservationFallbackService } from './store-observation-fallback.js'

function watcherStatus(initialized = true): WatcherRuntimeStatus {
  return {
    initialized,
    rootCount: 1,
    subscriptionCount: 1,
    roots: [
      {
        rootPath: '/data-home',
        referenceCount: 1,
        initialized,
        subscriptionCount: 1,
        generation: 1,
        reinitializeCount: 0,
        lastReinitializeReason: null,
        reinitializeReasonCounts: {
          'drop-events': 0,
          'watcher-error': 0,
          'missing-project-dir': 0,
          'project-dir-replaced': 0,
          manual: 0,
        },
        projectResidency: { state: 'active' },
      },
    ],
  }
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('StoreObservationFallbackService', () => {
  it('remains inert while data-home, Store, and watcher observation are healthy', async () => {
    vi.useFakeTimers()
    const invalidation = new RuntimeInvalidationIndex()
    const service = new StoreObservationFallbackService({
      invalidation,
      dataHomeObservation: { start: vi.fn(), getState: () => 'active' },
      storeObservation: { hasObservationGaps: () => false },
      observationEnvironment: {
        getRoots: () => [{ rootPath: '/data-home', referenceCount: 1 }],
      },
      getWatcherStatus: () => watcherStatus(),
      intervalMs: 100,
    })

    service.start()
    await vi.advanceTimersByTimeAsync(500)
    expect(invalidation.current('stores')).toBe(0)
    expect(invalidation.current('context')).toBe(0)
    await service.dispose()
  })

  it.each(['store-gap', 'watcher-gap'] as const)(
    'invalidates Store and Context only while %s is present',
    async (gap) => {
      vi.useFakeTimers()
      const invalidation = new RuntimeInvalidationIndex()
      const service = new StoreObservationFallbackService({
        invalidation,
        dataHomeObservation: { start: vi.fn(), getState: () => 'active' },
        storeObservation: { hasObservationGaps: () => gap === 'store-gap' },
        observationEnvironment: {
          getRoots: () => [{ rootPath: '/data-home', referenceCount: 1 }],
        },
        getWatcherStatus: () => watcherStatus(gap !== 'watcher-gap'),
        intervalMs: 100,
      })

      service.start()
      await vi.advanceTimersByTimeAsync(100)
      expect(invalidation.current('stores')).toBe(1)
      expect(invalidation.current('context')).toBe(1)
      await service.dispose()
    }
  )

  it('retries failed data-home observation and invalidates once after recovery', async () => {
    vi.useFakeTimers()
    const invalidation = new RuntimeInvalidationIndex()
    const state = { current: 'failed' as OpenSpecDataHomeObservationState }
    const start = vi.fn(async () => {
      state.current = 'active'
    })
    const service = new StoreObservationFallbackService({
      invalidation,
      dataHomeObservation: { start, getState: () => state.current },
      storeObservation: { hasObservationGaps: () => false },
      observationEnvironment: {
        getRoots: () => [{ rootPath: '/data-home', referenceCount: 1 }],
      },
      getWatcherStatus: () => watcherStatus(),
      intervalMs: 100,
    })

    service.start()
    await vi.advanceTimersByTimeAsync(100)
    expect(start).toHaveBeenCalledTimes(1)
    expect(invalidation.current('stores')).toBe(1)
    await service.dispose()
    await vi.advanceTimersByTimeAsync(500)
    expect(invalidation.current('stores')).toBe(1)
  })

  it('waits for an in-flight check without invalidating after teardown', async () => {
    vi.useFakeTimers()
    const invalidation = new RuntimeInvalidationIndex()
    let resolveStart: () => void = () => {}
    const startPromise = new Promise<void>((resolve) => {
      resolveStart = resolve
    })
    const service = new StoreObservationFallbackService({
      invalidation,
      dataHomeObservation: { start: () => startPromise, getState: () => 'failed' },
      storeObservation: { hasObservationGaps: () => false },
      observationEnvironment: { getRoots: () => [] },
      getWatcherStatus: () => null,
      intervalMs: 100,
    })

    service.start()
    await vi.advanceTimersByTimeAsync(100)
    const disposed = service.dispose()
    resolveStart()
    await disposed

    expect(invalidation.current('stores')).toBe(0)
    await vi.advanceTimersByTimeAsync(500)
    expect(invalidation.current('stores')).toBe(0)
  })
})
