import { Button } from '@/components/button'
import { ButtonGroup, type ButtonGroupOption } from '@/components/button-group'
import { CliTerminal } from '@/components/cli-terminal'
import { CopyablePath } from '@/components/copyable-path'
import { Dialog } from '@/components/dialog'
import { NotificationSettings } from '@/components/notifications/notification-settings'
import { Select, type SelectOption } from '@/components/select'
import { SoundSettingControl } from '@/components/sound-setting-control'
import { Switch } from '@/components/switch'
import { TerminalInvocationSettings } from '@/components/terminal/terminal-invocation-settings'
import { generateTimelineScope, Toc, TocSection, type TocItem } from '@/components/toc'
import { getApiBaseUrl } from '@/lib/api-config'
import {
  prepareBrowserTranslation,
  probeBrowserTranslation,
  type BrowserTranslationStatus,
} from '@/lib/browser-translation'
import {
  CODE_EDITOR_THEME_OPTIONS,
  DEFAULT_CODE_EDITOR_THEME,
  isCodeEditorTheme,
  type CodeEditorTheme,
} from '@/lib/code-editor-theme'
import {
  OPSX_AGENT_INVOCATION_MODE_OPTIONS,
  type OpsxAgentInvocationMode,
} from '@/lib/opsx-agent-invocation'
import { isStaticMode } from '@/lib/static-mode'
import { TerminalBellSoundEngine } from '@/lib/terminal-bell-sound-engine'
import {
  GOOGLE_FONT_PRESETS,
  isTerminalRendererEngine,
  TERMINAL_RENDERER_ENGINES,
  terminalController,
  type TerminalRendererEngine,
} from '@/lib/terminal-controller'
import {
  isTerminalThemeId,
  isTerminalThemeMode,
  TERMINAL_THEME_MODE_VALUES,
  TERMINAL_THEME_OPTIONS,
  type TerminalThemeId,
  type TerminalThemeMode,
} from '@/lib/terminal-theme'
import { applyTheme, getStoredTheme, persistTheme, type Theme } from '@/lib/theme'
import { queryClient, trpc, trpcClient } from '@/lib/trpc'
import { useCliRunner } from '@/lib/use-cli-runner'
import { useServerStatus } from '@/lib/use-server-status'
import { useConfigSubscription } from '@/lib/use-subscription'
import {
  DEFAULT_TRANSLATION_CACHE_ENTRY_LIMIT,
  type DocumentTranslationConfig,
  type DocumentTranslationDisplayMode,
} from '@openspecui/core/document-translation'
import { OFFICIAL_APP_BASE_URL } from '@openspecui/core/hosted-app'
import { NotificationSoundSchema } from '@openspecui/core/notifications'
import {
  DEFAULT_BELL_SOUND_ID,
  DEFAULT_NOTIFICATION_SOUND_ID,
  type SoundId,
} from '@openspecui/core/sounds'
import { TerminalBellSoundSchema, type TerminalBellSound } from '@openspecui/core/terminal-audio'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowUp,
  Check,
  CheckCircle,
  Download,
  FolderOpen,
  FolderPlus,
  GitCommitHorizontal,
  Languages,
  LayoutDashboard,
  Link2,
  Loader2,
  Monitor,
  Moon,
  Plus,
  RefreshCw,
  RotateCcw,
  Settings as SettingsIcon,
  Sparkles,
  Sun,
  Terminal,
  Unlink2,
  XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
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

function formatTranslationCapability(
  capability: BrowserTranslationStatus | null,
  loading: boolean
): string {
  if (loading) return 'Checking browser translation capability...'
  if (!capability) return 'Capability not checked yet.'

  switch (capability.availability) {
    case 'available':
      return 'Translator is ready.'
    case 'downloadable':
      return 'Language support can be downloaded by Chrome.'
    case 'downloading':
      return 'Chrome is preparing translation support.'
    case 'missing':
      return capability.message ?? 'Chrome Translator API is not exposed.'
    case 'unavailable':
      return 'Translation is unavailable for this browser or language pair.'
    case 'error':
      return capability.message ?? 'Unable to check translation capability.'
  }
}

const INIT_TOOLS_MODE_OPTIONS: SelectOption<InitToolsMode>[] = [
  { value: 'auto', label: 'Auto-detect tools (recommended)' },
  { value: 'selected', label: 'Use selected tools' },
  { value: 'all', label: 'Use all tools' },
]

const INIT_PROFILE_OVERRIDE_OPTIONS: SelectOption<InitProfileOverride>[] = [
  { value: 'default', label: 'Use global default' },
  { value: 'core', label: 'core' },
  { value: 'custom', label: 'custom' },
]

const DEFAULT_TERMINAL_FONT_SIZE = 13
const DEFAULT_TERMINAL_FONT_FAMILY = ''
const DEFAULT_TERMINAL_CURSOR_BLINK = true
const DEFAULT_TERMINAL_CURSOR_STYLE: TerminalCursorStyle = 'block'
const DEFAULT_TERMINAL_SCROLLBACK = 1000
const DEFAULT_TERMINAL_RENDERER_ENGINE: TerminalRendererEngine = 'xterm'
const DEFAULT_TERMINAL_BELL_VOLUME = 1
const DEFAULT_DASHBOARD_TREND_POINT_LIMIT = 100
const DEFAULT_GIT_DIFF_EAGER_LINE_BUDGET = 1000
const DEFAULT_TRANSLATION_TARGET_LANGUAGE = 'zh'
const DEFAULT_TRANSLATION_DISPLAY_MODE: DocumentTranslationDisplayMode = 'direct'
const DEFAULT_TRANSLATION_CACHE_ENABLED = false

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

type TerminalCursorStyle = 'block' | 'underline' | 'bar'

const TERMINAL_CURSOR_STYLE_OPTIONS = [
  { value: 'block', label: 'Block' },
  { value: 'underline', label: 'Underline' },
  { value: 'bar', label: 'Bar' },
] satisfies ButtonGroupOption<TerminalCursorStyle>[]

const TRANSLATION_DISPLAY_MODE_OPTIONS = [
  { value: 'direct', label: 'Direct' },
  { value: 'bilingual', label: 'Bilingual' },
] satisfies ButtonGroupOption<DocumentTranslationDisplayMode>[]

const TRANSLATION_TARGET_LANGUAGE_OPTIONS = [
  { value: 'zh', label: 'Chinese' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'es', label: 'Spanish' },
] satisfies SelectOption<string>[]

const SETTINGS_TOC_ITEMS: TocItem[] = [
  { id: 'settings-appearance', label: 'Appearance' },
  { id: 'settings-opsx-invocation', label: 'OPSX Invocation' },
  { id: 'settings-terminal', label: 'Terminal' },
  { id: 'settings-notifications', label: 'Notifications' },
  { id: 'settings-translation', label: 'Translation' },
  { id: 'settings-dashboard', label: 'Dashboard' },
  { id: 'settings-git-detail', label: 'Git Detail' },
  { id: 'settings-project-directory', label: 'Project Directory' },
  { id: 'settings-cli-configuration', label: 'CLI Configuration' },
  { id: 'settings-openspec-profile', label: 'OpenSpec Profile' },
  { id: 'settings-api-configuration', label: 'API Configuration' },
  { id: 'settings-hosted-app', label: 'Hosted App' },
  { id: 'settings-file-watcher', label: 'File Watcher' },
  { id: 'settings-init-openspec', label: 'Initialize OpenSpec' },
]

function tocIndex(id: string): number {
  const index = SETTINGS_TOC_ITEMS.findIndex((item) => item.id === id)
  return index === -1 ? 0 : index
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
  const { data: globalSettings, refetch: refetchGlobalSettings } = useQuery({
    ...trpc.globalSettings.get.queryOptions(),
    enabled: !inStaticMode,
  })
  const { data: translationCacheStats, refetch: refetchTranslationCacheStats } = useQuery({
    ...trpc.translationCache.stats.queryOptions(),
    enabled: !inStaticMode && (config?.translation?.cacheEnabled ?? false),
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
  const saveOpsxConfigMutation = useMutation({
    mutationFn: (agentInvocationMode: OpsxAgentInvocationMode) =>
      trpcClient.config.update.mutate({ opsx: { agentInvocationMode } }),
  })

  // Terminal config — seed local state from controller's current config
  const initialConfig = useMemo(() => terminalController.getConfig(), [])

  const [termFontSize, setTermFontSize] = useState(initialConfig.fontSize)
  const [termFontFamily, setTermFontFamily] = useState(initialConfig.fontFamily)
  const [termCursorBlink, setTermCursorBlink] = useState(initialConfig.cursorBlink)
  const [termCursorStyle, setTermCursorStyle] = useState<TerminalCursorStyle>(
    initialConfig.cursorStyle
  )
  const [termScrollback, setTermScrollback] = useState(initialConfig.scrollback)
  const [termUseTheme, setTermUseTheme] = useState<TerminalThemeMode>(initialConfig.useTheme)
  const [termLightTheme, setTermLightTheme] = useState<TerminalThemeId>(initialConfig.lightTheme)
  const [termDarkTheme, setTermDarkTheme] = useState<TerminalThemeId>(initialConfig.darkTheme)
  const [termRendererEngine, setTermRendererEngine] = useState<string>(initialConfig.rendererEngine)
  const [termBellSound, setTermBellSound] = useState<TerminalBellSound>(initialConfig.bellSound)
  const [termBellVolume, setTermBellVolume] = useState(initialConfig.bellVolume)
  const [dashboardTrendPointLimit, setDashboardTrendPointLimit] = useState(100)
  const [gitDiffEagerLineBudget, setGitDiffEagerLineBudget] = useState(1000)
  const [translationEnabled, setTranslationEnabled] = useState(false)
  const [translationTargetLanguage, setTranslationTargetLanguage] = useState(
    DEFAULT_TRANSLATION_TARGET_LANGUAGE
  )
  const [translationDisplayMode, setTranslationDisplayMode] =
    useState<DocumentTranslationDisplayMode>(DEFAULT_TRANSLATION_DISPLAY_MODE)
  const [translationCacheEnabled, setTranslationCacheEnabled] = useState(
    DEFAULT_TRANSLATION_CACHE_ENABLED
  )
  const [translationCacheEntryLimit, setTranslationCacheEntryLimit] = useState(
    DEFAULT_TRANSLATION_CACHE_ENTRY_LIMIT
  )
  const [translationCapability, setTranslationCapability] =
    useState<BrowserTranslationStatus | null>(null)
  const [translationCapabilityLoading, setTranslationCapabilityLoading] = useState(false)
  const [termRendererError, setTermRendererError] = useState<string | null>(null)
  const codeEditorThemeOptions = CODE_EDITOR_THEME_OPTIONS satisfies SelectOption<CodeEditorTheme>[]
  const terminalThemeOptions = TERMINAL_THEME_OPTIONS satisfies SelectOption<TerminalThemeId>[]
  const terminalRendererOptions = useMemo<SelectOption<string>[]>(
    () => [
      ...TERMINAL_RENDERER_ENGINES.map((engine) => ({
        value: engine,
        label: engine === 'ghostty' ? 'ghostty-web' : engine,
      })),
      ...(isTerminalRendererEngine(termRendererEngine)
        ? []
        : [{ value: termRendererEngine, label: `Invalid value: ${termRendererEngine}` }]),
    ],
    [termRendererEngine]
  )
  const isRendererEngineValid = isTerminalRendererEngine(termRendererEngine)
  const terminalBellSoundEngine = useMemo(() => {
    const engine = new TerminalBellSoundEngine()
    engine.init()
    return engine
  }, [])

  // Re-sync local state when controller config changes
  useEffect(
    () => {
      const current = terminalController.getConfig()
      setTermFontSize(current.fontSize)
      setTermFontFamily(current.fontFamily)
      setTermCursorBlink(current.cursorBlink)
      setTermCursorStyle(current.cursorStyle)
      setTermScrollback(current.scrollback)
      setTermUseTheme(current.useTheme)
      setTermLightTheme(current.lightTheme)
      setTermDarkTheme(current.darkTheme)
      setTermRendererEngine(current.rendererEngine)
      setTermBellSound(current.bellSound)
      setTermBellVolume(current.bellVolume)
    },
    [
      /* re-run when entering settings page — captured by loading state transition */
    ]
  )

  useEffect(() => {
    const nextUseTheme = config?.terminal?.useTheme
    if (nextUseTheme && isTerminalThemeMode(nextUseTheme)) {
      setTermUseTheme(nextUseTheme)
    }
  }, [config?.terminal?.useTheme])
  useEffect(() => {
    const nextLightTheme = config?.terminal?.lightTheme
    if (nextLightTheme && isTerminalThemeId(nextLightTheme)) {
      setTermLightTheme(nextLightTheme)
    }
  }, [config?.terminal?.lightTheme])
  useEffect(() => {
    const nextDarkTheme = config?.terminal?.darkTheme
    if (nextDarkTheme && isTerminalThemeId(nextDarkTheme)) {
      setTermDarkTheme(nextDarkTheme)
    }
  }, [config?.terminal?.darkTheme])
  useEffect(() => {
    const nextRenderer = config?.terminal?.rendererEngine
    if (typeof nextRenderer === 'string' && nextRenderer.length > 0) {
      setTermRendererEngine(nextRenderer)
    }
  }, [config?.terminal?.rendererEngine])
  useEffect(() => {
    const result = TerminalBellSoundSchema.safeParse(config?.terminal?.bellSound)
    if (result.success) {
      setTermBellSound(result.data)
    }
  }, [config?.terminal?.bellSound])
  useEffect(() => {
    const nextVolume = config?.terminal?.bellVolume
    if (typeof nextVolume === 'number' && Number.isFinite(nextVolume)) {
      setTermBellVolume(nextVolume)
    }
  }, [config?.terminal?.bellVolume])

  // Apply immediately on local state change (live preview)
  const applyTerminalConfig = useCallback(
    (overrides: {
      fontSize?: number
      fontFamily?: string
      cursorBlink?: boolean
      cursorStyle?: TerminalCursorStyle
      scrollback?: number
      useTheme?: TerminalThemeMode
      lightTheme?: TerminalThemeId
      darkTheme?: TerminalThemeId
      bellSound?: TerminalBellSound
      bellVolume?: number
    }) => {
      terminalController.applyConfig({
        fontSize: overrides.fontSize ?? termFontSize,
        fontFamily: overrides.fontFamily ?? termFontFamily,
        cursorBlink: overrides.cursorBlink ?? termCursorBlink,
        cursorStyle: overrides.cursorStyle ?? termCursorStyle,
        scrollback: overrides.scrollback ?? termScrollback,
        useTheme: overrides.useTheme ?? termUseTheme,
        lightTheme: overrides.lightTheme ?? termLightTheme,
        darkTheme: overrides.darkTheme ?? termDarkTheme,
        bellSound: overrides.bellSound ?? termBellSound,
        bellVolume: overrides.bellVolume ?? termBellVolume,
      })
    },
    [
      termFontSize,
      termFontFamily,
      termCursorBlink,
      termCursorStyle,
      termScrollback,
      termUseTheme,
      termLightTheme,
      termDarkTheme,
      termBellSound,
      termBellVolume,
    ]
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
      cursorStyle?: TerminalCursorStyle
      scrollback?: number
      useTheme?: TerminalThemeMode
      lightTheme?: TerminalThemeId
      darkTheme?: TerminalThemeId
      rendererEngine?: TerminalRendererEngine
      bellSound?: TerminalBellSound
      bellVolume?: number
    }) => trpcClient.config.update.mutate({ terminal }),
  })
  const saveDashboardConfigMutation = useMutation({
    mutationFn: (trendPointLimit: number) =>
      trpcClient.config.update.mutate({
        dashboard: { trendPointLimit },
      }),
  })
  const saveGitConfigMutation = useMutation({
    mutationFn: (diffEagerLineBudget: number) =>
      trpcClient.config.update.mutate({
        git: { diffEagerLineBudget },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['git'] })
    },
  })
  const saveTranslationConfigMutation = useMutation({
    mutationFn: (translation: Partial<DocumentTranslationConfig>) =>
      trpcClient.config.update.mutate({ translation }),
  })
  const saveGlobalTranslationCacheMutation = useMutation({
    mutationFn: (entryLimit: number) =>
      trpcClient.globalSettings.update.mutate({ translationCache: { entryLimit } }),
  })
  const cleanTranslationCacheMutation = useMutation({
    mutationFn: () => trpcClient.translationCache.clean.mutate(),
  })
  const clearTranslationCacheMutation = useMutation({
    mutationFn: () => trpcClient.translationCache.clear.mutate(),
  })

  useEffect(() => {
    const nextLimit = config?.dashboard?.trendPointLimit
    if (typeof nextLimit === 'number' && Number.isFinite(nextLimit)) {
      setDashboardTrendPointLimit(nextLimit)
    }
  }, [config?.dashboard?.trendPointLimit])
  useEffect(() => {
    const nextBudget = config?.git?.diffEagerLineBudget
    if (typeof nextBudget === 'number' && Number.isFinite(nextBudget)) {
      setGitDiffEagerLineBudget(nextBudget)
    }
  }, [config?.git?.diffEagerLineBudget])
  useEffect(() => {
    setTranslationEnabled(config?.translation?.enabled ?? false)
    setTranslationTargetLanguage(
      config?.translation?.targetLanguage ?? DEFAULT_TRANSLATION_TARGET_LANGUAGE
    )
    setTranslationDisplayMode(config?.translation?.displayMode ?? DEFAULT_TRANSLATION_DISPLAY_MODE)
    setTranslationCacheEnabled(
      config?.translation?.cacheEnabled ?? DEFAULT_TRANSLATION_CACHE_ENABLED
    )
  }, [
    config?.translation?.cacheEnabled,
    config?.translation?.displayMode,
    config?.translation?.enabled,
    config?.translation?.targetLanguage,
  ])
  useEffect(() => {
    setTranslationCacheEntryLimit(
      globalSettings?.translationCache?.entryLimit ?? DEFAULT_TRANSLATION_CACHE_ENTRY_LIMIT
    )
  }, [globalSettings?.translationCache?.entryLimit])

  const savedDashboardTrendPointLimit =
    config?.dashboard?.trendPointLimit ?? DEFAULT_DASHBOARD_TREND_POINT_LIMIT
  const savedGitDiffEagerLineBudget =
    config?.git?.diffEagerLineBudget ?? DEFAULT_GIT_DIFF_EAGER_LINE_BUDGET
  const savedAppBaseUrl = config?.appBaseUrl ?? ''
  const savedTerminalFontFamily = config?.terminal?.fontFamily ?? DEFAULT_TERMINAL_FONT_FAMILY
  const savedTerminalConfig = {
    fontSize: config?.terminal?.fontSize ?? DEFAULT_TERMINAL_FONT_SIZE,
    fontFamily: savedTerminalFontFamily,
    cursorBlink: config?.terminal?.cursorBlink ?? DEFAULT_TERMINAL_CURSOR_BLINK,
    cursorStyle: config?.terminal?.cursorStyle ?? DEFAULT_TERMINAL_CURSOR_STYLE,
    scrollback: config?.terminal?.scrollback ?? DEFAULT_TERMINAL_SCROLLBACK,
    useTheme: config?.terminal?.useTheme ?? 'app',
    lightTheme: config?.terminal?.lightTheme ?? 'default-light',
    darkTheme: config?.terminal?.darkTheme ?? 'default-dark',
    rendererEngine: config?.terminal?.rendererEngine ?? DEFAULT_TERMINAL_RENDERER_ENGINE,
    bellSound: config?.terminal?.bellSound ?? DEFAULT_BELL_SOUND_ID,
    bellVolume: config?.terminal?.bellVolume ?? DEFAULT_TERMINAL_BELL_VOLUME,
  }
  const normalizedTermFontFamily = termFontFamily
    .split(/[,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(', ')
  const terminalConfigSaved =
    termFontSize === savedTerminalConfig.fontSize &&
    normalizedTermFontFamily === savedTerminalConfig.fontFamily &&
    termCursorBlink === savedTerminalConfig.cursorBlink &&
    termCursorStyle === savedTerminalConfig.cursorStyle &&
    termScrollback === savedTerminalConfig.scrollback &&
    termUseTheme === savedTerminalConfig.useTheme &&
    termLightTheme === savedTerminalConfig.lightTheme &&
    termDarkTheme === savedTerminalConfig.darkTheme &&
    termRendererEngine === savedTerminalConfig.rendererEngine &&
    termBellSound === savedTerminalConfig.bellSound &&
    termBellVolume === savedTerminalConfig.bellVolume
  const dashboardTrendPointLimitSaved = dashboardTrendPointLimit === savedDashboardTrendPointLimit
  const gitDiffEagerLineBudgetSaved = gitDiffEagerLineBudget === savedGitDiffEagerLineBudget
  const cliCommandSaved = cliCommand.trim() === savedCliCommand
  const apiUrlApplied = apiUrl === (getApiBaseUrl() || '')
  const appBaseUrlSaved = appBaseUrl.trim() === savedAppBaseUrl
  const savedOpsxAgentInvocationMode = config?.opsx?.agentInvocationMode ?? 'compose'
  const notificationSound = NotificationSoundSchema.parse(
    config?.notifications?.sound ?? DEFAULT_NOTIFICATION_SOUND_ID
  )
  const notificationVolume = config?.notifications?.volume ?? 1
  const systemNotificationsEnabled = config?.notifications?.systemNotificationsEnabled ?? false
  const savedTranslationConfig = {
    enabled: config?.translation?.enabled ?? false,
    targetLanguage: config?.translation?.targetLanguage ?? DEFAULT_TRANSLATION_TARGET_LANGUAGE,
    displayMode: config?.translation?.displayMode ?? DEFAULT_TRANSLATION_DISPLAY_MODE,
    cacheEnabled: config?.translation?.cacheEnabled ?? DEFAULT_TRANSLATION_CACHE_ENABLED,
  }
  const savedTranslationCacheEntryLimit =
    globalSettings?.translationCache?.entryLimit ?? DEFAULT_TRANSLATION_CACHE_ENTRY_LIMIT
  const opsxAgentInvocationModeOptions = useMemo(
    () =>
      OPSX_AGENT_INVOCATION_MODE_OPTIONS.map((option) => ({
        ...option,
        disabled: saveOpsxConfigMutation.isPending,
      })),
    [saveOpsxConfigMutation.isPending]
  )
  const refreshTranslationCapability = useCallback(
    async (targetLanguage: string, options: { initialize?: boolean } = {}) => {
      setTranslationCapabilityLoading(true)
      const controller = new AbortController()
      try {
        const status = options.initialize
          ? await prepareBrowserTranslation(targetLanguage, controller.signal)
          : await probeBrowserTranslation(targetLanguage)
        setTranslationCapability(status)
      } finally {
        controller.abort()
        setTranslationCapabilityLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    if (!translationEnabled) return
    void refreshTranslationCapability(translationTargetLanguage, { initialize: true })
  }, [refreshTranslationCapability, translationEnabled, translationTargetLanguage])

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
    <div
      className="@container-[size] scrollbar-thin scrollbar-track-transparent h-full min-h-0 overflow-y-auto scroll-smooth"
      style={{ timelineScope: generateTimelineScope(SETTINGS_TOC_ITEMS) } as CSSProperties}
    >
      <div className="toc-page-layout min-h-full gap-6 p-4 [--toc-page-sidebar-min:14rem]">
        <div className="toc-page-content min-w-0 space-y-8">
          <h1 className="font-nav flex items-center gap-2 text-2xl font-bold">
            <SettingsIcon className="h-6 w-6 shrink-0" />
            Settings
          </h1>

          {/* Theme */}
          <TocSection
            id="settings-appearance"
            index={tocIndex('settings-appearance')}
            className="space-y-4"
          >
            <h2 className="text-lg font-semibold">Appearance</h2>
            <div className="border-border rounded-lg border p-4">
              <label className="mb-3 block text-sm font-medium">Theme</label>
              <ButtonGroup<Theme>
                value={theme}
                onChange={(nextTheme) => {
                  setTheme(nextTheme)
                  saveThemeMutation.mutate(nextTheme)
                }}
                options={THEME_OPTIONS}
              />
              <div className="border-border/60 mt-4 border-t pt-4">
                <label className="mb-2 block text-sm font-medium">Code Editor Theme</label>
                <div className="flex items-center gap-2">
                  <Select
                    value={codeEditorTheme}
                    options={codeEditorThemeOptions}
                    onValueChange={(nextTheme) => {
                      setCodeEditorTheme(nextTheme)
                      if (!inStaticMode) {
                        saveCodeEditorThemeMutation.mutate(nextTheme)
                      }
                    }}
                    ariaLabel="Code Editor Theme"
                    className="w-full"
                    disabled={inStaticMode || saveCodeEditorThemeMutation.isPending}
                  />
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
          </TocSection>

          {/* Only show other sections in dynamic mode */}
          {!inStaticMode && (
            <>
              <TocSection
                id="settings-opsx-invocation"
                index={tocIndex('settings-opsx-invocation')}
                className="space-y-4"
              >
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <Sparkles className="h-5 w-5" />
                  OPSX Invocation
                </h2>
                <div className="border-border rounded-lg border p-4">
                  <label className="mb-3 block text-sm font-medium">Agent invocation mode</label>
                  <ButtonGroup<OpsxAgentInvocationMode>
                    value={savedOpsxAgentInvocationMode}
                    onChange={(mode) => saveOpsxConfigMutation.mutate(mode)}
                    options={opsxAgentInvocationModeOptions}
                  />
                  <p className="text-muted-foreground mt-2 text-xs">
                    Unsupported command actions automatically keep compose mode.
                  </p>
                </div>
              </TocSection>

              {/* Terminal Settings */}
              <TocSection
                id="settings-terminal"
                index={tocIndex('settings-terminal')}
                className="space-y-4"
              >
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <Terminal className="h-5 w-5" />
                  Terminal
                </h2>
                <div className="border-border space-y-4 rounded-lg border p-4">
                  <TerminalInvocationSettings />

                  <div>
                    <label className="mb-2 block text-sm font-medium">Use Theme</label>
                    <div className="flex flex-wrap gap-2">
                      <ButtonGroup<TerminalThemeMode>
                        value={termUseTheme}
                        onChange={(nextMode) => {
                          setTermUseTheme(nextMode)
                          applyTerminalConfig({ useTheme: nextMode })
                        }}
                        options={TERMINAL_THEME_MODE_VALUES.map((value) => ({
                          value,
                          disabled: saveTerminalConfigMutation.isPending,
                          label:
                            value === 'app'
                              ? 'App'
                              : value === 'system'
                                ? 'System'
                                : value === 'light'
                                  ? 'Light'
                                  : 'Dark',
                        }))}
                      />
                    </div>
                    <p className="text-muted-foreground mt-2 text-xs">
                      <code>app</code> follows the current openspecui theme. <code>system</code>{' '}
                      follows the OS color scheme.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium">Light Theme</label>
                      <Select
                        value={termLightTheme}
                        options={terminalThemeOptions}
                        onValueChange={(next) => {
                          setTermLightTheme(next)
                          applyTerminalConfig({ lightTheme: next })
                        }}
                        ariaLabel="Light Theme"
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium">Dark Theme</label>
                      <Select
                        value={termDarkTheme}
                        options={terminalThemeOptions}
                        onValueChange={(next) => {
                          setTermDarkTheme(next)
                          applyTerminalConfig({ darkTheme: next })
                        }}
                        ariaLabel="Dark Theme"
                        className="w-full"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">Renderer Engine</label>
                    <Select
                      value={termRendererEngine}
                      options={terminalRendererOptions}
                      onValueChange={(next) => {
                        setTermRendererEngine(next)
                        if (isTerminalRendererEngine(next)) {
                          void handleRendererEngineChange(next)
                        } else {
                          setTermRendererError(`Invalid renderer engine: ${next}`)
                        }
                      }}
                      ariaLabel="Renderer Engine"
                      className="w-full"
                    />
                    {termRendererError ? (
                      <p className="mt-2 text-xs text-red-500">{termRendererError}</p>
                    ) : (
                      <p className="text-muted-foreground mt-2 text-xs">
                        Switches immediately and remounts current terminal sessions.
                      </p>
                    )}
                    {!isRendererEngineValid && (
                      <p className="mt-2 text-xs text-amber-500">
                        Current config contains an unsupported renderer value. Select a valid one to
                        fix it.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">Bell Sound</label>
                    <SoundSettingControl
                      value={termBellSound}
                      defaultValue={DEFAULT_BELL_SOUND_ID}
                      onValueChange={(next) => {
                        setTermBellSound(next)
                        applyTerminalConfig({ bellSound: next })
                      }}
                      onPreview={(sound?: SoundId) =>
                        void terminalBellSoundEngine.play(sound ?? termBellSound, termBellVolume)
                      }
                      ariaLabel="Bell Sound"
                      previewDisabled={termBellSound === 'silent' || termBellVolume === 0}
                      volume={termBellVolume}
                      onVolumeChange={(nextVolume) => {
                        setTermBellVolume(nextVolume)
                        applyTerminalConfig({ bellVolume: nextVolume })
                      }}
                    />
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
                    <ButtonGroup<TerminalCursorStyle>
                      value={termCursorStyle}
                      onChange={(style) => {
                        setTermCursorStyle(style)
                        applyTerminalConfig({ cursorStyle: style })
                      }}
                      options={TERMINAL_CURSOR_STYLE_OPTIONS}
                    />
                  </div>

                  {/* Cursor Blink */}
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Cursor Blink</label>
                    <Switch
                      checked={termCursorBlink}
                      onCheckedChange={(checked) => {
                        setTermCursorBlink(checked)
                        applyTerminalConfig({ cursorBlink: checked })
                      }}
                      ariaLabel="Cursor Blink"
                    />
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
                    <Button
                      onClick={() => {
                        saveTerminalConfigMutation.mutate({
                          fontSize: termFontSize,
                          fontFamily: normalizedTermFontFamily,
                          cursorBlink: termCursorBlink,
                          cursorStyle: termCursorStyle,
                          scrollback: termScrollback,
                          useTheme: termUseTheme,
                          lightTheme: termLightTheme,
                          darkTheme: termDarkTheme,
                          rendererEngine: isRendererEngineValid ? termRendererEngine : undefined,
                          bellSound: termBellSound,
                          bellVolume: termBellVolume,
                        })
                      }}
                      disabled={saveTerminalConfigMutation.isPending || !isRendererEngineValid}
                      activity={terminalConfigSaved && isRendererEngineValid}
                    >
                      {saveTerminalConfigMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : terminalConfigSaved ? (
                        <Check className="h-4 w-4" />
                      ) : null}
                      {saveTerminalConfigMutation.isPending
                        ? 'Saving...'
                        : terminalConfigSaved
                          ? 'Saved'
                          : 'Save'}
                    </Button>
                  </div>
                </div>
              </TocSection>

              <TocSection
                id="settings-notifications"
                index={tocIndex('settings-notifications')}
                className="space-y-4"
              >
                <NotificationSettings
                  sound={notificationSound}
                  volume={notificationVolume}
                  systemNotificationsEnabled={systemNotificationsEnabled}
                />
              </TocSection>

              <TocSection
                id="settings-translation"
                index={tocIndex('settings-translation')}
                className="space-y-4"
              >
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <Languages className="h-5 w-5" />
                  Translation
                </h2>
                <div className="border-border space-y-4 rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <label className="block text-sm font-medium">
                        Enable document translation
                      </label>
                      <p className="text-muted-foreground mt-1 text-sm">
                        Uses the browser Translator API for Markdown document views.
                      </p>
                    </div>
                    <Switch
                      checked={translationEnabled}
                      onCheckedChange={(checked) => {
                        setTranslationEnabled(checked)
                        saveTranslationConfigMutation.mutate({ enabled: checked })
                        if (checked) {
                          void refreshTranslationCapability(translationTargetLanguage, {
                            initialize: true,
                          })
                        }
                      }}
                      ariaLabel="Enable document translation"
                      disabled={saveTranslationConfigMutation.isPending}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium">Target Language</label>
                      <Select
                        value={translationTargetLanguage}
                        options={TRANSLATION_TARGET_LANGUAGE_OPTIONS}
                        onValueChange={(targetLanguage) => {
                          setTranslationTargetLanguage(targetLanguage)
                          saveTranslationConfigMutation.mutate({ targetLanguage })
                          if (translationEnabled) {
                            void refreshTranslationCapability(targetLanguage, {
                              initialize: true,
                            })
                          }
                        }}
                        ariaLabel="Translation target language"
                        disabled={saveTranslationConfigMutation.isPending}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium">Display Mode</label>
                      <ButtonGroup<DocumentTranslationDisplayMode>
                        value={translationDisplayMode}
                        onChange={(displayMode) => {
                          setTranslationDisplayMode(displayMode)
                          saveTranslationConfigMutation.mutate({ displayMode })
                        }}
                        options={TRANSLATION_DISPLAY_MODE_OPTIONS}
                      />
                    </div>
                  </div>

                  <div className="border-border/60 flex flex-wrap items-center gap-2 border-t pt-3 text-sm">
                    {translationCapabilityLoading ? (
                      <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                    ) : translationCapability?.availability === 'available' ? (
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                    ) : translationCapability?.availability === 'downloadable' ||
                      translationCapability?.availability === 'downloading' ? (
                      <Download className="h-4 w-4 text-sky-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    )}
                    <span className="text-muted-foreground">
                      {formatTranslationCapability(
                        translationCapability,
                        translationCapabilityLoading
                      )}
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        void refreshTranslationCapability(translationTargetLanguage, {
                          initialize: translationEnabled,
                        })
                      }
                      disabled={translationCapabilityLoading}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Check
                    </Button>
                  </div>

                  <div className="border-border/60 space-y-3 border-t pt-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <label className="block text-sm font-medium">Translation cache</label>
                        <p className="text-muted-foreground mt-1 text-sm">
                          Stores validated browser translation projections in the shared user cache.
                        </p>
                      </div>
                      <Switch
                        checked={translationCacheEnabled}
                        onCheckedChange={(checked) => {
                          setTranslationCacheEnabled(checked)
                          saveTranslationConfigMutation.mutate({ cacheEnabled: checked })
                          if (checked) void refetchTranslationCacheStats()
                        }}
                        ariaLabel="Enable translation cache"
                        disabled={saveTranslationConfigMutation.isPending}
                      />
                    </div>

                    {translationCacheEnabled ? (
                      <div className="grid gap-3 md:grid-cols-[minmax(12rem,1fr)_auto]">
                        <label className="block text-sm font-medium">
                          Entry limit
                          <input
                            type="number"
                            min={100}
                            max={200000}
                            step={100}
                            value={translationCacheEntryLimit}
                            onChange={(event) =>
                              setTranslationCacheEntryLimit(Number(event.currentTarget.value))
                            }
                            onBlur={() => {
                              const nextLimit = Math.round(translationCacheEntryLimit)
                              setTranslationCacheEntryLimit(nextLimit)
                              saveGlobalTranslationCacheMutation.mutate(nextLimit, {
                                onSuccess: () => {
                                  void Promise.allSettled([
                                    refetchGlobalSettings(),
                                    refetchTranslationCacheStats(),
                                  ])
                                },
                              })
                            }}
                            className="border-input bg-background mt-2 h-9 w-full rounded-md border px-3 text-sm"
                          />
                        </label>
                        <div className="flex flex-wrap items-end gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              cleanTranslationCacheMutation.mutate(undefined, {
                                onSuccess: () => void refetchTranslationCacheStats(),
                              })
                            }
                            disabled={cleanTranslationCacheMutation.isPending}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Clean
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              clearTranslationCacheMutation.mutate(undefined, {
                                onSuccess: () => void refetchTranslationCacheStats(),
                              })
                            }
                            disabled={clearTranslationCacheMutation.isPending}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Clear
                          </Button>
                        </div>
                        <p className="text-muted-foreground text-xs md:col-span-2">
                          {translationCacheStats
                            ? `${translationCacheStats.entries} / ${translationCacheStats.entryLimit} entries`
                            : 'Cache stats unavailable.'}
                        </p>
                      </div>
                    ) : null}
                  </div>

                  {savedTranslationConfig.enabled !== translationEnabled ||
                  savedTranslationConfig.targetLanguage !== translationTargetLanguage ||
                  savedTranslationConfig.displayMode !== translationDisplayMode ||
                  savedTranslationConfig.cacheEnabled !== translationCacheEnabled ||
                  savedTranslationCacheEntryLimit !== translationCacheEntryLimit ? (
                    <p className="text-muted-foreground text-xs">Saving translation settings...</p>
                  ) : null}
                </div>
              </TocSection>

              {/* Dashboard Settings */}
              <TocSection
                id="settings-dashboard"
                index={tocIndex('settings-dashboard')}
                className="space-y-4"
              >
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <LayoutDashboard className="h-5 w-5" />
                  Dashboard
                </h2>
                <div className="border-border space-y-4 rounded-lg border p-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium">Trend Point Limit</label>
                    <p className="text-muted-foreground mb-3 text-sm">
                      Max data points kept per top metric card trend (server-shared in-memory
                      history).
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
                      <Button
                        onClick={() => {
                          const next = Math.max(
                            20,
                            Math.min(500, Math.trunc(dashboardTrendPointLimit || 100))
                          )
                          setDashboardTrendPointLimit(next)
                          saveDashboardConfigMutation.mutate(next)
                        }}
                        disabled={saveDashboardConfigMutation.isPending}
                        activity={dashboardTrendPointLimitSaved}
                      >
                        {saveDashboardConfigMutation.isPending
                          ? 'Saving...'
                          : dashboardTrendPointLimitSaved
                            ? 'Saved'
                            : 'Save'}
                      </Button>
                    </div>
                    <p className="text-muted-foreground mt-2 text-xs">
                      Allowed range: 20-500. Lower values reduce memory and increase visual
                      smoothing.
                    </p>
                  </div>
                </div>
              </TocSection>

              <TocSection
                id="settings-git-detail"
                index={tocIndex('settings-git-detail')}
                className="space-y-4"
              >
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <GitCommitHorizontal className="h-5 w-5" />
                  Git Detail
                </h2>
                <div className="border-border space-y-4 rounded-lg border p-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Eager Patch Line Budget
                    </label>
                    <p className="text-muted-foreground mb-3 text-sm">
                      Server-side line budget for the initial Git detail payload. Files are included
                      as a prefix, and the file that crosses the budget still ships eagerly.
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={0}
                        max={200000}
                        step={100}
                        value={gitDiffEagerLineBudget}
                        onChange={(e) => {
                          const next = Number(e.target.value)
                          if (Number.isFinite(next)) {
                            setGitDiffEagerLineBudget(next)
                          }
                        }}
                        className="bg-background border-border text-foreground focus:ring-primary w-40 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1"
                      />
                      <Button
                        onClick={() => {
                          const next = Math.max(
                            0,
                            Math.min(200000, Math.trunc(gitDiffEagerLineBudget || 0))
                          )
                          setGitDiffEagerLineBudget(next)
                          saveGitConfigMutation.mutate(next)
                        }}
                        disabled={saveGitConfigMutation.isPending}
                        activity={gitDiffEagerLineBudgetSaved}
                      >
                        {saveGitConfigMutation.isPending
                          ? 'Saving...'
                          : gitDiffEagerLineBudgetSaved
                            ? 'Saved'
                            : 'Save'}
                      </Button>
                    </div>
                    <p className="text-muted-foreground mt-2 text-xs">
                      Set to `0` to force fully lazy patch loading. Default is `1000`.
                    </p>
                  </div>
                </div>
              </TocSection>

              {/* Project Directory */}
              <TocSection
                id="settings-project-directory"
                index={tocIndex('settings-project-directory')}
                className="space-y-4"
              >
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
              </TocSection>

              {/* CLI Configuration */}
              <TocSection
                id="settings-cli-configuration"
                index={tocIndex('settings-cli-configuration')}
                className="space-y-4"
              >
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
                    {!isSniffingCli &&
                      (!cliSniffResult?.hasGlobal || cliSniffResult?.hasUpdate) && (
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
                      Override the runner command used to execute OpenSpec. Leave empty to
                      auto-resolve.
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={cliCommand}
                        onChange={(e) => setCliCommand(e.target.value)}
                        placeholder={cliPlaceholder}
                        className="border-border bg-background text-foreground flex-1 rounded-md border px-3 py-2 font-mono text-sm"
                      />
                      <Button
                        onClick={() => saveCliCommandMutation.mutate(cliCommand)}
                        disabled={saveCliCommandMutation.isPending}
                        activity={cliCommandSaved}
                      >
                        {saveCliCommandMutation.isPending
                          ? 'Saving...'
                          : cliCommandSaved
                            ? 'Saved'
                            : 'Save'}
                      </Button>
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
              </TocSection>

              {/* OpenSpec Profile & Sync */}
              <TocSection
                id="settings-openspec-profile"
                index={tocIndex('settings-openspec-profile')}
                className="space-y-4"
              >
                <h2 className="text-lg font-semibold">OpenSpec Profile &amp; Sync</h2>
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
                          <div className="mt-1 text-sm font-medium">
                            {opsxProfileState.delivery}
                          </div>
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
                        OpenSpec CLI profile behavior and prunes deselected workflow command/skill
                        files.
                      </p>

                      <p className="text-muted-foreground text-xs">
                        For interactive custom profile editing, run{' '}
                        <code className="bg-muted rounded px-1">openspec config profile</code> in a
                        local terminal.
                      </p>
                    </>
                  )}
                </div>
              </TocSection>

              {/* API Configuration */}
              <TocSection
                id="settings-api-configuration"
                index={tocIndex('settings-api-configuration')}
                className="space-y-4"
              >
                <h2 className="text-lg font-semibold">API Configuration</h2>
                <div className="border-border space-y-4 rounded-lg border p-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium">API Server URL</label>
                    <p className="text-muted-foreground mb-3 text-sm">
                      Leave empty for same-origin requests. Set a custom URL to connect to a
                      different server.
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={apiUrl}
                        onChange={(e) => setApiUrl(e.target.value)}
                        placeholder={window.location.origin}
                        className="border-border bg-background text-foreground flex-1 rounded-md border px-3 py-2"
                      />
                      <Button onClick={handleApiUrlChange} activity={apiUrlApplied}>
                        {apiUrlApplied ? 'Applied' : 'Apply'}
                      </Button>
                    </div>
                    {getApiBaseUrl() && (
                      <p className="text-muted-foreground mt-2 text-sm">
                        Current: <code className="bg-muted rounded px-1">{getApiBaseUrl()}</code>
                      </p>
                    )}
                  </div>
                </div>
              </TocSection>

              <TocSection
                id="settings-hosted-app"
                index={tocIndex('settings-hosted-app')}
                className="space-y-4"
              >
                <h2 className="text-lg font-semibold">Hosted App</h2>
                <div className="border-border space-y-4 rounded-lg border p-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium">Base URL</label>
                    <p className="text-muted-foreground mb-3 text-sm">
                      Used by <code className="bg-muted rounded px-1">openspecui --app</code> when
                      no explicit base URL is passed. Leave empty to use the official app shell.
                      Reusing an installed PWA only works when that PWA was installed from this same
                      shell origin.
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={appBaseUrl}
                        onChange={(e) => setAppBaseUrl(e.target.value)}
                        placeholder={OFFICIAL_APP_BASE_URL}
                        className="border-border bg-background text-foreground flex-1 rounded-md border px-3 py-2"
                      />
                      <Button
                        onClick={() => saveAppBaseUrlMutation.mutate(appBaseUrl)}
                        disabled={saveAppBaseUrlMutation.isPending}
                        activity={appBaseUrlSaved}
                      >
                        {saveAppBaseUrlMutation.isPending
                          ? 'Saving...'
                          : appBaseUrlSaved
                            ? 'Saved'
                            : 'Save'}
                      </Button>
                    </div>
                    <p className="text-muted-foreground mt-2 text-sm">
                      Effective default:{' '}
                      <code className="bg-muted rounded px-1">
                        {savedAppBaseUrl || OFFICIAL_APP_BASE_URL}
                      </code>
                    </p>
                  </div>
                </div>
              </TocSection>

              {/* File Watcher Info */}
              <TocSection
                id="settings-file-watcher"
                index={tocIndex('settings-file-watcher')}
                className="space-y-4"
              >
                <h2 className="text-lg font-semibold">File Watcher</h2>
                <div className="border-border rounded-lg border p-4">
                  <p className="text-muted-foreground mb-3 text-sm">
                    File watcher is configured on the server side. Check the status bar at the
                    bottom of the page to see if file watching is enabled.
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
              </TocSection>

              {/* Initialize OpenSpec */}
              <TocSection
                id="settings-init-openspec"
                index={tocIndex('settings-init-openspec')}
                className="space-y-4"
              >
                <h2 className="text-lg font-semibold">Initialize OpenSpec</h2>
                <div className="border-border space-y-4 rounded-lg border p-4">
                  <p className="text-muted-foreground text-sm">
                    Create the OpenSpec directory structure in the current project. This will create{' '}
                    <code className="bg-muted rounded px-1">openspec/</code> with specs, changes,
                    and archive directories.
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1.5">
                      <span className="text-sm font-medium">Init Mode</span>
                      <Select
                        value={initToolsMode}
                        options={INIT_TOOLS_MODE_OPTIONS}
                        onValueChange={setInitToolsMode}
                        ariaLabel="Init Mode"
                        className="w-full"
                      />
                      <p className="text-muted-foreground text-xs">
                        OpenSpec CLI can auto-detect existing tool directories. OpenSpecUI 3.x uses
                        OpenSpec CLI 1.3.x as the current tool line.
                      </p>
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-sm font-medium">Profile Override</span>
                      <Select
                        value={initProfileOverride}
                        options={INIT_PROFILE_OVERRIDE_OPTIONS}
                        onValueChange={setInitProfileOverride}
                        ariaLabel="Profile Override"
                        className="w-full"
                      />
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
                        {selectedTools.length > 0 &&
                        selectedTools.length === selectableToolIds.length
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
                          const legacyCommandWorkflows =
                            toolInitStateById.get(tool.value)?.legacyCommandWorkflows ?? []
                          const statusTitle = initialized
                            ? legacyCommandWorkflows.length > 0
                              ? `Initialized: legacy-compatible command paths detected for ${legacyCommandWorkflows.join(', ')}`
                              : 'Initialized: exact match for current delivery/workflows'
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
                        <Switch
                          checked={initForce}
                          onCheckedChange={setInitForce}
                          ariaLabel="Force non-interactive init"
                        />
                      </span>
                      <span className="text-muted-foreground text-[11px] leading-4">
                        Enabled by default so{' '}
                        <code className="bg-muted rounded px-1">openspec init --tools ...</code>{' '}
                        also writes{' '}
                        <code className="bg-muted rounded px-1">openspec/config.yaml</code>.
                      </span>
                    </label>
                  </div>
                  <p className="text-muted-foreground text-xs">{currentInitAction.helperText}</p>
                </div>
              </TocSection>
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
                      You can now run the "openspec" command directly. Click "Re-detect CLI" to
                      refresh status.
                    </p>
                  </div>
                )}
              </Dialog>
            </>
          )}
        </div>
        <Toc items={SETTINGS_TOC_ITEMS} className="toc-page-sidebar" />
      </div>
    </div>
  )
}
