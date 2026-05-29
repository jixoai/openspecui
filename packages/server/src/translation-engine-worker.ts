import {
  normalizeBatchTranslationError,
  type BatchTranslateEvent,
  type BatchTranslationError,
  type ManagedLocalTranslationEngineId,
  type TranslatorFactory,
} from '@openspecui/core'
import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads'
import type { TranslationWorkerResourceLimits } from './translation-engine-runtime-strategy.js'

const execFileAsync = promisify(execFile)
const __dirname = dirname(fileURLToPath(import.meta.url))

export interface ManagedLocalTranslationWorkerRequest {
  engineId: ManagedLocalTranslationEngineId
  sourceLanguage: string
  targetLanguage: string
  model?: string
  dtype?: string
  runtimeConfig?: Record<string, unknown>
  inputs: string[]
  instructions?: string
  context?: string
  timeoutMs?: number
  cacheDir: string
}

export interface ManagedLocalBatchTranslateExecutionInput
  extends Omit<ManagedLocalTranslationWorkerRequest, 'cacheDir'> {
  signal: AbortSignal
  workerResourceLimits?: TranslationWorkerResourceLimits
}

export type ManagedLocalTranslationWorkerMessage =
  | { type: 'event'; event: BatchTranslateEvent }
  | { type: 'complete' }
  | { type: 'error'; error: BatchTranslationError }
  | { type: 'ready' }

export type ManagedLocalTranslationHostKind = 'thread' | 'process'

export interface ManagedLocalTranslationChildProcess {
  pid?: number
  connected?: boolean
  send(message: unknown): boolean
  kill(signal?: NodeJS.Signals): boolean
  on(event: 'message', listener: (message: unknown) => void): this
  on(event: 'error', listener: (error: Error) => void): this
  on(event: 'exit', listener: (code: number | null, signal: NodeJS.Signals | null) => void): this
  on(event: 'disconnect', listener: () => void): this
  on(event: 'close', listener: (code: number | null, signal: NodeJS.Signals | null) => void): this
}

interface ManagedLocalTranslationHostPort {
  postMessage(message: ManagedLocalTranslationWorkerMessage): void
  onAbort(callback: () => void): void
}

const SOURCE_BOOTSTRAP_ENTRY_URL_KEY = '__openspecuiTranslationWorkerEntryUrl'
const PROCESS_ENTRY_URL_ENV = 'OPENSPECUI_TRANSLATION_PROCESS_ENTRY_URL'
const DEVELOPMENT_EXPORT_CONDITION = '--conditions=development'

async function createWorkerFactory(
  request: ManagedLocalTranslationWorkerRequest
): Promise<TranslatorFactory> {
  if (request.engineId === 'local') {
    const mod = (await import('@openspecui/local-translator')) as {
      createLocalTranslatorFactory: (options?: {
        defaultModel?: string
        cacheDir?: string
        localOnly?: boolean
      }) => TranslatorFactory
    }
    return mod.createLocalTranslatorFactory({
      defaultModel: request.model,
      cacheDir: request.cacheDir,
      localOnly: true,
    })
  }

  if (request.engineId === 'local-ct2') {
    const mod = (await import('@openspecui/local-ct2-translator')) as {
      createLocalCt2TranslatorFactory: (options?: {
        defaultModel?: string
        cacheDir?: string
      }) => TranslatorFactory
    }
    return mod.createLocalCt2TranslatorFactory({
      defaultModel: request.model,
      cacheDir: request.cacheDir,
    })
  }

  const mod = (await import('@openspecui/local-llama-translator')) as {
    createLocalLlamaTranslatorFactory: (options?: {
      defaultModel?: string
      cacheDir?: string
    }) => TranslatorFactory
  }
  return mod.createLocalLlamaTranslatorFactory({
    defaultModel: request.model,
    cacheDir: request.cacheDir,
  })
}

async function runManagedLocalTranslationHost(
  request: ManagedLocalTranslationWorkerRequest,
  host: ManagedLocalTranslationHostPort
): Promise<void> {
  const controller = new AbortController()
  host.onAbort(() => {
    controller.abort(new DOMException('Translation cancelled.', 'AbortError'))
  })

  try {
    const factory = await createWorkerFactory(request)
    const translator = await factory.create({
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
      model: request.model,
      dtype: request.dtype,
      runtimeConfig: request.runtimeConfig,
      signal: controller.signal,
    })

    try {
      for await (const event of translator.batchTranslate(request.inputs, {
        instructions: request.instructions,
        context: request.context,
        signal: controller.signal,
        timeoutMs: request.timeoutMs,
      })) {
        host.postMessage({
          type: 'event',
          event,
        } satisfies ManagedLocalTranslationWorkerMessage)
      }
      host.postMessage({ type: 'complete' } satisfies ManagedLocalTranslationWorkerMessage)
    } finally {
      translator.destroy?.()
    }
  } catch (error) {
    const normalized = normalizeBatchTranslationError(error, controller.signal)
    host.postMessage({
      type: 'error',
      error: normalized,
    } satisfies ManagedLocalTranslationWorkerMessage)
  }
}

export function createManagedLocalBatchTranslateWorkerExecutor(options: {
  resolveCacheDir: (engineId: ManagedLocalTranslationEngineId) => string
  resolveHost?: (input: ManagedLocalBatchTranslateExecutionInput) => ManagedLocalTranslationHostKind
  resolveResourceLimits?: (
    input: ManagedLocalBatchTranslateExecutionInput
  ) => TranslationWorkerResourceLimits | undefined
  createProcessHost?: (input: {
    entryUrl: string
    execArgv: string[]
    resourceLimits?: TranslationWorkerResourceLimits
  }) => ManagedLocalTranslationChildProcess
  readProcessRssMb?: (pid: number) => Promise<number | undefined>
  rssPollIntervalMs?: number
}) {
  return async function* executeManagedLocalBatchTranslateInWorker(
    input: ManagedLocalBatchTranslateExecutionInput
  ): AsyncGenerator<BatchTranslateEvent> {
    const request = createManagedLocalTranslationWorkerRequest(input, options.resolveCacheDir)
    const resourceLimits = options.resolveResourceLimits?.(input) ?? input.workerResourceLimits
    if ((options.resolveHost?.(input) ?? 'thread') === 'process') {
      yield* executeManagedLocalBatchTranslateInProcess({
        request,
        signal: input.signal,
        resourceLimits,
        execArgv: process.execArgv,
        createProcessHost: options.createProcessHost,
        readProcessRssMb: options.readProcessRssMb,
        rssPollIntervalMs: options.rssPollIntervalMs,
      })
      return
    }

    const worker = createManagedLocalTranslationWorker({
      request,
      resourceLimits,
      execArgv: process.execArgv,
    })
    const queue: BatchTranslateEvent[] = []
    let completed = false
    let thrown: Error | null = null
    const abort = () => {
      try {
        worker.postMessage('abort')
      } catch {
        // ignore shutdown races
      }
    }
    input.signal.addEventListener('abort', abort, { once: true })
    worker.on('message', (message: ManagedLocalTranslationWorkerMessage) => {
      if (message.type === 'event') {
        queue.push(message.event)
        return
      }
      if (message.type === 'complete') {
        completed = true
        return
      }
      if (message.type === 'ready') {
        return
      }
      thrown = new Error(message.error.message)
      completed = true
    })
    worker.on('error', (error) => {
      thrown = error
      completed = true
    })

    try {
      while (!completed || queue.length > 0) {
        if (input.signal.aborted) {
          throw new DOMException('Translation cancelled.', 'AbortError')
        }
        const next = queue.shift()
        if (next) {
          yield next
          continue
        }
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
      if (thrown) throw thrown
    } finally {
      input.signal.removeEventListener('abort', abort)
      await worker.terminate()
    }
  }
}

function createManagedLocalTranslationWorkerRequest(
  input: ManagedLocalBatchTranslateExecutionInput,
  resolveCacheDir: (engineId: ManagedLocalTranslationEngineId) => string
): ManagedLocalTranslationWorkerRequest {
  return {
    engineId: input.engineId,
    sourceLanguage: input.sourceLanguage,
    targetLanguage: input.targetLanguage,
    model: input.model,
    dtype: input.dtype,
    runtimeConfig: input.runtimeConfig,
    inputs: input.inputs,
    instructions: input.instructions,
    context: input.context,
    timeoutMs: input.timeoutMs,
    cacheDir: resolveCacheDir(input.engineId),
  }
}

async function* executeManagedLocalBatchTranslateInProcess(input: {
  request: ManagedLocalTranslationWorkerRequest
  signal: AbortSignal
  resourceLimits?: TranslationWorkerResourceLimits
  execArgv?: string[]
  createProcessHost?: (input: {
    entryUrl: string
    execArgv: string[]
    resourceLimits?: TranslationWorkerResourceLimits
  }) => ManagedLocalTranslationChildProcess
  readProcessRssMb?: (pid: number) => Promise<number | undefined>
  rssPollIntervalMs?: number
}): AsyncGenerator<BatchTranslateEvent> {
  const execArgv = withProcessMemoryExecArgv(
    withDevelopmentExecArgv(input.execArgv ?? []),
    input.resourceLimits
  )
  const child =
    input.createProcessHost?.({
      entryUrl: resolveProcessEntryUrl(),
      execArgv,
      resourceLimits: input.resourceLimits,
    }) ??
    createManagedLocalTranslationProcess({
      entryUrl: resolveProcessEntryUrl(),
      execArgv,
      resourceLimits: input.resourceLimits,
    })
  const queue: BatchTranslateEvent[] = []
  const settledIndexes = new Set<number>()
  let completed = false
  let processEnded = false
  let rssCheckRunning = false
  let rssTimer: ReturnType<typeof setInterval> | undefined

  const stopRssWatchdog = () => {
    if (rssTimer) {
      clearInterval(rssTimer)
      rssTimer = undefined
    }
  }
  const failPending = (error: unknown) => {
    if (completed) return
    const normalized = normalizeBatchTranslationError(error, input.signal)
    for (const [index] of input.request.inputs.entries()) {
      if (settledIndexes.has(index)) continue
      settledIndexes.add(index)
      queue.push({ index, error: normalized })
    }
    completed = true
  }
  const failProcess = (error: unknown, options?: { ended?: boolean }) => {
    if (options?.ended) {
      processEnded = true
    }
    stopRssWatchdog()
    failPending(error)
  }
  const abort = () => {
    try {
      child.send('abort')
    } catch {
      // ignore shutdown races
    }
  }

  input.signal.addEventListener('abort', abort, { once: true })
  child.on('message', (message) => {
    if (!isManagedLocalTranslationWorkerMessage(message)) return
    if (message.type === 'ready') {
      try {
        const sent = child.send(input.request)
        if (!sent && child.connected === false) {
          failProcess(new Error('Translation engine process IPC disconnected unexpectedly.'))
        }
      } catch (error) {
        failProcess(error)
      }
      return
    }
    if (message.type === 'event') {
      settledIndexes.add(message.event.index)
      queue.push(message.event)
      return
    }
    if (message.type === 'complete') {
      completed = true
      return
    }
    failPending(message.error)
  })
  child.on('error', (error) => {
    failProcess(error)
  })
  child.on('exit', (code, signal) => {
    failProcess(createProcessExitError({ code, signal }), { ended: true })
  })
  child.on('disconnect', () => {
    failProcess(new Error('Translation engine process IPC disconnected unexpectedly.'))
  })
  child.on('close', (code, signal) => {
    failProcess(createProcessCloseError({ code, signal }), { ended: true })
  })

  if (input.resourceLimits?.maxRssMb && input.resourceLimits.maxRssMb > 0 && child.pid) {
    const readRss = input.readProcessRssMb ?? readProcessRssMb
    rssTimer = setInterval(() => {
      if (rssCheckRunning || completed || processEnded || !child.pid) return
      rssCheckRunning = true
      void readRss(child.pid)
        .then((rssMb) => {
          if (
            typeof rssMb === 'number' &&
            Number.isFinite(rssMb) &&
            input.resourceLimits?.maxRssMb &&
            rssMb > input.resourceLimits.maxRssMb &&
            !completed
          ) {
            failPending(
              new Error(
                `Translation process exceeded memory limit: ${Math.round(rssMb)}MB > ${
                  input.resourceLimits.maxRssMb
                }MB.`
              )
            )
            child.kill('SIGKILL')
          }
        })
        .catch(() => undefined)
        .finally(() => {
          rssCheckRunning = false
        })
    }, input.rssPollIntervalMs ?? 1000)
  }

  try {
    while (!completed || queue.length > 0) {
      if (input.signal.aborted) {
        throw new DOMException('Translation cancelled.', 'AbortError')
      }
      const next = queue.shift()
      if (next) {
        yield next
        continue
      }
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  } finally {
    input.signal.removeEventListener('abort', abort)
    stopRssWatchdog()
    if (!processEnded) {
      child.kill('SIGTERM')
    }
  }
}

function createManagedLocalTranslationWorker(input: {
  request: ManagedLocalTranslationWorkerRequest
  resourceLimits?: TranslationWorkerResourceLimits
  execArgv?: string[]
}): Worker {
  const resourceLimits = input.resourceLimits
    ? {
        maxOldGenerationSizeMb: input.resourceLimits.maxOldGenerationSizeMb,
        maxYoungGenerationSizeMb: input.resourceLimits.maxYoungGenerationSizeMb,
        codeRangeSizeMb: input.resourceLimits.codeRangeSizeMb,
      }
    : undefined
  if (isSourceEntryUrl(import.meta.url)) {
    return new Worker(buildSourceBootstrapWorkerSource(), {
      eval: true,
      execArgv: withDevelopmentExecArgv(input.execArgv ?? []),
      workerData: {
        ...input.request,
        [SOURCE_BOOTSTRAP_ENTRY_URL_KEY]: import.meta.url,
      },
      ...(resourceLimits ? { resourceLimits } : {}),
    })
  }

  return new Worker(new URL(import.meta.url), {
    execArgv: input.execArgv,
    workerData: input.request,
    ...(resourceLimits ? { resourceLimits } : {}),
  })
}

function createManagedLocalTranslationProcess(input: {
  entryUrl: string
  execArgv: string[]
  resourceLimits?: TranslationWorkerResourceLimits
}): ChildProcess {
  return spawn(process.execPath, [...input.execArgv, '--eval', buildProcessBootstrapSource()], {
    env: {
      ...process.env,
      [PROCESS_ENTRY_URL_ENV]: input.entryUrl,
    },
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
  })
}

function resolveProcessEntryUrl(): string {
  if (isSourceEntryUrl(import.meta.url)) return import.meta.url
  return pathToFileURL(join(__dirname, 'index.mjs')).href
}

function isSourceEntryUrl(entryUrl: string): boolean {
  return new URL(entryUrl).pathname.endsWith('.ts')
}

function withDevelopmentExecArgv(execArgv: string[]): string[] {
  return execArgv.includes(DEVELOPMENT_EXPORT_CONDITION)
    ? [...execArgv]
    : [...execArgv, DEVELOPMENT_EXPORT_CONDITION]
}

function withProcessMemoryExecArgv(
  execArgv: string[],
  resourceLimits: TranslationWorkerResourceLimits | undefined
): string[] {
  const next = execArgv.filter(
    (arg) => !arg.startsWith('--max-old-space-size=') && !arg.startsWith('--max-semi-space-size=')
  )
  if (resourceLimits?.maxOldGenerationSizeMb) {
    next.push(`--max-old-space-size=${Math.max(64, resourceLimits.maxOldGenerationSizeMb)}`)
  }
  if (resourceLimits?.maxYoungGenerationSizeMb) {
    next.push(`--max-semi-space-size=${Math.max(16, resourceLimits.maxYoungGenerationSizeMb)}`)
  }
  return next
}

function buildSourceBootstrapWorkerSource(): string {
  return `
const { parentPort, workerData } = require('node:worker_threads')
;(async () => {
  const entryUrl = workerData.${SOURCE_BOOTSTRAP_ENTRY_URL_KEY}
  if (typeof entryUrl !== 'string') {
    throw new Error('Invalid translation worker bootstrap entry URL.')
  }
  const { tsImport } = await import('tsx/esm/api')
  await tsImport(entryUrl, { parentURL: entryUrl })
})().catch((error) => {
  parentPort?.postMessage(
    error instanceof Error
      ? { type: 'error', error: { kind: 'runtime', message: error.message } }
      : { type: 'error', error: { kind: 'runtime', message: String(error) } }
  )
  process.exit(1)
})
`
}

function buildProcessBootstrapSource(): string {
  return `
;(async () => {
  const entryUrl = process.env.${PROCESS_ENTRY_URL_ENV}
  if (typeof entryUrl !== 'string' || entryUrl.length === 0) {
    throw new Error('Invalid translation process entry URL.')
  }
  const mod = entryUrl.endsWith('.ts')
    ? await import('tsx/esm/api').then(({ tsImport }) => tsImport(entryUrl, { parentURL: entryUrl }))
    : await import(entryUrl)
  if (typeof mod.runManagedLocalTranslationChildProcess !== 'function') {
    throw new Error('Translation process entry did not expose runManagedLocalTranslationChildProcess.')
  }
  await mod.runManagedLocalTranslationChildProcess()
})().catch((error) => {
  process.send?.(
    error instanceof Error
      ? { type: 'error', error: { kind: 'runtime', message: error.message } }
      : { type: 'error', error: { kind: 'runtime', message: String(error) } }
  )
  process.exit(1)
})
`
}

export async function runManagedLocalTranslationChildProcess(): Promise<void> {
  if (typeof process.send !== 'function') {
    throw new Error('Missing IPC channel for managed local translation process.')
  }

  const request = await new Promise<ManagedLocalTranslationWorkerRequest>((resolve, reject) => {
    process.once('message', (message: unknown) => {
      if (!isWorkerRequest(message)) {
        reject(new Error('Invalid managed local translation process payload.'))
        return
      }
      resolve(message)
    })
    process.send?.({ type: 'ready' } satisfies ManagedLocalTranslationWorkerMessage)
  })

  await runManagedLocalTranslationHost(request, {
    postMessage(message) {
      process.send?.(message)
    },
    onAbort(callback) {
      process.on('message', (message: unknown) => {
        if (message === 'abort') callback()
      })
    },
  })
}

function isManagedLocalTranslationWorkerMessage(
  value: unknown
): value is ManagedLocalTranslationWorkerMessage {
  if (typeof value !== 'object' || value === null) return false
  const type = Reflect.get(value, 'type')
  if (type === 'ready' || type === 'complete') return true
  if (type === 'event') {
    const event = Reflect.get(value, 'event')
    return (
      typeof event === 'object' && event !== null && typeof Reflect.get(event, 'index') === 'number'
    )
  }
  if (type === 'error') {
    const error = Reflect.get(value, 'error')
    return (
      typeof error === 'object' &&
      error !== null &&
      typeof Reflect.get(error, 'message') === 'string'
    )
  }
  return false
}

function createProcessExitError(input: {
  code: number | null
  signal: NodeJS.Signals | null
}): Error {
  return new Error(
    `Translation engine process exited unexpectedly with ${formatProcessStatus(input)}.`
  )
}

function createProcessCloseError(input: {
  code: number | null
  signal: NodeJS.Signals | null
}): Error {
  return new Error(
    `Translation engine process closed unexpectedly with ${formatProcessStatus(input)}.`
  )
}

function formatProcessStatus(input: {
  code: number | null
  signal: NodeJS.Signals | null
}): string {
  const detail =
    input.signal !== null
      ? `signal ${input.signal}`
      : input.code !== null
        ? `exit code ${input.code}`
        : 'unknown exit status'
  return detail
}

async function readProcessRssMb(pid: number): Promise<number | undefined> {
  if (process.platform === 'win32') return undefined
  const { stdout } = await execFileAsync('ps', ['-o', 'rss=', '-p', String(pid)])
  const rssKb = Number(stdout.trim())
  return Number.isFinite(rssKb) && rssKb > 0 ? rssKb / 1024 : undefined
}

function isWorkerRequest(value: unknown): value is ManagedLocalTranslationWorkerRequest {
  if (typeof value !== 'object' || value === null) return false
  const engineId = Reflect.get(value, 'engineId')
  const sourceLanguage = Reflect.get(value, 'sourceLanguage')
  const targetLanguage = Reflect.get(value, 'targetLanguage')
  const inputs = Reflect.get(value, 'inputs')
  const cacheDir = Reflect.get(value, 'cacheDir')
  return (
    (engineId === 'local' || engineId === 'local-ct2' || engineId === 'local-llama') &&
    typeof sourceLanguage === 'string' &&
    typeof targetLanguage === 'string' &&
    Array.isArray(inputs) &&
    inputs.every((entry) => typeof entry === 'string') &&
    typeof cacheDir === 'string'
  )
}

if (!isMainThread) {
  if (!isWorkerRequest(workerData)) {
    throw new Error('Invalid managed local translation worker payload.')
  }
  void runManagedLocalTranslationHost(workerData, {
    postMessage(message) {
      parentPort?.postMessage(message)
    },
    onAbort(callback) {
      parentPort?.on('message', (message: unknown) => {
        if (message === 'abort') callback()
      })
    },
  })
}
