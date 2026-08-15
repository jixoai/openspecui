/**
 * Orthogonal intents (updated 2026-08-08 Asia/Shanghai):
 * 1. Execute buffered CLI work through process/Worker backends with runner recovery,
 *    observer-explicit OTel phase evidence, bounded probes, and owner-scoped disposal.
 * 2. Own streaming CLI process trees through cancellation request, escalation, and confirmed settlement.
 * 3. Retain lifecycle helpers and add the fixed-path, tools-none project bootstrap stream.
 * 4. Expose the physically separated OpenSpec 1.6 typed command facade.
 * 5. Clear the Core-owned direct-child slot independently from stream settlement, and keep
 *    response-Span delivery physically separate from late child-process settlement evidence.
 *
 * Report eager-resolved exit codes as unknown instead of fabricated zeros.
 * Original request (2026-07-15): "你先负责后端（内核）的开发。"
 * Original request (2026-07-17): "A stream cancellation request is not child-process settlement."
 * Built-runtime correction (2026-07-30): foreground Server shutdown must retire buffered projection children and settled probe timers.
 * Tracing (2026-07-31): each CLI subprocess call is wrapped in an OpenTelemetry span so the Server
 *   `planningRoot.runOperation` breakdown can attribute latency to specific CLI invocations
 *   (doctor / context / list ...). Uses `@opentelemetry/api` only — a no-op tracer is returned when
 *   no SDK is registered, so standalone Core use incurs zero overhead.
 * Original request (2026-07-31): "这些命令的执行，时间绝对不是七八秒那么久...请看一下代码，看能不能让trace更精确"
 * Original request (2026-07-31): "终端大量报错，比如: Cannot execute the operation on ended Span"
 * Original request (2026-07-31): "在主线程，通过 OPENSPEC_SPAWN_MODE=process|worker 来进行区分两种模式。"
 * Original request (2026-08-02): initialize the Launch Project with `openspec init <path> --tools=none`.
 * Review correction (2026-08-02): streamed command evidence must preserve argv boundaries.
 * Original request (2026-08-04): "Make pnpm openspecui start and equivalent package scripts work on Windows."

 * Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"*/
import { context, trace, type Attributes, type Span } from '@opentelemetry/api'
import { type ChildProcess } from 'child_process'
import { realpathSync } from 'node:fs'
import { loadavg } from 'node:os'
import { isAbsolute } from 'node:path'
import { performance } from 'node:perf_hooks'
import { terminateChildProcessTree } from './child-process-tree.js'
import { CliBufferedAdmission, type CliBufferedAdmissionLease } from './cli-buffered-admission.js'
import { OpenSpecCliContractExecutor } from './cli-contracts/index.js'
import { CliStreamChildOwner } from './cli-stream-child-owner.js'
import { createCleanCliEnv, type ConfigManager } from './config.js'
import {
  OpenSpecCliModuleNotFoundError,
  resolveOpenSpecSpawnMode,
  resolveOpenSpecWorkerInvocation,
  runOpenSpecCliWorker,
  type OpenSpecSpawnMode,
  type OpenSpecWorkerInvocation,
} from './openspec-cli-worker.js'
import {
  formatSpawnError,
  runBufferedCommand,
  spawnSafe,
  type BufferedSpawnPhase,
  type BufferedSpawnPhaseEvent,
  type BufferedSpawnResult,
} from './spawn-safe.js'

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

function formatCommandEvidence(argv: readonly string[]): string {
  return JSON.stringify(argv)
}

interface CliResultInternal extends CliResult {
  errorCode?: string
  /** Per-phase observer timing for latency diagnosis; present once a spawn was attempted. */
  phases?: import('./spawn-safe.js').SpawnPhases
  spawnMode?: OpenSpecSpawnMode
  attempts?: number
}

interface CliCommandTraceContext {
  span: Span
  attempt: number
  subcommand: string
}

const CLI_PHASE_EVENT_SUFFIXES = {
  'spawn-called': 'spawn.called',
  'spawn-returned': 'spawn.returned',
  'spawn-observed': 'spawn.observed',
  'first-stdout-observed': 'stdout.first.observed',
  'first-stderr-observed': 'stderr.first.observed',
  'json-complete-observed': 'json.complete.observed',
  'termination-requested': 'termination.requested',
  'exit-observed': 'exit.observed',
  'close-observed': 'close.observed',
  'result-resolved': 'result.resolved',
  'spawn-error': 'spawn.error',
} satisfies Record<BufferedSpawnPhase, string>

function roundedMs(value: number): number {
  return Math.round(value * 1_000) / 1_000
}

function phaseEventAttributes(
  event: BufferedSpawnPhaseEvent,
  spawnCalledAt: number,
  attempt: number
): Attributes {
  const attributes: Attributes = {
    'cli.attempt': attempt,
    'cli.phase.elapsed_ms': roundedMs(event.at - spawnCalledAt),
  }
  if (event.pid !== undefined) attributes['process.pid'] = event.pid
  if (event.exitCode !== undefined && event.exitCode !== null) {
    attributes['process.exit.code'] = event.exitCode
  }
  if (event.signal) attributes['process.exit.signal'] = event.signal
  if (event.reason) attributes['cli.phase.reason'] = event.reason
  return attributes
}

function setObservedDuration(span: Span, key: string, base: number, observedAt: number): void {
  if (observedAt > 0) span.setAttribute(key, roundedMs(observedAt - base))
}

function executableRealpath(command: string): string | null {
  if (!isAbsolute(command)) return null
  try {
    return realpathSync.native(command)
  } catch {
    return null
  }
}

function systemLoadAttributes(suffix: string): Attributes {
  const [oneMinute, fiveMinutes, fifteenMinutes] = loadavg()
  return {
    [`system.load.1m.${suffix}`]: oneMinute,
    [`system.load.5m.${suffix}`]: fiveMinutes,
    [`system.load.15m.${suffix}`]: fifteenMinutes,
  }
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

function settleWithin<T>(operation: Promise<T>, timeout: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null
  const timeoutFailure = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeout)
  })
  return Promise.race([operation, timeoutFailure]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

/**
 * CLI 执行器
 *
 * 负责调用外部 openspec CLI 命令，统一通过 ConfigManager 的 runner 解析结果执行。
 * 所有命令都使用 shell: false，避免 shell 注入风险。
 */
export class CliExecutor {
  readonly contracts: OpenSpecCliContractExecutor
  private readonly bufferedAdmission = new CliBufferedAdmission()
  private readonly bufferedAbortController = new AbortController()
  private readonly activeBufferedCommands = new Set<Promise<BufferedSpawnResult>>()
  private activeBufferedChildren = 0
  private peakBufferedChildren = 0
  private disposePromise: Promise<void> | null = null
  private disposed = false

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

  private async runCommandOnce(
    fullCommand: readonly string[],
    traceContext: CliCommandTraceContext
  ): Promise<CliResultInternal> {
    if (this.disposed) {
      return {
        success: false,
        stdout: '',
        stderr: 'CLI executor is disposed.',
        exitCode: null,
        errorCode: 'ABORT_ERR',
      }
    }
    const [cmd, ...cmdArgs] = fullCommand
    const isJsonCommand = cmdArgs.includes('--json')
    const requestedSpawnMode = resolveOpenSpecSpawnMode()
    let spawnMode = requestedSpawnMode
    let workerInvocation: OpenSpecWorkerInvocation | null = null
    let workerFallbackReason: 'module-not-found' | null = null
    if (requestedSpawnMode === 'worker') {
      try {
        workerInvocation = await resolveOpenSpecWorkerInvocation(fullCommand)
      } catch (error) {
        if (!(error instanceof OpenSpecCliModuleNotFoundError)) throw error
        spawnMode = 'process'
        workerFallbackReason = 'module-not-found'
        traceContext.span.addEvent('cli.worker.fallback', {
          'cli.worker.fallback.reason': workerFallbackReason,
          'cli.worker.fallback.message': error.message,
        })
      }
    }
    const queuedStats = this.bufferedAdmission.stats()
    traceContext.span.addEvent('cli.admission.queued', {
      'cli.concurrent.active': queuedStats.active,
      'cli.concurrent.waiting': queuedStats.waiting,
      'cli.concurrent.limit': this.bufferedAdmission.limit,
    })
    const admission = await this.bufferedAdmission.acquire(this.bufferedAbortController.signal)
    if (!admission || this.disposed) {
      admission?.release()
      traceContext.span.addEvent('cli.admission.cancelled')
      return {
        success: false,
        stdout: '',
        stderr: 'CLI executor is disposed.',
        exitCode: null,
        errorCode: 'ABORT_ERR',
      }
    }
    this.recordAdmissionEvidence(traceContext.span, admission)
    traceContext.span.addEvent('cli.admission.acquired', {
      'cli.concurrent.wait_ms': roundedMs(admission.evidence.waitMs),
      'cli.concurrent.active_at_enqueue': admission.evidence.activeAtEnqueue,
      'cli.concurrent.waiting_at_enqueue': admission.evidence.waitingAtEnqueue,
    })
    traceContext.span.setAttribute('cli.spawn_mode', spawnMode)
    traceContext.span.setAttribute('cli.spawn_mode.requested', requestedSpawnMode)
    if (workerFallbackReason) {
      traceContext.span.setAttribute('cli.worker.fallback.reason', workerFallbackReason)
    }
    const processSpan = trace.getTracer('openspecui-core').startSpan(
      `cli.${spawnMode} ${traceContext.subcommand}`,
      {
        attributes: {
          'cli.attempt': traceContext.attempt,
          'cli.cwd': this.projectDir,
          'cli.executable': cmd,
          'cli.json': isJsonCommand,
          'cli.spawn_mode': spawnMode,
          'cli.spawn_mode.requested': requestedSpawnMode,
          ...(workerFallbackReason ? { 'cli.worker.fallback.reason': workerFallbackReason } : {}),
          'cli.concurrent.limit': this.bufferedAdmission.limit,
          'cli.concurrent.active_at_enqueue': admission.evidence.activeAtEnqueue,
          'cli.concurrent.waiting_at_enqueue': admission.evidence.waitingAtEnqueue,
          'cli.concurrent.wait_ms': roundedMs(admission.evidence.waitMs),
          'process.parent.pid': process.pid,
          ...systemLoadAttributes('admitted'),
        },
      },
      context.active()
    )
    const resolvedExecutable = executableRealpath(cmd)
    if (resolvedExecutable) {
      processSpan.setAttribute('cli.runner.realpath', resolvedExecutable)
      traceContext.span.setAttribute('cli.runner.realpath', resolvedExecutable)
    }
    let spawnCalledAt = performance.now()
    let childHandleReturned = false
    let processCloseObserved = false
    let responseDelivered = false
    let processSpanEnded = false
    let childCounted = false
    const executionKind = spawnMode === 'process' ? 'processes' : 'workers'
    const endProcessSpan = () => {
      if (processSpanEnded) return
      processSpanEnded = true
      processSpan.end()
    }
    const observePhase = (event: BufferedSpawnPhaseEvent) => {
      if (event.phase === 'spawn-called') spawnCalledAt = event.at
      if (event.phase === 'spawn-returned') {
        childHandleReturned = true
        if (!childCounted) {
          childCounted = true
          this.activeBufferedChildren += 1
          this.peakBufferedChildren = Math.max(
            this.peakBufferedChildren,
            this.activeBufferedChildren
          )
        }
      }
      const eventName = `cli.${spawnMode}.${CLI_PHASE_EVENT_SUFFIXES[event.phase]}`
      const admissionStats = this.bufferedAdmission.stats()
      const attributes: Attributes = {
        ...phaseEventAttributes(event, spawnCalledAt, traceContext.attempt),
        'cli.concurrent.active': admissionStats.active,
        'cli.concurrent.waiting': admissionStats.waiting,
        'cli.executions.active': this.activeBufferedChildren,
        'cli.executions.peak': this.peakBufferedChildren,
        [`cli.${executionKind}.active`]: this.activeBufferedChildren,
        [`cli.${executionKind}.peak`]: this.peakBufferedChildren,
      }
      if (event.phase === 'spawn-called') Object.assign(attributes, systemLoadAttributes('spawn'))
      if (event.phase === 'first-stdout-observed') {
        Object.assign(attributes, systemLoadAttributes('first_stdout'))
      }
      if (!responseDelivered) traceContext.span.addEvent(eventName, attributes)
      processSpan.addEvent(eventName, attributes)

      if (event.phase === 'spawn-returned') {
        traceContext.span.setAttribute(
          `cli.${executionKind}.active_at_spawn`,
          this.activeBufferedChildren
        )
        processSpan.setAttribute(
          `cli.${executionKind}.active_at_spawn`,
          this.activeBufferedChildren
        )
      }
      if (event.phase === 'first-stdout-observed') {
        traceContext.span.setAttribute(
          `cli.${executionKind}.active_at_first_stdout`,
          this.activeBufferedChildren
        )
        processSpan.setAttribute(
          `cli.${executionKind}.active_at_first_stdout`,
          this.activeBufferedChildren
        )
      }

      if (event.pid !== undefined) processSpan.setAttribute('process.pid', event.pid)
      if (event.phase === 'exit-observed' && event.exitCode !== undefined) {
        processSpan.setAttribute('process.exit.code', event.exitCode ?? -1)
      }
      if (event.phase === 'result-resolved') {
        responseDelivered = true
        processSpan.setAttribute('cli.result.reason', event.reason ?? 'unknown')
        const processWillCloseAfterResponse =
          childHandleReturned &&
          !processCloseObserved &&
          (event.reason === 'eager-json' || event.reason === 'spawn-error')
        if (!processWillCloseAfterResponse) endProcessSpan()
      }
      if (event.phase === 'close-observed') {
        processCloseObserved = true
        if (childCounted) {
          childCounted = false
          this.activeBufferedChildren -= 1
          processSpan.setAttribute(
            `cli.${executionKind}.active_after_close`,
            this.activeBufferedChildren
          )
        }
        if (responseDelivered) endProcessSpan()
      }
    }
    const cliEnv = createCleanCliEnv()
    const command =
      spawnMode === 'worker' && workerInvocation
        ? runOpenSpecCliWorker({
            cwd: this.projectDir,
            env: cliEnv,
            signal: this.bufferedAbortController.signal,
            eagerResolveJson: isJsonCommand,
            invocation: workerInvocation,
            onModuleResolved: (modulePath) => {
              processSpan.setAttribute('cli.worker.module', modulePath)
              traceContext.span.setAttribute('cli.worker.module', modulePath)
            },
            onPhase: observePhase,
          })
        : runBufferedCommand({
            command: cmd,
            args: cmdArgs,
            cwd: this.projectDir,
            env: cliEnv,
            signal: this.bufferedAbortController.signal,
            eagerResolveJson: isJsonCommand,
            onPhase: observePhase,
          })
    this.activeBufferedCommands.add(command)
    const result = await command.finally(() => {
      this.activeBufferedCommands.delete(command)
      admission.release()
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
        phases: result.phases,
        spawnMode,
      }
    }

    // Eager-JSON resolution terminates the process after complete JSON output instead of
    // waiting for its natural exit, so the real exit code was never observed. Report the
    // code as unknown rather than fabricating 0: an object-shaped failure envelope (for
    // example the OpenSpec 1.9 selected-Root schemas failure) must not carry false exit
    // evidence. Transport success still holds because a complete JSON document arrived.
    const eagerResolved = result.phases?.resultReason === 'eager-json'

    return {
      success: result.exitCode === 0 || (eagerResolved && result.exitCode === null),
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: eagerResolved ? null : result.exitCode,
      phases: result.phases,
      spawnMode,
    }
  }

  private recordAdmissionEvidence(span: Span, admission: CliBufferedAdmissionLease): void {
    span.setAttributes({
      'cli.cwd': this.projectDir,
      'cli.concurrent.limit': this.bufferedAdmission.limit,
      'cli.concurrent.active_at_enqueue': admission.evidence.activeAtEnqueue,
      'cli.concurrent.waiting_at_enqueue': admission.evidence.waitingAtEnqueue,
      'cli.concurrent.wait_ms': roundedMs(admission.evidence.waitMs),
      'process.parent.pid': process.pid,
      ...systemLoadAttributes('admitted'),
    })
  }

  private async executeInternal(args: string[], allowRetry: boolean): Promise<CliResult> {
    // Wrap each CLI invocation in a span so Server-side `planningRoot.runOperation` traces can
    // attribute latency to individual subprocess calls (doctor/context/list...). When no SDK is
    // registered `trace.getTracer()` returns a no-op, so this is zero-overhead in standalone Core.
    const tracer = trace.getTracer('openspecui-core')
    const subcommand = args[0] ?? 'cli'
    return tracer.startActiveSpan(`cli.execute ${subcommand}`, async (span) => {
      const executionStartedAt = performance.now()
      const eventLoopStartedAt = performance.eventLoopUtilization()
      span.setAttribute('cli.args', args.join(' '))
      try {
        const result = await this.executeInternalCore(args, allowRetry, span, subcommand)
        span.setAttribute('cli.exitCode', result.exitCode ?? -1)
        span.setAttribute('cli.attempts', result.attempts ?? 1)
        // Record per-phase durations as span attributes so traces reveal whether the latency is
        // in process spawn, first-byte (CLI startup), or exit→close drain.
        const phases = result.phases
        if (phases) {
          const base = phases.spawnCalledAt
          span.setAttribute('cli.eagerResolved', phases.eagerResolved)
          span.setAttribute('cli.result.reason', phases.resultReason ?? 'unknown')
          setObservedDuration(span, 'cli.ms.spawnCall', base, phases.spawnReturnedAt)
          setObservedDuration(span, 'cli.ms.spawnObserved', base, phases.spawnObservedAt)
          setObservedDuration(span, 'cli.ms.firstStdoutObserved', base, phases.firstStdoutAt)
          setObservedDuration(span, 'cli.ms.firstStderrObserved', base, phases.firstStderrAt)
          setObservedDuration(span, 'cli.ms.jsonCompleteObserved', base, phases.jsonCompleteAt)
          setObservedDuration(
            span,
            'cli.ms.terminationRequested',
            base,
            phases.terminationRequestedAt
          )
          setObservedDuration(span, 'cli.ms.resultResolved', base, phases.resultResolvedAt)
          setObservedDuration(span, 'cli.ms.exitObserved', base, phases.exitAt)
          setObservedDuration(span, 'cli.ms.closeObserved', base, phases.closeAt)
          const spawnMode = result.spawnMode ?? resolveOpenSpecSpawnMode()
          span.setAttribute(
            `cli.${spawnMode}.exitObservedBeforeResult`,
            phases.exitAt > 0 && phases.exitAt <= phases.resultResolvedAt
          )
          span.setAttribute(
            `cli.${spawnMode}.closeObservedBeforeResult`,
            phases.closeAt > 0 && phases.closeAt <= phases.resultResolvedAt
          )
          if (phases.exitAt && phases.closeAt) {
            span.setAttribute(
              'cli.ms.exitToCloseObserved',
              roundedMs(phases.closeAt - phases.exitAt)
            )
          }
        }
        if (!result.success) {
          span.setStatus({ code: 2, message: result.stderr || `exit ${result.exitCode}` })
        }
        return result
      } catch (err) {
        span.recordException(err instanceof Error ? err : String(err))
        span.setStatus({ code: 2, message: err instanceof Error ? err.message : String(err) })
        throw err
      } finally {
        const eventLoop = performance.eventLoopUtilization(eventLoopStartedAt)
        span.setAttributes({
          'cli.ms.response': roundedMs(performance.now() - executionStartedAt),
          'cli.event_loop.utilization': eventLoop.utilization,
          'cli.ms.event_loop_active': roundedMs(eventLoop.active),
          'cli.ms.event_loop_idle': roundedMs(eventLoop.idle),
        })
        span.end()
      }
    })
  }

  private async executeInternalCore(
    args: string[],
    allowRetry: boolean,
    span: Span,
    subcommand: string,
    attempt = 1
  ): Promise<CliResultInternal> {
    let fullCommand: string[]
    const runnerResolveStartedAt = performance.now()
    try {
      fullCommand = await this.buildCommandArray(args)
    } catch (err) {
      span.addEvent('cli.runner.resolve.error', {
        'cli.attempt': attempt,
        'cli.ms.runnerResolve': roundedMs(performance.now() - runnerResolveStartedAt),
      })
      return {
        success: false,
        stdout: '',
        stderr: err instanceof Error ? err.message : String(err),
        exitCode: null,
        attempts: attempt,
      }
    }
    const runnerResolveMs = roundedMs(performance.now() - runnerResolveStartedAt)
    span.setAttribute('cli.ms.runnerResolve', runnerResolveMs)
    span.setAttribute('cli.executable', fullCommand[0] ?? '')
    span.addEvent('cli.runner.resolved', {
      'cli.attempt': attempt,
      'cli.ms.runnerResolve': runnerResolveMs,
      'cli.executable': fullCommand[0] ?? '',
    })

    const result = await this.runCommandOnce(fullCommand, { span, attempt, subcommand })
    if (allowRetry && result.errorCode === 'ENOENT') {
      span.addEvent('cli.runner.retry', { 'cli.attempt': attempt, 'cli.retry.reason': 'ENOENT' })
      this.configManager.invalidateResolvedCliRunner()
      return this.executeInternalCore(args, false, span, subcommand, attempt + 1)
    }
    return {
      success: result.success,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      phases: result.phases,
      spawnMode: result.spawnMode,
      attempts: attempt,
    }
  }

  /**
   * 执行 CLI 命令
   */
  async execute(args: string[]): Promise<CliResult> {
    return this.executeInternal(args, true)
  }

  /** Cancel and await every buffered CLI child owned by this executor. */
  dispose(): Promise<void> {
    if (this.disposePromise) return this.disposePromise
    this.disposed = true
    this.bufferedAbortController.abort()
    const activeCommands = [...this.activeBufferedCommands]
    this.disposePromise = Promise.allSettled(activeCommands).then(() => undefined)
    return this.disposePromise
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
   * 执行 openspec schemas --json（可选转发所选 Root 的 Store 选择器）
   */
  async schemas(selector: { store?: string } = {}): Promise<CliResult> {
    const args = ['schemas', '--json']
    if (selector.store !== undefined) args.push('--store', selector.store)
    return this.execute(args)
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
    const tracer = trace.getTracer('openspecui-core')
    return tracer.startActiveSpan('cli.checkAvailability', async (span) => {
      const checkStartedAt = performance.now()
      const eventLoopStartedAt = performance.eventLoopUtilization()
      try {
        const runnerResolveStartedAt = performance.now()
        const resolved = await settleWithin(
          this.configManager.getResolvedCliRunner(),
          timeout,
          'CLI runner resolve timed out'
        )
        const runnerResolveMs = roundedMs(performance.now() - runnerResolveStartedAt)
        span.setAttribute('cli.triedCount', resolved.attempts.length)
        span.setAttribute('cli.ms.runnerResolve', runnerResolveMs)
        span.setAttribute('cli.executable', resolved.commandParts[0] ?? '')
        span.addEvent('cli.runner.resolved', {
          'cli.ms.runnerResolve': runnerResolveMs,
          'cli.executable': resolved.commandParts[0] ?? '',
          'cli.runner.attempts': resolved.attempts.length,
        })

        const versionResult = await settleWithin(
          this.runCommandOnce([...resolved.commandParts, '--version'], {
            span,
            attempt: 1,
            subcommand: 'check-availability',
          }),
          timeout,
          'CLI check timed out'
        )
        span.setAttribute('cli.available', versionResult.success)

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
        span.setAttribute('cli.available', false)
        return {
          available: false,
          error: err instanceof Error ? err.message : String(err),
        }
      } finally {
        const eventLoop = performance.eventLoopUtilization(eventLoopStartedAt)
        span.setAttributes({
          'cli.ms.response': roundedMs(performance.now() - checkStartedAt),
          'cli.event_loop.utilization': eventLoop.utilization,
          'cli.ms.event_loop_active': roundedMs(eventLoop.active),
          'cli.ms.event_loop_idle': roundedMs(eventLoop.idle),
        })
        span.end()
      }
    })
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
      void terminateChildProcessTree(child).catch(() => {
        // The bounded close confirmation remains the settlement authority.
      })
      terminationTimer = setTimeout(() => {
        if (settled || !childOwner.owns(child)) return
        void terminateChildProcessTree(child, 'SIGKILL').catch(() => {
          // The close event may already be queued; the bounded confirmation still applies.
        })
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

      activeCommand = formatCommandEvidence(fullCommand)
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

  /** Stream the fixed project bootstrap command without installing Agent integrations. */
  initProjectStream(
    projectPath: string,
    onEvent: (event: CliStreamEvent) => void
  ): CliStreamHandle {
    return this.executeStream(['init', projectPath, '--tools=none'], onEvent)
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
