import { ButtonGroup, type ButtonGroupOption } from '@/components/button-group'
import { applyTheme, getStoredTheme, persistTheme, type Theme } from '@/lib/theme'
import { Monitor, Moon, Settings as SettingsIcon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'

const THEME_OPTIONS = [
  {
    value: 'light',
    label: (
      <>
        <Sun className="h-3.5 w-3.5" />
        Light
      </>
    ),
  },
  {
    value: 'dark',
    label: (
      <>
        <Moon className="h-3.5 w-3.5" />
        Dark
      </>
    ),
  },
  {
    value: 'system',
    label: (
      <>
        <Monitor className="h-3.5 w-3.5" />
        System
      </>
    ),
  },
] satisfies ButtonGroupOption<Theme>[]

export function SettingsStatic() {
  const [theme, setTheme] = useState<Theme>(getStoredTheme)

  useEffect(() => {
    applyTheme(theme)
    persistTheme(theme)
  }, [theme])

  useEffect(() => {
    if (theme !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('system')
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [theme])

  return (
    <div className="max-w-2xl space-y-8 p-4">
      <h1 className="font-nav flex items-center gap-2 text-2xl font-bold">
        <SettingsIcon className="h-6 w-6 shrink-0" />
        Settings
      </h1>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Appearance</h2>
        <div className="border-border rounded-lg border p-4">
          <label className="mb-3 block text-sm font-medium">Theme</label>
          <ButtonGroup<Theme> value={theme} onChange={setTheme} options={THEME_OPTIONS} />
        </div>
      </section>
    </div>
  )
}
