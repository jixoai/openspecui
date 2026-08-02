/**
 * Orthogonal intents (created 2026-08-02 Asia/Shanghai):
 * 1. Supply the live App theme preference plus its resolved light/dark value to interactive UI.
 *
 * Original request (2026-08-02): "app settings 中要新增 theme 的开关；titlebar 新增 theme-toggle-icon-button"
 *
 * This hook is presentation-only state. The single source of truth remains
 * localStorage['openspecui-app:theme'] (lib/app-theme.ts) and HostedShellThemeBootstrap owns
 * first-paint application. Mutations go through persistHostedShellTheme + applyHostedShellTheme so
 * the bootstrap storage listener keeps every tab and the document class in sync.
 */
import { useCallback, useEffect, useState } from 'react'
import {
  applyHostedShellTheme,
  getHostedShellThemeStorageKey,
  getStoredHostedShellTheme,
  persistHostedShellTheme,
  type HostedShellTheme,
} from './app-theme'

export type ResolvedHostedShellTheme = 'light' | 'dark'

export interface HostedShellThemeState {
  /** The persisted preference ('light' | 'dark' | 'system'). */
  theme: HostedShellTheme
  /** The effective light/dark value after resolving 'system' against the OS preference. */
  resolvedTheme: ResolvedHostedShellTheme
  /** Persist + apply a new preference; storage sync updates the bootstrap and other tabs. */
  setTheme(theme: HostedShellTheme): void
  /** Cycle system -> light -> dark -> system. */
  toggleTheme(): void
}

function resolveTheme(theme: HostedShellTheme): ResolvedHostedShellTheme {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme
}

const CYCLE: readonly HostedShellTheme[] = ['system', 'light', 'dark']

export function useHostedShellThemeState(): HostedShellThemeState {
  const storageKey = getHostedShellThemeStorageKey()
  const [theme, setThemeState] = useState<HostedShellTheme>(() => getStoredHostedShellTheme())
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedHostedShellTheme>(() =>
    resolveTheme(getStoredHostedShellTheme())
  )

  // Cross-tab + same-tab storage sync (the bootstrap writes the same key on apply).
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey) {
        const next = getStoredHostedShellTheme()
        setThemeState(next)
        setResolvedTheme(resolveTheme(next))
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [storageKey])

  // Re-resolve 'system' when the OS preference flips.
  useEffect(() => {
    if (theme !== 'system') return
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => setResolvedTheme(mediaQuery.matches ? 'dark' : 'light')
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [theme])

  const setTheme = useCallback((next: HostedShellTheme) => {
    persistHostedShellTheme(next)
    applyHostedShellTheme(next)
    setThemeState(next)
    setResolvedTheme(resolveTheme(next))
  }, [])

  const toggleTheme = useCallback(() => {
    const currentIndex = CYCLE.indexOf(theme)
    setTheme(CYCLE[(currentIndex + 1) % CYCLE.length]!)
  }, [theme, setTheme])

  return { theme, resolvedTheme, setTheme, toggleTheme }
}
