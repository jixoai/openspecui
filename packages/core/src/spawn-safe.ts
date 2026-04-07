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

export function runBufferedCommand(options: {
  command: string
  args: readonly string[]
  cwd: string
  env: NodeJS.ProcessEnv
  timeoutMs?: number
}): Promise<BufferedSpawnResult> {
  return new Promise((resolve) => {
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
    let settled = false

    let clearTimer = () => {}
    if (options.timeoutMs !== undefined) {
      const timer = setTimeout(() => {
        timedOut = true
        killChild(child)
      }, options.timeoutMs)
      clearTimer = () => clearTimeout(timer)
    }

    const finish = (result: BufferedSpawnResult) => {
      if (settled) return
      settled = true
      clearTimer()
      resolve(result)
    }

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
