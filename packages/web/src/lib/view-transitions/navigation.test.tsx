/**
 * Orthogonal intents (created 2026-07-19 Asia/Shanghai):
 * 1. Prove View Transition navigation prepares the exact target route.
 * 2. Prove Git handoff state and target scope reach detail preparation unchanged.
 *
 * Original request (2026-07-16): "接下来，你来接手后续工作"
 * Derived requirement (2026-07-19): Checkpoint 6.11 carries Git origin provenance into VT.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { navControllerMock, prepareDetailMock, runViewTransitionMock } = vi.hoisted(() => ({
  navControllerMock: {
    getLocation: vi.fn(() => ({ pathname: '/git' })),
    push: vi.fn(),
    replace: vi.fn(),
  },
  prepareDetailMock: vi.fn(async () => 'ready' as const),
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

describe('vtNavController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    navControllerMock.getLocation.mockReturnValue({ pathname: '/git' })
    prepareDetailMock.mockResolvedValue('ready')
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
})
