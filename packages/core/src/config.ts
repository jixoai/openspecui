import { writeFile } from 'fs/promises'
import { exec } from 'child_process'
import { promisify } from 'util'
import { join } from 'path'
import { z } from 'zod'
import { reactiveReadFile } from './reactive-fs/index.js'

const execAsync = promisify(exec)

/** 默认的 fallback CLI 命令（数组形式） */
const FALLBACK_CLI_COMMAND: readonly string[] = ['npx', '@fission-ai/openspec']

/** 全局 openspec 命令（数组形式） */
const GLOBAL_CLI_COMMAND: readonly string[] = ['openspec']

/** 缓存检测到的 CLI 命令 */
let detectedCliCommand: readonly string[] | null = null

/**
 * 解析 CLI 命令字符串为数组
 *
 * 支持两种格式：
 * 1. JSON 数组：以 `[` 开头，如 `["npx", "@fission-ai/openspec"]`
 * 2. 简单字符串：用空格分割，如 `npx @fission-ai/openspec`
 *
 * 注意：简单字符串解析不支持带引号的参数，如需复杂命令请使用 JSON 数组格式
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
      throw new Error(`Failed to parse CLI command as JSON array: ${err instanceof Error ? err.message : err}`)
    }
  }

  // 简单字符串格式：用空白字符分割
  // 这是一个简化的解析，不处理引号等复杂情况
  return trimmed.split(/\s+/).filter(Boolean)
}

/** CLI 嗅探结果 */
export interface CliSniffResult {
  /** 是否存在全局 openspec 命令 */
  hasGlobal: boolean
  /** 全局命令的版本（仅当 hasGlobal 为 true 时有值） */
  version?: string
  /** 错误信息（如果检测失败） */
  error?: string
}

/**
 * 嗅探全局 openspec 命令（无缓存）
 *
 * 使用 `openspec --version` 检测是否有全局命令可用。
 * 每次调用都会重新检测，不使用缓存。
 */
export async function sniffGlobalCli(): Promise<CliSniffResult> {
  try {
    const { stdout } = await execAsync('openspec --version', { timeout: 10000 })
    const version = stdout.trim()
    // 更新缓存
    detectedCliCommand = GLOBAL_CLI_COMMAND
    return { hasGlobal: true, version }
  } catch (err) {
    // 全局命令不存在或执行失败
    // 不更新缓存，保留之前的值
    const error = err instanceof Error ? err.message : String(err)
    // 检查是否是 "command not found" 类型的错误
    if (error.includes('not found') || error.includes('ENOENT') || error.includes('not recognized')) {
      return { hasGlobal: false }
    }
    // 其他错误（如网络超时等）
    return { hasGlobal: false, error }
  }
}

/**
 * 检测全局安装的 openspec 命令
 * 优先使用全局命令，fallback 到 npx
 *
 * @returns CLI 命令数组
 */
async function detectCliCommand(): Promise<readonly string[]> {
  if (detectedCliCommand !== null) {
    return detectedCliCommand
  }

  try {
    // 尝试检测全局 openspec 命令
    const whichCmd = process.platform === 'win32' ? 'where' : 'which'
    await execAsync(`${whichCmd} openspec`)
    detectedCliCommand = GLOBAL_CLI_COMMAND
    return detectedCliCommand
  } catch {
    // 全局命令不存在，使用 npx
    detectedCliCommand = FALLBACK_CLI_COMMAND
    return detectedCliCommand
  }
}

/**
 * 获取默认 CLI 命令（异步，带检测）
 *
 * @returns CLI 命令数组，如 `['openspec']` 或 `['npx', '@fission-ai/openspec']`
 */
export async function getDefaultCliCommand(): Promise<readonly string[]> {
  return detectCliCommand()
}

/**
 * 获取默认 CLI 命令的字符串形式（用于 UI 显示）
 */
export async function getDefaultCliCommandString(): Promise<string> {
  const cmd = await detectCliCommand()
  return cmd.join(' ')
}

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
    })
    .default({}),

  /** UI 配置 */
  ui: z
    .object({
      /** 主题 */
      theme: z.enum(['light', 'dark', 'system']).default('system'),
    })
    .default({}),
})

export type OpenSpecUIConfig = z.infer<typeof OpenSpecUIConfigSchema>

/** 默认配置（静态，用于测试和类型） */
export const DEFAULT_CONFIG: OpenSpecUIConfig = {
  cli: {
    // command 不设置，使用自动检测
  },
  ui: {
    theme: 'system',
  },
}

/**
 * 配置管理器
 *
 * 负责读写 openspec/.openspecui.json 配置文件。
 * 读取操作使用 reactiveReadFile，支持响应式更新。
 */
export class ConfigManager {
  private configPath: string

  constructor(projectDir: string) {
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
  async writeConfig(config: Partial<OpenSpecUIConfig>): Promise<void> {
    const current = await this.readConfig()
    const merged = {
      ...current,
      ...config,
      cli: { ...current.cli, ...config.cli },
      ui: { ...current.ui, ...config.ui },
    }

    await writeFile(this.configPath, JSON.stringify(merged, null, 2), 'utf-8')
  }

  /**
   * 获取 CLI 命令（数组形式）
   *
   * 优先级：配置文件 > 全局 openspec 命令 > npx fallback
   *
   * @returns CLI 命令数组，如 `['openspec']` 或 `['npx', '@fission-ai/openspec']`
   */
  async getCliCommand(): Promise<readonly string[]> {
    const config = await this.readConfig()
    // 如果配置文件中设置了 command，解析并使用配置的值
    if (config.cli.command) {
      return parseCliCommand(config.cli.command)
    }
    // 否则检测并使用默认值
    return getDefaultCliCommand()
  }

  /**
   * 获取 CLI 命令的字符串形式（用于 UI 显示）
   */
  async getCliCommandString(): Promise<string> {
    const cmd = await this.getCliCommand()
    return cmd.join(' ')
  }

  /**
   * 设置 CLI 命令
   */
  async setCliCommand(command: string): Promise<void> {
    await this.writeConfig({ cli: { command } })
  }
}
