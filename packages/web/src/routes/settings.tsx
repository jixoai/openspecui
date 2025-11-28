import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { trpcClient } from '@/lib/trpc'
import { getApiBaseUrl } from '@/lib/api-config'
import { Sun, Moon, Monitor, Wifi, WifiOff, FolderPlus } from 'lucide-react'

type Theme = 'light' | 'dark' | 'system'

function getStoredTheme(): Theme {
  const stored = localStorage.getItem('theme')
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored
  }
  return 'system'
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.toggle('dark', prefersDark)
  } else {
    root.classList.toggle('dark', theme === 'dark')
  }
}

export function Settings() {
  const [theme, setTheme] = useState<Theme>(getStoredTheme)
  const [apiUrl, setApiUrl] = useState(getApiBaseUrl() || '')
  const [showInitSuccess, setShowInitSuccess] = useState(false)

  const initMutation = useMutation({
    mutationFn: () => trpcClient.init.init.mutate(),
    onSuccess: () => {
      setShowInitSuccess(true)
      setTimeout(() => setShowInitSuccess(false), 3000)
    },
  })

  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('system')
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [theme])

  const handleApiUrlChange = () => {
    const currentUrl = new URL(window.location.href)
    if (apiUrl) {
      currentUrl.searchParams.set('api', apiUrl)
    } else {
      currentUrl.searchParams.delete('api')
    }
    window.location.href = currentUrl.toString()
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Theme */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Appearance</h2>
        <div className="border border-border rounded-lg p-4">
          <label className="text-sm font-medium mb-3 block">Theme</label>
          <div className="flex gap-2">
            <button
              onClick={() => setTheme('light')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md border transition-colors ${
                theme === 'light'
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:bg-muted'
              }`}
            >
              <Sun className="w-4 h-4" />
              Light
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md border transition-colors ${
                theme === 'dark'
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:bg-muted'
              }`}
            >
              <Moon className="w-4 h-4" />
              Dark
            </button>
            <button
              onClick={() => setTheme('system')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md border transition-colors ${
                theme === 'system'
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:bg-muted'
              }`}
            >
              <Monitor className="w-4 h-4" />
              System
            </button>
          </div>
        </div>
      </section>

      {/* API Configuration */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">API Configuration</h2>
        <div className="border border-border rounded-lg p-4 space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">API Server URL</label>
            <p className="text-sm text-muted-foreground mb-3">
              Leave empty for same-origin requests. Set a custom URL to connect to a different
              server.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="http://localhost:3100"
                className="flex-1 px-3 py-2 border border-border rounded-md bg-background text-foreground"
              />
              <button
                onClick={handleApiUrlChange}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90"
              >
                Apply
              </button>
            </div>
            {getApiBaseUrl() && (
              <p className="text-sm text-muted-foreground mt-2">
                Current: <code className="bg-muted px-1 rounded">{getApiBaseUrl()}</code>
              </p>
            )}
          </div>
        </div>
      </section>

      {/* File Watcher Info */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">File Watcher</h2>
        <div className="border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground mb-3">
            File watcher is configured on the server side. Check the status bar at the bottom of the
            page to see if file watching is enabled.
          </p>
          <div className="flex items-center gap-2 text-sm">
            <Wifi className="w-4 h-4 text-green-500" />
            <span>Enabled: Real-time updates when files change</span>
          </div>
          <div className="flex items-center gap-2 text-sm mt-2">
            <WifiOff className="w-4 h-4 text-yellow-500" />
            <span>Disabled: Manual refresh required</span>
          </div>
          <p className="text-sm text-muted-foreground mt-3">
            To disable file watching, restart the server with{' '}
            <code className="bg-muted px-1 rounded">--no-watch</code> flag.
          </p>
        </div>
      </section>

      {/* Initialize OpenSpec */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Initialize OpenSpec</h2>
        <div className="border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground mb-4">
            Create the OpenSpec directory structure in the current project. This will create{' '}
            <code className="bg-muted px-1 rounded">openspec/</code> with specs, changes, and
            archive directories.
          </p>
          <button
            onClick={() => initMutation.mutate()}
            disabled={initMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50"
          >
            <FolderPlus className="w-4 h-4" />
            {initMutation.isPending ? 'Initializing...' : 'Initialize OpenSpec'}
          </button>
          {showInitSuccess && (
            <p className="text-sm text-green-600 mt-2">OpenSpec initialized successfully!</p>
          )}
          {initMutation.isError && (
            <p className="text-sm text-red-600 mt-2">
              Error: {initMutation.error?.message || 'Failed to initialize'}
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
