/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Define backend-issued opaque runtime-environment identity (`envUri`).
 * 2. Define the three product-level hosted capability facts (compatibility, not permissions).
 * 3. Define backend-owned Store mutation lifecycle and terminal CLI evidence.
 * 4. Define the single shared Backend Access Gate credential contract.
 *
 * Original request (2026-07-15): "我们可以在 cli 上新增一个 --auth 或者 --password。"
 * Migrated from `packages/app/src/types/{env-uri,capabilities,store-mutation}.ts` so the backend is the
 * authoritative producer and both App and Server share one typed contract.
 *
 * Key invariants (AGENTS.md):
 *  - `envUri` is backend-issued, opaque, non-dereferenceable; it identifies host identity + effective
 *    OpenSpec data home. Multiple processes/ports/projects share one envUri when that pair is unchanged.
 *  - Capabilities are objective compatibility facts, never permissions, authorization, or workflow state.
 *  - Store mutations are backend-owned: `accepted -> running -> succeeded | failed`; unrecoverable
 *    terminal loss is `indeterminate`, never fabricated as failure or cancellation. V1 has no Cancel
 *    and no automatic retry. A client request id deduplicates starts within one backend process.
 *  - The Access Gate is one shared Bearer credential for the whole backend boundary; it is not an
 *    account, role, ACL, or permission system, and it provides no transport confidentiality.
 */
import { createHash, randomBytes } from 'node:crypto'
import type { CliDiagnostic } from './cli-contracts/common.js'

/**
 * Opaque runtime-environment identity string. Branding prevents treating it as a plain string or
 * dereferencing it as a URL — it is never parsed by consumers.
 */
export type EnvUri = string & { readonly __brand: 'EnvUri' }

/**
 * Mark a backend-issued string as an `EnvUri`. This is the only legal construction point; actual
 * envUri values come only from backend health/protocol responses.
 */
export function asEnvUri(value: string): EnvUri {
  return value as EnvUri
}

/**
 * Compute a stable opaque `envUri` from backend host identity plus effective OpenSpec data home.
 * The inputs are hashed so the returned URI never exposes either component; only pair equality matters.
 */
export function computeEnvUri(options: { hostIdentity: string; dataHome: string | null }): EnvUri {
  const dataHome = options.dataHome ?? ''
  const digest = createHash('sha256')
    .update(`${options.hostIdentity}\u0000${dataHome}`)
    .digest('hex')
  return asEnvUri(`openspecui-env://1/${digest}`)
}

/** Product-level Store/Context capability vocabulary. Exactly three; do not mirror CLI subcommands. */
export type StoreCapability = 'stores.inspect' | 'stores.mutate' | 'contexts.inspect'

/** Read-only capability set emitted by the backend and consumed read-only by clients. */
export type StoreCapabilitySet = readonly StoreCapability[]

/** Whether a backend advertises a capability. A pure compatibility fact; it authorizes nothing. */
export function hasCapability(
  capabilities: StoreCapabilitySet | undefined,
  capability: StoreCapability
): boolean {
  return Boolean(capabilities?.includes(capability))
}

/** Store mutation kind, mirroring the CLI subcommands setup/register/unregister/remove. */
export type StoreMutationKind = 'setup' | 'register' | 'unregister' | 'remove'

/**
 * Mutation lifecycle state. `indeterminate` is unrecoverable terminal-result loss (e.g. CLI ended
 * during disconnect and its result was not captured); it is never fabricated as failure or cancellation.
 */
export type StoreMutationStatus = 'accepted' | 'running' | 'succeeded' | 'failed' | 'indeterminate'

/** Terminal CLI evidence retained on a succeeded/failed/indeterminate mutation. */
export interface StoreMutationResult {
  exitStatus: number | null
  stdout?: string
  stderr?: string
  diagnostics?: CliDiagnostic[]
  /** CLI-returned structured payload; upstream fact preserved without reinterpretation. */
  payload?: unknown
  /** Typed CLI decoder drift; an exit-0 process is still a failed mutation when this is present. */
  contractError?: string
}

/** Runtime projection of one backend-owned Store mutation. */
export interface StoreMutation {
  /** Request id used to deduplicate mutation starts within one backend process. */
  requestId: string
  /** Target runtime environment (backend-issued opaque identity). */
  envUri: EnvUri
  kind: StoreMutationKind
  status: StoreMutationStatus
  /** Target Store id (required for remove/unregister; may be undetermined during setup). */
  storeId?: string
  /** Terminal CLI evidence (backend-authoritative). */
  result?: StoreMutationResult
  /** Observation timestamp (ms, backend-issued). */
  observedAt: number
}

/** Whether a mutation status is terminal (no further transition). */
export function isTerminalMutationStatus(status: StoreMutationStatus): boolean {
  return status === 'succeeded' || status === 'failed' || status === 'indeterminate'
}

/**
 * Backend Access Gate credential.
 *
 * One canonical form: `Authorization: Bearer <credential>`. `--auth` generates a high-entropy
 * credential; `--password` normalizes an operator secret into the same Bearer form. The gate is not
 * an account/role/ACL/permission system and provides no transport confidentiality.
 */
export interface AccessGateCredential {
  /** The shared Bearer secret. Never logged in full; only its fingerprint is safe to display. */
  readonly credential: string
  /** SHA-256 fingerprint for safe display/logging without exposing the secret. */
  readonly fingerprint: string
  /** The complete `Authorization` header value clients must send. */
  readonly authorizationHeader: string
}

/** Required byte length of a generated `--auth` credential (256 bits of entropy). */
export const ACCESS_GATE_CREDENTIAL_BYTES = 32

/** Base64url-encode without padding. */
function base64url(bytes: Buffer | string): string {
  return Buffer.from(bytes).toString('base64url')
}

/** Compute a short SHA-256 fingerprint suitable for safe display. */
export function accessGateFingerprint(credential: string): string {
  return createHash('sha256').update(credential).digest('hex').slice(0, 16)
}

/** Generate a high-entropy Bearer credential for `--auth` and return the complete gate record. */
export function generateAccessGateCredential(): AccessGateCredential {
  const credential = base64url(randomBytes(ACCESS_GATE_CREDENTIAL_BYTES))
  return {
    credential,
    fingerprint: accessGateFingerprint(credential),
    authorizationHeader: `Bearer ${credential}`,
  }
}

/**
 * Normalize an operator-supplied `--password` secret into the same Bearer gate record. The secret is
 * used verbatim as the credential (no hashing) so the gate is a single shared secret comparison.
 */
export function normalizeAccessGatePassword(password: string): AccessGateCredential {
  const credential = password
  return {
    credential,
    fingerprint: accessGateFingerprint(credential),
    authorizationHeader: `Bearer ${credential}`,
  }
}

/** Constant-time comparison of two equal-length secrets to mitigate timing side channels. */
export function constantTimeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) {
    // Compare right against itself to keep the work proportional, then return false.
    void left.compare(left)
    return false
  }
  return left.compare(right) === 0
}
