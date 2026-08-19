/**
 * Orthogonal intents (updated 2026-08-04 Asia/Shanghai):
 * 1. Define the typed worker/process bootstrap contract for a worktree Server.
 * 2. Carry and runtime-validate inherited Access Gate and Web asset inputs without putting them in argv.
 * 3. Consume process-only bootstrap transfers before descendant processes can inherit them.
 * 4. Route worker-thread payloads by an explicit protocol kind before full validation.
 * 5. Define the internal graceful-close message shared by process parent and child.
 *
 * Original request (2026-07-24): "Propagate the exact parent Access Gate into worktree Servers."
 * Delivery correction (2026-07-26): child Servers inherit the parent runtime's resolved Web asset root.
 */
import { normalizeAccessGatePassword, type AccessGateCredential } from '@openspecui/core'
import type { Worker } from 'node:worker_threads'

export const WORKTREE_ACCESS_GATE_CREDENTIAL_ENV =
  'OPENSPECUI_INTERNAL_WORKTREE_ACCESS_GATE_CREDENTIAL'
export const WORKTREE_WEB_ASSETS_DIR_ENV = 'OPENSPECUI_INTERNAL_WORKTREE_WEB_ASSETS_DIR'
export const WORKTREE_SERVER_WORKER_KIND = 'worktree-server'
export const WORKTREE_PROCESS_CLOSE_MESSAGE_TYPE = 'worktree-server:close'

export interface WorktreeProcessCloseMessage {
  type: typeof WORKTREE_PROCESS_CLOSE_MESSAGE_TYPE
}

export const WORKTREE_PROCESS_CLOSE_MESSAGE: WorktreeProcessCloseMessage = {
  type: WORKTREE_PROCESS_CLOSE_MESSAGE_TYPE,
}

export interface WorktreeServerStartOptions {
  projectDir: string
  port: number
  open: false
  webAssetsDir: string
  enableWatcher?: boolean
  accessGateCredential?: AccessGateCredential
}

export interface WorktreeServerWorkerData {
  kind: typeof WORKTREE_SERVER_WORKER_KIND
  projectDir: string
  port: number
  webAssetsDir: string
  enableWatcher?: boolean
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

export function isWorktreeServerWorkerKind(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    Reflect.get(value, 'kind') === WORKTREE_SERVER_WORKER_KIND
  )
}

export function isWorktreeProcessCloseMessage(
  value: unknown
): value is WorktreeProcessCloseMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    Reflect.get(value, 'type') === WORKTREE_PROCESS_CLOSE_MESSAGE_TYPE
  )
}

export function isWorktreeServerWorkerData(value: unknown): value is WorktreeServerWorkerData {
  if (typeof value !== 'object' || value === null) return false
  const data = value as Record<string, unknown>
  return (
    data.kind === WORKTREE_SERVER_WORKER_KIND &&
    typeof data.projectDir === 'string' &&
    typeof data.port === 'number' &&
    typeof data.webAssetsDir === 'string' &&
    data.webAssetsDir.length > 0 &&
    (data.accessGateCredential === undefined || isAccessGateCredential(data.accessGateCredential))
  )
}

/** Return null for another worker protocol, but reject malformed payloads claiming this protocol. */
export function readWorktreeServerWorkerData(value: unknown): WorktreeServerWorkerData | null {
  if (!isWorktreeServerWorkerKind(value)) return null
  if (!isWorktreeServerWorkerData(value)) {
    throw new Error('Invalid worktree server worker data.')
  }
  return value
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

/** Consume the private process Web asset root and erase it before nested Managers inherit environment. */
export function consumeWorktreeProcessWebAssetsDir(env: NodeJS.ProcessEnv): string | null {
  const webAssetsDir = env[WORKTREE_WEB_ASSETS_DIR_ENV]
  delete env[WORKTREE_WEB_ASSETS_DIR_ENV]
  if (webAssetsDir === undefined) return null
  if (webAssetsDir.length === 0) {
    throw new Error('Invalid inherited worktree Web asset root.')
  }
  return webAssetsDir
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
    webAssetsDir: data.webAssetsDir,
    ...(data.enableWatcher === false ? { enableWatcher: false } : {}),
    ...(data.accessGateCredential ? { accessGateCredential: data.accessGateCredential } : {}),
  }
}
