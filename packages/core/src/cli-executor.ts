import { spawn } from 'child_process'
import type { ConfigManager } from './config.js'

/** CLI 执行结果 */
export interface CliResult {
  success: boolean
  stdout: string
  stderr: string
  exitCode: number | null
}

/** CLI 流式输出事件 */
export interface CliStreamEvent {
  type: 'command' | 'stdout' | 'stderr' | 'exit'
  data?: string
  exitCode?: number | null
}

/**
 * CLI 执行器
 *
 * 负责调用外部 openspec CLI 命令。
 * 命令前缀从 ConfigManager 获取，支持：
 * - ['npx', '@fission-ai/openspec'] (默认)
 * - ['openspec'] (全局安装)
 * - 自定义数组或字符串
 *
 * 注意：所有命令都使用 shell: false 执行，避免 shell 注入风险
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
   * 构建完整命令数组
   *
   * @param args CLI 参数，如 ['init'] 或 ['archive', 'change-id']
   * @returns [command, ...commandArgs, ...args]
   */
  private async buildCommandArray(args: string[]): Promise<string[]> {
    const commandParts = await this.configManager.getCliCommand()
    return [...commandParts, ...args]
  }

  /**
   * 执行 CLI 命令
   *
   * @param args CLI 参数，如 ['init'] 或 ['archive', 'change-id']
   * @returns 执行结果
   */
  async execute(args: string[]): Promise<CliResult> {
    const fullCommand = await this.buildCommandArray(args)
    const [cmd, ...cmdArgs] = fullCommand

    return new Promise((resolve) => {
      const child = spawn(cmd, cmdArgs, {
        cwd: this.projectDir,
        shell: false,
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
    // CLI 格式是 `--tools <value>`，不是 `--tools=<value>`
    return this.execute(['init', '--tools', toolsArg])
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
   * 流式执行 openspec validate
   */
  validateStream(
    type: 'spec' | 'change' | undefined,
    id: string | undefined,
    onEvent: (event: CliStreamEvent) => void
  ): Promise<() => void> {
    const args = ['validate']
    if (type) args.push(type)
    if (id) args.push(id)
    return this.executeStream(args, onEvent)
  }

  /**
   * 检查 CLI 是否可用
   * @param timeout 超时时间（毫秒），默认 10 秒
   */
  async checkAvailability(timeout = 10000): Promise<{ available: boolean; version?: string; error?: string }> {
    try {
      const result = await Promise.race([
        this.execute(['--version']),
        new Promise<CliResult>((_, reject) =>
          setTimeout(() => reject(new Error('CLI check timed out')), timeout)
        ),
      ])
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

  /**
   * 流式执行 CLI 命令
   *
   * @param args CLI 参数
   * @param onEvent 事件回调
   * @returns 取消函数
   */
  async executeStream(
    args: string[],
    onEvent: (event: CliStreamEvent) => void
  ): Promise<() => void> {
    const fullCommand = await this.buildCommandArray(args)
    const [cmd, ...cmdArgs] = fullCommand

    // 首先发送正在执行的命令（用于 UI 显示）
    onEvent({ type: 'command', data: fullCommand.join(' ') })

    const child = spawn(cmd, cmdArgs, {
      cwd: this.projectDir,
      shell: false,
      env: this.getCleanEnv(),
    })

    child.stdout?.on('data', (data) => {
      onEvent({ type: 'stdout', data: data.toString() })
    })

    child.stderr?.on('data', (data) => {
      onEvent({ type: 'stderr', data: data.toString() })
    })

    child.on('close', (exitCode) => {
      onEvent({ type: 'exit', exitCode })
    })

    child.on('error', (err) => {
      onEvent({ type: 'stderr', data: err.message })
      onEvent({ type: 'exit', exitCode: null })
    })

    // 返回取消函数
    return () => {
      child.kill()
    }
  }

  /**
   * 流式执行 openspec init
   */
  initStream(
    tools: string[] | 'all' | 'none',
    onEvent: (event: CliStreamEvent) => void
  ): Promise<() => void> {
    const toolsArg = Array.isArray(tools) ? tools.join(',') : tools
    // CLI 格式是 `--tools <value>`，不是 `--tools=<value>`
    return this.executeStream(['init', '--tools', toolsArg], onEvent)
  }

  /**
   * 流式执行 openspec archive
   */
  archiveStream(
    changeId: string,
    options: { skipSpecs?: boolean; noValidate?: boolean },
    onEvent: (event: CliStreamEvent) => void
  ): Promise<() => void> {
    const args = ['archive', '-y', changeId]
    if (options.skipSpecs) args.push('--skip-specs')
    if (options.noValidate) args.push('--no-validate')
    return this.executeStream(args, onEvent)
  }

  /**
   * 流式执行任意命令（数组形式）
   *
   * 用于执行不需要 openspec CLI 前缀的命令，如 npm install。
   * 使用 shell: false 避免 shell 注入风险。
   *
   * @param command 命令数组，如 ['npm', 'install', '-g', '@fission-ai/openspec']
   * @param onEvent 事件回调
   * @returns 取消函数
   */
  executeCommandStream(
    command: readonly string[],
    onEvent: (event: CliStreamEvent) => void
  ): () => void {
    const [cmd, ...cmdArgs] = command

    // 首先发送正在执行的命令（用于 UI 显示）
    onEvent({ type: 'command', data: command.join(' ') })

    const child = spawn(cmd, cmdArgs, {
      cwd: this.projectDir,
      shell: false,
      env: this.getCleanEnv(),
    })

    child.stdout?.on('data', (data) => {
      onEvent({ type: 'stdout', data: data.toString() })
    })

    child.stderr?.on('data', (data) => {
      onEvent({ type: 'stderr', data: data.toString() })
    })

    child.on('close', (exitCode) => {
      onEvent({ type: 'exit', exitCode })
    })

    child.on('error', (err) => {
      onEvent({ type: 'stderr', data: err.message })
      onEvent({ type: 'exit', exitCode: null })
    })

    // 返回取消函数
    return () => {
      child.kill()
    }
  }
}
