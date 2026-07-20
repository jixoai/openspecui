/**
 * Orthogonal intents (created 2026-07-21 Asia/Shanghai):
 * 1. Prove disabled and actionsDisabled independently block payload preparation and history writes.
 *
 * Owner correction (2026-07-21): "每项先明确一个生产 owner、一个精准红例、一个绿例。"
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TerminalDispatchActions } from './terminal-dispatch-actions'

const { addInputHistoryMock } = vi.hoisted(() => ({
  addInputHistoryMock: vi.fn(),
}))

vi.mock('@/lib/terminal-context', () => ({
  useTerminalContext: () => ({
    sessions: [],
    activeSessionId: null,
    createShellSession: vi.fn(),
  }),
}))

vi.mock('@/lib/terminal-controller', () => ({
  terminalController: {
    addInputHistory: addInputHistoryMock,
    writeToSession: vi.fn(),
  },
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
})
