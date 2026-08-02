import { applyTheme, getStoredTheme, persistTheme, type Theme } from '@/lib/theme'
import { useConfigSubscription } from '@/lib/use-subscription'
import { useEffect, useState } from 'react'

/**
 * Apply theme globally on app bootstrap, independent from Settings route lifecycle.
 *
 * Hosted (embedded in the App shell): the App is the theme master. When it pushes a
 * theme via postMessage, that override takes priority. Child windows never echo their
 * own changes back to the App.
 *
 * Precedence: App push (override) > local storage (child's own choice) > backend
 * config.theme (first-visit default only). A local Settings change clears the override
 * so the child's choice wins until the App pushes again.
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

/** Current App-forced override; cleared when the child changes theme locally. */
let hostedThemeOverride: Theme | null = null

/** Clear the App-forced override so a local child change takes effect. */
export function clearHostedThemeOverride(): void {
  hostedThemeOverride = null
}

export function ThemeBootstrap() {
  const { data: config } = useConfigSubscription()
  const [overrideTick, setOverrideTick] = useState(0)

  // Receive force-synced theme from the App shell (cross-origin postMessage).
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!isHostedThemeSyncMessage(event.data)) return
      const theme = event.data.theme
      hostedThemeOverride = theme
      setOverrideTick((tick) => tick + 1)
      applyTheme(theme)
      persistTheme(theme)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // Override > local storage > backend config (first-visit default).
  const activeTheme = hostedThemeOverride ?? getStoredTheme() ?? config?.theme ?? 'system'

  useEffect(() => {
    applyTheme(activeTheme)
    persistTheme(activeTheme)
  }, [activeTheme, overrideTick])

  useEffect(() => {
    if (activeTheme !== 'system') return
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('system')
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [activeTheme])

  return null
}
