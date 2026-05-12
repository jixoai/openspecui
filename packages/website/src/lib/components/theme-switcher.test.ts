import ThemeSwitcher from '$lib/components/theme-switcher.svelte'
import { en } from '$lib/i18n/locales/en'
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'

function setPrefersDark(matches: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn(
      (query: string): MediaQueryList => ({
        matches,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      })
    ),
  })
}

describe('ThemeSwitcher', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.classList.remove('dark')
    setPrefersDark(false)
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

  it('applies system theme from the browser color-scheme preference', async () => {
    setPrefersDark(true)
    render(ThemeSwitcher, { content: en })

    await fireEvent.click(screen.getByRole('button', { name: 'system' }))

    expect(window.localStorage.getItem('theme')).toBe('system')
    expect(document.documentElement).toHaveClass('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
  })
})
