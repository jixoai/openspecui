/**
 * Orthogonal intents (updated 2026-08-09 Asia/Shanghai):
 * 1. Spawn non-shell child processes without converting synchronous failures into thrown control flow.
 * 2. Buffer stdout/stderr and preserve exit, timeout, and spawn-error evidence.
 * 3. Retire cancelled buffered child-process trees through bounded SIGTERM-to-SIGKILL escalation.
 * 4. Resolve Windows executables and npm-style Node shims onto native argv boundaries without cmd.exe.
 * 5. Provide eager JSON resolution + observer-explicit phase timing while treating observed stderr
 *    as exit-owned evidence that must settle through the real child close.
 * 6. Hide child console windows by default (`windowsHide`) so a console-less Windows daemon never
 *    flashes a cmd window per executed command; an explicit caller opt-out remains authoritative.
 *
 * Original request (2026-08-14): "在Windows平台上，执行命令总是会弹出cmd窗口，这个可否统一隐藏，你先调查一下原因"
 * Original request (2026-07-29): "继续打磨 app 模式，我们需要将它适配对接 opentray。"
 * Review correction (2026-08-09): Windows npm-style `.cmd` launchers must resolve to a native
 *   executable plus argv; `cross-spawn` can route them through `cmd.exe` and reinterpret user input.
 * Original request (2026-07-31): "这些命令的执行，时间绝对不是七八秒那么久...请看一下代码，看能不能让trace更精确"
 * Original request (2026-08-06): "continue"
 * Original request (2026-08-04): "Make pnpm openspecui start and equivalent package scripts work on Windows."
 */
import type { ChildProcess, SpawnOptionsWithoutStdio } from 'node:child_process'
import { spawn } from 'node:child_process'
import { terminateChildProcessTree } from './child-process-tree.js'
import { resolveCommandInvocation } from './command-invocation.js'

export interface SpawnErrorInfo {
  code?: string
  message: string
}

/**
 * Per-phase monotonic timestamps (ms via `performance.now()`) for one buffered spawn.
 *
 * `CliExecutor` records these onto its OTel span as `cli.ms.*` attributes so traces can attribute
 * latency to process startup vs. first-byte vs. exit-drain. `eagerResolved` marks early return
 * via eager JSON parsing (see `runBufferedCommand.eagerResolveJson`).
 */
export interface SpawnPhases {
  spawnCalledAt: number
  spawnReturnedAt: number
  spawnObservedAt: number
  firstStdoutAt: number
  firstStderrAt: number
  jsonCompleteAt: number
  terminationRequestedAt: number
  resultResolvedAt: number
  exitAt: number
  closeAt: number
  eagerResolved: boolean
  resultReason: BufferedSpawnResultReason | null
}

export type BufferedSpawnResultReason = 'close' | 'eager-json' | 'spawn-error'

export type BufferedSpawnPhase =
  | 'spawn-called'
  | 'spawn-returned'
  | 'spawn-observed'
  | 'first-stdout-observed'
  | 'first-stderr-observed'
  | 'json-complete-observed'
  | 'termination-requested'
  | 'exit-observed'
  | 'close-observed'
  | 'result-resolved'
  | 'spawn-error'

/** One monotonic phase observation emitted at the exact parent-process callback boundary. */
export interface BufferedSpawnPhaseEvent {
  phase: BufferedSpawnPhase
  at: number
  pid?: number
  exitCode?: number | null
  signal?: NodeJS.Signals | null
  reason?: BufferedSpawnResultReason | 'abort' | 'timeout' | 'eager-json'
}

export interface BufferedSpawnResult {
  stdout: string
  stderr: string
  exitCode: number | null
  timedOut: boolean
  spawnError?: SpawnErrorInfo
  /** Per-phase timing; present on every result, including spawn failure. */
  phases?: SpawnPhases
}

/** Shell-independent child-process startup result, including synchronous spawn failures. */
export type SafeSpawnResult =
  | {
      ok: true
      child: ChildProcess
    }
  | {
      ok: false
      error: SpawnErrorInfo
    }

function getSpawnErrorCode(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null || !('code' in err)) {
    return undefined
  }

  const code = (err as { code?: unknown }).code
  return typeof code === 'string' ? code : undefined
}

export function formatSpawnError(err: unknown): SpawnErrorInfo {
  const message = err instanceof Error ? err.message : String(err)
  const code = getSpawnErrorCode(err)
  const suffix = code ? ` (${code})` : ''
  return {
    code,
    message: `${message}${suffix}`,
  }
}

/** Spawn without a shell after resolving one caller-environment native argv boundary. */
export function spawnSafe(
  command: string,
  args: readonly string[],
  options: SpawnOptionsWithoutStdio
): SafeSpawnResult {
  try {
    const invocation = resolveCommandInvocation(command, args, {
      cwd: typeof options.cwd === 'string' ? options.cwd : undefined,
      env: options.env,
    })
    return {
      ok: true,
      child: spawn(invocation.command, invocation.args, {
        ...options,
        shell: false,
        windowsHide: options.windowsHide ?? true,
      }),
    }
  } catch (err) {
    return {
      ok: false,
      error: formatSpawnError(err),
    }
  }
}

export const EAGER_JSON_EXIT_GRACE_MS = 100
const BUFFERED_FORCE_KILL_DELAY_MS = 1_000

export function runBufferedCommand(options: {
  command: string
  args: readonly string[]
  cwd: string
  env: NodeJS.ProcessEnv
  timeoutMs?: number
  signal?: AbortSignal
  /**
   * When true, observe complete JSON, briefly preserve a naturally arriving exit code/stderr, then
   * terminate only a child that remains alive. This keeps OpenSpec diagnostics truthful while
   * skipping a long post-response event-loop drain. Non-JSON commands (`--version`) do not use it.
   */
  eagerResolveJson?: boolean
  /** Diagnostic-only observer used to project exact subprocess phases into OTel events. */
  onPhase?: (event: BufferedSpawnPhaseEvent) => void
}): Promise<BufferedSpawnResult> {
  return new Promise((resolve) => {
    const phases: SpawnPhases = {
      spawnCalledAt: performance.now(),
      spawnReturnedAt: 0,
      spawnObservedAt: 0,
      firstStdoutAt: 0,
      firstStderrAt: 0,
      jsonCompleteAt: 0,
      terminationRequestedAt: 0,
      resultResolvedAt: 0,
      exitAt: 0,
      closeAt: 0,
      eagerResolved: false,
      resultReason: null,
    }
    const observe = (
      phase: BufferedSpawnPhase,
      evidence: Omit<BufferedSpawnPhaseEvent, 'phase' | 'at'> = {}
    ) => {
      options.onPhase?.({ phase, at: performance.now(), ...evidence })
    }
    observe('spawn-called')
    const started = spawnSafe(options.command, options.args, {
      cwd: options.cwd,
      shell: false,
      env: options.env,
    })

    if (!started.ok) {
      observe('spawn-error', { reason: 'spawn-error' })
      phases.resultResolvedAt = performance.now()
      phases.resultReason = 'spawn-error'
      observe('result-resolved', { reason: 'spawn-error' })
      resolve({
        stdout: '',
        stderr: '',
        exitCode: null,
        timedOut: false,
        spawnError: started.error,
        phases,
      })
      return
    }

    const { child } = started
    phases.spawnReturnedAt = performance.now()
    observe('spawn-returned', { pid: child.pid })
    let stdout = ''
    let stderr = ''
    let timedOut = false
    let settled = false
    let eagerJsonTimer: NodeJS.Timeout | null = null
    let eagerJsonImmediate: NodeJS.Immediate | null = null
    let forceKillTimer: NodeJS.Timeout | null = null

    const clearEagerJsonResolution = () => {
      if (eagerJsonTimer) {
        clearTimeout(eagerJsonTimer)
        eagerJsonTimer = null
      }
      if (eagerJsonImmediate) {
        clearImmediate(eagerJsonImmediate)
        eagerJsonImmediate = null
      }
    }

    const clearForceKillTimer = () => {
      if (!forceKillTimer) return
      clearTimeout(forceKillTimer)
      forceKillTimer = null
    }

    const requestTermination = (reason: 'abort' | 'eager-json' | 'timeout') => {
      if (!phases.terminationRequestedAt) {
        phases.terminationRequestedAt = performance.now()
        observe('termination-requested', { reason })
      }
      void terminateChildProcessTree(child).catch(() => undefined)
      if (forceKillTimer) return
      forceKillTimer = setTimeout(() => {
        forceKillTimer = null
        if (!phases.exitAt && !phases.closeAt) {
          void terminateChildProcessTree(child, 'SIGKILL').catch(() => undefined)
        }
      }, BUFFERED_FORCE_KILL_DELAY_MS)
    }

    let clearTimer = () => {}
    if (options.timeoutMs !== undefined) {
      const timer = setTimeout(() => {
        timedOut = true
        requestTermination('timeout')
      }, options.timeoutMs)
      clearTimer = () => clearTimeout(timer)
    }

    if (options.signal) {
      const onAbort = () => {
        requestTermination('abort')
      }
      if (options.signal.aborted) {
        onAbort()
      } else {
        options.signal.addEventListener('abort', onAbort, { once: true })
      }
    }

    const finish = (reason: BufferedSpawnResultReason, result: BufferedSpawnResult) => {
      if (settled) return
      settled = true
      clearTimer()
      clearEagerJsonResolution()
      if (reason !== 'eager-json') clearForceKillTimer()
      phases.resultResolvedAt = performance.now()
      phases.resultReason = reason
      result.phases = phases
      observe('result-resolved', { reason })
      resolve(result)
    }

    child.once('spawn', () => {
      phases.spawnObservedAt = performance.now()
      observe('spawn-observed', { pid: child.pid })
    })

    child.stdout?.on('data', (data: Buffer) => {
      if (!phases.firstStdoutAt) {
        phases.firstStdoutAt = performance.now()
        observe('first-stdout-observed')
      }
      stdout += data.toString()
      if (
        options.eagerResolveJson &&
        !phases.jsonCompleteAt &&
        stdout.trimStart().startsWith('{')
      ) {
        try {
          JSON.parse(stdout)
          phases.jsonCompleteAt = performance.now()
          observe('json-complete-observed')
          eagerJsonTimer = setTimeout(() => {
            eagerJsonTimer = null
            if (settled || phases.exitAt || child.exitCode !== null || stderr.length > 0) return
            eagerJsonImmediate = setImmediate(() => {
              eagerJsonImmediate = null
              if (settled || phases.exitAt || child.exitCode !== null || stderr.length > 0) return
              phases.eagerResolved = true
              requestTermination('eager-json')
              finish('eager-json', { stdout, stderr, exitCode: 0, timedOut })
            })
          }, EAGER_JSON_EXIT_GRACE_MS)
        } catch {
          // Incomplete JSON — wait for more data.
        }
      }
    })

    child.stderr?.on('data', (data: Buffer) => {
      if (!phases.firstStderrAt) {
        phases.firstStderrAt = performance.now()
        observe('first-stderr-observed')
      }
      stderr += data.toString()
    })

    child.on('exit', (exitCode, signal) => {
      clearEagerJsonResolution()
      clearForceKillTimer()
      if (!phases.exitAt) {
        phases.exitAt = performance.now()
        observe('exit-observed', { exitCode, signal })
      }
    })

    child.on('error', (err: Error) => {
      observe('spawn-error', { reason: 'spawn-error' })
      finish('spawn-error', {
        stdout,
        stderr,
        exitCode: null,
        timedOut,
        spawnError: formatSpawnError(err),
      })
    })

    child.on('close', (exitCode: number | null, signal: NodeJS.Signals | null) => {
      clearForceKillTimer()
      phases.closeAt = performance.now()
      observe('close-observed', { exitCode, signal })
      finish('close', {
        stdout,
        stderr,
        exitCode,
        timedOut,
      })
    })
  })
}
