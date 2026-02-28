export type Theme = 'light' | 'dark' | 'system'

const THEME_STORAGE_KEY = 'theme'

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system'
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored
  }
  return 'system'
}

export function persistTheme(theme: Theme): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(THEME_STORAGE_KEY, theme)
}

export function applyTheme(theme: Theme): void {
  if (typeof window === 'undefined') return
  const root = document.documentElement
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.toggle('dark', prefersDark)
    return
  }
  root.classList.toggle('dark', theme === 'dark')
}
