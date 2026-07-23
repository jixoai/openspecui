/**
 * Orthogonal intents (updated 2026-07-24 Asia/Shanghai):
 * 1. Define the typed worker/process bootstrap contract for a worktree Server.
 * 2. Carry and runtime-validate an inherited Access Gate without putting it in argv.
 * 3. Consume process-only credential transfer before descendant processes can inherit it.
 *
 * Original request (2026-07-24): "Propagate the exact parent Access Gate into worktree Servers."
 */
import { normalizeAccessGatePassword, type AccessGateCredential } from '@openspecui/core'
import type { Worker } from 'node:worker_threads'

export const WORKTREE_ACCESS_GATE_CREDENTIAL_ENV =
  'OPENSPECUI_INTERNAL_WORKTREE_ACCESS_GATE_CREDENTIAL'

export interface WorktreeServerStartOptions {
  projectDir: string
  port: number
  open: false
  accessGateCredential?: AccessGateCredential
}

export interface WorktreeServerWorkerData {
  projectDir: string
  port: number
  accessGateCredential?: AccessGateCredential
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
  return (
    typeof data.projectDir === 'string' &&
    typeof data.port === 'number' &&
    (data.accessGateCredential === undefined || isAccessGateCredential(data.accessGateCredential))
  )
}

function isAccessGateCredential(value: unknown): value is AccessGateCredential {
  if (typeof value !== 'object' || value === null) return false
  const credential = value as Record<string, unknown>
  return (
    typeof credential.credential === 'string' &&
    credential.credential.length > 0 &&
    typeof credential.fingerprint === 'string' &&
    credential.authorizationHeader === `Bearer ${credential.credential}`
  )
}

/** Consume the private process bootstrap credential and erase it before the Server can spawn children. */
export function consumeWorktreeProcessAccessGateCredential(
  env: NodeJS.ProcessEnv
): AccessGateCredential | null {
  const credential = env[WORKTREE_ACCESS_GATE_CREDENTIAL_ENV]
  delete env[WORKTREE_ACCESS_GATE_CREDENTIAL_ENV]
  return credential ? normalizeAccessGatePassword(credential) : null
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
    ...(data.accessGateCredential ? { accessGateCredential: data.accessGateCredential } : {}),
  }
}
