import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { Switch } from './switch'

function SwitchHarness() {
  const [checked, setChecked] = useState(false)

  return (
    <>
      <Switch checked={checked} onCheckedChange={setChecked} ariaLabel="Enable option" />
      <div data-testid="switch-state">{String(checked)}</div>
    </>
  )
}

describe('Switch', () => {
  afterEach(() => {
    cleanup()
  })

  it('updates checked state after toggling', () => {
    render(<SwitchHarness />)

    const trigger = screen.getByRole('switch', { name: 'Enable option' })

    expect(trigger).toHaveAttribute('aria-checked', 'false')

    fireEvent.click(trigger)

    expect(screen.getByTestId('switch-state').textContent).toBe('true')
    expect(trigger).toHaveAttribute('aria-checked', 'true')
  })

  it('renders the shared switch style', () => {
    render(<SwitchHarness />)

    const trigger = screen.getByRole('switch', { name: 'Enable option' })

    expect(trigger.className).toContain('h-6')
    expect(trigger.className).toContain('w-11')
    expect(trigger.className).toContain('rounded-full')
    expect(trigger.className).toContain('border')
    expect(trigger.firstElementChild?.className).toContain('translate-x-0')
  })
})
