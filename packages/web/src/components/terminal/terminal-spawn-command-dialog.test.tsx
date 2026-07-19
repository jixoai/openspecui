/**
 * Orthogonal intents (updated 2026-07-20 Asia/Shanghai):
 * 1. Verify configured terminal command creation and advanced-field behavior.
 * 2. Verify configured commands expose resolved cwd identity and send only a cwd target.
 * 3. Verify planning-root readiness keeps repair through the available Launch target.
 *
 * Original request (2026-07-16): "Terminal creation controls expose the selected cwd/root identity."
 */
import { fieldsToTerminalCommandParameters } from '@openspecui/core/terminal-invocation'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TerminalSpawnCommandDialog } from './terminal-spawn-command-dialog'

const { createShellSessionMock, useTerminalInvocationConfigMock, useTerminalCwdTargetStateMock } =
  vi.hoisted(() => ({
    createShellSessionMock: vi.fn(),
    useTerminalInvocationConfigMock: vi.fn(),
    useTerminalCwdTargetStateMock: vi.fn(),
  }))

vi.mock('@/lib/terminal-context', () => ({
  useTerminalContext: () => ({
    createShellSession: createShellSessionMock,
  }),
}))

vi.mock('@/lib/use-terminal-invocation-config', () => ({
  useTerminalInvocationConfig: () => useTerminalInvocationConfigMock(),
}))

vi.mock('@/lib/use-terminal-cwd-target', () => ({
  useTerminalCwdTargetState: () => useTerminalCwdTargetStateMock(),
  getTerminalCwdTargetOption: (
    state: { launchProject: unknown; planningRoot: unknown },
    target: 'launch-project' | 'planning-root'
  ) => (target === 'planning-root' ? state.planningRoot : state.launchProject),
}))

describe('TerminalSpawnCommandDialog', () => {
  const shell = {
    id: 'builtin:sh',
    label: '/bin/sh',
    command: '/bin/sh',
    args: [],
    source: 'builtin' as const,
    quoteStyle: 'posix' as const,
  }

  const command = {
    id: 'builtin:claude',
    label: 'Claude',
    command: 'claude',
    args: [
      {
        kind: 'booleanFlag' as const,
        fieldId: 'dangerouslySkipPermissions',
        flag: '--dangerously-skip-permissions',
      },
      {
        kind: 'field' as const,
        fieldId: 'prompt',
        prefix: '',
        omitWhenEmpty: true,
      },
    ],
    fields: [
      {
        id: 'prompt',
        label: 'Prompt',
        type: 'textarea' as const,
        options: [],
        defaultValue: '',
        required: false,
        advanced: false,
      },
      {
        id: 'dangerouslySkipPermissions',
        label: 'Skip permissions',
        type: 'boolean' as const,
        options: [],
        defaultValue: false,
        required: false,
        advanced: true,
      },
    ],
    parameters: fieldsToTerminalCommandParameters([
      {
        id: 'prompt',
        label: 'Prompt',
        type: 'textarea' as const,
        options: [],
        defaultValue: '',
        required: false,
        advanced: false,
      },
      {
        id: 'dangerouslySkipPermissions',
        label: 'Skip permissions',
        type: 'boolean' as const,
        options: [],
        defaultValue: false,
        required: false,
        advanced: true,
      },
    ]),
    builder: {
      kind: 'argv' as const,
      parts: [
        { kind: 'literal' as const, value: 'claude' },
        {
          kind: 'booleanFlag' as const,
          fieldId: 'dangerouslySkipPermissions',
          flag: '--dangerously-skip-permissions',
        },
        { kind: 'field' as const, fieldId: 'prompt', prefix: '', omitWhenEmpty: true },
      ],
    },
    source: 'builtin' as const,
  }

  beforeEach(() => {
    createShellSessionMock.mockReset()
    createShellSessionMock.mockReturnValue('term-1')
    useTerminalInvocationConfigMock.mockReturnValue({
      shellProfiles: [shell],
      defaultShellProfile: shell,
    })
    useTerminalCwdTargetStateMock.mockReturnValue({
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
        path: '/stores/shared',
        available: true,
        unavailableReason: null,
      },
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('prefills prompt values and keeps dangerous flags disabled by default', () => {
    const { getByDisplayValue } = render(
      <TerminalSpawnCommandDialog
        open
        command={command}
        presetValues={{ prompt: 'draft prompt' }}
        onClose={() => {}}
      />
    )

    expect(getByDisplayValue('draft prompt')).toBeTruthy()
    const advancedButton = screen.getByRole('button', { name: /Advanced options/ })
    const advancedSectionId = advancedButton.getAttribute('aria-controls')
    if (!advancedSectionId) throw new Error('Expected advanced section id')
    const advancedSection = document.getElementById(advancedSectionId)
    if (!advancedSection) throw new Error('Expected advanced section')
    expect(advancedSection.getAttribute('aria-hidden')).toBe('true')
    expect(advancedSection.hasAttribute('inert')).toBe(true)
    expect(advancedButton.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('switch', { name: /Skip permissions/ })).toBeNull()
    expect(document.body.textContent).toContain("claude 'draft prompt'")
    expect(document.body.textContent).not.toContain('--dangerously-skip-permissions')

    fireEvent.click(advancedButton)

    expect(advancedButton.getAttribute('aria-expanded')).toBe('true')
    expect(advancedSection.getAttribute('aria-hidden')).toBe('false')
    expect(advancedSection.hasAttribute('inert')).toBe(false)
    expect(screen.getByRole('switch', { name: /Skip permissions/ })).toBeTruthy()
  })

  it('creates one shell session with rendered initial input', () => {
    const onClose = vi.fn()
    const { getByText } = render(
      <TerminalSpawnCommandDialog
        open
        command={command}
        presetValues={{ prompt: 'run checks' }}
        onClose={onClose}
      />
    )

    expect(screen.getByText('/launch')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: /Advanced options/ }))
    fireEvent.click(screen.getByRole('switch', { name: /Skip permissions/ }))
    fireEvent.click(getByText('Create'))

    expect(createShellSessionMock).toHaveBeenCalledTimes(1)
    expect(createShellSessionMock).toHaveBeenCalledWith(
      shell,
      expect.objectContaining({
        cwdTarget: 'launch-project',
        label: 'Claude',
        initialInput: "claude --dangerously-skip-permissions 'run checks'\n",
      })
    )
    expect(onClose).toHaveBeenCalled()
  })

  it('creates the command in the selected planning root', () => {
    render(<TerminalSpawnCommandDialog open command={command} onClose={() => {}} />)

    expect(screen.getByText('/launch')).toBeVisible()
    fireEvent.click(screen.getByRole('radio', { name: 'Planning' }))
    expect(screen.getByText('/stores/shared')).toBeVisible()
    fireEvent.click(screen.getByText('Create'))

    expect(createShellSessionMock).toHaveBeenCalledWith(shell, {
      cwdTarget: 'planning-root',
      label: 'Claude',
      initialInput: 'claude\n',
    })
  })

  it('keeps planning-root creation disabled until Root Context is current and ready', () => {
    useTerminalCwdTargetStateMock.mockReturnValue({
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
        path: null,
        available: false,
        unavailableReason: 'Planning root is refreshing.',
      },
    })

    render(
      <TerminalSpawnCommandDialog
        open
        command={command}
        initialCwdTarget="planning-root"
        onClose={() => {}}
      />
    )

    const planningTarget = screen.getByRole('radio', { name: 'Planning' })
    const launchTarget = screen.getByRole('radio', { name: 'Launch' })
    const createButton = screen.getByRole('button', { name: 'Create' })

    expect(screen.getByText('Planning root is refreshing.')).toBeVisible()
    expect(planningTarget).toBeDisabled()
    expect(createButton).toBeDisabled()
    expect(launchTarget).toBeEnabled()
    fireEvent.click(launchTarget)
    expect(launchTarget).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('/launch')).toBeVisible()
    expect(createButton).toBeEnabled()
    fireEvent.click(createButton)
    expect(createShellSessionMock).toHaveBeenCalledWith(shell, {
      cwdTarget: 'launch-project',
      label: 'Claude',
      initialInput: 'claude\n',
    })
  })

  it('does not close on outside dismiss requests', () => {
    const onClose = vi.fn()
    render(<TerminalSpawnCommandDialog open command={command} onClose={onClose} />)

    fireEvent.click(screen.getByRole('dialog', { hidden: true }), { clientX: 1, clientY: 1 })

    expect(onClose).not.toHaveBeenCalled()
  })
})
