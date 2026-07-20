/**
 * Orthogonal intents (created 2026-07-21 Asia/Shanghai):
 * 1. Keep presentation-only action locks distinct from the caller-owned payload assertion.
 * 2. Preserve the hard Root readiness lock before payload preparation.
 *
 * Original request (2026-07-21): "public Save must reach the Compose payload owner when only the
 * visual recovery lock is adversarially bypassed."
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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

function submitButtonForm(name: string): void {
  const button = screen.getByRole('button', { name })
  if (!(button instanceof HTMLButtonElement)) throw new Error(`Expected ${name} button.`)
  const form = button.form
  if (!form) throw new Error(`Expected ${name} to submit a public form.`)
  fireEvent.submit(form)
}

describe('TerminalDispatchActions payload owner', () => {
  beforeEach(() => {
    addInputHistoryMock.mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
  })

  it('lets an adversarial public Save reach the caller assertion behind a visual-only lock', async () => {
    const preparePayload = vi.fn().mockResolvedValue('retained prompt')
    render(<TerminalDispatchActions preparePayload={preparePayload} actionsDisabled />)

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    submitButtonForm('Save')

    await waitFor(() => expect(preparePayload).toHaveBeenCalledTimes(1))
    expect(addInputHistoryMock).toHaveBeenCalledWith('retained prompt')
  })

  it('keeps the hard Root readiness lock inside the payload owner', async () => {
    const preparePayload = vi.fn().mockResolvedValue('must not dispatch')
    const onError = vi.fn()
    render(
      <TerminalDispatchActions
        preparePayload={preparePayload}
        disabled
        disabledReason="Planning root is unavailable."
        onError={onError}
      />
    )

    submitButtonForm('Save')

    await waitFor(() => expect(onError).toHaveBeenCalledWith('Planning root is unavailable.'))
    expect(preparePayload).not.toHaveBeenCalled()
    expect(addInputHistoryMock).not.toHaveBeenCalled()
  })
})
