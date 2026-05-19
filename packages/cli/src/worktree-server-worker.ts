import type { Worker } from 'node:worker_threads'

export interface WorktreeServerStartOptions {
  projectDir: string
  port: number
  open: false
}

export interface WorktreeServerWorkerData {
  projectDir: string
  port: number
}

export interface CreateWorktreeServerWorkerOptions {
  execArgv: string[]
  workerData: WorktreeServerWorkerData
}

export type WorktreeServerWorkerFactory = (options: CreateWorktreeServerWorkerOptions) => Worker

export interface WorkerReadyMessage {
  type: 'ready'
  serverUrl: string
}

export interface WorkerErrorMessage {
  type: 'error'
  message: string
  stack?: string
}

export function isWorktreeServerWorkerData(value: unknown): value is WorktreeServerWorkerData {
  if (typeof value !== 'object' || value === null) return false
  const data = value as Record<string, unknown>
  return typeof data.projectDir === 'string' && typeof data.port === 'number'
}

export function toWorkerErrorMessage(error: unknown): WorkerErrorMessage {
  if (error instanceof Error) {
    return { type: 'error', message: error.message, stack: error.stack }
  }
  return { type: 'error', message: String(error) }
}

export function normalizeSourceBootstrapEntryUrl(entryUrl: string): string {
  const url = new URL(entryUrl)
  url.search = ''
  url.hash = ''
  return url.href
}

export function buildWorktreeServerStartOptions(
  data: WorktreeServerWorkerData
): WorktreeServerStartOptions {
  return {
    projectDir: data.projectDir,
    port: data.port,
    open: false,
  }
}
