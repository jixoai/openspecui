import { findAvailablePort } from '@openspecui/server'
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { Worker } from 'node:worker_threads'

import {
  OPENSPECUI_RUNTIME_CAPABILITIES,
  isHostedBackendHealthResponse,
  type GitWorktreeHandoff,
} from '@openspecui/core'
import type { SpawnCommandConfig } from './local-hosted-app-dev'
import type {
  WorktreeServerWorkerData,
  WorktreeServerWorkerFactory,
} from './worktree-server-worker'
import {
  isWorktreeHandoffRequestMessage,
  postWorktreeHandoffError,
} from './worktree-server-worker-handoff'

const DEFAULT_CHILD_TIMEOUT_MS = 15_000
const DEFAULT_PORT_START = 3100
const DEFAULT_PORT_ATTEMPTS = 200
const DEVELOPMENT_EXPORT_CONDITION = '--conditions=development'

export interface LocalCliWorkspace {
  repoRoot: string
  cliPackageDir: string
}

export interface WorktreeInstanceManager {
  ensureWorktreeServer(input: { targetPath: string }): Promise<GitWorktreeHandoff>
  close(): Promise<void>
}

interface WorktreeInstanceManagerOptions {
  currentProjectDir: string
  currentServerUrl: string
  runtimeDir: string
  createWorker?: WorktreeServerWorkerFactory
  readinessTimeoutMs?: number
  preferredPortStart?: number
}

interface ManagedInstance {
  projectDir: string
  serverUrl: string
  runtime: WorktreeServerRuntime
  lastUsedAt: number
}

interface WorktreeServerRuntime {
  once(event: 'exit', listener: () => void): void
  once(event: 'error', listener: (error: Error) => void): void
  onError(listener: (error: Error) => void): void
  onHandoffRequest?(handler: (input: { targetPath: string }) => Promise<GitWorktreeHandoff>): void
  onReady(listener: (serverUrl: string) => void): void
  stop(): Promise<void>
}

interface WorktreeServerWorkerErrorMessage {
  type: 'error'
  message: string
  stack?: string
}

interface WorktreeServerWorkerReadyMessage {
  type: 'ready'
  serverUrl: string
}

export interface WorktreeServerWorkerLaunchPlan {
  kind: 'worker'
  createWorker: WorktreeServerWorkerFactory
  execArgv: string[]
  workerData: WorktreeServerWorkerData
}

export interface WorktreeServerProcessLaunchPlan extends SpawnCommandConfig {
  kind: 'process'
}

export type WorktreeServerLaunchPlan =
  | WorktreeServerWorkerLaunchPlan
  | WorktreeServerProcessLaunchPlan

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getMissingRuntimeCapabilities(value: unknown): string[] {
  if (!isRecord(value) || !Array.isArray(value.runtimeCapabilities)) {
    return [...OPENSPECUI_RUNTIME_CAPABILITIES]
  }

  const capabilities = new Set(value.runtimeCapabilities.filter((item) => typeof item === 'string'))
  return OPENSPECUI_RUNTIME_CAPABILITIES.filter((capability) => !capabilities.has(capability))
}

function describeIncompatibleHealth(value: unknown, projectDir: string): string {
  if (!isRecord(value)) {
    return 'health payload is not an object'
  }

  const reasons: string[] = []
  if (value.status !== 'ok') reasons.push('status is not ok')
  if (value.projectDir !== projectDir) reasons.push('projectDir does not match target worktree')
  if (typeof value.openspecuiVersion !== 'string') reasons.push('openspecuiVersion is missing')
  if (typeof value.hostedShellProtocolVersion !== 'number') {
    reasons.push('hostedShellProtocolVersion is missing')
  }
  if (typeof value.embeddedUiUrl !== 'string') reasons.push('embeddedUiUrl is missing')

  const missingCapabilities = getMissingRuntimeCapabilities(value)
  if (missingCapabilities.length > 0) {
    reasons.push(`missing runtime capabilities: ${missingCapabilities.join(', ')}`)
  }

  return reasons.join('; ') || 'health payload does not satisfy the runtime contract'
}

export async function assertWorktreeServerCompatible(options: {
  serverUrl: string
  projectDir: string
}): Promise<void> {
  const response = await fetch(`${options.serverUrl}/api/health`, {
    headers: { accept: 'application/json' },
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new Error(`Worktree server health check failed with HTTP ${response.status}`)
  }

  const payload = (await response.json()) as unknown
  if (!isHostedBackendHealthResponse(payload)) {
    throw new Error(
      `Worktree server runtime is incompatible: ${describeIncompatibleHealth(
        payload,
        options.projectDir
      )}`
    )
  }
  if (payload.projectDir !== options.projectDir) {
    throw new Error(
      `Worktree server runtime is incompatible: ${describeIncompatibleHealth(
        payload,
        options.projectDir
      )}`
    )
  }
}

export function resolveLocalCliWorkspace(runtimeDir: string): LocalCliWorkspace | null {
  const repoRoot = resolve(runtimeDir, '..', '..', '..')
  const rootPackageJson = join(repoRoot, 'package.json')
  const cliPackageJson = join(repoRoot, 'packages', 'cli', 'package.json')
  const cliSourceEntry = join(repoRoot, 'packages', 'cli', 'src', 'cli.ts')

  if (!existsSync(rootPackageJson) || !existsSync(cliPackageJson) || !existsSync(cliSourceEntry)) {
    return null
  }

  return {
    repoRoot,
    cliPackageDir: join(repoRoot, 'packages', 'cli'),
  }
}

function withDevelopmentExecArgv(execArgv: string[]): string[] {
  if (execArgv.includes(DEVELOPMENT_EXPORT_CONDITION)) {
    return [...execArgv]
  }
  return [...execArgv, DEVELOPMENT_EXPORT_CONDITION]
}

function createNodeCliCommandPlan(options: {
  cliEntry: string
  projectDir: string
  port: number
  cwd: string
}): WorktreeServerProcessLaunchPlan {
  return {
    kind: 'process',
    command: process.execPath,
    args: [
      options.cliEntry,
      'start',
      options.projectDir,
      '--port',
      String(options.port),
      '--no-open',
    ],
    cwd: options.cwd,
    env: { ...process.env },
  }
}

export function createWorktreeServerLaunchPlan(options: {
  runtimeDir: string
  projectDir: string
  port: number
  createWorker?: WorktreeServerWorkerFactory
}): WorktreeServerLaunchPlan {
  const workerData = {
    projectDir: options.projectDir,
    port: options.port,
  }
  const workspace = resolveLocalCliWorkspace(options.runtimeDir)

  if (options.createWorker) {
    let execArgv = [...process.execArgv]
    if (workspace) {
      const cliSourceDir = join(workspace.cliPackageDir, 'src')
      if (resolve(options.runtimeDir) === resolve(cliSourceDir)) {
        execArgv = withDevelopmentExecArgv(execArgv)
      }
    }

    return {
      kind: 'worker',
      createWorker: options.createWorker,
      execArgv,
      workerData,
    }
  }

  return createNodeCliCommandPlan({
    cliEntry: join(options.runtimeDir, 'cli.mjs'),
    projectDir: options.projectDir,
    port: options.port,
    cwd: options.projectDir,
  })
}

async function waitForServerReady(options: {
  serverUrl: string
  projectDir: string
  runtime: WorktreeServerRuntime
  timeoutMs: number
}): Promise<void> {
  let exitMessage: string | null = null
  let startupError: Error | null = null
  let readyServerUrl: string | null = null

  options.runtime.once('exit', () => {
    exitMessage = 'runtime exited'
  })
  options.runtime.onError((error) => {
    startupError = error
  })
  options.runtime.onReady((serverUrl) => {
    readyServerUrl = serverUrl
  })

  const deadline = Date.now() + options.timeoutMs
  while (Date.now() < deadline) {
    if (startupError) {
      throw startupError
    }
    if (exitMessage) {
      throw new Error(`Worktree server exited before becoming ready (${exitMessage})`)
    }

    if (readyServerUrl) {
      await assertWorktreeServerCompatible({
        serverUrl: readyServerUrl,
        projectDir: options.projectDir,
      })
      return
    }

    try {
      await assertWorktreeServerCompatible({
        serverUrl: options.serverUrl,
        projectDir: options.projectDir,
      })
      return
    } catch (error) {
      if (error instanceof Error && error.message.includes('runtime is incompatible')) {
        throw error
      }
      // Server is still starting.
    }

    await delay(250)
  }

  throw new Error(`Timed out waiting for worktree server at ${options.serverUrl}`)
}

class ProcessWorktreeServerRuntime implements WorktreeServerRuntime {
  readonly child: ChildProcess

  constructor(plan: WorktreeServerProcessLaunchPlan) {
    this.child = spawn(plan.command, plan.args, {
      cwd: plan.cwd,
      env: plan.env,
      stdio: 'inherit',
      detached: process.platform !== 'win32',
    })
  }

  once(event: 'exit', listener: () => void): void
  once(event: 'error', listener: (error: Error) => void): void
  once(event: 'exit' | 'error', listener: (() => void) | ((error: Error) => void)): void {
    if (event === 'error') {
      this.child.once(event, listener as (error: Error) => void)
      return
    }
    this.child.once(event, listener as () => void)
  }

  onError(listener: (error: Error) => void): void {
    this.child.on('error', listener)
  }

  onReady(): void {
    // Process runtimes use HTTP health polling for readiness.
  }

  async stop(): Promise<void> {
    await stopChildProcess(this.child)
  }
}

class WorkerThreadWorktreeServerRuntime implements WorktreeServerRuntime {
  readonly worker: Worker
  private readonly structuredErrorListeners = new Set<(error: Error) => void>()
  private readonly readyListeners = new Set<(serverUrl: string) => void>()
  private readyServerUrl: string | null = null
  private startupError: Error | null = null

  constructor(plan: WorktreeServerWorkerLaunchPlan) {
    this.worker = plan.createWorker({
      execArgv: plan.execArgv,
      workerData: plan.workerData,
    })
    this.worker.on('message', (message: unknown) => {
      if (isWorkerErrorMessage(message)) {
        const error = new Error(message.message)
        error.stack = message.stack
        this.startupError = error
        for (const listener of this.structuredErrorListeners) {
          listener(error)
        }
        return
      }

      if (isWorkerReadyMessage(message)) {
        this.readyServerUrl = message.serverUrl
        for (const listener of this.readyListeners) {
          listener(message.serverUrl)
        }
      }
    })
  }

  once(event: 'exit', listener: () => void): void
  once(event: 'error', listener: (error: Error) => void): void
  once(event: 'exit' | 'error', listener: (() => void) | ((error: Error) => void)): void {
    if (event === 'error') {
      this.worker.once(event, listener as (error: Error) => void)
      return
    }
    this.worker.once(event, listener as () => void)
  }

  onError(listener: (error: Error) => void): void {
    this.structuredErrorListeners.add(listener)
    this.worker.on('error', listener)
    if (this.startupError) {
      listener(this.startupError)
    }
  }

  onReady(listener: (serverUrl: string) => void): void {
    this.readyListeners.add(listener)
    if (this.readyServerUrl) {
      listener(this.readyServerUrl)
    }
  }

  onHandoffRequest(handler: (input: { targetPath: string }) => Promise<GitWorktreeHandoff>): void {
    this.worker.on('message', (message: unknown) => {
      if (!isWorktreeHandoffRequestMessage(message)) {
        return
      }

      void handler({ targetPath: message.targetPath })
        .then((handoff) => {
          this.worker.postMessage({
            type: 'worktree-handoff:result',
            requestId: message.requestId,
            handoff,
          })
        })
        .catch((error) => {
          postWorktreeHandoffError(this.worker, message.requestId, error)
        })
    })
  }

  async stop(): Promise<void> {
    if (this.worker.threadId === -1) return
    this.worker.postMessage('close')
    const exited = await waitForWorkerExit(this.worker, 5_000)
    if (exited) return
    await this.worker.terminate()
  }
}

function isWorkerReadyMessage(value: unknown): value is WorktreeServerWorkerReadyMessage {
  if (typeof value !== 'object' || value === null) return false
  const message = value as Record<string, unknown>
  return message.type === 'ready' && typeof message.serverUrl === 'string'
}

function isWorkerErrorMessage(value: unknown): value is WorktreeServerWorkerErrorMessage {
  if (typeof value !== 'object' || value === null) return false
  const message = value as Record<string, unknown>
  return (
    message.type === 'error' &&
    typeof message.message === 'string' &&
    (message.stack === undefined || typeof message.stack === 'string')
  )
}

function startWorktreeServerRuntime(plan: WorktreeServerLaunchPlan): WorktreeServerRuntime {
  if (plan.kind === 'worker') {
    return new WorkerThreadWorktreeServerRuntime(plan)
  }
  return new ProcessWorktreeServerRuntime(plan)
}

async function isHealthyInstance(instance: ManagedInstance): Promise<boolean> {
  try {
    await assertWorktreeServerCompatible({
      serverUrl: instance.serverUrl,
      projectDir: instance.projectDir,
    })
    return true
  } catch {
    return false
  }
}

function killChildProcess(child: ChildProcess, signal: NodeJS.Signals): void {
  if (process.platform !== 'win32' && child.pid) {
    try {
      process.kill(-child.pid, signal)
      return
    } catch {
      // Fall back to direct child signal if the process group no longer exists.
    }
  }

  child.kill(signal)
}

function waitForChildExit(child: ChildProcess, timeoutMs: number): Promise<boolean> {
  return new Promise((resolvePromise) => {
    const timer = setTimeout(() => {
      cleanup()
      resolvePromise(false)
    }, timeoutMs)

    const onExit = () => {
      cleanup()
      resolvePromise(true)
    }

    const cleanup = () => {
      clearTimeout(timer)
      child.off('exit', onExit)
    }

    child.once('exit', onExit)
  })
}

async function stopChildProcess(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return
  }

  killChildProcess(child, 'SIGTERM')
  const exited = await waitForChildExit(child, 5_000)
  if (exited) {
    return
  }

  killChildProcess(child, 'SIGKILL')
  await waitForChildExit(child, 1_000)
}

function waitForWorkerExit(worker: Worker, timeoutMs: number): Promise<boolean> {
  return new Promise((resolvePromise) => {
    const timer = setTimeout(() => {
      cleanup()
      resolvePromise(false)
    }, timeoutMs)

    const onExit = () => {
      cleanup()
      resolvePromise(true)
    }

    const cleanup = () => {
      clearTimeout(timer)
      worker.off('exit', onExit)
    }

    worker.once('exit', onExit)
  })
}

function delay(ms: number): Promise<void> {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms)
  })
}

export function createWorktreeInstanceManager(
  options: WorktreeInstanceManagerOptions
): WorktreeInstanceManager {
  const currentProjectDir = resolve(options.currentProjectDir)
  const instances = new Map<string, ManagedInstance>()
  const pending = new Map<string, Promise<GitWorktreeHandoff>>()

  const ensureWorktreeServer = async (input: {
    targetPath: string
  }): Promise<GitWorktreeHandoff> => {
    const targetPath = resolve(input.targetPath)
    if (targetPath === currentProjectDir) {
      return {
        projectDir: currentProjectDir,
        serverUrl: options.currentServerUrl,
      }
    }

    const existing = instances.get(targetPath)
    if (existing && (await isHealthyInstance(existing))) {
      existing.lastUsedAt = Date.now()
      return {
        projectDir: existing.projectDir,
        serverUrl: existing.serverUrl,
      }
    }

    if (existing) {
      instances.delete(targetPath)
      await existing.runtime.stop()
    }

    const pendingInstance = pending.get(targetPath)
    if (pendingInstance) {
      return pendingInstance
    }

    const promise = (async (): Promise<GitWorktreeHandoff> => {
      const port = await findAvailablePort(
        options.preferredPortStart ?? DEFAULT_PORT_START,
        DEFAULT_PORT_ATTEMPTS
      )
      const plan = createWorktreeServerLaunchPlan({
        runtimeDir: options.runtimeDir,
        projectDir: targetPath,
        port,
        createWorker: options.createWorker,
      })
      const runtime = startWorktreeServerRuntime(plan)
      const serverUrl = `http://localhost:${port}`

      try {
        await waitForServerReady({
          serverUrl,
          projectDir: targetPath,
          runtime,
          timeoutMs: options.readinessTimeoutMs ?? DEFAULT_CHILD_TIMEOUT_MS,
        })
      } catch (error) {
        await runtime.stop()
        throw error
      }

      const instance: ManagedInstance = {
        projectDir: targetPath,
        serverUrl,
        runtime,
        lastUsedAt: Date.now(),
      }
      instances.set(targetPath, instance)
      runtime.onHandoffRequest?.(ensureWorktreeServer)
      runtime.once('exit', () => {
        const current = instances.get(targetPath)
        if (current?.runtime === runtime) {
          instances.delete(targetPath)
        }
      })

      return {
        projectDir: targetPath,
        serverUrl,
      }
    })()

    pending.set(targetPath, promise)
    try {
      return await promise
    } finally {
      pending.delete(targetPath)
    }
  }

  const close = async (): Promise<void> => {
    await Promise.all(
      [...instances.values()].map(async (instance) => {
        instances.delete(instance.projectDir)
        await instance.runtime.stop()
      })
    )
  }

  return {
    ensureWorktreeServer,
    close,
  }
}
