import { applyTheme, getStoredTheme } from '@openspecui/web-src/lib/theme'

export function installWebsiteThemeSync(): void {
  if (typeof window === 'undefined') return

  const sync = () => {
    applyTheme(getStoredTheme())
  }

  sync()
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const handleChange = () => {
    if (getStoredTheme() === 'system') {
      sync()
    }
  }

  media.addEventListener('change', handleChange)
}
