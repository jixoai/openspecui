import { applyTheme, getStoredTheme, persistTheme, type Theme } from '@openspecui/web-src/lib/theme'

export type WebsiteTheme = Theme

export const getWebsiteStoredTheme = getStoredTheme
export const persistWebsiteTheme = persistTheme

function syncDocumentColorScheme(): void {
  if (typeof document === 'undefined') return
  document.documentElement.style.colorScheme = document.documentElement.classList.contains('dark')
    ? 'dark'
    : 'light'
}

export function applyWebsiteTheme(theme: WebsiteTheme): void {
  applyTheme(theme)
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
