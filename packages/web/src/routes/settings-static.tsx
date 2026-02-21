import { Monitor, Moon, Settings as SettingsIcon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'system'

function getStoredTheme(): Theme {
  const stored = localStorage.getItem('theme')
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored
  }
  return 'system'
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.toggle('dark', prefersDark)
    return
  }
  root.classList.toggle('dark', theme === 'dark')
}

export function SettingsStatic() {
  const [theme, setTheme] = useState<Theme>(getStoredTheme)

  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem('theme', theme)
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
          <div className="flex gap-2">
            <button
              onClick={() => setTheme('light')}
              className={`flex items-center gap-2 rounded-md border px-4 py-2 transition-colors ${
                theme === 'light'
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:bg-muted'
              }`}
            >
              <Sun className="h-4 w-4" />
              Light
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`flex items-center gap-2 rounded-md border px-4 py-2 transition-colors ${
                theme === 'dark'
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:bg-muted'
              }`}
            >
              <Moon className="h-4 w-4" />
              Dark
            </button>
            <button
              onClick={() => setTheme('system')}
              className={`flex items-center gap-2 rounded-md border px-4 py-2 transition-colors ${
                theme === 'system'
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:bg-muted'
              }`}
            >
              <Monitor className="h-4 w-4" />
              System
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
