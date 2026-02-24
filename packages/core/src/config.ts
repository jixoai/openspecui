import { exec, spawn } from 'child_process'
import { mkdir, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { promisify } from 'util'
import { z } from 'zod'
import { reactiveReadFile, updateReactiveFileCache } from './reactive-fs/index.js'

const execAsync = promisify(exec)

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
export const TerminalRendererEngineSchema = z.enum(TERMINAL_RENDERER_ENGINE_VALUES)
export type TerminalRendererEngine = z.infer<typeof TerminalRendererEngineSchema>
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
  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let timedOut = false

    const timer = setTimeout(() => {
      timedOut = true
      child.kill()
    }, CLI_PROBE_TIMEOUT_MS)

    const child = spawn(cmd, [...cmdArgs, '--version'], {
      cwd,
      shell: false,
      env,
    })

    child.stdout?.on('data', (data) => {
      stdout += data.toString()
    })
    child.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('error', (err) => {
      clearTimeout(timer)
      const code = (err as NodeJS.ErrnoException).code
      const suffix = code ? ` (${code})` : ''
      resolve({
        source: candidate.source,
        command: commandToString(candidate.commandParts),
        success: false,
        error: `${err.message}${suffix}`,
        exitCode: null,
      })
    })

    child.on('close', (exitCode) => {
      clearTimeout(timer)
      if (timedOut) {
        resolve({
          source: candidate.source,
          command: commandToString(candidate.commandParts),
          success: false,
          error: 'CLI probe timed out',
          exitCode,
        })
        return
      }
      if (exitCode === 0) {
        const version = stdout.trim().split('\n')[0] || undefined
        resolve({
          source: candidate.source,
          command: commandToString(candidate.commandParts),
          success: true,
          version,
          exitCode,
        })
        return
      }
      resolve({
        source: candidate.source,
        command: commandToString(candidate.commandParts),
        success: false,
        error: stderr.trim() || `Exit code ${exitCode ?? 'null'}`,
        exitCode,
      })
    })
  })
}

async function resolveCliRunner(
  candidates: readonly CliRunnerCandidate[],
  cwd: string,
  env: NodeJS.ProcessEnv
): Promise<ResolvedCliRunner> {
  const attempts: CliRunnerAttempt[] = []
  for (const candidate of candidates) {
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
  // 并行获取本地版本和最新版本
  const [localResult, latestVersion] = await Promise.all([
    execAsync('openspec --version', { timeout: 10000 }).catch((err) => ({ error: err })),
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
  rendererEngine: z.string().default('xterm'),
})

export type TerminalConfig = z.infer<typeof TerminalConfigSchema>

export const DashboardConfigSchema = z.object({
  trendPointLimit: z.number().int().min(20).max(500).default(100),
})

export type DashboardConfig = z.infer<typeof DashboardConfigSchema>
export const CodeEditorConfigSchema = z.object({
  theme: CodeEditorThemeSchema.default('github'),
})
export type CodeEditorConfig = z.infer<typeof CodeEditorConfigSchema>

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

  /** 终端配置 */
  terminal: TerminalConfigSchema.default(TerminalConfigSchema.parse({})),

  /** Dashboard 配置 */
  dashboard: DashboardConfigSchema.default(DashboardConfigSchema.parse({})),
})

export type OpenSpecUIConfig = z.infer<typeof OpenSpecUIConfigSchema>
export type OpenSpecUIConfigUpdate = {
  cli?: {
    command?: string | null
    args?: string[] | null
  }
  theme?: OpenSpecUIConfig['theme']
  codeEditor?: Partial<OpenSpecUIConfig['codeEditor']>
  terminal?: Partial<TerminalConfig>
  dashboard?: Partial<DashboardConfig>
}

/** 默认配置（静态，用于测试和类型） */
export const DEFAULT_CONFIG: OpenSpecUIConfig = {
  cli: {
    // command 不设置，使用自动检测
  },
  theme: 'system',
  codeEditor: CodeEditorConfigSchema.parse({}),
  terminal: TerminalConfigSchema.parse({}),
  dashboard: DashboardConfigSchema.parse({}),
}

/**
 * 配置管理器
 *
 * 负责读写 openspec/.openspecui.json 配置文件。
 * 读取操作使用 reactiveReadFile，支持响应式更新。
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

  /**
   * 读取配置（响应式）
   *
   * 如果配置文件不存在，返回默认配置。
   * 如果配置文件格式错误，返回默认配置并打印警告。
   */
  async readConfig(): Promise<OpenSpecUIConfig> {
    const content = await reactiveReadFile(this.configPath)

    if (!content) {
      return DEFAULT_CONFIG
    }

    try {
      const parsed = JSON.parse(content)
      const result = OpenSpecUIConfigSchema.safeParse(parsed)

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
   * 写入配置
   *
   * 会触发文件监听，自动更新订阅者。
   */
  async writeConfig(config: OpenSpecUIConfigUpdate): Promise<void> {
    const current = await this.readConfig()
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
      terminal: { ...current.terminal, ...config.terminal },
      dashboard: { ...current.dashboard, ...config.dashboard },
    }
    const serialized = JSON.stringify(merged, null, 2)
    await mkdir(dirname(this.configPath), { recursive: true })
    await writeFile(this.configPath, serialized, 'utf-8')
    updateReactiveFileCache(this.configPath, serialized)
    this.invalidateResolvedCliRunner()
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

    if (!hasConfiguredCommand) {
      const [resolvedCommand, ...resolvedArgs] = resolved.commandParts
      const currentCommand = config.cli.command?.trim()
      const currentArgs = config.cli.args ?? []
      if (
        currentCommand !== resolvedCommand ||
        currentArgs.length !== resolvedArgs.length ||
        currentArgs.some((arg, index) => arg !== resolvedArgs[index])
      ) {
        try {
          await this.writeConfig({ cli: { command: resolvedCommand, args: resolvedArgs } })
        } catch (err) {
          // Runner resolution must not fail when config persistence cannot be initialized.
          console.warn('Failed to persist auto-detected CLI command:', err)
        }
      }
    }
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
