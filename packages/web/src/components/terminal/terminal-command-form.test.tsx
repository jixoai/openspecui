import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TerminalCommandForm } from './terminal-command-form'

describe('TerminalCommandForm', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders empty select options as accessible none labels', async () => {
    const onChange = vi.fn()
    render(
      <TerminalCommandForm
        schema={{
          type: 'object',
          properties: {
            model: {
              type: 'string',
              title: 'Model',
              enum: ['', 'sonnet'],
              default: '',
            },
          },
          required: [],
        }}
        values={{ model: '' }}
        onChange={onChange}
      />
    )

    expect(screen.getByRole('combobox', { name: 'Model' }).textContent).toContain('none')
    expect(screen.getByRole('combobox', { name: 'Model' }).querySelector('i')?.textContent).toBe(
      'none'
    )

    fireEvent.click(screen.getByRole('combobox', { name: 'Model' }))

    const emptyOption = await screen.findByRole('option', { name: 'none' })
    expect(emptyOption.querySelector('i')?.textContent).toBe('none')
  })

  it('does not proxy field whitespace clicks to boolean controls', () => {
    const onChange = vi.fn()
    const { container } = render(
      <TerminalCommandForm
        schema={{
          type: 'object',
          properties: {
            skipPermissions: {
              type: 'boolean',
              title: 'Skip permissions',
              default: false,
            },
            prompt: {
              type: 'string',
              title: 'Prompt',
              default: '',
            },
          },
          required: [],
        }}
        values={{ skipPermissions: false, prompt: '' }}
        onChange={onChange}
      />
    )

    const objectField = container.querySelector('.space-y-3')
    expect(objectField).not.toBeNull()

    fireEvent.click(objectField!)

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('switch', { name: 'Skip permissions' })).toHaveAttribute(
      'aria-checked',
      'false'
    )
  })
})
