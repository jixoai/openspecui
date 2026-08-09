/**
 * Orthogonal intents (updated 2026-08-06 Asia/Shanghai):
 * 1. Resolve an installed OpenSpec package's importable CLI module from its configured runner and
 *    distinguish objective module absence from Worker startup/execution failure.
 * 2. Execute one buffered OpenSpec command inside an isolated Node Worker with project cwd semantics.
 * 3. Project Worker stdout, stderr, cancellation, and settlement through the buffered spawn contract.
 * 4. Treat observed Worker stderr as exit-owned evidence and settle it through the real Worker exit
 *    instead of eager JSON retirement.
 *
 * Original request (2026-07-31): "直接寻址到本地 openspec 背后的 js，直接用 worker_thread 来运行它。"
 * Original request (2026-07-31): "通过 OPENSPEC_SPAWN_MODE=process|worker 来进行区分两种模式。"
 * Original request (2026-08-06): "continue"
 */
import { access, realpath } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { Worker } from 'node:worker_threads'
import {
  EAGER_JSON_EXIT_GRACE_MS,
  formatSpawnError,
  type BufferedSpawnPhase,
  type BufferedSpawnPhaseEvent,
  type BufferedSpawnResult,
  type BufferedSpawnResultReason,
  type SpawnPhases,
} from './spawn-safe.js'

export type OpenSpecSpawnMode = 'process' | 'worker'
export const OPENSPEC_SPAWN_MODE_ENV = 'OPENSPEC_SPAWN_MODE'

export interface OpenSpecWorkerInvocation {
  readonly args: readonly string[]
  readonly modulePath: string
}

/** Objective signal that no importable OpenSpec CLI JavaScript module exists behind the runner. */
export class OpenSpecCliModuleNotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OpenSpecCliModuleNotFoundError'
  }
}

interface OpenSpecWorkerMessage {
  readonly exitCode: number
  readonly type: 'completed'
}

const WORKER_BOOTSTRAP = String.raw`
const { parentPort, workerData } = require('node:worker_threads')
const { pathToFileURL } = require('node:url')

process.argv.splice(0, process.argv.length, process.execPath, 'openspec', ...workerData.args)
process.cwd = () => workerData.cwd

void (async () => {
  const cli = await import(pathToFileURL(workerData.modulePath).href)
  if (!cli.program || typeof cli.program.parseAsync !== 'function') {
    throw new TypeError('OpenSpec CLI module does not export program.parseAsync().')
  }
  await cli.program.parseAsync(process.argv)
  parentPort.postMessage({ type: 'completed', exitCode: process.exitCode ?? 0 })
  parentPort.close()
})().catch((error) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error)
  process.stderr.write(message + '\n')
  process.exitCode = 1
  parentPort.close()
})
`

function createPhases(): SpawnPhases {
  return {
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
}

function isOpenSpecWorkerMessage(value: unknown): value is OpenSpecWorkerMessage {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as { exitCode?: unknown; type?: unknown }
  return candidate.type === 'completed' && typeof candidate.exitCode === 'number'
}

function cleanWorkerEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).filter((entry): entry is [string, string] => entry[1] !== undefined)
  )
}

function isNodeExecutable(command: string): boolean {
  const executable = basename(command).toLowerCase()
  return (
    executable === 'node' ||
    executable === 'node.exe' ||
    resolve(command) === resolve(process.execPath)
  )
}

function isMissingPathError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false
  const code = (error as { code?: unknown }).code
  return code === 'ENOENT' || code === 'ENOTDIR'
}

async function existingFile(path: string): Promise<string | null> {
  try {
    await access(path)
    return path
  } catch (error) {
    if (isMissingPathError(error)) return null
    throw error
  }
}

async function moduleFromBin(binPath: string): Promise<string | null> {
  let physicalBin: string
  try {
    physicalBin = await realpath(binPath)
  } catch (error) {
    if (isMissingPathError(error)) return null
    throw error
  }
  if (physicalBin.endsWith(join('dist', 'cli', 'index.js'))) {
    return existingFile(physicalBin)
  }
  if (basename(physicalBin) !== 'openspec.js' || basename(dirname(physicalBin)) !== 'bin') {
    return null
  }
  return existingFile(join(dirname(dirname(physicalBin)), 'dist', 'cli', 'index.js'))
}

async function moduleFromVitePlusShim(command: string): Promise<string | null> {
  if (basename(command) !== 'openspec' || basename(dirname(command)) !== 'bin') return null
  const vitePlusRoot = dirname(dirname(command))
  if (basename(vitePlusRoot) !== '.vite-plus') return null
  return existingFile(
    join(
      vitePlusRoot,
      'packages',
      '@fission-ai',
      'openspec',
      'lib',
      'node_modules',
      '@fission-ai',
      'openspec',
      'dist',
      'cli',
      'index.js'
    )
  )
}

export async function resolveOpenSpecWorkerInvocation(
  fullCommand: readonly string[]
): Promise<OpenSpecWorkerInvocation> {
  const [command, ...commandArgs] = fullCommand
  if (!command) throw new Error('OpenSpec CLI command is empty.')

  if (isNodeExecutable(command)) {
    const [binPath, ...args] = commandArgs
    if (!binPath) throw new Error('Node OpenSpec runner does not include its bin entry.')
    const modulePath = await moduleFromBin(binPath)
    if (!modulePath) {
      throw new OpenSpecCliModuleNotFoundError(
        `Cannot resolve the OpenSpec CLI module from Node entry: ${binPath}`
      )
    }
    return { modulePath, args }
  }

  const modulePath =
    (await moduleFromBin(command)) ??
    (await moduleFromVitePlusShim(resolve(command))) ??
    (await moduleFromVitePlusShim(command))
  if (!modulePath) {
    throw new OpenSpecCliModuleNotFoundError(
      `Cannot resolve the OpenSpec CLI module from runner: ${command}`
    )
  }
  return { modulePath, args: commandArgs }
}

/** Resolve the main-thread buffered OpenSpec execution mode. */
export function resolveOpenSpecSpawnMode(
  value = process.env[OPENSPEC_SPAWN_MODE_ENV]
): OpenSpecSpawnMode {
  if (value === undefined || value === '' || value === 'worker') return 'worker'
  if (value === 'process') return 'process'
  throw new RangeError(`OPENSPEC_SPAWN_MODE must be "process" or "worker"; received "${value}".`)
}

/** Execute one importable OpenSpec CLI command in a dedicated Worker. */
export function runOpenSpecCliWorker(options: {
  cwd: string
  env: NodeJS.ProcessEnv
  eagerResolveJson?: boolean
  invocation: OpenSpecWorkerInvocation
  onModuleResolved?: (modulePath: string) => void
  onPhase?: (event: BufferedSpawnPhaseEvent) => void
  signal?: AbortSignal
}): Promise<BufferedSpawnResult> {
  return new Promise((resolveResult) => {
    const phases = createPhases()
    let stderr = ''
    let stdout = ''
    let settled = false
    let worker: Worker | null = null
    let completedExitCode: number | null = null
    let workerError: ReturnType<typeof formatSpawnError> | undefined
    let aborted = false
    let eagerJsonTimer: NodeJS.Timeout | null = null
    let eagerJsonImmediate: NodeJS.Immediate | null = null

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

    const observe = (
      phase: BufferedSpawnPhase,
      evidence: Omit<BufferedSpawnPhaseEvent, 'at' | 'phase'> = {}
    ) => options.onPhase?.({ phase, at: performance.now(), ...evidence })

    const finish = (reason: BufferedSpawnResultReason, exitCode: number | null) => {
      if (settled) return
      settled = true
      clearEagerJsonResolution()
      phases.resultResolvedAt = performance.now()
      phases.resultReason = reason
      observe('result-resolved', { reason })
      resolveResult({
        stdout,
        stderr,
        exitCode,
        timedOut: false,
        ...(workerError ? { spawnError: workerError } : {}),
        phases,
      })
    }

    const requestTermination = (reason: 'abort' | 'eager-json') => {
      if (!worker || phases.terminationRequestedAt) return
      phases.terminationRequestedAt = performance.now()
      observe('termination-requested', { reason })
      void worker.terminate()
    }

    const onAbort = () => {
      aborted = true
      requestTermination('abort')
    }
    if (options.signal?.aborted) {
      phases.resultResolvedAt = performance.now()
      phases.resultReason = 'close'
      observe('result-resolved', { reason: 'close' })
      resolveResult({ stdout, stderr, exitCode: null, timedOut: false, phases })
      return
    }
    options.signal?.addEventListener('abort', onAbort, { once: true })

    observe('spawn-called')
    void Promise.all([
      Promise.resolve(options.invocation),
      realpath(options.cwd).catch(() => resolve(options.cwd)),
    ]).then(
      ([invocation, physicalCwd]) => {
        if (options.signal?.aborted) {
          onAbort()
          finish('close', null)
          return
        }
        options.onModuleResolved?.(invocation.modulePath)
        try {
          worker = new Worker(WORKER_BOOTSTRAP, {
            env: cleanWorkerEnv(options.env),
            eval: true,
            execArgv: [],
            stderr: true,
            stdout: true,
            workerData: {
              args: invocation.args,
              cwd: physicalCwd,
              modulePath: invocation.modulePath,
            },
          })
        } catch (error) {
          workerError = formatSpawnError(error)
          observe('spawn-error', { reason: 'spawn-error' })
          finish('spawn-error', null)
          return
        }
        phases.spawnReturnedAt = performance.now()
        observe('spawn-returned')

        worker.once('online', () => {
          phases.spawnObservedAt = performance.now()
          observe('spawn-observed')
        })
        worker.stdout.on('data', (data: Buffer) => {
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
                if (
                  settled ||
                  phases.exitAt ||
                  workerError ||
                  completedExitCode !== null ||
                  stderr.length > 0
                ) {
                  return
                }
                eagerJsonImmediate = setImmediate(() => {
                  eagerJsonImmediate = null
                  if (
                    settled ||
                    phases.exitAt ||
                    workerError ||
                    completedExitCode !== null ||
                    stderr.length > 0
                  ) {
                    return
                  }
                  phases.eagerResolved = true
                  requestTermination('eager-json')
                  finish('eager-json', 0)
                })
              }, EAGER_JSON_EXIT_GRACE_MS)
            } catch {
              // A later stdout chunk may complete the JSON document.
            }
          }
        })
        worker.stderr.on('data', (data: Buffer) => {
          if (!phases.firstStderrAt) {
            phases.firstStderrAt = performance.now()
            observe('first-stderr-observed')
          }
          stderr += data.toString()
        })
        worker.on('message', (message: unknown) => {
          if (isOpenSpecWorkerMessage(message)) completedExitCode = message.exitCode
        })
        worker.once('error', (error) => {
          workerError = formatSpawnError(error)
          observe('spawn-error', { reason: 'spawn-error' })
        })
        worker.once('exit', (workerExitCode) => {
          options.signal?.removeEventListener('abort', onAbort)
          clearEagerJsonResolution()
          phases.exitAt = performance.now()
          const exitCode = aborted
            ? null
            : phases.eagerResolved
              ? 0
              : (completedExitCode ?? workerExitCode)
          observe('exit-observed', { exitCode })
          phases.closeAt = performance.now()
          observe('close-observed', { exitCode })
          if (workerError) {
            finish('spawn-error', null)
          } else {
            finish(phases.eagerResolved ? 'eager-json' : 'close', exitCode)
          }
        })
      },
      (error: unknown) => {
        options.signal?.removeEventListener('abort', onAbort)
        workerError = formatSpawnError(error)
        observe('spawn-error', { reason: 'spawn-error' })
        finish('spawn-error', null)
      }
    )
  })
}
