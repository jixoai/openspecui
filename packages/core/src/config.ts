import { writeFile } from 'fs/promises'
import { join } from 'path'
import { z } from 'zod'
import { reactiveReadFile } from './reactive-fs/index.js'

/**
 * OpenSpecUI 配置 Schema
 *
 * 存储在 openspec/.openspecui.json 中，利用文件监听实现响应式更新
 */
export const OpenSpecUIConfigSchema = z.object({
  /** CLI 命令配置 */
  cli: z
    .object({
      /** CLI 命令前缀，默认 'npx openspec' */
      command: z.string().default('npx openspec'),
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

/** 默认配置 */
export const DEFAULT_CONFIG: OpenSpecUIConfig = {
  cli: {
    command: 'npx openspec',
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
   * 获取 CLI 命令
   */
  async getCliCommand(): Promise<string> {
    const config = await this.readConfig()
    return config.cli.command
  }

  /**
   * 设置 CLI 命令
   */
  async setCliCommand(command: string): Promise<void> {
    await this.writeConfig({ cli: { command } })
  }
}
