/**
 * Orthogonal intents (updated 2026-07-22 Asia/Shanghai):
 * 1. Prove View Transition navigation prepares the exact target route.
 * 2. Prove Git handoff state and target scope reach detail preparation unchanged.
 * 3. Prove prepared navigation produces causally ordered timing evidence.
 *
 * Original request (2026-07-16): "接下来，你来接手后续工作"
 * Derived requirement (2026-07-19): Checkpoint 6.11 carries Git origin provenance into VT.
 * Original request (2026-07-22): "整个过程中，几乎都在 Loading，切换个页面也等，做任何动作也在等，给我的感觉就是非常卡。"
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type PrepareOutcome = 'ready' | 'cancelled' | 'skip-vt'

function createDeferred<T>() {
  let resolvePromise: ((value: T) => void) | null = null
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve
  })

  return {
    promise,
    resolve(value: T): void {
      if (!resolvePromise) {
        throw new Error('Deferred promise has not installed its resolver.')
      }
      resolvePromise(value)
    },
  }
}

const { navControllerMock, prepareDetailMock, runViewTransitionMock } = vi.hoisted(() => ({
  navControllerMock: {
    getLocation: vi.fn(() => ({ pathname: '/git' })),
    push: vi.fn(),
    replace: vi.fn(),
  },
  prepareDetailMock: vi.fn<(input: { pathname: string }) => Promise<PrepareOutcome>>(),
  runViewTransitionMock: vi.fn(async ({ update }: { update: () => void }) => update()),
}))

vi.mock('@/lib/nav-controller', () => ({ navController: navControllerMock }))

vi.mock('@tanstack/react-router', () => ({
  Link: () => null,
  useLocation: () => ({ pathname: '/git' }),
  useNavigate: () => vi.fn(),
}))

vi.mock('./detail-prepare', () => ({
  prepareRouteDetailViewTransition: prepareDetailMock,
}))

vi.mock('./runtime', () => ({
  runViewTransition: runViewTransitionMock,
}))

import { vtNavController } from './navigation'
import {
  clearNavigationTimingSamples,
  readCurrentNavigationTimingSample,
  readNavigationTimingSamples,
} from './navigation-timing'

describe('vtNavController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearNavigationTimingSamples()
    navControllerMock.getLocation.mockReturnValue({ pathname: '/git' })
    prepareDetailMock.mockResolvedValue('ready')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('forwards Git handoff state and the target scope to detail preparation', async () => {
    const state = {
      __vtHandoff: {
        family: 'git',
        entityId: 'abc12345',
        bindingToken: 'planning-binding-a',
      },
    }

    await vtNavController.push('bottom', '/git/commit/abc12345?gitScope=planning', state)

    expect(prepareDetailMock).toHaveBeenCalledWith({
      intent: {
        area: 'bottom',
        kind: 'route-detail',
        direction: 'forward',
      },
      pathname: '/git/commit/abc12345',
      search: '?gitScope=planning',
      state,
    })
    expect(navControllerMock.push).toHaveBeenCalledWith(
      'bottom',
      '/git/commit/abc12345?gitScope=planning',
      state
    )
  })

  it('records ordered monotonic phases through the production detail-navigation coordinator', async () => {
    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(120)
      .mockReturnValueOnce(140)
      .mockReturnValueOnce(180)
      .mockReturnValueOnce(200)

    await vtNavController.push('bottom', '/git/commit/abc12345')

    expect(readNavigationTimingSamples()).toEqual([
      {
        attemptId: 'navigation-1',
        area: 'bottom',
        fromPath: '/git',
        toPath: '/git/commit/abc12345',
        state: 'transition-settled',
        outcome: 'ready',
        phases: [
          { kind: 'requested', at: 100, elapsedMs: 0 },
          { kind: 'prepare-settled', outcome: 'ready', at: 120, elapsedMs: 20 },
          { kind: 'route-committed', at: 140, elapsedMs: 40 },
          { kind: 'transition-settled', at: 180, elapsedMs: 80 },
        ],
      },
    ])
  })

  it('records cancellation without invoking the route update or inventing later phases', async () => {
    prepareDetailMock.mockResolvedValue('cancelled')

    await vtNavController.push('bottom', '/git/commit/abc12345')

    expect(navControllerMock.push).not.toHaveBeenCalled()
    expect(runViewTransitionMock).not.toHaveBeenCalled()
    expect(readCurrentNavigationTimingSample('bottom')).toMatchObject({
      state: 'cancelled',
      outcome: 'cancelled',
      phases: [{ kind: 'requested' }, { kind: 'prepare-settled', outcome: 'cancelled' }],
    })
  })

  it('continues a skip-vt preparation through the real route update and settlement phases', async () => {
    prepareDetailMock.mockResolvedValue('skip-vt')

    await vtNavController.push('bottom', '/git/commit/abc12345')

    expect(runViewTransitionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        intent: null,
      })
    )
    expect(readCurrentNavigationTimingSample('bottom')).toMatchObject({
      state: 'transition-settled',
      outcome: 'skip-vt',
      phases: [
        { kind: 'requested' },
        { kind: 'prepare-settled', outcome: 'skip-vt' },
        { kind: 'route-committed' },
        { kind: 'transition-settled' },
      ],
    })
  })

  it('retires a late same-area attempt while preserving independent route-area evidence', async () => {
    const prepareA = createDeferred<PrepareOutcome>()
    prepareDetailMock.mockImplementation(({ pathname }) => {
      if (pathname.endsWith('/a')) return prepareA.promise
      return Promise.resolve('ready')
    })

    const pendingA = vtNavController.push('bottom', '/git/commit/a')
    await Promise.resolve()

    await vtNavController.push('bottom', '/git/commit/b')
    const bottomBeforeLateA = readCurrentNavigationTimingSample('bottom')
    await vtNavController.push('main', '/git/commit/c')
    prepareA.resolve('ready')
    await pendingA

    expect(readCurrentNavigationTimingSample('bottom')).toEqual(bottomBeforeLateA)
    expect(readCurrentNavigationTimingSample('bottom')).toMatchObject({
      toPath: '/git/commit/b',
      state: 'transition-settled',
    })
    expect(readCurrentNavigationTimingSample('main')).toMatchObject({
      toPath: '/git/commit/c',
      state: 'transition-settled',
    })
    expect(readNavigationTimingSamples()).toContainEqual(
      expect.objectContaining({
        toPath: '/git/commit/a',
        state: 'requested',
      })
    )
  })

  it('bounds process-local timing samples by age and count through real navigation', async () => {
    let now = 0
    vi.spyOn(performance, 'now').mockImplementation(() => now++)

    for (let index = 0; index < 257; index += 1) {
      await vtNavController.push('bottom', `/git/commit/${index}`)
    }

    expect(readNavigationTimingSamples({ limit: 999 })).toHaveLength(256)
    expect(readNavigationTimingSamples({ limit: 999 })[0]).toMatchObject({
      toPath: '/git/commit/1',
    })

    now += 30 * 60 * 1000 + 1
    await vtNavController.push('bottom', '/git/commit/fresh')

    expect(readNavigationTimingSamples({ limit: 999 })).toEqual([
      expect.objectContaining({ toPath: '/git/commit/fresh' }),
    ])
  })
})
