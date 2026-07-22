/**
 * Orthogonal intents (updated 2026-07-23 Asia/Shanghai):
 * 1. Exercise the production navigation coordinator with real detail preparation and wait policy.
 * 2. Prove a cold detail route commits within the 140ms preparation budget before remote data settles.
 * 3. Preserve warm View Transitions, error/timeout route commits, and Escape cancellation.
 *
 * Original request (2026-07-23): "页面数据的加载数据非常慢...切换个页面也等"
 * Derived requirement (2026-07-23): Cold detail prefetch must be opportunistic and use skip-vt.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function createDeferred<T>() {
  let resolvePromise: ((value: T) => void) | undefined
  let rejectPromise: ((reason: unknown) => void) | undefined
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })

  return {
    promise,
    resolve(value: T): void {
      if (!resolvePromise) {
        throw new Error('Deferred promise has not installed its resolver.')
      }
      resolvePromise(value)
    },
    reject(reason: unknown): void {
      if (!rejectPromise) {
        throw new Error('Deferred promise has not installed its rejecter.')
      }
      rejectPromise(reason)
    },
  }
}

const {
  navControllerMock,
  runViewTransitionMock,
  opsxStatusQueryMock,
  primeSubscriptionCacheMock,
} = vi.hoisted(() => ({
  navControllerMock: {
    getLocation: vi.fn(() => ({ pathname: '/changes' })),
    push: vi.fn(),
    replace: vi.fn(),
  },
  runViewTransitionMock: vi.fn(async ({ update }: { update: () => void }) => update()),
  opsxStatusQueryMock: vi.fn(),
  primeSubscriptionCacheMock: vi.fn(),
}))

vi.mock('@/lib/nav-controller', () => ({ navController: navControllerMock }))

vi.mock('@tanstack/react-router', () => ({
  Link: () => null,
  useLocation: () => ({ pathname: '/changes' }),
  useNavigate: () => vi.fn(),
}))

vi.mock('./runtime', () => ({ runViewTransition: runViewTransitionMock }))

vi.mock('@/lib/static-mode', () => ({
  isStaticMode: vi.fn(() => false),
}))

vi.mock('@/lib/trpc', () => ({
  trpcClient: {
    opsx: {
      status: {
        query: opsxStatusQueryMock,
      },
    },
  },
  queryClient: {
    fetchQuery: vi.fn(),
  },
}))

vi.mock('@/lib/use-opsx', async () => {
  const actual = await vi.importActual<typeof import('@/lib/use-opsx')>('@/lib/use-opsx')
  return { getOpsxStatusSubscriptionCacheKey: actual.getOpsxStatusSubscriptionCacheKey }
})

vi.mock('@/lib/use-subscription', () => ({
  getSpecDocumentSubscriptionCacheKey: () => 'spec-cache',
  getArchiveSubscriptionCacheKey: (id: string) => `archive-cache:${id}`,
  primeSubscriptionCache: primeSubscriptionCacheMock,
}))

vi.mock('@/lib/static-data-provider', () => ({
  getOpsxStatus: vi.fn(),
  getSpecDocument: vi.fn(),
  getArchive: vi.fn(),
}))

import { vtNavController } from './navigation'
import { clearNavigationTimingSamples, readLatestNavigationTimingSample } from './navigation-timing'

describe('production detail navigation preparation policy', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    clearNavigationTimingSamples()
    navControllerMock.getLocation.mockReturnValue({ pathname: '/changes' })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('commits a held cold detail route at the 140ms budget before prefetch resolves', async () => {
    const held = createDeferred<{ changeName: string }>()
    opsxStatusQueryMock.mockReturnValueOnce(held.promise)

    const navigation = vtNavController.push('main', '/changes/change-a')
    await vi.advanceTimersByTimeAsync(0)
    expect(opsxStatusQueryMock).toHaveBeenCalledWith({ change: 'change-a' })
    expect(navControllerMock.push).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(139)
    expect(navControllerMock.push).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(navControllerMock.push).toHaveBeenCalledWith('main', '/changes/change-a', undefined)
    expect(runViewTransitionMock).toHaveBeenCalledWith(expect.objectContaining({ intent: null }))
    expect(readLatestNavigationTimingSample('main')).toMatchObject({
      state: 'transition-settled',
      outcome: 'skip-vt',
      phases: [
        { kind: 'requested' },
        { kind: 'prepare-settled', outcome: 'skip-vt' },
        { kind: 'route-update-issued' },
        { kind: 'transition-settled' },
      ],
    })
    expect(document.querySelector('[data-vt-ready-indicator]')).toBeNull()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(navControllerMock.push).toHaveBeenCalledTimes(1)

    held.resolve({ changeName: 'change-a' })
    await navigation
    expect(primeSubscriptionCacheMock).toHaveBeenCalledWith(
      'opsx.subscribeStatus:change-a:undefined:0',
      { changeName: 'change-a' }
    )
  })

  it('keeps the existing View Transition path when detail preparation is warm', async () => {
    opsxStatusQueryMock.mockResolvedValueOnce({ changeName: 'warm-change' })

    await vtNavController.push('main', '/changes/warm-change')

    expect(runViewTransitionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        intent: {
          area: 'main',
          kind: 'route-detail',
          direction: 'forward',
        },
      })
    )
    expect(navControllerMock.push).toHaveBeenCalledWith('main', '/changes/warm-change', undefined)
  })

  it('commits an immediate prefetch error as skip-vt without inventing success', async () => {
    const failure = new Error('detail unavailable')
    opsxStatusQueryMock.mockRejectedValueOnce(failure)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await vtNavController.push('main', '/changes/error-change')

    expect(navControllerMock.push).toHaveBeenCalledWith('main', '/changes/error-change', undefined)
    expect(runViewTransitionMock).toHaveBeenCalledWith(expect.objectContaining({ intent: null }))
    expect(errorSpy).toHaveBeenCalledWith(
      '[VT] Failed to prepare route-detail transition:',
      failure
    )
  })

  it('consumes a late prefetch rejection after the route has committed', async () => {
    const held = createDeferred<{ changeName: string }>()
    const failure = new Error('late detail unavailable')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    opsxStatusQueryMock.mockReturnValueOnce(held.promise)

    const navigation = vtNavController.push('main', '/changes/late-error')
    await vi.advanceTimersByTimeAsync(0)
    expect(opsxStatusQueryMock).toHaveBeenCalledWith({ change: 'late-error' })
    await vi.advanceTimersByTimeAsync(140)
    expect(navControllerMock.push).toHaveBeenCalledWith('main', '/changes/late-error', undefined)

    held.reject(failure)
    await vi.advanceTimersByTimeAsync(0)
    await navigation

    expect(errorSpy).toHaveBeenCalledWith(
      '[VT] Failed to prepare route-detail transition:',
      failure
    )
  })

  it('cancels a held preparation on Escape without issuing a route update', async () => {
    const held = createDeferred<{ changeName: string }>()
    opsxStatusQueryMock.mockReturnValueOnce(held.promise)
    const navigation = vtNavController.push('main', '/changes/cancelled-change')

    await vi.advanceTimersByTimeAsync(0)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await navigation

    expect(navControllerMock.push).not.toHaveBeenCalled()
    expect(runViewTransitionMock).not.toHaveBeenCalled()
    held.resolve({ changeName: 'cancelled-change' })
    await vi.runOnlyPendingTimersAsync()
  })
})
