import { exec, execFile } from 'child_process'
import { mkdir, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { promisify } from 'util'
import { z } from 'zod'
import {
  DocumentTranslationConfigSchema,
  type DocumentTranslationConfigUpdate,
} from './document-translation.js'
import { NotificationSettingsSchema, type NotificationSettings } from './notifications.js'
import {
  sanitizePersistedSettings,
  type PersistedSanitizeRule,
} from './persisted-settings-sanitize.js'
import { reactiveReadFile, updateReactiveFileCache } from './reactive-fs/index.js'
import { DEFAULT_BELL_SOUND_ID, SoundVolumeSchema } from './sounds.js'
import { runBufferedCommand } from './spawn-safe.js'
import { TerminalBellSoundSchema } from './terminal-audio.js'
import {
  DEFAULT_TERMINAL_DARK_THEME,
  DEFAULT_TERMINAL_LIGHT_THEME,
  DEFAULT_TERMINAL_THEME_MODE,
  TERMINAL_THEME_MODE_VALUES,
  TERMINAL_THEME_VALUES,
} from './terminal-theme.js'

const execAsync = promisify(exec)
const execFileAsync = promisify(execFile)

const CLI_PROBE_TIMEOUT_MS = 20_000

const THEME_VALUES = ['light', 'dark', 'system'] as const
const CURSOR_STYLE_VALUES = ['block', 'underline', 'bar'] as const
export const CODE_EDITOR_THEME_VALUES = [
  'github',
  'material',
  'vscode',
  'tokyo',
  'gruvbox',
  'monokai',
  'nord',
] as const
export const TERMINAL_RENDERER_ENGINE_VALUES = ['xterm', 'ghostty'] as const
export const OPSX_AGENT_INVOCATION_MODE_VALUES = ['compose', 'command'] as const
export const TerminalRendererEngineSchema = z.enum(TERMINAL_RENDERER_ENGINE_VALUES)
export type TerminalRendererEngine = z.infer<typeof TerminalRendererEngineSchema>
export const TerminalThemeModeSchema = z.enum(TERMINAL_THEME_MODE_VALUES)
export type TerminalThemeMode = z.infer<typeof TerminalThemeModeSchema>
export const TerminalThemeSchema = z.enum(TERMINAL_THEME_VALUES)
export type TerminalThemeId = z.infer<typeof TerminalThemeSchema>
export const OpsxAgentInvocationModeSchema = z.enum(OPSX_AGENT_INVOCATION_MODE_VALUES)
export type OpsxAgentInvocationMode = z.infer<typeof OpsxAgentInvocationModeSchema>
export const CodeEditorThemeSchema = z.enum(CODE_EDITOR_THEME_VALUES)
export type CodeEditorTheme = z.infer<typeof CodeEditorThemeSchema>

export function isTerminalRendererEngine(value: string): value is TerminalRendererEngine {
  return (TERMINAL_RENDERER_ENGINE_VALUES as readonly string[]).includes(value)
}

type RunnerId = 'configured' | 'openspec' | 'npx' | 'bunx' | 'deno' | 'pnpm' | 'yarn'

interface CliRunnerCandidate {
  id: RunnerId
  source: string
  commandParts: readonly string[]
}

export interface CliRunnerAttempt {
  source: string
  command: string
  success: boolean
  version?: string
  error?: string
  exitCode: number | null
}

export interface ResolvedCliRunner {
  source: string
  command: string
  commandParts: readonly string[]
  version?: string
  attempts: readonly CliRunnerAttempt[]
}

const BASE_PACKAGE_MANAGER_RUNNERS: readonly CliRunnerCandidate[] = [
  { id: 'npx', source: 'npx', commandParts: ['npx', '-y', '@fission-ai/openspec'] },
  { id: 'bunx', source: 'bunx', commandParts: ['bunx', '@fission-ai/openspec'] },
  { id: 'deno', source: 'deno', commandParts: ['deno', 'run', '-A', 'npm:@fission-ai/openspec'] },
  { id: 'pnpm', source: 'pnpm', commandParts: ['pnpm', 'dlx', '@fission-ai/openspec'] },
  { id: 'yarn', source: 'yarn', commandParts: ['yarn', 'dlx', '@fission-ai/openspec'] },
]

function tokenizeCliCommand(input: string): string[] {
  const tokens: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null
  let tokenStarted = false

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]

    if (quote) {
      if (char === quote) {
        quote = null
        tokenStarted = true
        continue
      }

      if (char === '\\') {
        const next = input[index + 1]
        if (next && (next === quote || next === '\\')) {
          current += next
          tokenStarted = true
          index += 1
          continue
        }
      }

      current += char
      tokenStarted = true
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      tokenStarted = true
      continue
    }

    if (char === '\\') {
      const next = input[index + 1]
      if (next && /[\s"'\\]/.test(next)) {
        current += next
        tokenStarted = true
        index += 1
        continue
      }

      // Keep Windows path separators and other non-escape backslashes.
      current += char
      tokenStarted = true
      continue
    }

    if (/\s/.test(char)) {
      if (tokenStarted) {
        tokens.push(current)
        current = ''
        tokenStarted = false
      }
      continue
    }

    current += char
    tokenStarted = true
  }

  if (tokenStarted) {
    tokens.push(current)
  }

  return tokens
}

/**
 * 解析 CLI 命令字符串为数组
 *
 * 支持两种格式：
 * 1. JSON 数组：以 `[` 开头，如 `["npx", "@fission-ai/openspec"]`
 * 2. shell-like 字符串：支持引号与基础转义
 */
export function parseCliCommand(command: string): string[] {
  const trimmed = command.trim()

  // JSON 数组格式
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
        return parsed
      }
      throw new Error('Invalid JSON array: expected array of strings')
    } catch (err) {
      throw new Error(
        `Failed to parse CLI command as JSON array: ${err instanceof Error ? err.message : err}`
      )
    }
  }

  const tokens = tokenizeCliCommand(trimmed)
  if (tokens.length !== 1) {
    return tokens
  }

  // 兼容用户把整条命令误包在一层引号中的情况：
  // "pwsh -File \"C:\\path with space\\entry.ps1\""
  const firstChar = trimmed[0]
  const lastChar = trimmed[trimmed.length - 1]
  if ((firstChar !== '"' && firstChar !== "'") || firstChar !== lastChar) {
    return tokens
  }

  const inner = trimmed.slice(1, -1).trim()
  if (!inner) {
    return tokens
  }

  const normalizedInner = inner.replace(/\\(["'])/g, '$1')
  const innerTokens = tokenizeCliCommand(normalizedInner)
  if (innerTokens.length > 1 && innerTokens.slice(1).some((token) => token.startsWith('-'))) {
    return innerTokens
  }

  return tokens
}

function commandToString(commandParts: readonly string[]): string {
  const formatToken = (token: string): string => {
    if (!token) return '""'
    if (!/[\s"'\\]/.test(token)) return token
    return JSON.stringify(token)
  }
  return commandParts.map(formatToken).join(' ').trim()
}

function isBareExecutableCommand(command: string): boolean {
  if (!command) return false
  if (command === '.' || command === '..') return false
  return !/[\\/]/.test(command)
}

function quotePosixShellArg(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

async function resolveShellExecutablePath(
  command: string,
  cwd: string,
  env: NodeJS.ProcessEnv
): Promise<string | null> {
  if (!isBareExecutableCommand(command)) {
    return null
  }

  try {
    if (process.platform === 'win32') {
      const { stdout } = await execFileAsync('where', [command], {
        cwd,
        env,
        encoding: 'utf8',
        timeout: 5_000,
      })
      const resolved = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.length > 0)
      return resolved || null
    }

    const shell = env.SHELL || process.env.SHELL || '/bin/sh'
    const { stdout } = await execFileAsync(
      shell,
      ['-lc', `command -v -- ${quotePosixShellArg(command)}`],
      {
        cwd,
        env,
        encoding: 'utf8',
        timeout: 5_000,
      }
    )
    const resolved = stdout
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.startsWith('/'))
    return resolved || null
  } catch {
    return null
  }
}

async function expandCliRunnerCandidates(
  candidates: readonly CliRunnerCandidate[],
  cwd: string,
  env: NodeJS.ProcessEnv
): Promise<readonly CliRunnerCandidate[]> {
  const expanded: CliRunnerCandidate[] = []

  for (const candidate of candidates) {
    const [command, ...rest] = candidate.commandParts

    const shouldResolveViaShell =
      candidate.id === 'openspec' ||
      (candidate.id === 'configured' && command.trim().toLowerCase() === 'openspec')

    if (shouldResolveViaShell && command) {
      const shellResolved = await resolveShellExecutablePath(command, cwd, env)
      if (shellResolved && shellResolved !== command) {
        expanded.push({
          ...candidate,
          source: `${candidate.source} (shell)`,
          commandParts: [shellResolved, ...rest],
        })
      }
    }

    expanded.push(candidate)
  }

  return expanded
}

function getRunnerPriorityFromUserAgent(userAgent?: string | null): RunnerId | null {
  if (!userAgent) return null
  if (userAgent.startsWith('bun')) return 'bunx'
  if (userAgent.startsWith('npm')) return 'npx'
  if (userAgent.startsWith('deno')) return 'deno'
  if (userAgent.startsWith('pnpm')) return 'pnpm'
  if (userAgent.startsWith('yarn')) return 'yarn'
  return null
}

export function buildCliRunnerCandidates(options: {
  configuredCommandParts?: readonly string[]
  userAgent?: string | null
}): readonly CliRunnerCandidate[] {
  const candidates: CliRunnerCandidate[] = []
  const configuredCommandParts = options.configuredCommandParts?.filter(Boolean) ?? []

  if (configuredCommandParts.length > 0) {
    candidates.push({
      id: 'configured',
      source: 'config.cli.command',
      commandParts: configuredCommandParts,
    })
  }

  candidates.push({
    id: 'openspec',
    source: 'openspec',
    commandParts: ['openspec'],
  })

  const packageRunners = [...BASE_PACKAGE_MANAGER_RUNNERS]
  const preferred = getRunnerPriorityFromUserAgent(options.userAgent)
  if (preferred) {
    const index = packageRunners.findIndex((item) => item.id === preferred)
    if (index > 0) {
      const [runner] = packageRunners.splice(index, 1)
      packageRunners.unshift(runner)
    }
  }

  return [...candidates, ...packageRunners]
}

export function createCleanCliEnv(baseEnv: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env = { ...baseEnv }
  for (const key of Object.keys(env)) {
    if (
      key.startsWith('npm_config_') ||
      key.startsWith('npm_package_') ||
      key === 'npm_execpath' ||
      key === 'npm_lifecycle_event' ||
      key === 'npm_lifecycle_script'
    ) {
      delete env[key]
    }
  }
  return env
}

async function probeCliRunner(
  candidate: CliRunnerCandidate,
  cwd: string,
  env: NodeJS.ProcessEnv
): Promise<CliRunnerAttempt> {
  const [cmd, ...cmdArgs] = candidate.commandParts
  const result = await runBufferedCommand({
    command: cmd,
    args: [...cmdArgs, '--version'],
    cwd,
    env,
    timeoutMs: CLI_PROBE_TIMEOUT_MS,
  })

  if (result.timedOut) {
    return {
      source: candidate.source,
      command: commandToString(candidate.commandParts),
      success: false,
      error: 'CLI probe timed out',
      exitCode: result.exitCode,
    }
  }

  if (result.spawnError) {
    return {
      source: candidate.source,
      command: commandToString(candidate.commandParts),
      success: false,
      error: result.spawnError.message,
      exitCode: null,
    }
  }

  if (result.exitCode === 0) {
    const version = result.stdout.trim().split('\n')[0] || undefined
    return {
      source: candidate.source,
      command: commandToString(candidate.commandParts),
      success: true,
      version,
      exitCode: result.exitCode,
    }
  }

  return {
    source: candidate.source,
    command: commandToString(candidate.commandParts),
    success: false,
    error: result.stderr.trim() || `Exit code ${result.exitCode ?? 'null'}`,
    exitCode: result.exitCode,
  }
}

async function resolveCliRunner(
  candidates: readonly CliRunnerCandidate[],
  cwd: string,
  env: NodeJS.ProcessEnv
): Promise<ResolvedCliRunner> {
  const expandedCandidates = await expandCliRunnerCandidates(candidates, cwd, env)
  const attempts: CliRunnerAttempt[] = []
  for (const candidate of expandedCandidates) {
    const attempt = await probeCliRunner(candidate, cwd, env)
    attempts.push(attempt)
    if (attempt.success) {
      return {
        source: attempt.source,
        command: attempt.command,
        commandParts: candidate.commandParts,
        version: attempt.version,
        attempts,
      }
    }
  }
  const details = attempts
    .map((attempt) => `- ${attempt.command}: ${attempt.error ?? 'failed'}`)
    .join('\n')
  throw new Error(`No available OpenSpec CLI runner.\n${details}`)
}

/** CLI 嗅探结果 */
export interface CliSniffResult {
  /** 是否存在全局 openspec 命令 */
  hasGlobal: boolean
  /** 全局命令的版本（仅当 hasGlobal 为 true 时有值） */
  version?: string
  /** npm registry 上的最新版本 */
  latestVersion?: string
  /** 是否有可用更新 */
  hasUpdate?: boolean
  /** 错误信息（如果检测失败） */
  error?: string
}

/**
 * 比较两个语义化版本号
 * @returns 正数表示 a > b，负数表示 a < b，0 表示相等
 */
function compareVersions(a: string, b: string): number {
  const parseVersion = (v: string) => {
    // 移除 'v' 前缀和预发布标签
    const clean = v.replace(/^v/, '').split('-')[0]
    return clean.split('.').map((n) => parseInt(n, 10) || 0)
  }

  const aParts = parseVersion(a)
  const bParts = parseVersion(b)

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aVal = aParts[i] ?? 0
    const bVal = bParts[i] ?? 0
    if (aVal !== bVal) return aVal - bVal
  }
  return 0
}

/**
 * 获取 npx 可用的最新版本
 *
 * 使用 `npx @fission-ai/openspec --version` 获取最新版本
 * 这会下载并执行最新版本，所以超时时间较长
 */
async function fetchLatestVersion(): Promise<string | undefined> {
  try {
    // npx 会下载最新版本并执行，需要较长超时
    const { stdout } = await execAsync('npx -y @fission-ai/openspec --version', { timeout: 60000 })
    return stdout.trim()
  } catch {
    // 网络错误或 npx 不可用，静默失败
    return undefined
  }
}

/**
 * 嗅探全局 openspec 命令（无缓存）
 *
 * 使用 `openspec --version` 检测是否有全局命令可用。
 * 同时检查 npm registry 上的最新版本。
 * 每次调用都会重新检测，不使用缓存。
 */
export async function sniffGlobalCli(): Promise<CliSniffResult> {
  const env = createCleanCliEnv()
  const resolvedCommand =
    (await resolveShellExecutablePath('openspec', process.cwd(), env)) ?? 'openspec'

  // 并行获取本地版本和最新版本
  const [localResult, latestVersion] = await Promise.all([
    execFileAsync(resolvedCommand, ['--version'], {
      env,
      timeout: 10000,
      encoding: 'utf8',
    }).catch((err) => ({ error: err })),
    fetchLatestVersion(),
  ])

  // 处理本地版本检测结果
  if ('error' in localResult) {
    const error =
      localResult.error instanceof Error ? localResult.error.message : String(localResult.error)
    // 检查是否是 "command not found" 类型的错误
    if (
      error.includes('not found') ||
      error.includes('ENOENT') ||
      error.includes('not recognized')
    ) {
      return { hasGlobal: false, latestVersion, hasUpdate: !!latestVersion }
    }
    // 其他错误（如网络超时等）
    return { hasGlobal: false, latestVersion, hasUpdate: !!latestVersion, error }
  }

  const version = localResult.stdout.trim()
  // 比较版本，判断是否有更新
  const hasUpdate = latestVersion ? compareVersions(latestVersion, version) > 0 : false

  return { hasGlobal: true, version, latestVersion, hasUpdate }
}

/**
 * 获取默认 CLI 命令（异步，带检测）
 *
 * @returns CLI 命令数组，如 `['openspec']` 或 `['npx', '@fission-ai/openspec']`
 */
export async function getDefaultCliCommand(): Promise<readonly string[]> {
  const candidates = buildCliRunnerCandidates({
    userAgent: process.env.npm_config_user_agent,
  }).filter((candidate) => candidate.id !== 'configured')
  const resolved = await resolveCliRunner(candidates, process.cwd(), createCleanCliEnv())
  return resolved.commandParts
}

/**
 * 获取默认 CLI 命令的字符串形式（用于 UI 显示）
 */
export async function getDefaultCliCommandString(): Promise<string> {
  const cmd = await getDefaultCliCommand()
  return commandToString(cmd)
}

export const TerminalConfigSchema = z.object({
  fontSize: z.number().min(8).max(32).default(13),
  fontFamily: z.string().default(''),
  cursorBlink: z.boolean().default(true),
  cursorStyle: z.enum(CURSOR_STYLE_VALUES).default('block'),
  scrollback: z.number().min(0).max(100000).default(1000),
  useTheme: TerminalThemeModeSchema.default(DEFAULT_TERMINAL_THEME_MODE),
  lightTheme: TerminalThemeSchema.default(DEFAULT_TERMINAL_LIGHT_THEME),
  darkTheme: TerminalThemeSchema.default(DEFAULT_TERMINAL_DARK_THEME),
  rendererEngine: TerminalRendererEngineSchema.default('xterm'),
  bellSound: TerminalBellSoundSchema.default(DEFAULT_BELL_SOUND_ID),
  bellVolume: SoundVolumeSchema,
})

export type TerminalConfig = z.infer<typeof TerminalConfigSchema>

export const DashboardConfigSchema = z.object({
  trendPointLimit: z.number().int().min(20).max(500).default(100),
})

export type DashboardConfig = z.infer<typeof DashboardConfigSchema>
export const DEFAULT_GIT_DIFF_EAGER_LINE_BUDGET = 1000
export const GitConfigSchema = z.object({
  diffEagerLineBudget: z
    .number()
    .int()
    .min(0)
    .max(200_000)
    .default(DEFAULT_GIT_DIFF_EAGER_LINE_BUDGET),
})

export type GitConfig = z.infer<typeof GitConfigSchema>
export const CodeEditorConfigSchema = z.object({
  theme: CodeEditorThemeSchema.default('github'),
})
export type CodeEditorConfig = z.infer<typeof CodeEditorConfigSchema>
export const OpsxConfigSchema = z.object({
  agentInvocationMode: OpsxAgentInvocationModeSchema.default('compose'),
})
export type OpsxConfig = z.infer<typeof OpsxConfigSchema>

/**
 * OpenSpecUI 配置 Schema
 *
 * 存储在 openspec/.openspecui.json 中，利用文件监听实现响应式更新
 */
export const OpenSpecUIConfigSchema = z.object({
  /** CLI 命令配置 */
  cli: z
    .object({
      /** CLI 命令前缀 */
      command: z.string().optional(),
      /** CLI 命令参数 */
      args: z.array(z.string()).optional(),
    })
    .default({}),

  /** 主题 */
  theme: z.enum(THEME_VALUES).default('system'),

  /** 代码编辑器配置 */
  codeEditor: CodeEditorConfigSchema.default(CodeEditorConfigSchema.parse({})),

  /** Hosted app 基础 URL（空字符串表示使用官方默认值） */
  appBaseUrl: z.string().default(''),

  /** OPSX workflow invocation preferences */
  opsx: OpsxConfigSchema.default(OpsxConfigSchema.parse({})),

  /** 终端配置 */
  terminal: TerminalConfigSchema.default(TerminalConfigSchema.parse({})),

  /** Dashboard 配置 */
  dashboard: DashboardConfigSchema.default(DashboardConfigSchema.parse({})),

  /** Git detail 配置 */
  git: GitConfigSchema.default(GitConfigSchema.parse({})),

  /** Notification preferences */
  notifications: NotificationSettingsSchema.default(NotificationSettingsSchema.parse({})),

  /** Browser-side document translation preferences */
  translation: DocumentTranslationConfigSchema.default(DocumentTranslationConfigSchema.parse({})),
})

export type OpenSpecUIConfig = z.infer<typeof OpenSpecUIConfigSchema>
export type OpenSpecUIConfigUpdate = {
  cli?: {
    command?: string | null
    args?: string[] | null
  }
  theme?: OpenSpecUIConfig['theme']
  codeEditor?: Partial<OpenSpecUIConfig['codeEditor']>
  appBaseUrl?: OpenSpecUIConfig['appBaseUrl']
  opsx?: Partial<OpsxConfig>
  terminal?: Partial<TerminalConfig>
  dashboard?: Partial<DashboardConfig>
  git?: Partial<GitConfig>
  notifications?: Partial<NotificationSettings>
  translation?: DocumentTranslationConfigUpdate
}

export type PersistedOpenSpecUIConfig = {
  cli?: {
    command?: string
    args?: string[]
  }
  theme?: OpenSpecUIConfig['theme']
  codeEditor?: Partial<OpenSpecUIConfig['codeEditor']>
  appBaseUrl?: OpenSpecUIConfig['appBaseUrl']
  opsx?: Partial<OpsxConfig>
  terminal?: Partial<TerminalConfig>
  dashboard?: Partial<DashboardConfig>
  git?: Partial<GitConfig>
  notifications?: Partial<NotificationSettings>
  translation?: DocumentTranslationConfigUpdate
}

/** 默认配置（静态，用于测试和类型） */
export const DEFAULT_CONFIG: OpenSpecUIConfig = {
  cli: {
    // command 不设置，使用自动检测
  },
  theme: 'system',
  codeEditor: CodeEditorConfigSchema.parse({}),
  appBaseUrl: '',
  opsx: OpsxConfigSchema.parse({}),
  terminal: TerminalConfigSchema.parse({}),
  dashboard: DashboardConfigSchema.parse({}),
  git: GitConfigSchema.parse({}),
  notifications: NotificationSettingsSchema.parse({}),
  translation: DocumentTranslationConfigSchema.parse({}),
}

const PERSISTED_CONFIG_SANITIZE_RULES = [
  { kind: 'object', path: ['cli'], fallback: {} },
  { kind: 'field', path: ['theme'], schema: z.enum(THEME_VALUES), fallback: DEFAULT_CONFIG.theme },
  {
    kind: 'object',
    path: ['codeEditor'],
    fallback: {},
  },
  {
    kind: 'field',
    path: ['codeEditor', 'theme'],
    schema: CodeEditorThemeSchema,
    fallback: DEFAULT_CONFIG.codeEditor.theme,
  },
  {
    kind: 'object',
    path: ['opsx'],
    fallback: {},
  },
  {
    kind: 'field',
    path: ['opsx', 'agentInvocationMode'],
    schema: OpsxAgentInvocationModeSchema,
    fallback: DEFAULT_CONFIG.opsx.agentInvocationMode,
  },
  {
    kind: 'object',
    path: ['terminal'],
    fallback: {},
  },
  {
    kind: 'field',
    path: ['terminal', 'cursorStyle'],
    schema: z.enum(CURSOR_STYLE_VALUES),
    fallback: DEFAULT_CONFIG.terminal.cursorStyle,
  },
  {
    kind: 'field',
    path: ['terminal', 'useTheme'],
    schema: TerminalThemeModeSchema,
    fallback: DEFAULT_CONFIG.terminal.useTheme,
  },
  {
    kind: 'field',
    path: ['terminal', 'lightTheme'],
    schema: TerminalThemeSchema,
    fallback: DEFAULT_CONFIG.terminal.lightTheme,
  },
  {
    kind: 'field',
    path: ['terminal', 'darkTheme'],
    schema: TerminalThemeSchema,
    fallback: DEFAULT_CONFIG.terminal.darkTheme,
  },
  {
    kind: 'field',
    path: ['terminal', 'rendererEngine'],
    schema: TerminalRendererEngineSchema,
    fallback: DEFAULT_CONFIG.terminal.rendererEngine,
  },
  {
    kind: 'field',
    path: ['terminal', 'bellSound'],
    schema: TerminalBellSoundSchema,
    fallback: DEFAULT_CONFIG.terminal.bellSound,
  },
  {
    kind: 'object',
    path: ['notifications'],
    fallback: {},
  },
  {
    kind: 'field',
    path: ['notifications', 'sound'],
    schema: NotificationSettingsSchema.shape.sound,
    fallback: DEFAULT_CONFIG.notifications.sound,
  },
  {
    kind: 'object',
    path: ['translation'],
    fallback: {},
  },
  {
    kind: 'object',
    path: ['translation', 'engines'],
    fallback: {},
  },
  {
    kind: 'object',
    path: ['translation', 'engines', 'local'],
    fallback: {},
  },
  {
    kind: 'object',
    path: ['translation', 'engines', 'localCt2'],
    fallback: {},
  },
  {
    kind: 'object',
    path: ['translation', 'engines', 'openai'],
    fallback: {},
  },
  {
    kind: 'field',
    path: ['translation', 'displayMode'],
    schema: DocumentTranslationConfigSchema.shape.displayMode,
    fallback: DEFAULT_CONFIG.translation.displayMode,
  },
  {
    kind: 'field',
    path: ['translation', 'engineId'],
    schema: DocumentTranslationConfigSchema.shape.engineId,
    fallback: DEFAULT_CONFIG.translation.engineId,
  },
] as const satisfies readonly PersistedSanitizeRule[]

function areStringArraysEqual(
  left: readonly string[] | undefined,
  right: readonly string[] | undefined
): boolean {
  if (left === right) return true
  if (!left || !right) return !left && !right
  if (left.length !== right.length) return false
  return left.every((value, index) => value === right[index])
}

function pruneNullish(value: unknown): unknown {
  if (value === null || value === undefined) {
    return undefined
  }
  if (Array.isArray(value)) {
    return value.map((entry) => pruneNullish(entry)).filter((entry) => entry !== undefined)
  }
  if (typeof value === 'object') {
    const normalizedEntries = Object.entries(value).flatMap(([key, entryValue]) => {
      const nextValue = pruneNullish(entryValue)
      return nextValue === undefined ? [] : [[key, nextValue] as const]
    })
    return Object.fromEntries(normalizedEntries)
  }
  return value
}

function hasOwnEntries(value: object): boolean {
  return Object.keys(value).length > 0
}

function mergeNullablePatch<TBase extends Record<string, unknown>>(
  current: TBase,
  patch: Record<string, unknown> | undefined
): TBase {
  const next: Record<string, unknown> = { ...current }
  if (!patch) return next as TBase
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete next[key]
    } else if (value !== undefined) {
      next[key] = value
    }
  }
  return next as TBase
}

export function toPersistedConfig(
  config: OpenSpecUIConfig,
  options: {
    defaultCliCommandParts?: readonly string[]
  } = {}
): PersistedOpenSpecUIConfig {
  const persisted: PersistedOpenSpecUIConfig = {}

  const command = config.cli.command?.trim()
  const args = (config.cli.args ?? []).map((arg) => arg.trim()).filter(Boolean)
  const cliCommandParts = command ? [command, ...args] : undefined

  if (cliCommandParts && !areStringArraysEqual(cliCommandParts, options.defaultCliCommandParts)) {
    const persistedCommand = cliCommandParts[0]
    persisted.cli =
      args.length > 0 ? { command: persistedCommand, args } : { command: persistedCommand }
  }

  if (config.theme !== DEFAULT_CONFIG.theme) {
    persisted.theme = config.theme
  }

  const codeEditor: NonNullable<PersistedOpenSpecUIConfig['codeEditor']> = {}
  if (config.codeEditor.theme !== DEFAULT_CONFIG.codeEditor.theme) {
    codeEditor.theme = config.codeEditor.theme
  }
  if (hasOwnEntries(codeEditor)) {
    persisted.codeEditor = codeEditor
  }

  if (config.appBaseUrl !== DEFAULT_CONFIG.appBaseUrl) {
    persisted.appBaseUrl = config.appBaseUrl
  }

  const opsx: NonNullable<PersistedOpenSpecUIConfig['opsx']> = {}
  if (config.opsx.agentInvocationMode !== DEFAULT_CONFIG.opsx.agentInvocationMode) {
    opsx.agentInvocationMode = config.opsx.agentInvocationMode
  }
  if (hasOwnEntries(opsx)) {
    persisted.opsx = opsx
  }

  const terminal: NonNullable<PersistedOpenSpecUIConfig['terminal']> = {}
  if (config.terminal.fontSize !== DEFAULT_CONFIG.terminal.fontSize) {
    terminal.fontSize = config.terminal.fontSize
  }
  if (config.terminal.fontFamily !== DEFAULT_CONFIG.terminal.fontFamily) {
    terminal.fontFamily = config.terminal.fontFamily
  }
  if (config.terminal.cursorBlink !== DEFAULT_CONFIG.terminal.cursorBlink) {
    terminal.cursorBlink = config.terminal.cursorBlink
  }
  if (config.terminal.cursorStyle !== DEFAULT_CONFIG.terminal.cursorStyle) {
    terminal.cursorStyle = config.terminal.cursorStyle
  }
  if (config.terminal.scrollback !== DEFAULT_CONFIG.terminal.scrollback) {
    terminal.scrollback = config.terminal.scrollback
  }
  if (config.terminal.useTheme !== DEFAULT_CONFIG.terminal.useTheme) {
    terminal.useTheme = config.terminal.useTheme
  }
  if (config.terminal.lightTheme !== DEFAULT_CONFIG.terminal.lightTheme) {
    terminal.lightTheme = config.terminal.lightTheme
  }
  if (config.terminal.darkTheme !== DEFAULT_CONFIG.terminal.darkTheme) {
    terminal.darkTheme = config.terminal.darkTheme
  }
  if (config.terminal.rendererEngine !== DEFAULT_CONFIG.terminal.rendererEngine) {
    terminal.rendererEngine = config.terminal.rendererEngine
  }
  if (config.terminal.bellSound !== DEFAULT_CONFIG.terminal.bellSound) {
    terminal.bellSound = config.terminal.bellSound
  }
  if (config.terminal.bellVolume !== DEFAULT_CONFIG.terminal.bellVolume) {
    terminal.bellVolume = config.terminal.bellVolume
  }
  if (hasOwnEntries(terminal)) {
    persisted.terminal = terminal
  }

  const dashboard: NonNullable<PersistedOpenSpecUIConfig['dashboard']> = {}
  if (config.dashboard.trendPointLimit !== DEFAULT_CONFIG.dashboard.trendPointLimit) {
    dashboard.trendPointLimit = config.dashboard.trendPointLimit
  }
  if (hasOwnEntries(dashboard)) {
    persisted.dashboard = dashboard
  }

  const git: NonNullable<PersistedOpenSpecUIConfig['git']> = {}
  if (config.git.diffEagerLineBudget !== DEFAULT_CONFIG.git.diffEagerLineBudget) {
    git.diffEagerLineBudget = config.git.diffEagerLineBudget
  }
  if (hasOwnEntries(git)) {
    persisted.git = git
  }

  const notifications: NonNullable<PersistedOpenSpecUIConfig['notifications']> = {}
  if (config.notifications.sound !== DEFAULT_CONFIG.notifications.sound) {
    notifications.sound = config.notifications.sound
  }
  if (config.notifications.volume !== DEFAULT_CONFIG.notifications.volume) {
    notifications.volume = config.notifications.volume
  }
  if (
    config.notifications.systemNotificationsEnabled !==
    DEFAULT_CONFIG.notifications.systemNotificationsEnabled
  ) {
    notifications.systemNotificationsEnabled = config.notifications.systemNotificationsEnabled
  }
  if (hasOwnEntries(notifications)) {
    persisted.notifications = notifications
  }

  const translation: NonNullable<PersistedOpenSpecUIConfig['translation']> = {}
  if (config.translation.enabled !== DEFAULT_CONFIG.translation.enabled) {
    translation.enabled = config.translation.enabled
  }
  if (config.translation.targetLanguage !== DEFAULT_CONFIG.translation.targetLanguage) {
    translation.targetLanguage = config.translation.targetLanguage
  }
  if (config.translation.displayMode !== DEFAULT_CONFIG.translation.displayMode) {
    translation.displayMode = config.translation.displayMode
  }
  if (config.translation.cacheEnabled !== DEFAULT_CONFIG.translation.cacheEnabled) {
    translation.cacheEnabled = config.translation.cacheEnabled
  }
  if (config.translation.engineId !== DEFAULT_CONFIG.translation.engineId) {
    translation.engineId = config.translation.engineId
  }
  const translationEngines: NonNullable<
    NonNullable<PersistedOpenSpecUIConfig['translation']>['engines']
  > = {}
  const localEngine: NonNullable<
    NonNullable<PersistedOpenSpecUIConfig['translation']>['engines']
  >['local'] = {}
  if (config.translation.engines.local.model !== DEFAULT_CONFIG.translation.engines.local.model) {
    localEngine.model = config.translation.engines.local.model
  }
  if (
    config.translation.engines.local.selectedGroupId !==
    DEFAULT_CONFIG.translation.engines.local.selectedGroupId
  ) {
    localEngine.selectedGroupId = config.translation.engines.local.selectedGroupId
  }
  if (localEngine && hasOwnEntries(localEngine)) {
    translationEngines.local = localEngine
  }
  const localCt2Engine: NonNullable<
    NonNullable<PersistedOpenSpecUIConfig['translation']>['engines']
  >['localCt2'] = {}
  if (
    config.translation.engines.localCt2.model !== DEFAULT_CONFIG.translation.engines.localCt2.model
  ) {
    localCt2Engine.model = config.translation.engines.localCt2.model
  }
  if (
    config.translation.engines.localCt2.selectedGroupId !==
    DEFAULT_CONFIG.translation.engines.localCt2.selectedGroupId
  ) {
    localCt2Engine.selectedGroupId = config.translation.engines.localCt2.selectedGroupId
  }
  if (localCt2Engine && hasOwnEntries(localCt2Engine)) {
    translationEngines.localCt2 = localCt2Engine
  }
  if (config.translation.engines.openai.model !== DEFAULT_CONFIG.translation.engines.openai.model) {
    translationEngines.openai = { model: config.translation.engines.openai.model }
  }
  if (hasOwnEntries(translationEngines)) {
    translation.engines = translationEngines
  }
  if (hasOwnEntries(translation)) {
    persisted.translation = translation
  }

  return persisted
}

function isPersistedConfigEmpty(config: PersistedOpenSpecUIConfig): boolean {
  return !hasOwnEntries(config)
}

/**
 * 配置管理器
 *
 * 负责读写 openspec/.openspecui.json 配置文件。
 * 读取操作使用 reactiveReadFile，支持响应式更新。
 *
 * `.openspecui.json` 是预期中的项目级 UI 配置文件，但只有显式偏离默认值的
 * override 才会落盘。仅启动 openspecui 或仅依赖默认配置时，不应触发文件写入。
 */
export class ConfigManager {
  private configPath: string
  private projectDir: string
  private resolvedRunner: ResolvedCliRunner | null = null
  private resolvingRunnerPromise: Promise<ResolvedCliRunner> | null = null

  constructor(projectDir: string) {
    this.projectDir = projectDir
    this.configPath = join(projectDir, 'openspec', '.openspecui.json')
  }

  private parseConfigContent(content: string | null): OpenSpecUIConfig {
    if (!content) {
      return DEFAULT_CONFIG
    }

    try {
      const parsed = JSON.parse(content)
      const normalized = pruneNullish(parsed) ?? {}
      const sanitized = sanitizePersistedSettings(normalized, PERSISTED_CONFIG_SANITIZE_RULES)
      const result = OpenSpecUIConfigSchema.safeParse(sanitized)

      if (result.success) {
        return result.data
      }

      console.warn('Invalid config format, using defaults:', result.error.message)
      return DEFAULT_CONFIG
    } catch (err) {
      console.warn('Failed to parse config, using defaults:', err)
      return DEFAULT_CONFIG
    }
  }

  /**
   * 读取配置（响应式）
   *
   * 如果配置文件不存在，返回默认配置。
   * 如果配置文件格式错误，返回默认配置并打印警告。
   */
  async readConfig(): Promise<OpenSpecUIConfig> {
    const content = await reactiveReadFile(this.configPath)
    return this.parseConfigContent(content)
  }

  /**
   * 写入配置
   *
   * 会触发文件监听，自动更新订阅者。
   */
  async writeConfig(config: OpenSpecUIConfigUpdate): Promise<void> {
    const currentContent = await reactiveReadFile(this.configPath)
    const fileExists = currentContent !== null
    const current = this.parseConfigContent(currentContent)
    const nextCli = { ...current.cli }
    if (config.cli && Object.prototype.hasOwnProperty.call(config.cli, 'command')) {
      const raw = config.cli.command
      const trimmed = raw?.trim()
      if (trimmed) {
        nextCli.command = trimmed
      } else {
        delete nextCli.command
        delete nextCli.args
      }
    }
    if (config.cli && Object.prototype.hasOwnProperty.call(config.cli, 'args')) {
      const args = (config.cli.args ?? []).map((arg) => arg.trim()).filter(Boolean)
      if (args.length > 0) {
        nextCli.args = args
      } else {
        delete nextCli.args
      }
    }
    if (!nextCli.command) {
      delete nextCli.args
    }
    const merged = {
      ...current,
      cli: nextCli,
      theme: config.theme ?? current.theme,
      codeEditor: { ...current.codeEditor, ...config.codeEditor },
      appBaseUrl: config.appBaseUrl ?? current.appBaseUrl,
      opsx: { ...current.opsx, ...config.opsx },
      terminal: { ...current.terminal, ...config.terminal },
      dashboard: { ...current.dashboard, ...config.dashboard },
      git: { ...current.git, ...config.git },
      notifications: { ...current.notifications, ...config.notifications },
      translation: {
        ...current.translation,
        ...config.translation,
        engines: {
          local: mergeNullablePatch(
            current.translation.engines.local,
            config.translation?.engines?.local
          ),
          localCt2: mergeNullablePatch(
            current.translation.engines.localCt2,
            config.translation?.engines?.localCt2
          ),
          openai: mergeNullablePatch(
            current.translation.engines.openai,
            config.translation?.engines?.openai
          ),
        },
      },
    }

    const persisted = toPersistedConfig(merged)

    if (isPersistedConfigEmpty(persisted) && !fileExists) {
      return
    }

    const serialized = isPersistedConfigEmpty(persisted) ? '{}' : JSON.stringify(persisted, null, 2)

    if (currentContent === serialized) {
      return
    }

    await mkdir(dirname(this.configPath), { recursive: true })
    await writeFile(this.configPath, serialized, 'utf-8')
    updateReactiveFileCache(this.configPath, serialized)
    this.invalidateResolvedCliRunner()
  }

  private async resolveDefaultCliCommandParts(): Promise<readonly string[]> {
    const candidates = buildCliRunnerCandidates({
      userAgent: process.env.npm_config_user_agent,
    }).filter((candidate) => candidate.id !== 'configured')
    const resolved = await resolveCliRunner(candidates, this.projectDir, createCleanCliEnv())
    return resolved.commandParts
  }

  private async isDefaultCliCommand(commandParts: readonly string[]): Promise<boolean> {
    try {
      const defaultCommandParts = await this.resolveDefaultCliCommandParts()
      return areStringArraysEqual(commandParts, defaultCommandParts)
    } catch {
      return false
    }
  }

  /**
   * 解析并缓存可用 CLI runner。
   */
  private async resolveCliRunner(): Promise<ResolvedCliRunner> {
    if (this.resolvedRunner) {
      return this.resolvedRunner
    }
    if (this.resolvingRunnerPromise) {
      return this.resolvingRunnerPromise
    }
    this.resolvingRunnerPromise = this.resolveCliRunnerUncached()
      .then((runner) => {
        this.resolvedRunner = runner
        return runner
      })
      .finally(() => {
        this.resolvingRunnerPromise = null
      })
    return this.resolvingRunnerPromise
  }

  private async resolveCliRunnerUncached(): Promise<ResolvedCliRunner> {
    const config = await this.readConfig()
    const configuredCommandParts = this.getConfiguredCommandParts(config.cli)
    const hasConfiguredCommand = configuredCommandParts.length > 0
    const candidates = hasConfiguredCommand
      ? [
          {
            id: 'configured' as const,
            source: 'config.cli.command',
            commandParts: configuredCommandParts,
          },
        ]
      : buildCliRunnerCandidates({
          configuredCommandParts,
          userAgent: process.env.npm_config_user_agent,
        })
    const resolved = await resolveCliRunner(candidates, this.projectDir, createCleanCliEnv())

    return resolved
  }

  /**
   * 获取 CLI 命令（数组形式）
   */
  async getCliCommand(): Promise<readonly string[]> {
    const resolved = await this.resolveCliRunner()
    return resolved.commandParts
  }

  /**
   * 获取 CLI 命令的字符串形式（用于 UI 显示）
   */
  async getCliCommandString(): Promise<string> {
    const resolved = await this.resolveCliRunner()
    return resolved.command
  }

  /**
   * 获取 CLI 解析结果（用于诊断）
   */
  async getResolvedCliRunner(): Promise<ResolvedCliRunner> {
    return this.resolveCliRunner()
  }

  /**
   * 清理 CLI 解析缓存（用于 ENOENT 自愈）
   */
  invalidateResolvedCliRunner(): void {
    this.resolvedRunner = null
    this.resolvingRunnerPromise = null
  }

  /**
   * 设置 CLI 命令
   */
  async setCliCommand(command: string): Promise<void> {
    const trimmed = command.trim()
    if (!trimmed) {
      await this.writeConfig({ cli: { command: null, args: null } })
      return
    }
    const commandParts = parseCliCommand(trimmed)
    if (commandParts.length === 0) {
      await this.writeConfig({ cli: { command: null, args: null } })
      return
    }
    if (await this.isDefaultCliCommand(commandParts)) {
      await this.writeConfig({ cli: { command: null, args: null } })
      return
    }
    const [resolvedCommand, ...resolvedArgs] = commandParts
    await this.writeConfig({
      cli: {
        command: resolvedCommand,
        args: resolvedArgs,
      },
    })
  }

  private getConfiguredCommandParts(cli: OpenSpecUIConfig['cli']): string[] {
    const command = cli.command?.trim()
    if (!command) return []
    if (Array.isArray(cli.args) && cli.args.length > 0) {
      return [command, ...cli.args]
    }
    return parseCliCommand(command)
  }

  /**
   * 设置主题
   */
  async setTheme(theme: OpenSpecUIConfig['theme']): Promise<void> {
    await this.writeConfig({ theme })
  }

  /**
   * 设置终端配置（部分更新）
   */
  async setTerminalConfig(terminal: Partial<TerminalConfig>): Promise<void> {
    await this.writeConfig({ terminal })
  }
}
