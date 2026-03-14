export type HostedShellTheme = 'light' | 'dark' | 'system'

const HOSTED_SHELL_THEME_STORAGE_KEY = 'openspecui-app:theme'

export function getHostedShellThemeStorageKey(): string {
  return HOSTED_SHELL_THEME_STORAGE_KEY
}

export function getStoredHostedShellTheme(): HostedShellTheme {
  if (typeof window === 'undefined') return 'system'
  const stored = window.localStorage.getItem(HOSTED_SHELL_THEME_STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored
  }
  return 'system'
}

export function persistHostedShellTheme(theme: HostedShellTheme): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(HOSTED_SHELL_THEME_STORAGE_KEY, theme)
}

export function applyHostedShellTheme(theme: HostedShellTheme): void {
  if (typeof window === 'undefined') return
  const root = document.documentElement
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.toggle('dark', prefersDark)
    return
  }
  root.classList.toggle('dark', theme === 'dark')
}
