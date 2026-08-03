import { applyTheme, getStoredTheme, persistTheme } from '@/lib/theme'
import { useConfigSubscription } from '@/lib/use-subscription'
import { useEffect } from 'react'

/**
 * Apply theme globally on app bootstrap, independent from Settings route lifecycle.
 */
export function ThemeBootstrap() {
  const { data: config } = useConfigSubscription()
  const activeTheme = config?.theme ?? getStoredTheme()

  useEffect(() => {
    applyTheme(activeTheme)
    persistTheme(activeTheme)
  }, [activeTheme])

  useEffect(() => {
    if (activeTheme !== 'system') return
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('system')
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [activeTheme])

  return null
}
