/**
 * Orthogonal intents (created 2026-07-28 Asia/Shanghai):
 * 1. Prove Apply and Archive launch their established production presentation owners.
 * 2. Prove an already-captured launcher rechecks Root authority after rerender.
 *
 * Original request (2026-07-28): Board and Change Detail must use the same Operator owners.
 */
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useChangeOperatorLauncher } from './use-change-operator-launcher'

const openArchiveModal = vi.hoisted(() => vi.fn())
const activatePop = vi.hoisted(() => vi.fn())
const rootAction = vi.hoisted(() => ({ current: { status: 'ready', disabled: false } }))

vi.mock('@/lib/archive-modal-context', () => ({
  useArchiveModal: () => ({ openArchiveModal }),
}))

vi.mock('@/lib/use-root-action-state', () => ({
  useRootActionState: () => rootAction.current,
}))

vi.mock('@/lib/view-transitions/navigation', () => ({
  vtNavController: { activatePop },
}))

describe('useChangeOperatorLauncher', () => {
  beforeEach(() => {
    openArchiveModal.mockReset()
    activatePop.mockReset()
    rootAction.current = { status: 'ready', disabled: false }
  })

  it('launches Compose and Archive owners while Root authority is current', () => {
    const { result } = renderHook(() => useChangeOperatorLauncher())
    const target = { changeId: 'change-a', changeName: 'Change A' }

    act(() => {
      expect(result.current.launchApply(target)).toBe(true)
      expect(result.current.launchArchive(target)).toBe(true)
    })

    expect(activatePop).toHaveBeenCalledWith('/opsx-compose?action=apply&change=change-a')
    expect(openArchiveModal).toHaveBeenCalledWith('change-a', 'Change A')
  })

  it('rejects captured launch functions after Root authority becomes blocked', () => {
    const { result, rerender } = renderHook(() => useChangeOperatorLauncher())
    const launchApply = result.current.launchApply
    const launchArchive = result.current.launchArchive
    rootAction.current = { status: 'blocked', disabled: true }
    rerender()

    act(() => {
      expect(launchApply({ changeId: 'change-a', changeName: 'Change A' })).toBe(false)
      expect(launchArchive({ changeId: 'change-a', changeName: 'Change A' })).toBe(false)
    })

    expect(activatePop).not.toHaveBeenCalled()
    expect(openArchiveModal).not.toHaveBeenCalled()
  })

  it('rejects captured launch functions after their projection authority becomes stale', () => {
    const { result, rerender } = renderHook(
      ({ applyCurrent, archiveCurrent }) =>
        useChangeOperatorLauncher({ applyCurrent, archiveCurrent }),
      { initialProps: { applyCurrent: true, archiveCurrent: true } }
    )
    const launchApply = result.current.launchApply
    const launchArchive = result.current.launchArchive

    rerender({ applyCurrent: false, archiveCurrent: false })

    act(() => {
      expect(launchApply({ changeId: 'change-a', changeName: 'Change A' })).toBe(false)
      expect(launchArchive({ changeId: 'change-a', changeName: 'Change A' })).toBe(false)
    })

    expect(activatePop).not.toHaveBeenCalled()
    expect(openArchiveModal).not.toHaveBeenCalled()
  })
})
