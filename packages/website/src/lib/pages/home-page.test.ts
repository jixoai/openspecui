import { en } from '$lib/i18n/locales/en'
import HomePage from '$lib/pages/home-page.svelte'
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'

describe('HomePage', () => {
  it('renders launch commands and updates runner/app mode', async () => {
    render(HomePage, { content: en, lang: 'en' })

    expect(
      screen.getByText('Operate OpenSpec through a UI that stays close to the CLI.')
    ).toBeVisible()
    expect(screen.getAllByText('npx openspecui@latest --app')).toHaveLength(2)
    expect(screen.getByText('npx openspecui@latest export -o ./dist')).toBeVisible()

    await fireEvent.change(screen.getByLabelText('Runner'), { target: { value: 'pnpm' } })

    expect(screen.getAllByText('pnpx openspecui@latest --app')).toHaveLength(2)

    await fireEvent.click(screen.getByRole('button', { name: 'App mode' }))

    expect(screen.getByText('pnpx openspecui@latest')).toBeVisible()
    expect(screen.getAllByText('pnpx openspecui@latest --app')).toHaveLength(1)
    expect(screen.getByText('pnpx openspecui@latest export -o ./dist')).toBeVisible()
  })
})
