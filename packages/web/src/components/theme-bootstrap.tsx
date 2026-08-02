import { applyTheme, getStoredTheme, persistTheme, type Theme } from '@/lib/theme'
import { useConfigSubscription } from '@/lib/use-subscription'
import { useEffect, useState } from 'react'

/**
 * Apply theme globally on app bootstrap, independent from Settings route lifecycle.
 *
 * Hosted (embedded in the App shell): the App is the theme master. When it pushes a
 * theme via postMessage, that override takes priority over backend config.theme and
 * local storage. Child windows never echo their own changes back to the App.
 */

/** Message type discriminator shared with the App-side sender. */
const HOSTED_THEME_SYNC_TYPE = 'openspecui:hosted-theme'

interface HostedThemeSyncMessage {
  readonly type: typeof HOSTED_THEME_SYNC_TYPE
  readonly theme: Theme
}

function isHostedThemeSyncMessage(data: unknown): data is HostedThemeSyncMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as Record<string, unknown>).type === HOSTED_THEME_SYNC_TYPE &&
    typeof (data as Record<string, unknown>).theme === 'string'
  )
}

export function ThemeBootstrap() {
  const { data: config } = useConfigSubscription()
  const [appThemeOverride, setAppThemeOverride] = useState<Theme | null>(null)

  // Receive force-synced theme from the App shell (cross-origin postMessage).
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!isHostedThemeSyncMessage(event.data)) return
      const theme = event.data.theme
      setAppThemeOverride(theme)
      applyTheme(theme)
      persistTheme(theme)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // App override wins over backend config and local storage.
  const activeTheme = appThemeOverride ?? config?.theme ?? getStoredTheme()

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
