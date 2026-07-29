/**
 * Orthogonal intents (updated 2026-07-30 Asia/Shanghai):
 * 1. Spawn non-shell child processes without converting synchronous failures into thrown control flow.
 * 2. Buffer stdout/stderr and preserve exit, timeout, and spawn-error evidence.
 * 3. Retire cancelled buffered children through bounded SIGTERM-to-SIGKILL escalation.
 *
 * Original request (2026-07-29): "继续打磨 app 模式，我们需要将它适配对接 opentray。"
 * Built-runtime correction (2026-07-30): one foreground Server signal must retire background OpenSpec CLI children.
 */
import { spawn, type ChildProcess, type SpawnOptionsWithoutStdio } from 'child_process'

export interface SpawnErrorInfo {
  code?: string
  message: string
}

export interface BufferedSpawnResult {
  stdout: string
  stderr: string
  exitCode: number | null
  timedOut: boolean
  spawnError?: SpawnErrorInfo
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
      child: spawn(command, [...args], options),
    }
  } catch (err) {
    return {
      ok: false,
      error: formatSpawnError(err),
    }
  }
}

function killChild(child: ChildProcess): void {
  try {
    child.kill()
  } catch {
    // Ignore kill failures when the process already exited or was never started.
  }
}

const BUFFERED_TERMINATION_GRACE_MS = 1_000

function bufferedCancellationError(): SpawnErrorInfo {
  return { code: 'ABORT_ERR', message: 'CLI command was cancelled.' }
}

export function runBufferedCommand(options: {
  command: string
  args: readonly string[]
  cwd: string
  env: NodeJS.ProcessEnv
  timeoutMs?: number
  signal?: AbortSignal
}): Promise<BufferedSpawnResult> {
  return new Promise((resolve) => {
    if (options.signal?.aborted) {
      resolve({
        stdout: '',
        stderr: '',
        exitCode: null,
        timedOut: false,
        spawnError: bufferedCancellationError(),
      })
      return
    }

    const started = spawnSafe(options.command, options.args, {
      cwd: options.cwd,
      shell: false,
      env: options.env,
    })

    if (!started.ok) {
      resolve({
        stdout: '',
        stderr: '',
        exitCode: null,
        timedOut: false,
        spawnError: started.error,
      })
      return
    }

    const { child } = started
    let stdout = ''
    let stderr = ''
    let timedOut = false
    let cancelled = false
    let settled = false

    let timeoutTimer: ReturnType<typeof setTimeout> | null = null
    let forceTerminationTimer: ReturnType<typeof setTimeout> | null = null
    if (options.timeoutMs !== undefined) {
      timeoutTimer = setTimeout(() => {
        timedOut = true
        killChild(child)
      }, options.timeoutMs)
    }

    const finish = (result: BufferedSpawnResult) => {
      if (settled) return
      settled = true
      if (timeoutTimer) clearTimeout(timeoutTimer)
      if (forceTerminationTimer) clearTimeout(forceTerminationTimer)
      options.signal?.removeEventListener('abort', cancel)
      resolve(
        cancelled
          ? {
              ...result,
              exitCode: null,
              spawnError: bufferedCancellationError(),
            }
          : result
      )
    }

    const cancel = () => {
      if (cancelled || settled) return
      cancelled = true
      try {
        child.kill('SIGTERM')
      } catch {
        // The close/error event remains the settlement authority.
      }
      forceTerminationTimer = setTimeout(() => {
        if (settled) return
        try {
          child.kill('SIGKILL')
        } catch {
          // The close/error event may already be queued.
        }
      }, BUFFERED_TERMINATION_GRACE_MS)
    }

    options.signal?.addEventListener('abort', cancel, { once: true })

    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString()
    })

    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    child.on('error', (err: Error) => {
      finish({
        stdout,
        stderr,
        exitCode: null,
        timedOut,
        spawnError: formatSpawnError(err),
      })
    })

    child.on('close', (exitCode: number | null) => {
      finish({
        stdout,
        stderr,
        exitCode,
        timedOut,
      })
    })
  })
}
