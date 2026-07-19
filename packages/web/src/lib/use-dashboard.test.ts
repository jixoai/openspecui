/**
 * Orthogonal intents (created 2026-07-19 Asia/Shanghai):
 * 1. Prove Dashboard Git actions submit the binding token observed with the rendered snapshot.
 * 2. Prove a later backend binding cannot relabel an already captured refresh or removal intent.
 *
 * Original request (2026-07-19): "代码已经提交，开始review。如果有问题，那么可更新change。"
 * Derived requirement (2026-07-19): Checkpoint 6.11 binds Dashboard mutations to snapshot provenance.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { refreshDashboardGitSnapshot, removeDetachedDashboardWorktree } from './use-dashboard'

const { codeQueryMock, refreshMock, removeMock, staticModeMock } = vi.hoisted(() => ({
  codeQueryMock: vi.fn(async () => ({ bindingToken: 'code-binding-b' })),
  refreshMock: vi.fn(),
  removeMock: vi.fn(),
  staticModeMock: vi.fn(() => false),
}))

vi.mock('./static-mode', () => ({ isStaticMode: staticModeMock }))
vi.mock('./trpc', () => ({
  trpcClient: {
    git: { code: { query: codeQueryMock } },
    dashboard: {
      refreshGitSnapshot: { mutate: refreshMock },
      removeDetachedWorktree: { mutate: removeMock },
    },
  },
}))

describe('Dashboard Git mutation provenance', () => {
  beforeEach(() => {
    codeQueryMock.mockClear()
    refreshMock.mockReset()
    removeMock.mockReset()
    staticModeMock.mockReturnValue(false)
  })

  it('keeps snapshot A on refresh after the backend publishes binding B', async () => {
    refreshMock.mockRejectedValueOnce(new Error('The code repository binding changed.'))

    await expect(refreshDashboardGitSnapshot('manual-button', 'code-binding-a')).rejects.toThrow(
      'binding changed'
    )

    expect(refreshMock).toHaveBeenCalledWith({
      scope: 'code',
      expectedBindingToken: 'code-binding-a',
      reason: 'manual-button',
    })
    expect(codeQueryMock).not.toHaveBeenCalled()
  })

  it('keeps snapshot A on detached-worktree removal after binding B exists', async () => {
    removeMock.mockRejectedValueOnce(new Error('The code repository binding changed.'))

    await expect(
      removeDetachedDashboardWorktree('/worktrees/detached', 'code-binding-a')
    ).rejects.toThrow('binding changed')

    expect(removeMock).toHaveBeenCalledWith({
      scope: 'code',
      expectedBindingToken: 'code-binding-a',
      path: '/worktrees/detached',
    })
    expect(codeQueryMock).not.toHaveBeenCalled()
  })
})
