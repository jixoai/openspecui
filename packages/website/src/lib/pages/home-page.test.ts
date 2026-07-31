/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Verify the website launch controls and current compatibility guidance.
 * 2. Prove App and Direct Web choices emit explicit production CLI modes.
 *
 * Original request (2026-07-15): "CLI 1.6 compatibility gate."
 * Original request (2026-07-31): "目前这个版本先给它支持1.7.*，因为基本兼容。"
 */
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
    expect(
      screen.getByText(
        'OpenSpecUI 6.1 targets OpenSpec CLI 1.7.x and accepts 1.6.x as legacy-compatible.'
      )
    ).toBeVisible()

    await fireEvent.change(screen.getByLabelText('Runner'), { target: { value: 'pnpm' } })

    expect(screen.getAllByText('pnpx openspecui@latest --app')).toHaveLength(2)

    await fireEvent.click(screen.getByRole('button', { name: 'App mode' }))

    expect(screen.getByText('pnpx openspecui@latest --web')).toBeVisible()
    expect(screen.getAllByText('pnpx openspecui@latest --app')).toHaveLength(1)
    expect(screen.getByText('pnpx openspecui@latest export -o ./dist')).toBeVisible()
  })
})
