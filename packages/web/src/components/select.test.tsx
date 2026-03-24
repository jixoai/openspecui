import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { Select, type SelectOption } from './select'

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

describe('Select', () => {
  it('updates the selected value after choosing an item', async () => {
    render(<SelectHarness />)

    fireEvent.click(screen.getByRole('combobox', { name: 'Auto refresh' }))
    const option = await screen.findByRole('option', { name: '5min' })
    fireEvent.mouseMove(option)
    fireEvent.click(option)

    expect(screen.getByTestId('selected-value').textContent).toBe('5min')
  })
})
