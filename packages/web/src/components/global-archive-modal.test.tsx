import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GlobalArchiveModal } from './global-archive-modal'

const { closeArchiveModalMock } = vi.hoisted(() => ({
  closeArchiveModalMock: vi.fn(),
}))

vi.mock('@/lib/archive-modal-context', () => ({
  useArchiveModal: () => ({
    state: {
      open: true,
      changeId: 'add-terminal-spawn-command',
      changeName: 'Add Terminal Spawn Command',
    },
    closeArchiveModal: closeArchiveModalMock,
  }),
}))

vi.mock('@/lib/use-cli-runner', () => ({
  useCliRunner: () => ({
    lines: [],
    status: 'idle',
    hasStarted: false,
    commands: {
      replaceAll: vi.fn(),
      runAll: vi.fn(),
    },
    reset: vi.fn(),
    cancel: vi.fn(),
  }),
}))

vi.mock('@/lib/view-transitions/navigation', () => ({
  useVTHrefNavigate: () => vi.fn(),
}))

vi.mock('./cli-terminal', () => ({
  CliTerminal: () => <div>terminal output</div>,
}))

describe('GlobalArchiveModal', () => {
  afterEach(() => {
    cleanup()
    closeArchiveModalMock.mockReset()
  })

  it('blocks outside dismiss for archive workflow dialogs', () => {
    render(<GlobalArchiveModal />)

    fireEvent.click(screen.getByRole('dialog', { hidden: true }), { clientX: 1, clientY: 1 })

    expect(closeArchiveModalMock).not.toHaveBeenCalled()
  })
})
