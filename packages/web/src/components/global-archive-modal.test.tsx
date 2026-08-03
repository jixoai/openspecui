/**
 * Orthogonal intents (updated 2026-08-01 Asia/Shanghai):
 * 1. Verify Archive dialog dismissal remains explicit.
 * 2. Verify Root Context controls readiness and explicit Store command selection.
 * 3. Verify strict archive diagnostics remain visible without synthesized retry.
 * 4. Verify Archive consumes selected-Root operation inputs before queuing its typed transport.
 * 5. Prove Archive inputs and mutation share one exact Root generation.
 *
 * Original request (2026-07-15): "Root-dependent actions remain locked until root selection succeeds."
 * Original request (2026-07-17): "CliStreamTransport is the single execution and display truth."
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GlobalArchiveModal } from './global-archive-modal'

const {
  archiveInstructionsStateMock,
  closeArchiveModalMock,
  replaceAllMock,
  rootActionMock,
  runAllMock,
  runnerMock,
} = vi.hoisted(() => ({
  archiveInstructionsStateMock: vi.fn(),
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

vi.mock('@/lib/use-opsx', () => ({
  useOpsxArchiveInstructionsSubscription: () => archiveInstructionsStateMock(),
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
    archiveInstructionsStateMock.mockReset().mockReturnValue({
      data: {
        rootGeneration: 'planning-generation-a',
        instructions: {
          changeName: 'add-terminal-spawn-command',
          context: 'Preserve terminal ownership.',
          operationGuidance: ['Review the final delta before archiving.'],
          evidence: {
            command: 'instructions archive',
            success: true,
            stdout: '{}',
            stderr: '',
            exitCode: 0,
            payload: {},
            diagnostics: [],
            selector: { store: 'shared' },
          },
        },
      },
      isLoading: false,
      error: null,
      authority: { state: 'current' },
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
        generation: 'planning-generation-a',
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
          type: 'archive-strict',
          input: {
            changeId: 'add-terminal-spawn-command',
            expectedRootGeneration: 'planning-generation-a',
            noValidate: false,
            skipSpecs: false,
          },
        },
      ])
    })
    expect(JSON.stringify(replaceAllMock.mock.calls)).not.toContain('--store')
    expect(screen.getByText('Preserve terminal ownership.')).toBeTruthy()
    expect(screen.getByText('Review the final delta before archiving.')).toBeTruthy()
  })

  it('does not queue Archive when current Root Context and inputs have different generations', () => {
    const rootAction = rootActionMock()
    rootActionMock.mockReturnValue({
      ...rootAction,
      context: { ...rootAction.context, generation: 'planning-generation-b' },
    })

    render(<GlobalArchiveModal />)

    expect(screen.getByRole('button', { name: 'Archive' })).toBeDisabled()
    expect(replaceAllMock).not.toHaveBeenCalled()
  })

  it('does not queue Archive before selected-Root instructions settle', () => {
    archiveInstructionsStateMock.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      authority: { state: 'waiting', reason: 'initial' },
    })

    render(<GlobalArchiveModal />)

    expect(replaceAllMock).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Archive' })).toBeDisabled()
    expect(screen.getByText('Loading archive inputs…')).toBeTruthy()
  })

  it('retains stale Archive inputs for reading but revokes execution authority', () => {
    archiveInstructionsStateMock.mockReturnValue({
      data: {
        rootGeneration: 'planning-generation-a',
        instructions: {
          changeName: 'add-terminal-spawn-command',
          context: 'Retained Root A context.',
          operationGuidance: ['Retained guidance.'],
          evidence: {
            command: 'instructions archive',
            success: true,
            stdout: '{}',
            stderr: '',
            exitCode: 0,
            payload: {},
            diagnostics: [],
            selector: { store: 'root-a' },
          },
        },
      },
      isLoading: false,
      error: null,
      authority: { state: 'waiting', reason: 'rebind' },
    })

    render(<GlobalArchiveModal />)

    expect(screen.getByText('Retained Root A context.')).toBeTruthy()
    expect(screen.getByText('Refreshing archive inputs…')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Archive' })).toBeDisabled()
    expect(replaceAllMock).not.toHaveBeenCalled()
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
