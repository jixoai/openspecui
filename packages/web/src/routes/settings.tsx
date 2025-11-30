import { useState, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { trpc, trpcClient } from '@/lib/trpc'
import { getApiBaseUrl } from '@/lib/api-config'
import { useConfigSubscription } from '@/lib/use-subscription'
import { Sun, Moon, Monitor, Wifi, WifiOff, FolderPlus, Terminal, CheckCircle, XCircle, Check } from 'lucide-react'

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
  const [cliCommand, setCliCommand] = useState('')
  const [selectedTools, setSelectedTools] = useState<string[]>([])

  // 订阅配置
  const { data: config } = useConfigSubscription()

  // CLI 可用性检查
  const { data: cliAvailability, refetch: recheckCli } = useQuery(trpc.cli.checkAvailability.queryOptions())

  // 获取可用工具列表
  const { data: availableTools } = useQuery(trpc.cli.getAvailableTools.queryOptions())

  // 同步配置到本地状态
  useEffect(() => {
    if (config?.cli?.command) {
      setCliCommand(config.cli.command)
    }
  }, [config?.cli?.command])

  // 使用 CLI 执行 init（带工具选择）
  const initMutation = useMutation({
    mutationFn: (tools: string[] | 'all' | 'none') => trpcClient.cli.init.mutate({ tools }),
    onSuccess: (result) => {
      if (result.success) {
        setShowInitSuccess(true)
        setTimeout(() => setShowInitSuccess(false), 3000)
      }
    },
  })

  // 切换工具选择
  const toggleTool = (tool: string) => {
    setSelectedTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
    )
  }

  // 全选/取消全选
  const toggleAllTools = () => {
    if (availableTools && selectedTools.length === availableTools.length) {
      setSelectedTools([])
    } else if (availableTools) {
      setSelectedTools([...availableTools])
    }
  }

  // 保存 CLI 命令配置
  const saveCliCommandMutation = useMutation({
    mutationFn: (command: string) => trpcClient.config.setCliCommand.mutate({ command }),
    onSuccess: () => {
      recheckCli()
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

      {/* CLI Configuration */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">CLI Configuration</h2>
        <div className="border border-border rounded-lg p-4 space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">OpenSpec CLI Command</label>
            <p className="text-sm text-muted-foreground mb-3">
              Configure the command used to run OpenSpec CLI. Examples:
              <code className="bg-muted px-1 mx-1 rounded">npx openspec</code>,
              <code className="bg-muted px-1 mx-1 rounded">bunx openspec</code>,
              <code className="bg-muted px-1 mx-1 rounded">openspec</code> (local install)
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={cliCommand}
                onChange={(e) => setCliCommand(e.target.value)}
                placeholder="npx openspec"
                className="flex-1 px-3 py-2 border border-border rounded-md bg-background text-foreground font-mono text-sm"
              />
              <button
                onClick={() => saveCliCommandMutation.mutate(cliCommand)}
                disabled={saveCliCommandMutation.isPending || cliCommand === config?.cli?.command}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50"
              >
                {saveCliCommandMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>

          {/* CLI Status */}
          <div className="pt-2 border-t border-border">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">CLI Status:</span>
              {cliAvailability?.available ? (
                <span className="flex items-center gap-1 text-sm text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  Available {cliAvailability.version && `(${cliAvailability.version})`}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-sm text-red-600">
                  <XCircle className="w-4 h-4" />
                  Not available
                </span>
              )}
            </div>
            {cliAvailability && !cliAvailability.available && cliAvailability.error && (
              <p className="text-sm text-muted-foreground mt-1 ml-6">
                {cliAvailability.error}
              </p>
            )}
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
        <div className="border border-border rounded-lg p-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Create the OpenSpec directory structure in the current project. This will create{' '}
            <code className="bg-muted px-1 rounded">openspec/</code> with specs, changes, and
            archive directories.
          </p>

          {/* Tool Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">AI Tools Configuration</label>
              <button
                onClick={toggleAllTools}
                className="text-xs text-primary hover:underline"
              >
                {availableTools && selectedTools.length === availableTools.length
                  ? 'Deselect All'
                  : 'Select All'}
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Select which AI tools to configure instruction files for:
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {availableTools?.map((tool) => (
                <button
                  key={tool}
                  onClick={() => toggleTool(tool)}
                  className={`flex items-center gap-1 px-2 py-1.5 text-xs rounded border transition-colors ${
                    selectedTools.includes(tool)
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  {selectedTools.includes(tool) && <Check className="w-3 h-3" />}
                  <span className="truncate">{tool}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Init Buttons */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
            <button
              onClick={() => initMutation.mutate(selectedTools.length > 0 ? selectedTools : 'none')}
              disabled={initMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50"
            >
              <FolderPlus className="w-4 h-4" />
              {initMutation.isPending
                ? 'Initializing...'
                : selectedTools.length > 0
                  ? `Initialize with ${selectedTools.length} tools`
                  : 'Initialize (no tools)'}
            </button>
            <button
              onClick={() => initMutation.mutate('all')}
              disabled={initMutation.isPending}
              className="px-4 py-2 border border-border rounded-md hover:bg-muted disabled:opacity-50"
            >
              Initialize with All Tools
            </button>
          </div>

          {/* Results */}
          {showInitSuccess && (
            <p className="text-sm text-green-600">OpenSpec initialized successfully!</p>
          )}
          {initMutation.isError && (
            <p className="text-sm text-red-600">
              Error: {initMutation.error?.message || 'Failed to initialize'}
            </p>
          )}
          {initMutation.data && !initMutation.data.success && (
            <div className="text-sm text-red-600">
              <p>CLI Error:</p>
              <pre className="bg-muted p-2 rounded mt-1 text-xs overflow-auto max-h-32">
                {initMutation.data.stderr || 'Unknown error'}
              </pre>
            </div>
          )}
          {initMutation.data?.success && initMutation.data.stdout && (
            <div className="text-sm">
              <p className="font-medium text-green-600 mb-1">Output:</p>
              <pre className="bg-muted p-2 rounded text-xs overflow-auto max-h-32">
                {initMutation.data.stdout}
              </pre>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
