/*
 * Orthogonal intents (updated 2026-09-06 Asia/Shanghai):
 * 1. Verify the registry ThemeToggle drives the site theme contract
 *    (localStorage "theme", `.dark` class + colorScheme on the root).
 *
 * Replaces the retired hand-rolled theme-switcher test with the same
 * three-state coverage against the @jixoai registry component
 * (2026-09-06 registry adoption).
 */
import ThemeToggle from '$lib/ui/theme-toggle/theme-toggle.svelte'
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte'
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

describe('ThemeToggle', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.classList.remove('dark')
    setPrefersDark(false)
  })

  it('persists and applies explicit themes', async () => {
    render(ThemeToggle, { variant: 'full' })
    await waitFor(() => expect(screen.getByRole('button', { name: 'dark' })).toBeInTheDocument())

    await fireEvent.click(screen.getByRole('button', { name: 'dark' }))

    expect(window.localStorage.getItem('theme')).toBe('dark')
    expect(document.documentElement).toHaveClass('dark')

    await fireEvent.click(screen.getByRole('button', { name: 'light' }))

    expect(window.localStorage.getItem('theme')).toBe('light')
    expect(document.documentElement).not.toHaveClass('dark')
  })

  it('keeps system as a selectable mode', async () => {
    render(ThemeToggle, { variant: 'full' })
    await waitFor(() => expect(screen.getByRole('button', { name: 'system' })).toBeInTheDocument())

    await fireEvent.click(screen.getByRole('button', { name: 'system' }))

    expect(window.localStorage.getItem('theme')).toBe('system')
  })

  it('applies system theme from the browser color-scheme preference', async () => {
    setPrefersDark(true)
    render(ThemeToggle, { variant: 'full' })

    await fireEvent.click(await waitFor(() => screen.getByRole('button', { name: 'system' })))

    expect(window.localStorage.getItem('theme')).toBe('system')
    expect(document.documentElement).toHaveClass('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
  })
})
