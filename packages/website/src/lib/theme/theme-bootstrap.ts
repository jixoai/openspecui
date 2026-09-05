/*
 * Orthogonal intents (updated 2026-09-06 Asia/Shanghai):
 * 1. Express the site theme contract (localStorage "theme", `.dark` class +
 *    colorScheme on the root) locally against the @jixoai registry theme
 *    law — the shared `@openspecui/web-src/lib/theme` borrow retired with
 *    the palette import (packages/web stays untouched).
 * 2. Keep the system-mode media listener so "system" tracks OS changes.
 *
 * Original request (2026-09-06): 官网接入 @jixoai registry — theme
 * persistence re-expressed against the registry contract; the server-side
 * no-flash bootstrap (theme-bootstrap.server.ts) already speaks it.
 */

export type WebsiteTheme = 'light' | 'dark' | 'system'

const THEME_STORAGE_KEY = 'theme'

function isWebsiteTheme(value: unknown): value is WebsiteTheme {
  return value === 'light' || value === 'dark' || value === 'system'
}

export function getWebsiteStoredTheme(): WebsiteTheme {
  if (typeof window === 'undefined') return 'system'
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isWebsiteTheme(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

export function persistWebsiteTheme(theme: WebsiteTheme): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Storage can be unavailable (private mode); the in-memory theme still applies.
  }
}

function syncDocumentColorScheme(): void {
  if (typeof document === 'undefined') return
  document.documentElement.style.colorScheme = document.documentElement.classList.contains('dark')
    ? 'dark'
    : 'light'
}

export function applyWebsiteTheme(theme: WebsiteTheme): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.toggle('dark', prefersDark)
  } else {
    root.classList.toggle('dark', theme === 'dark')
  }
  syncDocumentColorScheme()
}

export function installWebsiteThemeSync(): () => void {
  if (typeof window === 'undefined') return () => undefined

  const sync = () => {
    applyWebsiteTheme(getWebsiteStoredTheme())
  }

  sync()
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const handleChange = () => {
    if (getWebsiteStoredTheme() === 'system') {
      sync()
    }
  }

  media.addEventListener('change', handleChange)
  return () => media.removeEventListener('change', handleChange)
}
