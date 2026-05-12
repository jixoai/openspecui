import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { Select, type SelectOption, type SelectOptionGroup } from './select'

const OPTIONS: SelectOption<'30s' | '5min' | 'none'>[] = [
  { value: '30s', label: '30s' },
  { value: '5min', label: '5min' },
  { value: 'none', label: 'none' },
]

function SelectHarness() {
  const [value, setValue] = useState<'30s' | '5min' | 'none'>('30s')

  return (
    <>
      <Select value={value} options={OPTIONS} onValueChange={setValue} ariaLabel="Auto refresh" />
      <div data-testid="selected-value">{value}</div>
    </>
  )
}

const GROUPS: SelectOptionGroup<'shell:zsh' | 'create:claude'>[] = [
  {
    label: 'Shell Instances',
    options: [{ value: 'shell:zsh', label: 'zsh' }],
  },
  {
    label: 'Create Shell Instance',
    options: [{ value: 'create:claude', label: 'Create Claude' }],
  },
]

describe('Select', () => {
  afterEach(() => {
    cleanup()
  })

  it('updates the selected value after choosing an item', async () => {
    render(<SelectHarness />)

    fireEvent.click(screen.getByRole('combobox', { name: 'Auto refresh' }))
    const option = await screen.findByRole('option', { name: '5min' })
    fireEvent.mouseMove(option)
    fireEvent.click(option)

    expect(screen.getByTestId('selected-value').textContent).toBe('5min')
  })

  it('renders the shared form-control trigger style by default', () => {
    render(<SelectHarness />)

    const trigger = screen.getByRole('combobox', { name: 'Auto refresh' })

    expect(trigger.className).toContain('bg-background')
    expect(trigger.className).toContain('border')
    expect(trigger.className).toContain('h-9')
  })

  it('renders grouped options with accessible group labels', async () => {
    render(<Select value="shell:zsh" groups={GROUPS} onValueChange={() => {}} ariaLabel="Target" />)

    fireEvent.click(screen.getByRole('combobox', { name: 'Target' }))

    expect(await screen.findByRole('group', { name: 'Shell Instances' })).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Create Shell Instance' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Create Claude' })).toBeTruthy()
  })
})
