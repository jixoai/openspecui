import { spawn, type ChildProcess } from 'child_process'
import { createCleanCliEnv, type ConfigManager } from './config.js'

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

interface CliResultInternal extends CliResult {
  errorCode?: string
}

/**
 * CLI 执行器
 *
 * 负责调用外部 openspec CLI 命令，统一通过 ConfigManager 的 runner 解析结果执行。
 * 所有命令都使用 shell: false，避免 shell 注入风险。
 */
export class CliExecutor {
  constructor(
    private configManager: ConfigManager,
    private projectDir: string
  ) {}

  private async buildCommandArray(args: string[]): Promise<string[]> {
    const commandParts = await this.configManager.getCliCommand()
    return [...commandParts, ...args]
  }

  private runCommandOnce(fullCommand: readonly string[]): Promise<CliResultInternal> {
    const [cmd, ...cmdArgs] = fullCommand
    return new Promise((resolve) => {
      const child = spawn(cmd, cmdArgs, {
        cwd: this.projectDir,
        shell: false,
        env: createCleanCliEnv(),
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
        const errorCode = (err as NodeJS.ErrnoException).code
        const errorMessage = err.message + (errorCode ? ` (${errorCode})` : '')
        resolve({
          success: false,
          stdout,
          stderr: stderr ? `${stderr}\n${errorMessage}` : errorMessage,
          exitCode: null,
          errorCode,
        })
      })
    })
  }

  private async executeInternal(args: string[], allowRetry: boolean): Promise<CliResult> {
    let fullCommand: string[]
    try {
      fullCommand = await this.buildCommandArray(args)
    } catch (err) {
      return {
        success: false,
        stdout: '',
        stderr: err instanceof Error ? err.message : String(err),
        exitCode: null,
      }
    }

    const result = await this.runCommandOnce(fullCommand)
    if (allowRetry && result.errorCode === 'ENOENT') {
      this.configManager.invalidateResolvedCliRunner()
      return this.executeInternal(args, false)
    }
    return {
      success: result.success,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    }
  }

  /**
   * 执行 CLI 命令
   */
  async execute(args: string[]): Promise<CliResult> {
    return this.executeInternal(args, true)
  }

  /**
   * 执行 openspec init（非交互式）
   */
  async init(tools: string[] | 'all' | 'none' = 'all'): Promise<CliResult> {
    const toolsArg = Array.isArray(tools) ? tools.join(',') : tools
    return this.execute(['init', '--tools', toolsArg])
  }

  /**
   * 执行 openspec archive <changeId>（非交互式）
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
   * 执行 openspec schemas --json
   */
  async schemas(): Promise<CliResult> {
    return this.execute(['schemas', '--json'])
  }

  /**
   * 执行 openspec schema which <name> --json
   */
  async schemaWhich(name: string): Promise<CliResult> {
    return this.execute(['schema', 'which', name, '--json'])
  }

  /**
   * 执行 openspec templates --json [--schema <name>]
   */
  async templates(schema?: string): Promise<CliResult> {
    const args = ['templates', '--json']
    if (schema) args.push('--schema', schema)
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
   */
  async checkAvailability(timeout = 10000): Promise<{
    available: boolean
    version?: string
    error?: string
    effectiveCommand?: string
    tried?: string[]
  }> {
    try {
      const resolved = await Promise.race([
        this.configManager.getResolvedCliRunner(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('CLI runner resolve timed out')), timeout)
        ),
      ])

      const versionResult = await Promise.race([
        this.runCommandOnce([...resolved.commandParts, '--version']),
        new Promise<CliResultInternal>((_, reject) =>
          setTimeout(() => reject(new Error('CLI check timed out')), timeout)
        ),
      ])

      if (versionResult.success) {
        return {
          available: true,
          version: versionResult.stdout.trim() || resolved.version,
          effectiveCommand: resolved.command,
          tried: resolved.attempts.map((attempt) => attempt.command),
        }
      }

      return {
        available: false,
        error: versionResult.stderr || 'Unknown error',
        effectiveCommand: resolved.command,
        tried: resolved.attempts.map((attempt) => attempt.command),
      }
    } catch (err) {
      return {
        available: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  /**
   * 流式执行 CLI 命令
   */
  async executeStream(
    args: string[],
    onEvent: (event: CliStreamEvent) => void
  ): Promise<() => void> {
    let cancelled = false
    let activeChild: ChildProcess | null = null

    const start = async (allowRetry: boolean): Promise<void> => {
      if (cancelled) return

      let fullCommand: string[]
      try {
        fullCommand = await this.buildCommandArray(args)
      } catch (err) {
        onEvent({ type: 'stderr', data: err instanceof Error ? err.message : String(err) })
        onEvent({ type: 'exit', exitCode: null })
        return
      }

      onEvent({ type: 'command', data: fullCommand.join(' ') })
      const [cmd, ...cmdArgs] = fullCommand

      const child = spawn(cmd, cmdArgs, {
        cwd: this.projectDir,
        shell: false,
        env: createCleanCliEnv(),
      })
      activeChild = child

      child.stdout?.on('data', (data) => {
        onEvent({ type: 'stdout', data: data.toString() })
      })

      child.stderr?.on('data', (data) => {
        onEvent({ type: 'stderr', data: data.toString() })
      })

      child.on('close', (exitCode) => {
        if (activeChild !== child) return
        activeChild = null
        onEvent({ type: 'exit', exitCode })
      })

      child.on('error', (err) => {
        if (activeChild !== child) return
        activeChild = null
        const code = (err as NodeJS.ErrnoException).code
        const message = err.message + (code ? ` (${code})` : '')

        if (allowRetry && code === 'ENOENT' && !cancelled) {
          this.configManager.invalidateResolvedCliRunner()
          void start(false)
          return
        }

        onEvent({ type: 'stderr', data: message })
        onEvent({ type: 'exit', exitCode: null })
      })
    }

    await start(true)

    return () => {
      cancelled = true
      activeChild?.kill()
      activeChild = null
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
   */
  executeCommandStream(
    command: readonly string[],
    onEvent: (event: CliStreamEvent) => void
  ): () => void {
    const [cmd, ...cmdArgs] = command
    onEvent({ type: 'command', data: command.join(' ') })

    const child = spawn(cmd, cmdArgs, {
      cwd: this.projectDir,
      shell: false,
      env: createCleanCliEnv(),
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
      const code = (err as NodeJS.ErrnoException).code
      const message = err.message + (code ? ` (${code})` : '')
      onEvent({ type: 'stderr', data: message })
      onEvent({ type: 'exit', exitCode: null })
    })

    return () => {
      child.kill()
    }
  }
}
