import { CliTerminal } from '@/components/cli-terminal'
import { CopyablePath } from '@/components/copyable-path'
import { Dialog } from '@/components/dialog'
import { getApiBaseUrl } from '@/lib/api-config'
import {
  CODE_EDITOR_THEME_OPTIONS,
  DEFAULT_CODE_EDITOR_THEME,
  isCodeEditorTheme,
  type CodeEditorTheme,
} from '@/lib/code-editor-theme'
import { isStaticMode } from '@/lib/static-mode'
import {
  GOOGLE_FONT_PRESETS,
  isTerminalRendererEngine,
  TERMINAL_RENDERER_ENGINES,
  terminalController,
  type TerminalRendererEngine,
} from '@/lib/terminal-controller'
import { applyTheme, getStoredTheme, persistTheme, type Theme } from '@/lib/theme'
import { queryClient, trpc, trpcClient } from '@/lib/trpc'
import { useCliRunner } from '@/lib/use-cli-runner'
import { useServerStatus } from '@/lib/use-server-status'
import { useConfigSubscription } from '@/lib/use-subscription'
import { OFFICIAL_APP_BASE_URL } from '@openspecui/core/hosted-app'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowUp,
  Check,
  CheckCircle,
  Download,
  FolderOpen,
  FolderPlus,
  LayoutDashboard,
  Link2,
  Loader2,
  Monitor,
  Moon,
  Plus,
  RefreshCw,
  Settings as SettingsIcon,
  Sun,
  Terminal,
  Unlink2,
  XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  buildSettingsInitArgs,
  canAutoInit,
  countSelectedToolActions,
  formatSelectedInitLabel,
  getSettingsInitActionState,
  getToolInitStatus,
  type InitProfileOverride,
  type InitToolsMode,
} from './settings-init'

function formatExecutePath(command: string, args: readonly string[] = []): string {
  const quote = (token: string): string => {
    if (!token) return '""'
    if (!/[\s"'\\]/.test(token)) return token
    return JSON.stringify(token)
  }
  return [command, ...args].map(quote).join(' ')
}

function FontFamilyEditor({
  value,
  onChange,
  onBlur,
}: {
  value: string
  onChange: (v: string) => void
  onBlur: () => void
}) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [customUrl, setCustomUrl] = useState('')

  const append = (entry: string) => {
    const current = value.trim()
    const next = current ? `${current}, ${entry}` : entry
    onChange(next)
  }

  return (
    <div>
      <label className="mb-2 block text-sm font-medium">Font Family</label>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder="e.g. JetBrains Mono, monospace"
          className="bg-background border-border text-foreground focus:ring-primary flex-1 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1"
        />
        <button
          type="button"
          popoverTarget="font-family-popover"
          className="border-border hover:bg-muted rounded-md border px-2 py-2 transition-colors"
          aria-label="Add font"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Popover for presets + custom URL */}
      <div
        id="font-family-popover"
        ref={popoverRef}
        popover="auto"
        className="bg-popover text-popover-foreground border-border m-auto rounded-lg border p-4 shadow-lg backdrop:bg-black/20"
      >
        <div className="w-64 space-y-3">
          <p className="text-sm font-medium">Google Fonts</p>
          <div className="flex flex-wrap gap-1.5">
            {GOOGLE_FONT_PRESETS.map((font) => (
              <button
                key={font}
                type="button"
                onClick={() => {
                  append(font)
                  popoverRef.current?.hidePopover()
                }}
                className="border-border hover:bg-muted rounded-md border px-2 py-1 text-xs transition-colors"
              >
                {font}
              </button>
            ))}
          </div>

          <hr className="border-border" />

          <p className="text-sm font-medium">Custom Font URL</p>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="https://..."
              className="bg-background border-border text-foreground focus:ring-primary min-w-0 flex-1 rounded-md border px-2 py-1 text-xs focus:outline-none focus:ring-1"
            />
            <button
              type="button"
              onClick={() => {
                const url = customUrl.trim()
                if (url) {
                  append(url)
                  setCustomUrl('')
                  popoverRef.current?.hidePopover()
                }
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-2 py-1 text-xs font-medium transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Settings() {
  const [theme, setTheme] = useState<Theme>(getStoredTheme)
  const [codeEditorTheme, setCodeEditorTheme] = useState<CodeEditorTheme>(DEFAULT_CODE_EDITOR_THEME)
  const [apiUrl, setApiUrl] = useState(getApiBaseUrl() || '')
  const [appBaseUrl, setAppBaseUrl] = useState('')
  const [cliCommand, setCliCommand] = useState('')
  const [manualSelectedTools, setManualSelectedTools] = useState<string[]>([])
  const [showInitModal, setShowInitModal] = useState(false)
  const [showInstallModal, setShowInstallModal] = useState(false)
  const [initToolsMode, setInitToolsMode] = useState<InitToolsMode>('auto')
  const [initProfileOverride, setInitProfileOverride] = useState<InitProfileOverride>('default')
  const [initForce, setInitForce] = useState(true)

  const initRunner = useCliRunner()
  const installRunner = useCliRunner()

  const {
    lines: initLines,
    status: initStatus,
    commands: initCommands,
    cancel: cancelInit,
    reset: resetInit,
  } = initRunner

  const initBorderVariant =
    initStatus === 'error' ? 'error' : initStatus === 'success' ? 'success' : 'default'

  const {
    lines: installLines,
    status: installStatus,
    commands: installCommands,
    cancel: cancelInstall,
    reset: resetInstall,
  } = installRunner

  const installBorderVariant =
    installStatus === 'error' ? 'error' : installStatus === 'success' ? 'success' : 'default'

  // 服务器状态（包含项目路径）
  const serverStatus = useServerStatus()

  // In static mode, only show appearance settings
  const inStaticMode = isStaticMode()

  // 订阅配置
  const { data: config } = useConfigSubscription()

  // 嗅探全局 CLI（每次进入 settings 页面都会重新嗅探）
  // Skip in static mode
  const {
    data: cliSniffResult,
    isLoading: isSniffingCli,
    refetch: resniffCli,
  } = useQuery({
    ...trpc.cli.sniffGlobalCli.queryOptions(),
    staleTime: 0,
    gcTime: 0,
    enabled: !inStaticMode,
  })

  // CLI 可用性检查（基于配置或嗅探结果）
  // Skip in static mode
  const {
    data: cliAvailability,
    isLoading: isCheckingCli,
    refetch: recheckCli,
  } = useQuery({
    ...trpc.cli.checkAvailability.queryOptions(),
    enabled: !inStaticMode,
  })
  const { data: effectiveCliCommand, refetch: refetchEffectiveCliCommand } = useQuery({
    ...trpc.config.getEffectiveCliCommand.queryOptions(),
    enabled: !inStaticMode,
  })

  // 获取所有工具列表
  // Skip in static mode
  const { data: allTools } = useQuery({
    ...trpc.cli.getAllTools.queryOptions(),
    enabled: !inStaticMode,
  })
  const {
    data: detectedProjectTools,
    isLoading: isLoadingDetectedProjectTools,
    refetch: refetchDetectedProjectTools,
  } = useQuery({
    ...trpc.cli.getDetectedProjectTools.queryOptions(),
    enabled: !inStaticMode,
  })
  const {
    data: opsxProfileState,
    isLoading: isLoadingOpsxProfileState,
    refetch: refetchOpsxProfileState,
  } = useQuery({
    ...trpc.cli.getProfileState.queryOptions(),
    enabled: !inStaticMode,
  })

  const toolInitStateInput = useMemo(() => {
    if (!opsxProfileState?.available || !opsxProfileState.delivery) {
      return null
    }
    return {
      delivery: opsxProfileState.delivery,
      workflows: opsxProfileState.workflows,
    }
  }, [opsxProfileState?.available, opsxProfileState?.delivery, opsxProfileState?.workflows])

  const { data: toolInitStates, refetch: refetchToolInitStates } = useQuery({
    ...trpc.cli.getToolInitStates.queryOptions(
      toolInitStateInput ?? { delivery: 'both', workflows: [] }
    ),
    enabled: !inStaticMode && toolInitStateInput !== null,
  })

  const nativeTools = useMemo(() => allTools?.filter((t) => t.available) ?? [], [allTools])
  const cliSupportedToolIds = useMemo(() => nativeTools.map((t) => t.value), [nativeTools])
  const cliSupportedTools = useMemo(() => new Set(cliSupportedToolIds), [cliSupportedToolIds])
  const cliSupportedToolsKey = useMemo(() => cliSupportedToolIds.join('|'), [cliSupportedToolIds])
  const detectedProjectToolIds = useMemo(
    () => detectedProjectTools?.map((tool) => tool.value) ?? [],
    [detectedProjectTools]
  )
  const toolInitStateById = useMemo(
    () => new Map((toolInitStates ?? []).map((state) => [state.toolId, state])),
    [toolInitStates]
  )
  const initializedToolIds = useMemo(
    () =>
      cliSupportedToolIds.filter(
        (toolId) => getToolInitStatus(toolInitStateById, toolId) === 'initialized'
      ),
    [cliSupportedToolIds, toolInitStateById]
  )
  const initializedToolSet = useMemo(() => new Set(initializedToolIds), [initializedToolIds])
  const initializedToolIdsKey = useMemo(() => initializedToolIds.join('|'), [initializedToolIds])
  const selectableToolIds = useMemo(
    () =>
      cliSupportedToolIds.filter(
        (toolId) => getToolInitStatus(toolInitStateById, toolId) !== 'initialized'
      ),
    [cliSupportedToolIds, toolInitStateById]
  )
  const selectedTools = useMemo(
    () =>
      manualSelectedTools.filter(
        (toolId) => cliSupportedTools.has(toolId) && !initializedToolSet.has(toolId)
      ),
    [cliSupportedTools, initializedToolSet, manualSelectedTools]
  )

  // 同步配置到本地状态（只有用户配置了才显示）
  useEffect(() => {
    if (config?.cli?.command) {
      setCliCommand(formatExecutePath(config.cli.command, config.cli.args ?? []))
    } else {
      setCliCommand('')
    }
  }, [config?.cli?.args, config?.cli?.command])

  const savedCliCommand = useMemo(() => {
    if (!config?.cli?.command) return ''
    return formatExecutePath(config.cli.command, config.cli.args ?? [])
  }, [config?.cli?.args, config?.cli?.command])

  useEffect(() => {
    if (!config?.theme) return
    setTheme(config.theme)
  }, [config?.theme])
  useEffect(() => {
    const nextTheme = config?.codeEditor?.theme
    if (!nextTheme || !isCodeEditorTheme(nextTheme)) return
    setCodeEditorTheme(nextTheme)
  }, [config?.codeEditor?.theme])
  useEffect(() => {
    setAppBaseUrl(config?.appBaseUrl ?? '')
  }, [config?.appBaseUrl])

  // 安装完成后重新嗅探
  const handleInstallSuccess = useCallback(() => {
    resniffCli()
    recheckCli()
    setShowInstallModal(false)
  }, [resniffCli, recheckCli])

  // 计算显示的 placeholder
  const cliPlaceholder = cliSniffResult?.hasGlobal
    ? 'openspec (v' + (cliSniffResult.version || 'detected') + ')'
    : 'npx @fission-ai/openspec'

  useEffect(() => {
    setManualSelectedTools((prev) => {
      const next = prev.filter(
        (toolId) => cliSupportedTools.has(toolId) && !initializedToolSet.has(toolId)
      )
      return prev.length === next.length && prev.every((toolId, index) => toolId === next[index])
        ? prev
        : next
    })
  }, [cliSupportedTools, cliSupportedToolsKey, initializedToolSet, initializedToolIdsKey])

  const selectedToolActionCounts = useMemo(
    () => countSelectedToolActions(toolInitStateById, selectedTools),
    [selectedTools, toolInitStateById]
  )
  const initializedToolsCount = useMemo(
    () => (toolInitStates ?? []).filter((state) => state.status === 'initialized').length,
    [toolInitStates]
  )
  const repairableToolsCount = useMemo(
    () => (toolInitStates ?? []).filter((state) => state.status === 'partial').length,
    [toolInitStates]
  )

  // 打开 init modal
  const startInit = (mode: InitToolsMode) => {
    setInitToolsMode(mode)
    setShowInitModal(true)
  }

  // Modal lifecycle: auto start streams when打开
  // Keep state clean when关闭
  useEffect(() => {
    if (!showInitModal) {
      cancelInit()
      resetInit()
    }
  }, [showInitModal, cancelInit, resetInit])

  const initArgs = useMemo(
    () =>
      buildSettingsInitArgs({
        mode: initToolsMode,
        selectedToolIds: selectedTools,
        cliSupportedToolIds: cliSupportedTools,
        profileOverride: initProfileOverride,
        force: initForce,
      }),
    [cliSupportedTools, initForce, initProfileOverride, initToolsMode, selectedTools]
  )

  useEffect(() => {
    if (!showInitModal) return
    initCommands.replaceAll([{ command: 'openspec', args: initArgs }])
  }, [initArgs, initCommands, showInitModal])

  useEffect(() => {
    if (showInstallModal) {
      installCommands.replaceAll([
        { command: 'npm', args: ['install', '-g', '@fission-ai/openspec'] },
      ])
      installCommands.runAll()
    } else {
      cancelInstall()
      resetInstall()
    }
  }, [showInstallModal, installCommands, cancelInstall, resetInstall])

  useEffect(() => {
    if (initStatus !== 'success') return
    void Promise.allSettled([
      refetchOpsxProfileState(),
      refetchDetectedProjectTools(),
      refetchToolInitStates(),
      recheckCli(),
      resniffCli(),
    ])
  }, [
    initStatus,
    refetchDetectedProjectTools,
    refetchOpsxProfileState,
    refetchToolInitStates,
    recheckCli,
    resniffCli,
  ])

  const isToolInitialized = (toolId: string) =>
    getToolInitStatus(toolInitStateById, toolId) === 'initialized'

  const toggleTool = (toolId: string) => {
    if (!cliSupportedTools.has(toolId) || isToolInitialized(toolId)) return
    setManualSelectedTools((prev) =>
      prev.includes(toolId) ? prev.filter((id) => id !== toolId) : [...prev, toolId]
    )
  }

  const toggleAllTools = () => {
    const allSelectableSelected =
      selectableToolIds.length > 0 &&
      selectableToolIds.every((toolId) => manualSelectedTools.includes(toolId))

    if (allSelectableSelected) {
      setManualSelectedTools([])
      return
    }

    setManualSelectedTools([...selectableToolIds])
  }

  const newToolsCount = selectedToolActionCounts.newCount
  const repairToolsCount = selectedToolActionCounts.repairCount
  const selectedInitLabel = formatSelectedInitLabel(selectedToolActionCounts)
  const hasSelectedToolActions = newToolsCount + repairToolsCount > 0
  const isManualToolsMode = initToolsMode === 'selected'
  const autoInitDisabled = isLoadingDetectedProjectTools || !canAutoInit(detectedProjectToolIds)
  const currentInitAction = useMemo(
    () =>
      getSettingsInitActionState({
        mode: initToolsMode,
        selectedLabel: selectedInitLabel,
        autoInitDisabled,
        hasSelectedToolActions,
      }),
    [autoInitDisabled, hasSelectedToolActions, initToolsMode, selectedInitLabel]
  )

  const handleCloseInit = () => {
    setShowInitModal(false)
    cancelInit()
    resetInit()
  }

  const handleCloseInstall = () => {
    setShowInstallModal(false)
    cancelInstall()
    resetInstall()
  }

  // 保存 execute-path 配置
  const saveCliCommandMutation = useMutation({
    mutationFn: (command: string) => trpcClient.config.update.mutate({ cli: { command } }),
    onSuccess: async () => {
      await Promise.allSettled([recheckCli(), refetchEffectiveCliCommand(), resniffCli()])
      await Promise.allSettled([
        queryClient.invalidateQueries(trpc.cli.checkAvailability.queryFilter()),
        queryClient.invalidateQueries(trpc.config.getEffectiveCliCommand.queryFilter()),
      ])
    },
  })

  const syncOpsxProjectMutation = useMutation({
    mutationFn: () => trpcClient.cli.execute.mutate({ args: ['update'] }),
    onSuccess: async () => {
      await Promise.allSettled([
        refetchOpsxProfileState(),
        recheckCli(),
        resniffCli(),
        queryClient.invalidateQueries(trpc.cli.checkAvailability.queryFilter()),
      ])
    },
  })

  const setCoreProfileMutation = useMutation({
    mutationFn: () => trpcClient.cli.execute.mutate({ args: ['config', 'profile', 'core'] }),
    onSuccess: async () => {
      await Promise.allSettled([refetchOpsxProfileState()])
    },
  })

  const saveThemeMutation = useMutation({
    mutationFn: (nextTheme: Theme) => trpcClient.config.update.mutate({ theme: nextTheme }),
  })
  const saveCodeEditorThemeMutation = useMutation({
    mutationFn: (nextTheme: CodeEditorTheme) =>
      trpcClient.config.update.mutate({ codeEditor: { theme: nextTheme } }),
  })
  const saveAppBaseUrlMutation = useMutation({
    mutationFn: (nextAppBaseUrl: string) =>
      trpcClient.config.update.mutate({ appBaseUrl: nextAppBaseUrl.trim() }),
  })

  // Terminal config — seed local state from controller's current config
  const initialConfig = useMemo(() => terminalController.getConfig(), [])

  const [termFontSize, setTermFontSize] = useState(initialConfig.fontSize)
  const [termFontFamily, setTermFontFamily] = useState(initialConfig.fontFamily)
  const [termCursorBlink, setTermCursorBlink] = useState(initialConfig.cursorBlink)
  const [termCursorStyle, setTermCursorStyle] = useState<'block' | 'underline' | 'bar'>(
    initialConfig.cursorStyle
  )
  const [termScrollback, setTermScrollback] = useState(initialConfig.scrollback)
  const [termRendererEngine, setTermRendererEngine] = useState<string>(initialConfig.rendererEngine)
  const [dashboardTrendPointLimit, setDashboardTrendPointLimit] = useState(100)
  const [termRendererError, setTermRendererError] = useState<string | null>(null)
  const isRendererEngineValid = isTerminalRendererEngine(termRendererEngine)

  // Re-sync local state when controller config changes
  useEffect(
    () => {
      const current = terminalController.getConfig()
      setTermFontSize(current.fontSize)
      setTermFontFamily(current.fontFamily)
      setTermCursorBlink(current.cursorBlink)
      setTermCursorStyle(current.cursorStyle)
      setTermScrollback(current.scrollback)
      setTermRendererEngine(current.rendererEngine)
    },
    [
      /* re-run when entering settings page — captured by loading state transition */
    ]
  )

  useEffect(() => {
    const nextRenderer = config?.terminal?.rendererEngine
    if (typeof nextRenderer === 'string' && nextRenderer.length > 0) {
      setTermRendererEngine(nextRenderer)
    }
  }, [config?.terminal?.rendererEngine])

  // Apply immediately on local state change (live preview)
  const applyTerminalConfig = useCallback(
    (overrides: {
      fontSize?: number
      fontFamily?: string
      cursorBlink?: boolean
      cursorStyle?: 'block' | 'underline' | 'bar'
      scrollback?: number
    }) => {
      terminalController.applyConfig({
        fontSize: overrides.fontSize ?? termFontSize,
        fontFamily: overrides.fontFamily ?? termFontFamily,
        cursorBlink: overrides.cursorBlink ?? termCursorBlink,
        cursorStyle: overrides.cursorStyle ?? termCursorStyle,
        scrollback: overrides.scrollback ?? termScrollback,
      })
    },
    [termFontSize, termFontFamily, termCursorBlink, termCursorStyle, termScrollback]
  )

  const handleRendererEngineChange = useCallback(async (nextEngine: TerminalRendererEngine) => {
    setTermRendererError(null)
    try {
      await terminalController.setRendererEngine(nextEngine)
      setTermRendererEngine(nextEngine)
    } catch (error) {
      setTermRendererEngine(terminalController.getConfig().rendererEngine)
      setTermRendererError(error instanceof Error ? error.message : String(error))
    }
  }, [])

  const saveTerminalConfigMutation = useMutation({
    mutationFn: (terminal: {
      fontSize?: number
      fontFamily?: string
      cursorBlink?: boolean
      cursorStyle?: 'block' | 'underline' | 'bar'
      scrollback?: number
      rendererEngine?: TerminalRendererEngine
    }) => trpcClient.config.update.mutate({ terminal }),
  })
  const saveDashboardConfigMutation = useMutation({
    mutationFn: (trendPointLimit: number) =>
      trpcClient.config.update.mutate({
        dashboard: { trendPointLimit },
      }),
  })

  useEffect(() => {
    const nextLimit = config?.dashboard?.trendPointLimit
    if (typeof nextLimit === 'number' && Number.isFinite(nextLimit)) {
      setDashboardTrendPointLimit(nextLimit)
    }
  }, [config?.dashboard?.trendPointLimit])

  const savedDashboardTrendPointLimit = config?.dashboard?.trendPointLimit ?? 100
  const savedAppBaseUrl = config?.appBaseUrl ?? ''

  useEffect(() => {
    applyTheme(theme)
    persistTheme(theme)
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
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    setLoading(false)
  }, [])
  if (loading) {
    return <div className="route-loading animate-pulse">Loading settings...</div>
  }

  return (
    <div className="max-w-2xl space-y-8 p-4">
      <h1 className="font-nav flex items-center gap-2 text-2xl font-bold">
        <SettingsIcon className="h-6 w-6 shrink-0" />
        Settings
      </h1>

      {/* Theme */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Appearance</h2>
        <div className="border-border rounded-lg border p-4">
          <label className="mb-3 block text-sm font-medium">Theme</label>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setTheme('light')
                saveThemeMutation.mutate('light')
              }}
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
              onClick={() => {
                setTheme('dark')
                saveThemeMutation.mutate('dark')
              }}
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
              onClick={() => {
                setTheme('system')
                saveThemeMutation.mutate('system')
              }}
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
          <div className="border-border/60 mt-4 border-t pt-4">
            <label className="mb-2 block text-sm font-medium">Code Editor Theme</label>
            <div className="flex items-center gap-2">
              <select
                value={codeEditorTheme}
                onChange={(e) => {
                  const nextTheme = e.target.value
                  if (!isCodeEditorTheme(nextTheme)) return
                  setCodeEditorTheme(nextTheme)
                  if (!inStaticMode) {
                    saveCodeEditorThemeMutation.mutate(nextTheme)
                  }
                }}
                className="bg-background border-border text-foreground focus:ring-primary w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1"
                disabled={inStaticMode || saveCodeEditorThemeMutation.isPending}
              >
                {CODE_EDITOR_THEME_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {saveCodeEditorThemeMutation.isPending ? (
                <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
              ) : saveCodeEditorThemeMutation.isSuccess ? (
                <Check className="h-4 w-4 text-emerald-500" />
              ) : null}
            </div>
            <p className="text-muted-foreground mt-2 text-xs">
              Changes apply immediately to all CodeMirror editors.
            </p>
          </div>
        </div>
      </section>

      {/* Only show other sections in dynamic mode */}
      {!inStaticMode && (
        <>
          {/* Terminal Settings */}
          <section className="space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Terminal className="h-5 w-5" />
              Terminal
            </h2>
            <div className="border-border space-y-4 rounded-lg border p-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Renderer Engine</label>
                <select
                  value={termRendererEngine}
                  onChange={(e) => {
                    const next = e.target.value
                    setTermRendererEngine(next)
                    if (isTerminalRendererEngine(next)) {
                      void handleRendererEngineChange(next)
                    } else {
                      setTermRendererError(`Invalid renderer engine: ${next}`)
                    }
                  }}
                  className="bg-background border-border text-foreground focus:ring-primary w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1"
                >
                  {TERMINAL_RENDERER_ENGINES.map((engine) => (
                    <option key={engine} value={engine}>
                      {engine === 'ghostty' ? 'ghostty-web' : engine}
                    </option>
                  ))}
                  {!isRendererEngineValid && (
                    <option value={termRendererEngine}>
                      {`Invalid value: ${termRendererEngine}`}
                    </option>
                  )}
                </select>
                {termRendererError ? (
                  <p className="mt-2 text-xs text-red-500">{termRendererError}</p>
                ) : (
                  <p className="text-muted-foreground mt-2 text-xs">
                    Switches immediately and remounts current terminal sessions.
                  </p>
                )}
                {!isRendererEngineValid && (
                  <p className="mt-2 text-xs text-amber-500">
                    Current config contains an unsupported renderer value. Select a valid one to fix
                    it.
                  </p>
                )}
              </div>

              {/* Font Size */}
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Font Size: {termFontSize}px
                </label>
                <input
                  type="range"
                  min={8}
                  max={32}
                  value={termFontSize}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    setTermFontSize(v)
                    applyTerminalConfig({ fontSize: v })
                  }}
                  className="accent-primary w-full"
                />
                <div className="text-muted-foreground flex justify-between text-xs">
                  <span>8</span>
                  <span>32</span>
                </div>
              </div>

              {/* Font Family */}
              <FontFamilyEditor
                value={termFontFamily}
                onChange={(v) => {
                  setTermFontFamily(v)
                  applyTerminalConfig({ fontFamily: v })
                }}
                onBlur={() => applyTerminalConfig({ fontFamily: termFontFamily })}
              />

              {/* Cursor Style */}
              <div>
                <label className="mb-2 block text-sm font-medium">Cursor Style</label>
                <div className="flex gap-2">
                  {(['block', 'underline', 'bar'] as const).map((style) => (
                    <button
                      key={style}
                      onClick={() => {
                        setTermCursorStyle(style)
                        applyTerminalConfig({ cursorStyle: style })
                      }}
                      className={`rounded-md border px-4 py-2 text-sm capitalize transition-colors ${
                        termCursorStyle === style
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border hover:bg-muted'
                      }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cursor Blink */}
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Cursor Blink</label>
                <button
                  onClick={() => {
                    const v = !termCursorBlink
                    setTermCursorBlink(v)
                    applyTerminalConfig({ cursorBlink: v })
                  }}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    termCursorBlink ? 'bg-primary' : 'bg-muted-foreground/30'
                  }`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                      termCursorBlink ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Scrollback */}
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Scrollback Lines: {termScrollback.toLocaleString()}
                </label>
                <input
                  type="range"
                  min={0}
                  max={100000}
                  step={1000}
                  value={termScrollback}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    setTermScrollback(v)
                    applyTerminalConfig({ scrollback: v })
                  }}
                  className="accent-primary w-full"
                />
                <div className="text-muted-foreground flex justify-between text-xs">
                  <span>0</span>
                  <span>100,000</span>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    const families = termFontFamily
                      .split(/[,]+/)
                      .map((s) => s.trim())
                      .filter(Boolean)
                    saveTerminalConfigMutation.mutate({
                      fontSize: termFontSize,
                      fontFamily: families.join(', '),
                      cursorBlink: termCursorBlink,
                      cursorStyle: termCursorStyle,
                      scrollback: termScrollback,
                      rendererEngine: isRendererEngineValid ? termRendererEngine : undefined,
                    })
                  }}
                  disabled={saveTerminalConfigMutation.isPending || !isRendererEngineValid}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition disabled:opacity-50"
                >
                  {saveTerminalConfigMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : saveTerminalConfigMutation.isSuccess ? (
                    <Check className="h-4 w-4" />
                  ) : null}
                  {saveTerminalConfigMutation.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </section>

          {/* Dashboard Settings */}
          <section className="space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <LayoutDashboard className="h-5 w-5" />
              Dashboard
            </h2>
            <div className="border-border space-y-4 rounded-lg border p-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Trend Point Limit</label>
                <p className="text-muted-foreground mb-3 text-sm">
                  Max data points kept per top metric card trend (server-shared in-memory history).
                </p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={20}
                    max={500}
                    step={10}
                    value={dashboardTrendPointLimit}
                    onChange={(e) => {
                      const next = Number(e.target.value)
                      if (Number.isFinite(next)) {
                        setDashboardTrendPointLimit(next)
                      }
                    }}
                    className="bg-background border-border text-foreground focus:ring-primary w-36 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1"
                  />
                  <button
                    onClick={() => {
                      const next = Math.max(
                        20,
                        Math.min(500, Math.trunc(dashboardTrendPointLimit || 100))
                      )
                      setDashboardTrendPointLimit(next)
                      saveDashboardConfigMutation.mutate(next)
                    }}
                    disabled={
                      saveDashboardConfigMutation.isPending ||
                      dashboardTrendPointLimit === savedDashboardTrendPointLimit
                    }
                    className="bg-primary text-primary-foreground rounded-md px-4 py-2 hover:opacity-90 disabled:opacity-50"
                  >
                    {saveDashboardConfigMutation.isPending ? 'Saving...' : 'Save'}
                  </button>
                </div>
                <p className="text-muted-foreground mt-2 text-xs">
                  Allowed range: 20-500. Lower values reduce memory and increase visual smoothing.
                </p>
              </div>
            </div>
          </section>

          {/* Project Directory */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Project Directory</h2>
            <div className="border-border rounded-lg border p-4">
              <div className="flex items-start gap-2">
                <FolderOpen className="text-muted-foreground mt-1 h-4 w-4 shrink-0" />
                {serverStatus.projectDir ? (
                  <CopyablePath path={serverStatus.projectDir} className="flex-1" />
                ) : (
                  <span className="text-muted-foreground text-sm">Loading...</span>
                )}
              </div>
            </div>
          </section>

          {/* CLI Configuration */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">CLI Configuration</h2>
            <div className="border-border space-y-4 rounded-lg border p-4">
              {/* Global CLI Detection */}
              <div>
                <label className="mb-2 block text-sm font-medium">Global CLI Detection</label>
                <div className="mb-2 flex items-center gap-2">
                  {isSniffingCli ? (
                    <span className="text-muted-foreground flex items-center gap-2 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Detecting global openspec command...
                    </span>
                  ) : cliSniffResult?.hasGlobal ? (
                    <div className="flex flex-col gap-1">
                      <span className="flex items-center gap-2 text-sm text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        Global CLI installed:{' '}
                        <code className="bg-muted rounded px-1">
                          openspec {cliSniffResult.version}
                        </code>
                      </span>
                      {cliSniffResult.hasUpdate && cliSniffResult.latestVersion && (
                        <span className="flex items-center gap-2 text-sm text-amber-600">
                          <ArrowUp className="h-4 w-4" />
                          Update available:{' '}
                          <code className="bg-muted rounded px-1">
                            v{cliSniffResult.latestVersion}
                          </code>
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <span className="flex items-center gap-2 text-sm text-yellow-600">
                        <XCircle className="h-4 w-4" />
                        Global CLI not found
                      </span>
                      {cliSniffResult?.latestVersion && (
                        <span className="text-muted-foreground text-xs">
                          Latest version:{' '}
                          <code className="bg-muted rounded px-1">
                            v{cliSniffResult.latestVersion}
                          </code>
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {/* 显示安装/更新按钮：当没有全局 CLI 或有更新可用时 */}
                {!isSniffingCli && (!cliSniffResult?.hasGlobal || cliSniffResult?.hasUpdate) && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowInstallModal(true)}
                      className="bg-primary text-primary-foreground flex items-center gap-2 rounded-md px-3 py-1.5 text-sm hover:opacity-90"
                    >
                      {cliSniffResult?.hasUpdate ? (
                        <>
                          <ArrowUp className="h-4 w-4" />
                          Update to v{cliSniffResult.latestVersion}
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4" />
                          Install Globally
                        </>
                      )}
                    </button>
                    <span className="text-muted-foreground text-xs">
                      Run:{' '}
                      <code className="bg-muted rounded px-1">
                        npm install -g @fission-ai/openspec
                      </code>
                    </span>
                  </div>
                )}
                {cliSniffResult?.error && (
                  <p className="mt-1 text-sm text-red-500">
                    Detection error: {cliSniffResult.error}
                  </p>
                )}
              </div>

              {/* CLI Command Override */}
              <div className="border-border border-t pt-3">
                <label className="mb-2 block text-sm font-medium">Execute Path</label>
                <p className="text-muted-foreground mb-3 text-sm">
                  Override the runner command used to execute OpenSpec. Leave empty to auto-resolve.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={cliCommand}
                    onChange={(e) => setCliCommand(e.target.value)}
                    placeholder={cliPlaceholder}
                    className="border-border bg-background text-foreground flex-1 rounded-md border px-3 py-2 font-mono text-sm"
                  />
                  <button
                    onClick={() => saveCliCommandMutation.mutate(cliCommand)}
                    disabled={
                      saveCliCommandMutation.isPending || cliCommand.trim() === savedCliCommand
                    }
                    className="bg-primary text-primary-foreground rounded-md px-4 py-2 hover:opacity-90 disabled:opacity-50"
                  >
                    {saveCliCommandMutation.isPending ? 'Saving...' : 'Save'}
                  </button>
                </div>
                {config?.cli?.command && (
                  <p className="text-muted-foreground mt-2 text-xs">
                    Saved execute path:{' '}
                    <code className="bg-muted rounded px-1">
                      {formatExecutePath(config.cli.command, config.cli.args ?? [])}
                    </code>
                  </p>
                )}
              </div>

              {/* CLI Status */}
              <div className="border-border border-t pt-3">
                <div className="flex items-center gap-2">
                  <Terminal className="text-muted-foreground h-4 w-4" />
                  <span className="text-sm font-medium">CLI Status:</span>
                  {isCheckingCli ? (
                    <span className="text-muted-foreground flex items-center gap-1 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Checking...
                    </span>
                  ) : cliAvailability?.available ? (
                    <span className="flex items-center gap-1 text-sm text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      Available {cliAvailability.version && `(${cliAvailability.version})`}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-sm text-red-600">
                      <XCircle className="h-4 w-4" />
                      Not available
                    </span>
                  )}
                </div>
                {effectiveCliCommand && (
                  <p className="text-muted-foreground ml-6 mt-1 text-sm">
                    Effective execute path:{' '}
                    <code className="bg-muted rounded px-1">{effectiveCliCommand}</code>
                  </p>
                )}
                {cliAvailability && !cliAvailability.available && cliAvailability.error && (
                  <p className="text-muted-foreground ml-6 mt-1 text-sm">
                    {cliAvailability.error}
                    <br />
                    Set an explicit execute path above to recover quickly.
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* OpenSpec 1.2 Profile & Sync */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">OpenSpec 1.2 Profile &amp; Sync</h2>
            <div className="border-border space-y-4 rounded-lg border p-4">
              {isLoadingOpsxProfileState ? (
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading profile state...
                </div>
              ) : !opsxProfileState?.available ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-red-600">
                    <XCircle className="h-4 w-4" />
                    Unable to read profile state from OpenSpec CLI.
                  </div>
                  {opsxProfileState?.error && (
                    <p className="text-muted-foreground text-xs">{opsxProfileState.error}</p>
                  )}
                </div>
              ) : (
                <>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="border-border bg-muted/30 rounded-md border px-3 py-2">
                      <div className="text-muted-foreground text-xs">Profile</div>
                      <div className="mt-1 text-sm font-medium">{opsxProfileState.profile}</div>
                    </div>
                    <div className="border-border bg-muted/30 rounded-md border px-3 py-2">
                      <div className="text-muted-foreground text-xs">Delivery</div>
                      <div className="mt-1 text-sm font-medium">{opsxProfileState.delivery}</div>
                    </div>
                  </div>

                  <div>
                    <div className="text-muted-foreground mb-1 text-xs">Workflows</div>
                    <div className="flex flex-wrap gap-1.5">
                      {opsxProfileState.workflows.length > 0 ? (
                        opsxProfileState.workflows.map((workflow) => (
                          <span
                            key={workflow}
                            className="border-border bg-muted rounded border px-1.5 py-0.5 text-xs"
                          >
                            {workflow}
                          </span>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-xs">(none)</span>
                      )}
                    </div>
                  </div>

                  <div className="border-border flex flex-wrap items-center gap-2 border-t pt-3">
                    {opsxProfileState.driftStatus === 'drift' ? (
                      <span className="flex items-center gap-1.5 text-sm text-amber-600">
                        <AlertTriangle className="h-4 w-4" />
                        Global profile is not fully applied to this project.
                      </span>
                    ) : opsxProfileState.driftStatus === 'in-sync' ? (
                      <span className="flex items-center gap-1.5 text-sm text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        Project files are in sync with global profile.
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">
                        Drift status unavailable.
                      </span>
                    )}
                    {opsxProfileState.warningText && (
                      <span className="text-muted-foreground text-xs">
                        {opsxProfileState.warningText}
                      </span>
                    )}
                  </div>

                  <div className="border-border flex flex-wrap items-center gap-2 border-t pt-3">
                    <button
                      type="button"
                      onClick={() => syncOpsxProjectMutation.mutate()}
                      disabled={syncOpsxProjectMutation.isPending}
                      className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm disabled:opacity-50"
                    >
                      {syncOpsxProjectMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      Run openspec update
                    </button>
                    <button
                      type="button"
                      onClick={() => setCoreProfileMutation.mutate()}
                      disabled={setCoreProfileMutation.isPending}
                      className="border-border hover:bg-muted inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
                    >
                      {setCoreProfileMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      Set profile to core
                    </button>
                    <button
                      type="button"
                      onClick={() => void refetchOpsxProfileState()}
                      className="border-border hover:bg-muted inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Refresh state
                    </button>
                  </div>

                  <p className="text-muted-foreground text-xs">
                    Note: <code className="bg-muted rounded px-1">openspec update</code> follows
                    OpenSpec 1.2 behavior and prunes deselected workflow command/skill files.
                  </p>

                  <p className="text-muted-foreground text-xs">
                    For interactive custom profile editing, run{' '}
                    <code className="bg-muted rounded px-1">openspec config profile</code> in a
                    local terminal.
                  </p>
                </>
              )}
            </div>
          </section>

          {/* API Configuration */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">API Configuration</h2>
            <div className="border-border space-y-4 rounded-lg border p-4">
              <div>
                <label className="mb-2 block text-sm font-medium">API Server URL</label>
                <p className="text-muted-foreground mb-3 text-sm">
                  Leave empty for same-origin requests. Set a custom URL to connect to a different
                  server.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                    placeholder={window.location.origin}
                    className="border-border bg-background text-foreground flex-1 rounded-md border px-3 py-2"
                  />
                  <button
                    onClick={handleApiUrlChange}
                    className="bg-primary text-primary-foreground rounded-md px-4 py-2 hover:opacity-90"
                  >
                    Apply
                  </button>
                </div>
                {getApiBaseUrl() && (
                  <p className="text-muted-foreground mt-2 text-sm">
                    Current: <code className="bg-muted rounded px-1">{getApiBaseUrl()}</code>
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Hosted App</h2>
            <div className="border-border space-y-4 rounded-lg border p-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Base URL</label>
                <p className="text-muted-foreground mb-3 text-sm">
                  Used by <code className="bg-muted rounded px-1">openspecui --app</code> when no
                  explicit base URL is passed. Leave empty to use the official hosted app. Reusing
                  an installed PWA only works when that PWA was installed from this same deployment
                  scope.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={appBaseUrl}
                    onChange={(e) => setAppBaseUrl(e.target.value)}
                    placeholder={OFFICIAL_APP_BASE_URL}
                    className="border-border bg-background text-foreground flex-1 rounded-md border px-3 py-2"
                  />
                  <button
                    onClick={() => saveAppBaseUrlMutation.mutate(appBaseUrl)}
                    disabled={
                      saveAppBaseUrlMutation.isPending || appBaseUrl.trim() === savedAppBaseUrl
                    }
                    className="bg-primary text-primary-foreground rounded-md px-4 py-2 hover:opacity-90 disabled:opacity-50"
                  >
                    {saveAppBaseUrlMutation.isPending ? 'Saving...' : 'Save'}
                  </button>
                </div>
                <p className="text-muted-foreground mt-2 text-sm">
                  Effective default:{' '}
                  <code className="bg-muted rounded px-1">
                    {savedAppBaseUrl || OFFICIAL_APP_BASE_URL}
                  </code>
                </p>
              </div>
            </div>
          </section>

          {/* File Watcher Info */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">File Watcher</h2>
            <div className="border-border rounded-lg border p-4">
              <p className="text-muted-foreground mb-3 text-sm">
                File watcher is configured on the server side. Check the status bar at the bottom of
                the page to see if file watching is enabled.
              </p>
              <div className="flex items-center gap-2 text-sm">
                <Link2 className="h-4 w-4 text-green-500" />
                <span>Enabled: Real-time updates when files change</span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-sm">
                <Unlink2 className="h-4 w-4 text-yellow-500" />
                <span>Disabled: Manual refresh required</span>
              </div>
              <p className="text-muted-foreground mt-3 text-sm">
                To disable file watching, restart the server with{' '}
                <code className="bg-muted rounded px-1">--no-watch</code> flag.
              </p>
            </div>
          </section>

          {/* Initialize OpenSpec */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Initialize OpenSpec</h2>
            <div className="border-border space-y-4 rounded-lg border p-4">
              <p className="text-muted-foreground text-sm">
                Create the OpenSpec directory structure in the current project. This will create{' '}
                <code className="bg-muted rounded px-1">openspec/</code> with specs, changes, and
                archive directories.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-sm font-medium">Init Mode</span>
                  <select
                    value={initToolsMode}
                    onChange={(event) => setInitToolsMode(event.target.value as InitToolsMode)}
                    className="border-border bg-background w-full rounded-md border px-2 py-2 text-sm"
                  >
                    <option value="auto">Auto-detect tools (recommended)</option>
                    <option value="selected">Use selected tools</option>
                    <option value="all">Use all tools</option>
                  </select>
                  <p className="text-muted-foreground text-xs">
                    OpenSpec 1.2 can auto-detect existing tool directories.
                  </p>
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-medium">Profile Override</span>
                  <select
                    value={initProfileOverride}
                    onChange={(event) =>
                      setInitProfileOverride(event.target.value as InitProfileOverride)
                    }
                    className="border-border bg-background w-full rounded-md border px-2 py-2 text-sm"
                  >
                    <option value="default">Use global default</option>
                    <option value="core">core</option>
                    <option value="custom">custom</option>
                  </select>
                  <p className="text-muted-foreground text-xs">
                    Adds <code className="bg-muted rounded px-1">--profile</code> when set.
                  </p>
                </label>
              </div>
              {/* Tool Selection */}
              <div className={`space-y-4 ${isManualToolsMode ? '' : 'opacity-60'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">AI Tools Configuration</label>
                    <p className="text-muted-foreground text-sm">
                      Color encodes current init state. Hover a tool for the exact status.
                    </p>
                  </div>
                  <button
                    onClick={toggleAllTools}
                    disabled={!isManualToolsMode}
                    className="text-primary shrink-0 text-xs hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {selectedTools.length > 0 && selectedTools.length === selectableToolIds.length
                      ? 'Deselect All'
                      : 'Select All'}
                  </button>
                </div>

                <div>
                  <p className="text-muted-foreground mb-2 text-xs font-medium">
                    Natively supported providers (OpenSpec custom commands + skills)
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                    {nativeTools.map((tool) => {
                      const status = getToolInitStatus(toolInitStateById, tool.value)
                      const initialized = status === 'initialized'
                      const repairable = status === 'partial'
                      const selected = selectedTools.includes(tool.value)
                      const statusTitle = initialized
                        ? 'Initialized: exact match for current delivery/workflows'
                        : repairable
                          ? 'Partial: detected artifacts need repair for current delivery/workflows'
                          : 'Uninitialized: no generated artifacts detected'
                      return (
                        <button
                          key={tool.value}
                          onClick={() => toggleTool(tool.value)}
                          disabled={initialized || !isManualToolsMode}
                          title={statusTitle}
                          className={`flex min-w-0 items-center gap-1.5 rounded border px-2.5 py-1.5 text-left text-xs font-medium transition-colors ${
                            initialized
                              ? 'cursor-not-allowed border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                              : repairable
                                ? 'text-foreground border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/15'
                                : selected
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : 'border-border hover:bg-muted'
                          }`}
                        >
                          <span className="min-w-0 flex-1 truncate">{tool.name}</span>
                          {initialized ? (
                            <CheckCircle className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-300" />
                          ) : repairable ? (
                            <AlertTriangle className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-300" />
                          ) : selected ? (
                            <Check className="h-3 w-3 shrink-0" />
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="text-muted-foreground flex flex-wrap gap-4 text-xs">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-500/50" />
                    {initializedToolsCount} initialized
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-amber-500/50" />
                    {repairableToolsCount} repair needed
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="bg-primary/50 h-2 w-2 rounded-full" />
                    {selectedTools.length} selected
                  </span>
                </div>
              </div>
              <div className="border-border flex flex-row flex-wrap gap-2.5 border-t pt-3 md:flex-nowrap">
                {/*md:grid md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:items-start md:gap-4*/}
                <button
                  onClick={() => startInit(initToolsMode)}
                  disabled={currentInitAction.disabled}
                  title={currentInitAction.title}
                  className="bg-primary text-primary-foreground inline-flex grow-0 items-start justify-start gap-2 self-start rounded-md px-3.5 py-2 text-[13px] font-medium leading-5 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 md:min-w-0 md:max-w-none md:text-balance"
                >
                  <FolderPlus className="mt-1 h-4 w-4 shrink-0" />
                  {currentInitAction.label}
                </button>
                <label className="border-border bg-background/50 flex min-w-0 flex-col gap-1 rounded-md border px-3 py-2">
                  <span className="flex flex-wrap items-center justify-between gap-3">
                    <span className="break-word text-xs font-medium leading-4">
                      Force non-interactive init
                    </span>
                    <button
                      type="button"
                      onClick={() => setInitForce((prev) => !prev)}
                      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                        initForce ? 'bg-primary' : 'bg-muted-foreground/30'
                      }`}
                      aria-pressed={initForce}
                      aria-label="Toggle force init"
                    >
                      <span
                        className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                          initForce ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </span>
                  <span className="text-muted-foreground text-[11px] leading-4">
                    Enabled by default so{' '}
                    <code className="bg-muted rounded px-1">openspec init --tools ...</code> also
                    writes <code className="bg-muted rounded px-1">openspec/config.yaml</code>.
                  </span>
                </label>
              </div>
              <p className="text-muted-foreground text-xs">{currentInitAction.helperText}</p>
            </div>
          </section>
        </>
      )}

      {/* Init Terminal Dialog - only in dynamic mode */}
      {!inStaticMode && (
        <>
          <Dialog
            open={showInitModal}
            onClose={handleCloseInit}
            bodyClassName="max-h-[70vh]"
            borderVariant={initBorderVariant}
            title={
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4" />
                <span className="font-semibold">Initialize OpenSpec</span>
              </div>
            }
            footer={
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCloseInit}
                  className="bg-muted hover:bg-muted/80 rounded-md px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={initStatus === 'running'}
                >
                  Close
                </button>
                {initStatus !== 'success' && (
                  <button
                    onClick={() => initCommands.runAll()}
                    className="bg-primary text-primary-foreground rounded-md px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={
                      initStatus === 'running' ||
                      (initToolsMode === 'selected' && !hasSelectedToolActions)
                    }
                  >
                    {initStatus === 'running' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Run init'
                    )}
                  </button>
                )}
              </div>
            }
          >
            <CliTerminal lines={initLines} />
          </Dialog>

          {/* Install / Update CLI Dialog */}
          <Dialog
            open={showInstallModal}
            onClose={handleCloseInstall}
            bodyClassName="max-h-[70vh]"
            borderVariant={installBorderVariant}
            title={
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                <span className="font-semibold">
                  {cliSniffResult?.hasUpdate
                    ? 'Update OpenSpec CLI'
                    : 'Install OpenSpec CLI Globally'}
                </span>
              </div>
            }
            footer={
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCloseInstall}
                  className="bg-muted hover:bg-muted/80 rounded-md px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={installStatus === 'running'}
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    handleCloseInstall()
                    handleInstallSuccess()
                  }}
                  className="bg-primary text-primary-foreground rounded-md px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={installStatus !== 'success'}
                >
                  Re-detect CLI
                </button>
              </div>
            }
          >
            <CliTerminal lines={installLines} />

            {installStatus === 'success' && (
              <div className="border-border bg-muted/40 mt-3 rounded border px-3 py-2 text-sm">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  {cliSniffResult?.hasUpdate
                    ? `OpenSpec CLI updated to v${cliSniffResult?.latestVersion ?? ''}`
                    : 'OpenSpec CLI installed globally'}
                </div>
                <p className="text-muted-foreground text-xs">
                  You can now run the "openspec" command directly. Click "Re-detect CLI" to refresh
                  status.
                </p>
              </div>
            )}
          </Dialog>
        </>
      )}
    </div>
  )
}
