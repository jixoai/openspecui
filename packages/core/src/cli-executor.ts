/**
 * Orthogonal intents (updated 2026-07-17 Asia/Shanghai):
 * 1. Execute buffered CLI processes with runner recovery and complete process evidence.
 * 2. Own streaming CLI processes through cancellation request, escalation, and confirmed settlement.
 * 3. Retain established init/schema/template and human validate/archive helpers.
 * 4. Expose the physically separated OpenSpec 1.6 typed command facade.
 * 5. Clear the Core-owned direct-child slot independently from stream settlement.
 *
 * Original request (2026-07-15): "你先负责后端（内核）的开发。"
 * Original request (2026-07-17): "A stream cancellation request is not child-process settlement."
 */
import { type ChildProcess } from 'child_process'
import { OpenSpecCliContractExecutor } from './cli-contracts/index.js'
import { CliStreamChildOwner } from './cli-stream-child-owner.js'
import { createCleanCliEnv, type ConfigManager } from './config.js'
import { formatSpawnError, runBufferedCommand, spawnSafe } from './spawn-safe.js'

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

/** Terminal fact that releases ownership of one CLI stream process. */
export interface CliStreamSettlement {
  reason: 'exited' | 'cancelled' | 'startup-failed'
  exitCode: number | null
}

/** Settlement-aware owner returned immediately for one CLI stream. */
export interface CliStreamHandle {
  readonly settled: Promise<CliStreamSettlement>
  cancel(): Promise<CliStreamSettlement>
}

/** Failure raised when even forced termination cannot confirm child-process close. */
export class CliStreamTerminationError extends Error {
  constructor(command: string) {
    super(`CLI stream did not close after forced termination: ${command}`)
    this.name = 'CliStreamTerminationError'
  }
}

const STREAM_TERMINATION_GRACE_MS = 1_000
const STREAM_FORCE_CLOSE_TIMEOUT_MS = 1_000

interface CliResultInternal extends CliResult {
  errorCode?: string
}

function createDeferred<T>(): {
  promise: Promise<T>
  resolve(value: T): void
  reject(reason?: unknown): void
} {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

/**
 * CLI 执行器
 *
 * 负责调用外部 openspec CLI 命令，统一通过 ConfigManager 的 runner 解析结果执行。
 * 所有命令都使用 shell: false，避免 shell 注入风险。
 */
export class CliExecutor {
  readonly contracts: OpenSpecCliContractExecutor

  constructor(
    private configManager: ConfigManager,
    private projectDir: string
  ) {
    this.contracts = new OpenSpecCliContractExecutor((args) => this.execute(args))
  }

  private async buildCommandArray(args: string[]): Promise<string[]> {
    const commandParts = await this.configManager.getCliCommand()
    return [...commandParts, ...args]
  }

  private async runCommandOnce(fullCommand: readonly string[]): Promise<CliResultInternal> {
    const [cmd, ...cmdArgs] = fullCommand
    const result = await runBufferedCommand({
      command: cmd,
      args: cmdArgs,
      cwd: this.projectDir,
      env: createCleanCliEnv(),
    })

    if (result.spawnError) {
      return {
        success: false,
        stdout: result.stdout,
        stderr: result.stderr
          ? `${result.stderr}\n${result.spawnError.message}`
          : result.spawnError.message,
        exitCode: null,
        errorCode: result.spawnError.code,
      }
    }

    return {
      success: result.exitCode === 0,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    }
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
  async init(options?: {
    tools?: string[] | 'all' | 'none'
    profile?: 'core' | 'custom'
    force?: boolean
  }): Promise<CliResult> {
    const args = ['init']
    if (options?.tools !== undefined) {
      const toolsArg = Array.isArray(options.tools) ? options.tools.join(',') : options.tools
      args.push('--tools', toolsArg)
    }
    if (options?.profile) {
      args.push('--profile', options.profile)
    }
    if (options?.force) {
      args.push('--force')
    }
    return this.execute(args)
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
    if (id) args.push(id)
    if (type) args.push('--type', type)
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
    options: {
      type?: 'spec' | 'change'
      id?: string
      strict?: boolean
      store?: string
    },
    onEvent: (event: CliStreamEvent) => void
  ): CliStreamHandle {
    const args = ['validate']
    if (options.id) args.push(options.id)
    if (options.type) args.push('--type', options.type)
    if (options.strict) args.push('--strict')
    if (options.store !== undefined) args.push('--store', options.store)
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
  executeStream(args: string[], onEvent: (event: CliStreamEvent) => void): CliStreamHandle {
    return this.createStreamHandle(
      async () => this.buildCommandArray(args),
      onEvent,
      () => this.configManager.invalidateResolvedCliRunner()
    )
  }

  private createStreamHandle(
    resolveCommand: () => Promise<string[]> | string[],
    onEvent: (event: CliStreamEvent) => void,
    retryRunner?: () => void
  ): CliStreamHandle {
    const settlement = createDeferred<CliStreamSettlement>()
    let settled = false
    let cancelRequested = false
    let terminationStarted = false
    const childOwner = new CliStreamChildOwner()
    let activeCommand = 'CLI command'
    let terminationTimer: ReturnType<typeof setTimeout> | null = null
    let forceCloseTimer: ReturnType<typeof setTimeout> | null = null

    const clearTerminationTimers = () => {
      if (terminationTimer) clearTimeout(terminationTimer)
      if (forceCloseTimer) clearTimeout(forceCloseTimer)
      terminationTimer = null
      forceCloseTimer = null
    }

    const settle = (value: CliStreamSettlement) => {
      if (settled) return
      settled = true
      clearTerminationTimers()
      onEvent({ type: 'exit', exitCode: value.exitCode })
      settlement.resolve(value)
    }

    const failTermination = () => {
      if (settled) return
      settled = true
      clearTerminationTimers()
      settlement.reject(new CliStreamTerminationError(activeCommand))
    }

    const requestChildTermination = (child: ChildProcess) => {
      if (terminationStarted || settled) return
      terminationStarted = true
      try {
        child.kill('SIGTERM')
      } catch {
        // A concurrent close/error event remains the settlement authority.
      }
      terminationTimer = setTimeout(() => {
        if (settled || !childOwner.owns(child)) return
        try {
          child.kill('SIGKILL')
        } catch {
          // The close event may already be queued; the bounded confirmation still applies.
        }
        forceCloseTimer = setTimeout(() => {
          if (!settled && childOwner.owns(child)) failTermination()
        }, STREAM_FORCE_CLOSE_TIMEOUT_MS)
      }, STREAM_TERMINATION_GRACE_MS)
    }

    const start = async (allowRetry: boolean): Promise<void> => {
      if (cancelRequested || settled) return

      let fullCommand: string[]
      try {
        fullCommand = await resolveCommand()
      } catch (err) {
        if (cancelRequested || settled) return
        onEvent({ type: 'stderr', data: err instanceof Error ? err.message : String(err) })
        settle({ reason: 'startup-failed', exitCode: null })
        return
      }

      if (cancelRequested || settled) return

      activeCommand = fullCommand.join(' ')
      onEvent({ type: 'command', data: activeCommand })
      const [cmd, ...cmdArgs] = fullCommand

      const started = spawnSafe(cmd, cmdArgs, {
        cwd: this.projectDir,
        shell: false,
        env: createCleanCliEnv(),
      })

      if (!started.ok) {
        const { code, message } = started.error

        if (allowRetry && code === 'ENOENT' && !cancelRequested && retryRunner) {
          retryRunner()
          void start(false)
          return
        }

        onEvent({ type: 'stderr', data: message })
        settle({ reason: 'startup-failed', exitCode: null })
        return
      }

      const child = started.child
      childOwner.claim(child)
      let childSpawned = false

      child.once('spawn', () => {
        childSpawned = true
      })

      child.stdout?.on('data', (data: Buffer) => {
        onEvent({ type: 'stdout', data: data.toString() })
      })

      child.stderr?.on('data', (data: Buffer) => {
        onEvent({ type: 'stderr', data: data.toString() })
      })

      child.on('close', (exitCode: number | null) => {
        if (!childOwner.owns(child)) return
        childOwner.release(child)
        settle({ reason: cancelRequested ? 'cancelled' : 'exited', exitCode })
      })

      child.on('error', (err: Error) => {
        if (!childOwner.owns(child)) return
        const { code, message } = formatSpawnError(err)

        if (childSpawned) {
          onEvent({ type: 'stderr', data: message })
          return
        }

        childOwner.release(child)

        if (allowRetry && code === 'ENOENT' && !cancelRequested && retryRunner) {
          retryRunner()
          void start(false)
          return
        }

        onEvent({ type: 'stderr', data: message })
        settle({
          reason: cancelRequested ? 'cancelled' : 'startup-failed',
          exitCode: null,
        })
      })
    }

    void start(true)

    const handle: CliStreamHandle = {
      settled: settlement.promise,
      cancel: () => {
        if (cancelRequested || settled) return settlement.promise
        cancelRequested = true
        const child = childOwner.currentChild
        if (child) {
          requestChildTermination(child)
        } else {
          settle({ reason: 'cancelled', exitCode: null })
        }
        return settlement.promise
      },
    }
    void settlement.promise.catch(() => {})
    return handle
  }

  /**
   * 流式执行 openspec init
   */
  initStream(
    options: {
      tools?: string[] | 'all' | 'none'
      profile?: 'core' | 'custom'
      force?: boolean
    },
    onEvent: (event: CliStreamEvent) => void
  ): CliStreamHandle {
    const args = ['init']
    if (options.tools !== undefined) {
      const toolsArg = Array.isArray(options.tools) ? options.tools.join(',') : options.tools
      args.push('--tools', toolsArg)
    }
    if (options.profile) {
      args.push('--profile', options.profile)
    }
    if (options.force) {
      args.push('--force')
    }
    return this.executeStream(args, onEvent)
  }

  /**
   * 流式执行 openspec archive
   */
  archiveStream(
    changeId: string,
    options: { skipSpecs?: boolean; noValidate?: boolean; store?: string },
    onEvent: (event: CliStreamEvent) => void
  ): CliStreamHandle {
    const args = ['archive', '-y', changeId]
    if (options.skipSpecs) args.push('--skip-specs')
    if (options.noValidate) args.push('--no-validate')
    if (options.store !== undefined) args.push('--store', options.store)
    return this.executeStream(args, onEvent)
  }

  /**
   * 流式执行任意命令（数组形式）
   *
   * 字面量 `openspec` 会自动通过已解析的 CLI runner 执行，
   * 其它命令保持原始 spawn 行为。
   */
  executeCommandStream(
    command: readonly string[],
    onEvent: (event: CliStreamEvent) => void
  ): CliStreamHandle {
    const [cmd, ...cmdArgs] = command

    if (cmd === 'openspec') {
      return this.executeStream([...cmdArgs], onEvent)
    }
    return this.createStreamHandle(() => [cmd, ...cmdArgs], onEvent)
  }
}
