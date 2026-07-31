/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Spawn non-shell child processes without converting synchronous failures into thrown control flow.
 * 2. Buffer stdout/stderr and preserve exit, timeout, and spawn-error evidence.
 * 3. Retire cancelled buffered children through bounded SIGTERM-to-SIGKILL escalation.
 * 4. Resolve commands cross-platform via cross-spawn so Windows npm-global extension-less shims
 *    (`openspec` without `.cmd`) don't fail with ENOENT under `shell:false`.
 * 5. Provide eager JSON resolution + observer-explicit phase timing so OTel never labels result
 *    delivery as child-process exit.
 *
 * Original request (2026-07-29): "继续打磨 app 模式，我们需要将它适配对接 opentray。"
 * Hotfix (2026-07-30, issue #209): Windows `spawn({shell:false})` cannot execute the npm-global
 *   extension-less shim returned first by `where openspec`. `cross-spawn` resolves PATHEXT
 *   (`openspec.cmd`) while keeping `shell:false`, so the security model in cli-executor.ts is
 *   unchanged.
 * Original request (2026-07-31): "这些命令的执行，时间绝对不是七八秒那么久...请看一下代码，看能不能让trace更精确"
 */
import type { ChildProcess, SpawnOptionsWithoutStdio } from 'child_process'
import crossSpawn from 'cross-spawn'

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

type SafeSpawnResult =
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

export function spawnSafe(
  command: string,
  args: readonly string[],
  options: SpawnOptionsWithoutStdio
): SafeSpawnResult {
  try {
    return {
      ok: true,
      child: crossSpawn(command, [...args], options),
    }
  } catch (err) {
    return {
      ok: false,
      error: formatSpawnError(err),
    }
  }
}

function killChild(child: ChildProcess, signal: NodeJS.Signals = 'SIGTERM'): void {
  try {
    child.kill(signal)
  } catch {
    // Ignore kill failures when the process already exited or was never started.
  }
}

const EAGER_JSON_EXIT_GRACE_MS = 25
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
    let forceKillTimer: NodeJS.Timeout | null = null

    const clearEagerJsonTimer = () => {
      if (!eagerJsonTimer) return
      clearTimeout(eagerJsonTimer)
      eagerJsonTimer = null
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
      killChild(child)
      if (forceKillTimer) return
      forceKillTimer = setTimeout(() => {
        forceKillTimer = null
        if (!phases.exitAt && !phases.closeAt) killChild(child, 'SIGKILL')
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
      clearEagerJsonTimer()
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
            if (settled || phases.exitAt) return
            phases.eagerResolved = true
            requestTermination('eager-json')
            finish('eager-json', { stdout, stderr, exitCode: 0, timedOut })
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
      clearEagerJsonTimer()
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
