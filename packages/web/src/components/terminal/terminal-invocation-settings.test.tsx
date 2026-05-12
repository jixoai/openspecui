import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/trpc', () => ({
  trpcClient: {
    config: {
      getTerminalShellDefaults: {
        query: vi.fn().mockResolvedValue({
          platform: 'macos',
          effectiveDefaultShell: {
            id: 'builtin:env-shell',
            label: 'SHELL (/bin/zsh)',
            command: '/bin/zsh',
            args: [],
            source: 'builtin',
            quoteStyle: 'posix',
          },
          builtinShellProfiles: [
            {
              id: 'builtin:sh',
              label: '/bin/sh',
              command: '/bin/sh',
              args: [],
              source: 'builtin',
              quoteStyle: 'posix',
            },
            {
              id: 'builtin:env-shell',
              label: 'SHELL (/bin/zsh)',
              command: '/bin/zsh',
              args: [],
              source: 'builtin',
              quoteStyle: 'posix',
            },
          ],
        }),
      },
    },
  },
}))

describe('TerminalInvocationSettings', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/settings')
    localStorage.clear()
    vi.resetModules()
  })

  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  it('keeps settings compact and persists custom shell profiles and spawn commands from dialogs', async () => {
    const { TerminalInvocationSettings } = await import('./terminal-invocation-settings')
    render(<TerminalInvocationSettings />)

    await waitFor(() => {
      expect(screen.getByText(/Effective platform default:/).textContent).toContain('/bin/zsh')
    })

    expect(screen.queryByLabelText('Default Shell')).toBeNull()
    expect(screen.queryByPlaceholderText('Shell label')).toBeNull()
    expect(screen.queryByPlaceholderText('Command label')).toBeNull()
    expect(screen.getAllByText('Default').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByRole('button', { name: 'Default' }).length).toBeGreaterThanOrEqual(1)

    fireEvent.click(screen.getByRole('button', { name: 'Add Shell' }))
    fireEvent.change(screen.getByPlaceholderText('Shell label'), {
      target: { value: 'Git Bash' },
    })
    fireEvent.change(screen.getByPlaceholderText('/bin/zsh'), {
      target: { value: '/usr/bin/bash' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Shell label')).toBeNull()
    })
    fireEvent.click(screen.getAllByRole('button', { name: 'Default' }).at(-1)!)

    expect(
      JSON.parse(localStorage.getItem('terminal-invocation-settings') ?? '{}') as {
        defaultShellProfileId?: string
      }
    ).toMatchObject({
      defaultShellProfileId: expect.stringContaining('git-bash'),
    })

    fireEvent.click(screen.getByRole('button', { name: 'Edit Git Bash' }))
    expect(screen.getByText('Edit Shell')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    fireEvent.click(screen.getByRole('button', { name: 'Add Command' }))
    expect(screen.getByText('Parameter 1')).toBeTruthy()
    expect(screen.getByText('Builder Part 1')).toBeTruthy()
    const fieldInput = screen.getByLabelText('Field')
    expect(fieldInput).toBeTruthy()
    fieldInput.focus()
    fireEvent.change(fieldInput, {
      target: { value: 'promptBody' },
    })
    expect(document.activeElement).toBe(fieldInput)
    expect(screen.getByLabelText('Title')).toBeTruthy()
    expect(screen.getAllByLabelText('Description').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('Default Value').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByLabelText('Default Value')).toBeInstanceOf(HTMLTextAreaElement)
    expect(screen.queryByLabelText('Select Options')).toBeNull()
    fireEvent.click(screen.getByRole('combobox', { name: 'Control Type for Prompt' }))
    const booleanOption = await screen.findByRole('option', { name: 'Boolean' })
    fireEvent.mouseMove(booleanOption)
    fireEvent.click(booleanOption)
    expect(screen.getByRole('combobox', { name: 'Default Value for Prompt' })).toBeTruthy()
    expect(screen.queryByLabelText('Select Options')).toBeNull()
    fireEvent.click(screen.getByRole('combobox', { name: 'Control Type for Prompt' }))
    const selectOption = await screen.findByRole('option', { name: 'Select' })
    fireEvent.mouseMove(selectOption)
    fireEvent.click(selectOption)
    expect(screen.getByLabelText('Select Options')).toBeTruthy()
    expect(screen.getByLabelText('Literal Value')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add Parameter' }).className).toContain('bg-primary')
    expect(screen.getByRole('button', { name: 'Add Literal' }).className).toContain('bg-primary')
    expect(screen.getByRole('button', { name: 'Remove Prompt' }).className).toContain('bg-red-600')
    fireEvent.change(screen.getByPlaceholderText('Command label'), {
      target: { value: 'Claude Safe' },
    })
    fireEvent.click(screen.getByRole('combobox', { name: 'Control Type for Prompt' }))
    const textareaOption = await screen.findByRole('option', { name: 'Textarea' })
    fireEvent.mouseMove(textareaOption)
    fireEvent.click(textareaOption)
    fireEvent.click(screen.getByRole('button', { name: 'Add Boolean Flag' }))
    expect(screen.getByLabelText('Flag Token')).toBeTruthy()
    fireEvent.change(screen.getByPlaceholderText('--flag'), {
      target: { value: '--dangerously-skip-permissions' },
    })
    fireEvent.change(screen.getAllByDisplayValue('Flag Enabled')[0]!, {
      target: { value: 'Skip permissions' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Command label')).toBeNull()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Edit Claude' }))
    expect(screen.getByText('Edit Command')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    const stored = JSON.parse(localStorage.getItem('terminal-invocation-settings') ?? '{}') as {
      customShellProfiles?: Array<{ label: string; command: string }>
      customSpawnCommands?: Array<{
        label: string
        command: string
        builder?: {
          kind: string
          parts?: Array<{ kind: string; fieldId?: string; flag?: string; value?: string }>
        }
        args: Array<{ kind: string; fieldId?: string; flag?: string }>
        fields: Array<{ id: string; label: string; type: string; defaultValue?: unknown }>
      }>
    }

    expect(stored.customShellProfiles?.[0]).toMatchObject({
      label: 'Git Bash',
      command: '/usr/bin/bash',
    })
    expect(stored.customSpawnCommands?.[0]).toMatchObject({
      label: 'Claude Safe',
      command: 'claude',
    })
    expect(stored.customSpawnCommands?.[0]?.builder?.parts).toContainEqual(
      expect.objectContaining({
        kind: 'booleanFlag',
        flag: '--dangerously-skip-permissions',
      })
    )
    expect(stored.customSpawnCommands?.[0]?.fields).toContainEqual(
      expect.objectContaining({
        label: 'Skip permissions',
        type: 'boolean',
        defaultValue: false,
      })
    )
  })
})
