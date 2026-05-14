import type {
  TerminalShellDefaults,
  TerminalShellProfile,
} from '@openspecui/core/terminal-invocation'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ShellProfileSettings } from './shell-profile-settings'

const { setDefaultShellProfileIdMock } = vi.hoisted(() => ({
  setDefaultShellProfileIdMock: vi.fn(),
}))

vi.mock('@/lib/terminal-invocation-config', () => ({
  terminalInvocationConfigStore: {
    setDefaultShellProfileId: setDefaultShellProfileIdMock,
    upsertCustomShellProfile: vi.fn(),
    removeCustomShellProfile: vi.fn(),
  },
}))

const shellDefaults: TerminalShellDefaults = {
  platform: 'macos',
  effectiveDefaultShell: {
    id: 'builtin:env-shell',
    label: 'SHELL (/bin/zsh)',
    command: '/bin/zsh',
    args: [],
    source: 'builtin',
    quoteStyle: 'posix',
  },
  builtinShellProfiles: [],
}

const shellProfiles: TerminalShellProfile[] = [
  {
    id: 'builtin:sh',
    label: '/bin/sh',
    command: '/bin/sh',
    args: [],
    source: 'builtin',
    quoteStyle: 'posix',
  },
  shellDefaults.effectiveDefaultShell,
]

describe('ShellProfileSettings', () => {
  beforeEach(() => {
    setDefaultShellProfileIdMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the current default shell as an activity button', () => {
    render(
      <ShellProfileSettings
        shellDefaults={shellDefaults}
        shellProfiles={shellProfiles}
        defaultShellProfile={shellDefaults.effectiveDefaultShell}
      />
    )

    const defaultButtons = screen.getAllByRole('button', { name: 'Default' })
    const activeDefaultButton = defaultButtons.find(
      (button) => button.getAttribute('aria-disabled') === 'true'
    )

    expect(activeDefaultButton).toBeTruthy()
    expect(activeDefaultButton).not.toBeDisabled()

    fireEvent.click(activeDefaultButton!)

    expect(setDefaultShellProfileIdMock).not.toHaveBeenCalled()
  })

  it('keeps non-default shell actions clickable', () => {
    render(
      <ShellProfileSettings
        shellDefaults={shellDefaults}
        shellProfiles={shellProfiles}
        defaultShellProfile={shellDefaults.effectiveDefaultShell}
      />
    )

    const inactiveDefaultButton = screen
      .getAllByRole('button', { name: 'Default' })
      .find((button) => button.getAttribute('aria-disabled') !== 'true')

    expect(inactiveDefaultButton).toBeTruthy()

    fireEvent.click(inactiveDefaultButton!)

    expect(setDefaultShellProfileIdMock).toHaveBeenCalledWith('builtin:sh')
  })
})
