/**
 * Orthogonal intents (created 2026-07-25 Asia/Shanghai):
 * 1. Brand backend-issued opaque environment identities without calculating them.
 * 2. Define hosted capability facts and Store mutation lifecycle vocabulary for browser consumers.
 * 3. Keep browser-safe protocol facts physically separate from Node crypto and Access Gate operations.
 *
 * Original request (2026-07-24): "可以归档旧change了，然后我们继续新的change 的开发推进"
 * P4.1 correction: browser consumers must not runtime-import the Node-bearing Core root entry.
 */
import type { CliDiagnostic } from './cli-contracts/common.js'

/** Opaque backend-issued runtime-environment identity. Browser code may brand but never compute it. */
export type EnvUri = string & { readonly __brand: 'EnvUri' }

/** Mark a backend-issued string as an opaque `EnvUri` without dereferencing or reconstructing it. */
export function asEnvUri(value: string): EnvUri {
  return value as EnvUri
}

/** Product-level Store/Context compatibility vocabulary. It is not an authorization model. */
export type StoreCapability = 'stores.inspect' | 'stores.mutate' | 'contexts.inspect'

/** Read-only backend-advertised Store/Context compatibility facts. */
export type StoreCapabilitySet = readonly StoreCapability[]

/** Whether a backend advertises a compatibility fact. This authorizes nothing. */
export function hasCapability(
  capabilities: StoreCapabilitySet | undefined,
  capability: StoreCapability
): boolean {
  return Boolean(capabilities?.includes(capability))
}

/** Store mutation kind, mirroring the CLI subcommands setup/register/unregister/remove. */
export type StoreMutationKind = 'setup' | 'register' | 'unregister' | 'remove'

/** Backend-owned Store mutation lifecycle state. */
export type StoreMutationStatus = 'accepted' | 'running' | 'succeeded' | 'failed' | 'indeterminate'

/** Terminal CLI evidence retained by a Store mutation. */
export interface StoreMutationResult {
  exitStatus: number | null
  stdout?: string
  stderr?: string
  diagnostics?: CliDiagnostic[]
  payload?: unknown
  contractError?: string
}

/** Runtime projection of one backend-owned Store mutation. */
export interface StoreMutation {
  requestId: string
  envUri: EnvUri
  kind: StoreMutationKind
  status: StoreMutationStatus
  storeId?: string
  result?: StoreMutationResult
  observedAt: number
}

/** Whether a Store mutation status is terminal. */
export function isTerminalMutationStatus(status: StoreMutationStatus): boolean {
  return status === 'succeeded' || status === 'failed' || status === 'indeterminate'
}
