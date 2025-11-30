import { spawn } from 'child_process'
import type { ConfigManager } from './config.js'

/** CLI 执行结果 */
export interface CliResult {
  success: boolean
  stdout: string
  stderr: string
  exitCode: number | null
}

/**
 * CLI 执行器
 *
 * 负责调用外部 openspec CLI 命令。
 * 命令前缀从 ConfigManager 获取，支持：
 * - npx openspec (默认)
 * - bunx openspec
 * - openspec (本地安装)
 * - 自定义命令 (如 xspec)
 */
export class CliExecutor {
  constructor(
    private configManager: ConfigManager,
    private projectDir: string
  ) {}

  /**
   * 创建干净的环境变量，移除 pnpm 特有的配置
   * 避免 pnpm 环境变量污染 npx/npm 执行
   */
  private getCleanEnv(): NodeJS.ProcessEnv {
    const env = { ...process.env }
    // 移除 pnpm 特有的 npm_config_* 变量，避免污染 npx/npm
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

  /**
   * 执行 CLI 命令
   *
   * @param args CLI 参数，如 ['init'] 或 ['archive', 'change-id']
   * @returns 执行结果
   */
  async execute(args: string[]): Promise<CliResult> {
    const command = await this.configManager.getCliCommand()
    const parts = command.split(/\s+/)
    const cmd = parts[0]
    const cmdArgs = [...parts.slice(1), ...args]

    return new Promise((resolve) => {
      const child = spawn(cmd, cmdArgs, {
        cwd: this.projectDir,
        shell: true,
        env: this.getCleanEnv(),
      })

      let stdout = ''
      let stderr = ''

      child.stdout?.on('data', (data) => {
        stdout += data.toString()
      })

      child.stderr?.on('data', (data) => {
        stderr += data.toString()
      })

      child.on('close', (exitCode) => {
        resolve({
          success: exitCode === 0,
          stdout,
          stderr,
          exitCode,
        })
      })

      child.on('error', (err) => {
        resolve({
          success: false,
          stdout,
          stderr: stderr + '\n' + err.message,
          exitCode: null,
        })
      })
    })
  }

  /**
   * 执行 openspec init（非交互式）
   *
   * @param tools 工具列表，如 ['claude', 'cursor'] 或 'all' 或 'none'
   */
  async init(tools: string[] | 'all' | 'none' = 'all'): Promise<CliResult> {
    const toolsArg = Array.isArray(tools) ? tools.join(',') : tools
    return this.execute(['init', `--tools=${toolsArg}`])
  }

  /**
   * 执行 openspec archive <changeId>（非交互式）
   *
   * @param changeId 要归档的 change ID
   * @param options 选项
   */
  async archive(
    changeId: string,
    options: { skipSpecs?: boolean; noValidate?: boolean } = {}
  ): Promise<CliResult> {
    const args = ['archive', '-y', changeId]
    if (options.skipSpecs) args.push('--skip-specs')
    if (options.noValidate) args.push('--no-validate')
    return this.execute(args)
  }

  /**
   * 执行 openspec validate [type] [id]
   */
  async validate(type?: 'spec' | 'change', id?: string): Promise<CliResult> {
    const args = ['validate']
    if (type) args.push(type)
    if (id) args.push(id)
    return this.execute(args)
  }

  /**
   * 检查 CLI 是否可用
   */
  async checkAvailability(): Promise<{ available: boolean; version?: string; error?: string }> {
    try {
      const result = await this.execute(['--version'])
      if (result.success) {
        return {
          available: true,
          version: result.stdout.trim(),
        }
      }
      return {
        available: false,
        error: result.stderr || 'Unknown error',
      }
    } catch (err) {
      return {
        available: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }
    }
  }
}
