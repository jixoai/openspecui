/**
 * Orthogonal intents (updated 2026-07-22 Asia/Shanghai):
 * 1. Prove disabled and actionsDisabled independently block payload preparation and history writes.
 * 2. Prove workflow dispatch keeps Launch Agents plus same-generation Planning terminals available.
 * 3. Prove successful Send activates its target and reveals the owning Terminal area.
 *
 * Owner correction (2026-07-21): "每项先明确一个生产 owner、一个精准红例、一个绿例。"
 * Owner-reported defect (2026-07-21): Pre-created Codex/Gemini terminals are absent from Send.
 * Owner clarification (2026-07-22): The target appears while loading, then disappears when ready.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TerminalDispatchActions } from './terminal-dispatch-actions'

const {
  addInputHistoryMock,
  revealTerminalSessionMock,
  setActiveSessionMock,
  useTerminalContextMock,
  writeWorkflowToSessionMock,
} = vi.hoisted(() => ({
  addInputHistoryMock: vi.fn(),
  revealTerminalSessionMock: vi.fn(),
  setActiveSessionMock: vi.fn(),
  useTerminalContextMock: vi.fn(),
  writeWorkflowToSessionMock: vi.fn(),
}))

vi.mock('@/lib/terminal-context', () => ({
  useTerminalContext: useTerminalContextMock,
}))

vi.mock('@/lib/terminal-controller', () => ({
  terminalController: {
    addInputHistory: addInputHistoryMock,
    writeToSession: vi.fn(),
    writeWorkflowToSession: writeWorkflowToSessionMock,
  },
}))

vi.mock('@/lib/reveal-terminal-session', () => ({
  revealTerminalSession: revealTerminalSessionMock,
}))

vi.mock('@/lib/use-terminal-invocation-config', () => ({
  useTerminalInvocationConfig: () => ({
    shellProfiles: [
      {
        id: 'builtin:zsh',
        label: 'zsh',
        command: 'zsh',
        args: [],
        source: 'builtin',
        quoteStyle: 'posix',
      },
    ],
    defaultShellProfile: {
      id: 'builtin:zsh',
      label: 'zsh',
      command: 'zsh',
      args: [],
      source: 'builtin',
      quoteStyle: 'posix',
    },
    spawnCommands: [
      {
        id: 'builtin:claude',
        label: 'Claude',
        command: 'claude',
        args: [],
        fields: [],
        source: 'builtin',
      },
    ],
  }),
}))

vi.mock('@/lib/use-terminal-cwd-target', () => ({
  useTerminalCwdTargetState: () => ({
    launchProject: {
      target: 'launch-project',
      label: 'Launch project',
      path: '/launch',
      available: true,
      unavailableReason: null,
    },
    planningRoot: {
      target: 'planning-root',
      label: 'Planning root',
      path: '/planning',
      available: true,
      unavailableReason: null,
    },
  }),
  getTerminalCwdTargetOption: (
    state: { launchProject: unknown; planningRoot: unknown },
    target: 'launch-project' | 'planning-root'
  ) => (target === 'planning-root' ? state.planningRoot : state.launchProject),
}))

function clickButton(name: string): void {
  const button = screen.getByRole('button', { name })
  if (!(button instanceof HTMLButtonElement)) throw new Error(`Expected ${name} button.`)
  fireEvent.click(button)
}

describe('TerminalDispatchActions payload owner', () => {
  beforeEach(() => {
    addInputHistoryMock.mockReset().mockResolvedValue(undefined)
    revealTerminalSessionMock.mockReset()
    setActiveSessionMock.mockReset()
    writeWorkflowToSessionMock.mockReset().mockResolvedValue(undefined)
    useTerminalContextMock.mockReset().mockReturnValue({
      sessions: [],
      activeSessionId: null,
      createShellSession: vi.fn(),
      setActiveSession: setActiveSessionMock,
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('keeps actionsDisabled ahead of payload preparation and history', () => {
    const preparePayload = vi.fn().mockResolvedValue('retained prompt')
    render(<TerminalDispatchActions preparePayload={preparePayload} actionsDisabled />)

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    clickButton('Save')
    expect(preparePayload).not.toHaveBeenCalled()
    expect(addInputHistoryMock).not.toHaveBeenCalled()
  })

  it('keeps disabled Root readiness ahead of payload preparation and history', () => {
    const preparePayload = vi.fn().mockResolvedValue('must not dispatch')
    render(
      <TerminalDispatchActions
        preparePayload={preparePayload}
        disabled
        disabledReason="Planning root is unavailable."
      />
    )

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    clickButton('Save')
    expect(preparePayload).not.toHaveBeenCalled()
    expect(addInputHistoryMock).not.toHaveBeenCalled()
  })

  it('keeps a Launch Agent and current Planning terminal while excluding stale Planning sessions', async () => {
    useTerminalContextMock.mockReturnValue({
      sessions: [
        {
          id: 'launch-session',
          displayTitle: 'Launch Codex',
          cwdTarget: 'launch-project',
          rootGeneration: null,
          isExited: false,
          processTitle: 'codex',
        },
        {
          id: 'stale-planning-session',
          displayTitle: 'Stale Gemini',
          cwdTarget: 'planning-root',
          rootGeneration: 'root-generation-a',
          isExited: false,
          processTitle: 'gemini',
        },
        {
          id: 'current-planning-session',
          displayTitle: 'Current Codex',
          cwdTarget: 'planning-root',
          rootGeneration: 'root-generation-b',
          isExited: false,
          processTitle: 'codex',
        },
      ],
      activeSessionId: 'launch-session',
      createShellSession: vi.fn(),
      setActiveSession: setActiveSessionMock,
    })

    const { rerender } = render(
      <TerminalDispatchActions
        preparePayload={vi.fn().mockResolvedValue('apply this change')}
        actionsDisabled
      />
    )

    expect(screen.getByRole('combobox', { name: 'Target' })).toHaveTextContent(
      'Launch Codex · Launch'
    )

    rerender(
      <TerminalDispatchActions
        preparePayload={vi.fn().mockResolvedValue('apply this change')}
        requiredCwdTarget="planning-root"
        expectedRootGeneration="root-generation-b"
      />
    )

    fireEvent.click(screen.getByRole('combobox', { name: 'Target' }))
    expect(await screen.findByRole('option', { name: 'Current Codex · Planning' })).toBeVisible()
    expect(screen.getByRole('option', { name: 'Launch Codex · Launch' })).toBeVisible()
    expect(screen.queryByRole('option', { name: 'Stale Gemini · Planning' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    await vi.waitFor(() =>
      expect(writeWorkflowToSessionMock).toHaveBeenCalledWith(
        'launch-session',
        expect.stringContaining('apply this change'),
        'root-generation-b'
      )
    )
    expect(setActiveSessionMock).toHaveBeenCalledWith('launch-session')
    expect(revealTerminalSessionMock).toHaveBeenCalledWith('launch-session')
  })
})
