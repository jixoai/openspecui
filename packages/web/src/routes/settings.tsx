/**
 * Orthogonal intents (updated 2026-07-22 Asia/Shanghai):
 * 1. Present backend, CLI execution, terminal, notification, and appearance settings.
 * 2. Compose the extracted OpenSpec diagnostics and initialization owner.
 * 3. Bind network-triggered settings actions to visible loading and failure state.
 * 4. Delegate CLI installation and Init through single-source Server-owned transports.
 * 5. Preserve first-frame and dirty Terminal drafts through field-value Config synchronization.
 *
 * Original request (2026-07-14): "openspec 1.6.0 已经放出，我们需要开始进行适配。"
 * Original request (2026-07-17): "CliStreamTransport is the single execution and display truth."
 * Owner report (2026-07-22): "几乎都在 Loading，切换个页面也等，做任何动作也在等。"
 */
import { Button } from '@/components/button'
import { ButtonGroup, type ButtonGroupOption } from '@/components/button-group'
import { CliTerminal } from '@/components/cli-terminal'
import { CopyablePath } from '@/components/copyable-path'
import { Dialog } from '@/components/dialog'
import { NotificationSettings } from '@/components/notifications/notification-settings'
import { RealtimeSkeletonLine } from '@/components/realtime'
import { Select, type SelectOption } from '@/components/select'
import { OpenSpecSettingsSections } from '@/components/settings/openspec-settings-section'
import { SoundSettingControl } from '@/components/sound-setting-control'
import { Switch } from '@/components/switch'
import { TerminalInvocationSettings } from '@/components/terminal/terminal-invocation-settings'
import { generateTimelineScope, Toc, TocSection, type TocItem } from '@/components/toc'
import { getApiBaseUrl } from '@/lib/api-config'
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
import type { OpenSpecUIConfig } from '@openspecui/core'
import { OFFICIAL_APP_BASE_URL } from '@openspecui/core/hosted-app'
import { NotificationSoundSchema } from '@openspecui/core/notifications'
import {
  DEFAULT_BELL_SOUND_ID,
  DEFAULT_NOTIFICATION_SOUND_ID,
  type SoundId,
} from '@openspecui/core/sounds'
import type { TerminalBellSound } from '@openspecui/core/terminal-audio'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  ArrowUp,
  Check,
  CheckCircle,
  Download,
  FolderOpen,
  GitCommitHorizontal,
  LayoutDashboard,
  Link2,
  Loader2,
  Monitor,
  Moon,
  Plus,
  Settings as SettingsIcon,
  Sparkles,
  Sun,
  Terminal,
  Unlink2,
  XCircle,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { SettingsTranslationPanel } from './settings-translation-panel'

function formatExecutePath(command: string, args: readonly string[] = []): string {
  const quote = (token: string): string => {
    if (!token) return '""'
    if (!/[\s"'\\]/.test(token)) return token
    return JSON.stringify(token)
  }
  return [command, ...args].map(quote).join(' ')
}

const DEFAULT_TERMINAL_FONT_SIZE = 13
const DEFAULT_TERMINAL_FONT_FAMILY = ''
const DEFAULT_TERMINAL_CURSOR_BLINK = true
const DEFAULT_TERMINAL_CURSOR_STYLE: TerminalCursorStyle = 'block'
const DEFAULT_TERMINAL_SCROLLBACK = 1000
const DEFAULT_TERMINAL_RENDERER_ENGINE: TerminalRendererEngine = 'xterm'
const DEFAULT_TERMINAL_BELL_VOLUME = 1
const DEFAULT_DASHBOARD_TREND_POINT_LIMIT = 100
const DEFAULT_GIT_DIFF_EAGER_LINE_BUDGET = 1000

function resolveTerminalDraft(
  config: OpenSpecUIConfig['terminal'] | undefined,
  controllerFallback: ReturnType<typeof terminalController.getConfig>
) {
  return {
    fontSize: config?.fontSize ?? controllerFallback.fontSize,
    fontFamily: config?.fontFamily ?? controllerFallback.fontFamily,
    cursorBlink: config?.cursorBlink ?? controllerFallback.cursorBlink,
    cursorStyle: config?.cursorStyle ?? controllerFallback.cursorStyle,
    scrollback: config?.scrollback ?? controllerFallback.scrollback,
    useTheme: config?.useTheme ?? controllerFallback.useTheme,
    lightTheme: config?.lightTheme ?? controllerFallback.lightTheme,
    darkTheme: config?.darkTheme ?? controllerFallback.darkTheme,
    rendererEngine: config?.rendererEngine ?? controllerFallback.rendererEngine,
    bellSound: config?.bellSound ?? controllerFallback.bellSound,
    bellVolume: config?.bellVolume ?? controllerFallback.bellVolume,
  }
}

function useFieldValueDraft<T>(upstreamValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [draft, setDraft] = useState(upstreamValue)

  useEffect(() => {
    setDraft(upstreamValue)
  }, [upstreamValue])

  return [draft, setDraft]
}

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
  { id: 'settings-openspec-diagnostics', label: 'OpenSpec Diagnostics' },
  { id: 'settings-init-openspec', label: 'Initialize OpenSpec' },
  { id: 'settings-api-configuration', label: 'API Configuration' },
  { id: 'settings-hosted-app', label: 'Hosted App' },
  { id: 'settings-file-watcher', label: 'File Watcher' },
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

/** Render the project-backend Settings workspace. */
export function Settings() {
  // 订阅配置；已缓存的 Config 必须成为 writable draft 的首帧 authority。
  const { data: config } = useConfigSubscription()
  const configuredCodeEditorTheme = config?.codeEditor?.theme
  const [theme, setTheme] = useState<Theme>(() => config?.theme ?? getStoredTheme())
  const [codeEditorTheme, setCodeEditorTheme] = useState<CodeEditorTheme>(() =>
    configuredCodeEditorTheme && isCodeEditorTheme(configuredCodeEditorTheme)
      ? configuredCodeEditorTheme
      : DEFAULT_CODE_EDITOR_THEME
  )
  const [apiUrl, setApiUrl] = useState(getApiBaseUrl() || '')
  const [appBaseUrl, setAppBaseUrl] = useState(() => config?.appBaseUrl ?? '')
  const [cliCommand, setCliCommand] = useState(() =>
    config?.cli?.command ? formatExecutePath(config.cli.command, config.cli.args ?? []) : ''
  )
  const [showInstallModal, setShowInstallModal] = useState(false)
  const installRunner = useCliRunner()

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
  const visibleTocItems = inStaticMode ? SETTINGS_TOC_ITEMS.slice(0, 1) : SETTINGS_TOC_ITEMS

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
  const { data: effectiveCliCommand, refetch: refetchEffectiveCliCommand } = useQuery({
    ...trpc.config.getEffectiveCliCommand.queryOptions(),
    enabled: !inStaticMode,
  })
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
    setShowInstallModal(false)
  }, [resniffCli])

  // 计算显示的 placeholder
  const cliPlaceholder = cliSniffResult?.hasGlobal
    ? 'openspec (v' + (cliSniffResult.version || 'detected') + ')'
    : 'npx @fission-ai/openspec'

  useEffect(() => {
    if (showInstallModal) {
      installCommands.replaceAll([
        {
          type: 'install-global-cli',
        },
      ])
      installCommands.runAll()
    } else {
      cancelInstall()
      resetInstall()
    }
  }, [showInstallModal, installCommands, cancelInstall, resetInstall])

  const handleCloseInstall = () => {
    setShowInstallModal(false)
    cancelInstall()
    resetInstall()
  }

  // 保存 execute-path 配置
  const saveCliCommandMutation = useMutation({
    mutationFn: (command: string) => trpcClient.config.update.mutate({ cli: { command } }),
    onSuccess: async () => {
      await Promise.allSettled([refetchEffectiveCliCommand(), resniffCli()])
      await queryClient.invalidateQueries(trpc.config.getEffectiveCliCommand.queryFilter())
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

  // Terminal controller state is the fallback only when Config has no corresponding value.
  const terminalUpstreamValues = resolveTerminalDraft(
    config?.terminal,
    terminalController.getConfig()
  )
  const configuredDashboardTrendPointLimit = config?.dashboard?.trendPointLimit
  const configuredGitDiffEagerLineBudget = config?.git?.diffEagerLineBudget

  const [termFontSize, setTermFontSize] = useFieldValueDraft(terminalUpstreamValues.fontSize)
  const [termFontFamily, setTermFontFamily] = useFieldValueDraft(terminalUpstreamValues.fontFamily)
  const [termCursorBlink, setTermCursorBlink] = useFieldValueDraft(
    terminalUpstreamValues.cursorBlink
  )
  const [termCursorStyle, setTermCursorStyle] = useFieldValueDraft(
    terminalUpstreamValues.cursorStyle
  )
  const [termScrollback, setTermScrollback] = useFieldValueDraft(terminalUpstreamValues.scrollback)
  const [termUseTheme, setTermUseTheme] = useFieldValueDraft(terminalUpstreamValues.useTheme)
  const [termLightTheme, setTermLightTheme] = useFieldValueDraft(terminalUpstreamValues.lightTheme)
  const [termDarkTheme, setTermDarkTheme] = useFieldValueDraft(terminalUpstreamValues.darkTheme)
  const [termRendererEngine, setTermRendererEngine] = useFieldValueDraft<string>(
    terminalUpstreamValues.rendererEngine
  )
  const [termBellSound, setTermBellSound] = useFieldValueDraft(terminalUpstreamValues.bellSound)
  const [termBellVolume, setTermBellVolume] = useFieldValueDraft(terminalUpstreamValues.bellVolume)
  const [dashboardTrendPointLimit, setDashboardTrendPointLimit] = useState(() =>
    typeof configuredDashboardTrendPointLimit === 'number' &&
    Number.isFinite(configuredDashboardTrendPointLimit)
      ? configuredDashboardTrendPointLimit
      : DEFAULT_DASHBOARD_TREND_POINT_LIMIT
  )
  const [gitDiffEagerLineBudget, setGitDiffEagerLineBudget] = useState(() =>
    typeof configuredGitDiffEagerLineBudget === 'number' &&
    Number.isFinite(configuredGitDiffEagerLineBudget)
      ? configuredGitDiffEagerLineBudget
      : DEFAULT_GIT_DIFF_EAGER_LINE_BUDGET
  )
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
  const opsxAgentInvocationModeOptions = useMemo(
    () =>
      OPSX_AGENT_INVOCATION_MODE_OPTIONS.map((option) => ({
        ...option,
        disabled: saveOpsxConfigMutation.isPending,
      })),
    [saveOpsxConfigMutation.isPending]
  )
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
  return (
    <div
      className="@container-[size] scrollbar-thin scrollbar-track-transparent h-full min-h-0 overflow-y-auto scroll-smooth"
      style={{ timelineScope: generateTimelineScope(visibleTocItems) } as CSSProperties}
    >
      <div className="toc-page-layout min-h-full gap-6 p-4 [--toc-page-sidebar-min:14rem]">
        <Toc items={visibleTocItems} className="toc-page-sidebar [--toc-sticky-top:16px]" />
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

              <SettingsTranslationPanel index={tocIndex('settings-translation')} />

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
                      <RealtimeSkeletonLine className="w-40" />
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
                    {effectiveCliCommand && (
                      <p className="text-muted-foreground mt-2 text-xs">
                        Effective execute path:{' '}
                        <code className="bg-muted rounded px-1">{effectiveCliCommand}</code>
                      </p>
                    )}
                  </div>
                </div>
              </TocSection>

              <OpenSpecSettingsSections
                diagnosticsIndex={tocIndex('settings-openspec-diagnostics')}
                initializationIndex={tocIndex('settings-init-openspec')}
              />

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
            </>
          )}

          {/* Install / Update CLI Dialog */}
          {!inStaticMode && (
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
          )}
        </div>
      </div>
    </div>
  )
}
