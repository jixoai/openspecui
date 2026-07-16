/**
 * Orthogonal intents (updated 2026-07-16 Asia/Shanghai):
 * 1. Verify Archive dialog dismissal remains explicit.
 * 2. Verify Root Context controls readiness and explicit Store command selection.
 * 3. Verify strict archive diagnostics remain visible without synthesized retry.
 *
 * Original request (2026-07-15): "Root-dependent actions remain locked until root selection succeeds."
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GlobalArchiveModal } from './global-archive-modal'

const { closeArchiveModalMock, replaceAllMock, rootActionMock, runAllMock, runnerMock } =
  vi.hoisted(() => ({
    closeArchiveModalMock: vi.fn(),
    replaceAllMock: vi.fn(),
    rootActionMock: vi.fn(),
    runAllMock: vi.fn(),
    runnerMock: vi.fn(),
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
  useCliRunner: () => runnerMock(),
}))

vi.mock('@/lib/view-transitions/navigation', () => ({
  useVTHrefNavigate: () => vi.fn(),
}))

vi.mock('@/lib/use-root-action-state', () => ({
  useRootActionState: () => rootActionMock(),
}))

vi.mock('./cli-terminal', () => ({
  CliTerminal: ({ lines }: { lines: Array<{ id: string; kind: string; text?: string }> }) => (
    <div>{lines.map((line) => (line.kind === 'ascii' ? line.text : '')).join('\n')}</div>
  ),
}))

describe('GlobalArchiveModal', () => {
  beforeEach(() => {
    replaceAllMock.mockReset()
    runAllMock.mockReset()
    runnerMock.mockReset().mockReturnValue({
      lines: [],
      status: 'idle',
      hasStarted: false,
      commands: {
        replaceAll: replaceAllMock,
        runAll: runAllMock,
      },
      reset: vi.fn(),
      cancel: vi.fn(),
    })
    rootActionMock.mockReset().mockReturnValue({
      status: 'ready',
      disabled: false,
      context: {
        launchProject: { path: '/launch' },
        planningRoot: {
          path: '/stores/shared',
          source: 'store',
          store_id: 'shared',
          healthy: true,
          status: [],
        },
        storeId: 'shared',
        cli: { available: true, version: '1.6.0' },
        references: [],
        contextMembers: [],
        dataScope: {
          path: '/runtime/openspec',
          source: 'xdg-data-home',
          environmentVariable: 'XDG_DATA_HOME',
        },
        diagnostics: { root: [], doctor: [], context: [] },
        evidence: { doctor: null, context: null },
        observedAt: 1,
      },
      observedAt: 1,
      title: null,
      message: null,
      evidence: [],
    })
  })

  afterEach(() => {
    cleanup()
    closeArchiveModalMock.mockReset()
  })

  it('blocks outside dismiss for archive workflow dialogs', () => {
    render(<GlobalArchiveModal />)

    fireEvent.click(screen.getByRole('dialog', { hidden: true }), { clientX: 1, clientY: 1 })

    expect(closeArchiveModalMock).not.toHaveBeenCalled()
  })

  it('delegates strict validation and archive Store selection to one Server stream', async () => {
    render(<GlobalArchiveModal />)

    await waitFor(() => {
      expect(replaceAllMock).toHaveBeenCalledWith([
        {
          command: 'openspec',
          args: ['archive', '-y', 'add-terminal-spawn-command'],
          stream: {
            type: 'archive-strict',
            input: {
              changeId: 'add-terminal-spawn-command',
              noValidate: false,
              skipSpecs: false,
            },
          },
        },
      ])
    })
    expect(JSON.stringify(replaceAllMock.mock.calls)).not.toContain('--store')
  })

  it('does not queue or start archive while Root Context is blocked', () => {
    rootActionMock.mockReturnValue({
      status: 'blocked',
      disabled: true,
      context: null,
      observedAt: 2,
      title: 'Planning root unavailable',
      message: 'Root selection failed.',
      evidence: ['Doctor exit: 1'],
    })

    render(<GlobalArchiveModal />)

    expect(replaceAllMock).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Archive' })).toBeDisabled()
    expect(runAllMock).not.toHaveBeenCalled()
  })

  it('renders scenario-loss archive diagnostics verbatim without starting a retry', () => {
    const diagnostic = [
      'archive_spec_update_failed',
      'MODIFIED requirement would remove existing scenarios:',
      '- Scenario: Existing behavior',
    ].join('\n')
    runnerMock.mockReturnValue({
      lines: [{ id: 'stderr-1', kind: 'ascii', text: diagnostic, tone: 'error' }],
      status: 'error',
      hasStarted: true,
      commands: {
        replaceAll: replaceAllMock,
        runAll: runAllMock,
      },
      reset: vi.fn(),
      cancel: vi.fn(),
    })

    const { container } = render(<GlobalArchiveModal />)

    expect(container.textContent).toContain(diagnostic)
    expect(runAllMock).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Reset before Archive' })).toBeTruthy()
  })
})
