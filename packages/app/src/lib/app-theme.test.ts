// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import {
  applyHostedShellTheme,
  getHostedShellThemeStorageKey,
  getStoredHostedShellTheme,
  persistHostedShellTheme,
} from './app-theme'

describe('hosted shell app theme', () => {
  it('defaults to system and persists using the app-specific storage key', () => {
    localStorage.clear()

    expect(getStoredHostedShellTheme()).toBe('system')

    persistHostedShellTheme('dark')
    expect(localStorage.getItem(getHostedShellThemeStorageKey())).toBe('dark')
    expect(getStoredHostedShellTheme()).toBe('dark')
  })

  it('ignores the shared web theme storage key', () => {
    localStorage.clear()
    localStorage.setItem('theme', 'dark')

    expect(getStoredHostedShellTheme()).toBe('system')
  })

  it('applies the hosted shell theme to the root html element', () => {
    document.documentElement.classList.remove('dark')
    applyHostedShellTheme('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    applyHostedShellTheme('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
