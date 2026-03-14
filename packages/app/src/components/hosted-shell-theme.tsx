import { useEffect, useState } from 'react'
import {
  applyHostedShellTheme,
  getHostedShellThemeStorageKey,
  getStoredHostedShellTheme,
  type HostedShellTheme,
} from '../lib/app-theme'
import { applyHostedShellThemeColor } from '../lib/theme-color'

export function HostedShellThemeBootstrap() {
  const [theme, setTheme] = useState<HostedShellTheme>(() => getStoredHostedShellTheme())
  const themeStorageKey = getHostedShellThemeStorageKey()

  useEffect(() => {
    applyHostedShellTheme(theme)
    applyHostedShellThemeColor()
  }, [theme])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === themeStorageKey) {
        setTheme(getStoredHostedShellTheme())
      }
    }

    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [themeStorageKey])

  useEffect(() => {
    if (theme !== 'system' || typeof window.matchMedia !== 'function') return
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      applyHostedShellTheme('system')
      applyHostedShellThemeColor()
    }
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [theme])

  return null
}
