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

    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable option' }))

    expect(screen.getByTestId('switch-state').textContent).toBe('true')
  })

  it('renders the shared checkbox style', () => {
    render(<SwitchHarness />)

    const trigger = screen.getByRole('checkbox', { name: 'Enable option' })

    expect(trigger.className).toContain('h-5')
    expect(trigger.className).toContain('w-5')
    expect(trigger.className).toContain('border')
    expect(trigger.firstElementChild?.className).toContain('opacity-0')
  })
})
