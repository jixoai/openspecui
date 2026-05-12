import { fieldsToTerminalCommandParameters } from '@openspecui/core/terminal-invocation'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TerminalSpawnCommandDialog } from './terminal-spawn-command-dialog'

const { createShellSessionMock, useTerminalInvocationConfigMock } = vi.hoisted(() => ({
  createShellSessionMock: vi.fn(),
  useTerminalInvocationConfigMock: vi.fn(),
}))

vi.mock('@/lib/terminal-context', () => ({
  useTerminalContext: () => ({
    createShellSession: createShellSessionMock,
  }),
}))

vi.mock('@/lib/use-terminal-invocation-config', () => ({
  useTerminalInvocationConfig: () => useTerminalInvocationConfigMock(),
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
    expect(screen.getByRole('checkbox', { name: 'Show advanced options' })).toBeTruthy()
    expect(screen.queryByRole('checkbox', { name: /Skip permissions/ })).toBeNull()
    expect(document.body.textContent).toContain("claude 'draft prompt'")
    expect(document.body.textContent).not.toContain('--dangerously-skip-permissions')

    fireEvent.click(screen.getByRole('checkbox', { name: 'Show advanced options' }))

    expect(screen.getByRole('checkbox', { name: /Skip permissions/ })).toBeTruthy()
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

    fireEvent.click(screen.getByRole('checkbox', { name: 'Show advanced options' }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Skip permissions/ }))
    fireEvent.click(getByText('Create'))

    expect(createShellSessionMock).toHaveBeenCalledTimes(1)
    expect(createShellSessionMock).toHaveBeenCalledWith(
      shell,
      expect.objectContaining({
        label: 'Claude',
        initialInput: "claude --dangerously-skip-permissions 'run checks'\n",
      })
    )
    expect(onClose).toHaveBeenCalled()
  })
})
