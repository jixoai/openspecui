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

const EMPTY_OPTIONS: SelectOption<'' | 'model-a'>[] = [
  { value: '', label: '' },
  { value: 'model-a', label: 'Model A' },
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
    expect(trigger.className).toContain('min-w-32')
  })

  it('lets custom triggers keep compact explicit widths', () => {
    render(
      <Select
        value="30s"
        options={OPTIONS}
        onValueChange={() => {}}
        ariaLabel="Compact refresh"
        className="h-8 w-10 px-0"
        renderTrigger={({ selectedOption }) => <span>{selectedOption?.label}</span>}
      />
    )

    const trigger = screen.getByRole('combobox', { name: 'Compact refresh' })

    expect(trigger.className).toContain('min-w-0')
    expect(trigger.className).not.toContain('min-w-32')
    expect(trigger.className).toContain('w-10')
  })

  it('hides the positioner when its anchor is hidden during close transitions', async () => {
    const { container } = render(<SelectHarness />)

    fireEvent.click(screen.getByRole('combobox', { name: 'Auto refresh' }))
    await screen.findByRole('option', { name: '5min' })

    const positioner = container.ownerDocument.body.querySelector('[role="presentation"]')

    expect(positioner?.className).toContain('data-[anchor-hidden]:opacity-0')
  })

  it('lets option popups use available width without horizontal scrolling', async () => {
    render(<Select value="shell:zsh" groups={GROUPS} onValueChange={() => {}} ariaLabel="Target" />)

    fireEvent.click(screen.getByRole('combobox', { name: 'Target' }))
    await screen.findByRole('option', { name: 'Create Claude' })

    const list = screen.getByRole('listbox')
    const popup = list.closest('.bg-card')
    const optionText = screen
      .getByRole('option', { name: 'Create Claude' })
      .querySelector('.whitespace-normal')

    expect(popup?.className).toContain('w-max')
    expect(popup?.className).toContain('min-w-(--anchor-width)')
    expect(popup?.className).toContain('max-w-[min(28rem,var(--available-width,calc(100vw-2rem)))]')
    expect(list.className).toContain('overflow-x-hidden')
    expect(optionText?.className).toContain('whitespace-normal')
    expect(optionText?.className).toContain('[overflow-wrap:anywhere]')
    expect(optionText?.className).toContain('col-start-2')
  })

  it('keeps unselected item text in the text column when the indicator is not mounted', async () => {
    render(<Select value="shell:zsh" groups={GROUPS} onValueChange={() => {}} ariaLabel="Target" />)

    fireEvent.click(screen.getByRole('combobox', { name: 'Target' }))
    const option = await screen.findByRole('option', { name: 'Create Claude' })

    const optionText = option.querySelector('.col-start-2')

    expect(optionText?.textContent).toBe('Create Claude')
  })

  it('hides closing popups and positioners after Base UI changes close positioning', async () => {
    const { container } = render(
      <Select value="shell:zsh" groups={GROUPS} onValueChange={() => {}} ariaLabel="Target" />
    )

    fireEvent.click(screen.getByRole('combobox', { name: 'Target' }))
    await screen.findByRole('option', { name: 'Create Claude' })

    const popup = screen.getByRole('listbox').closest('.bg-card')
    const positioner = container.ownerDocument.body.querySelector('[role="presentation"]')

    expect(popup?.className).toContain('data-[ending-style]:hidden')
    expect(popup?.className).not.toContain('data-[ending-style]:translate')
    expect(positioner?.className).toContain('data-[ending-style]:hidden')
  })

  it('keeps the default popup closing visibility policy on the popup element', async () => {
    render(<Select value="shell:zsh" groups={GROUPS} onValueChange={() => {}} ariaLabel="Target" />)

    fireEvent.click(screen.getByRole('combobox', { name: 'Target' }))
    await screen.findByRole('option', { name: 'Create Claude' })

    const popup = screen.getByRole('listbox').closest('.bg-card')

    expect(popup?.className).toContain('data-[ending-style]:hidden')
  })

  it('renders grouped options with accessible group labels', async () => {
    render(<Select value="shell:zsh" groups={GROUPS} onValueChange={() => {}} ariaLabel="Target" />)

    fireEvent.click(screen.getByRole('combobox', { name: 'Target' }))

    expect(await screen.findByRole('group', { name: 'Shell Instances' })).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Create Shell Instance' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Create Claude' })).toBeTruthy()
  })

  it('renders empty options as accessible italic none labels', async () => {
    render(<Select value="" options={EMPTY_OPTIONS} onValueChange={() => {}} ariaLabel="Model" />)

    expect(screen.getByRole('combobox', { name: 'Model' }).textContent).toContain('none')
    expect(screen.getByRole('combobox', { name: 'Model' }).querySelector('i')?.textContent).toBe(
      'none'
    )

    fireEvent.click(screen.getByRole('combobox', { name: 'Model' }))

    const emptyOption = await screen.findByRole('option', { name: 'none' })
    expect(emptyOption.querySelector('i')?.textContent).toBe('none')
  })
})
