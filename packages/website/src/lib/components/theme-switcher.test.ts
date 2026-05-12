import ThemeSwitcher from '$lib/components/theme-switcher.svelte'
import { en } from '$lib/i18n/locales/en'
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { beforeEach, describe, expect, it } from 'vitest'

describe('ThemeSwitcher', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  it('persists and applies explicit themes', async () => {
    render(ThemeSwitcher, { content: en })

    await fireEvent.click(screen.getByRole('button', { name: 'dark' }))

    expect(window.localStorage.getItem('theme')).toBe('dark')
    expect(document.documentElement).toHaveClass('dark')

    await fireEvent.click(screen.getByRole('button', { name: 'light' }))

    expect(window.localStorage.getItem('theme')).toBe('light')
    expect(document.documentElement).not.toHaveClass('dark')
  })

  it('keeps system as a selectable mode', async () => {
    render(ThemeSwitcher, { content: en })

    await fireEvent.click(screen.getByRole('button', { name: 'system' }))

    expect(window.localStorage.getItem('theme')).toBe('system')
  })
})
