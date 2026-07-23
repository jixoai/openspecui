/**
 * Orthogonal intents (updated 2026-07-24 Asia/Shanghai):
 * 1. Project backend Store list/doctor through the hosted REST boundary without registry semantics.
 * 2. Preserve upstream Store facts and exit status; never invent health/completeness/ownership.
 * 3. Resolve Access Gate credentials only from the runtime registry for the request locator.
 *
 * Original request (2026-07-15): "我仍然需要看到一个初版的 Store Manager。"
 * Section 9.6/9.8 App Store Inspector/Inventory wiring against the backend store procedures.
 *
 * 关键中性约束（AGENTS.md）：
 *  - Inventory 投影 `openspec store list --json`；Inspector 投影 `openspec store doctor [id] --json`。
 *  - Hosted 封套可加 provenance，但不替换或重解释上游 payload 事实。
 *  - App 是 observed-only 投影；不做 Store Git clone/pull/push/sync，不做文件系统扫描。
 */
import type { RootContextState } from '@openspecui/core'
import type { StoreDoctorResult, StoreListResult } from '@openspecui/core/store-types'
import { readLaunchCredential } from './launch-credential'

/** Minimal REST shapes returned by the backend Store feature envelope. */
export interface BackendStoreListEnvelope {
  available: boolean
  stores: StoreListResult extends { stores: infer T } ? T : never
  evidence?: unknown
  error?: { kind: string; message: string; cliVersion?: string }
  cliVersion?: string
}

export interface BackendStoreDoctorEnvelope {
  available: boolean
  stores: StoreDoctorResult extends { stores: infer T } ? T : never
  evidence?: unknown
  error?: { kind: string; message: string; cliVersion?: string }
  cliVersion?: string
}

/** Hosted client locator; its optional Bearer credential is resolved from runtime memory at dispatch. */
export interface BackendClientOptions {
  apiBaseUrl: string
  fetchImpl?: typeof fetch
}

function normalizeBaseUrl(apiBaseUrl: string): string {
  return apiBaseUrl.replace(/\/+$/, '')
}

function authHeaders(apiBaseUrl: string): Record<string, string> {
  const credential = readLaunchCredential(apiBaseUrl)
  return credential ? { Authorization: `Bearer ${credential}` } : {}
}

/** Fetch the Store Inventory (`store list`) projection for one backend. */
export async function fetchBackendStoreInventory(
  options: BackendClientOptions
): Promise<BackendStoreListEnvelope> {
  const fetchImpl = options.fetchImpl ?? fetch
  const response = await fetchImpl(`${normalizeBaseUrl(options.apiBaseUrl)}/trpc/stores.list`, {
    cache: 'no-store',
    headers: { accept: 'application/json', ...authHeaders(options.apiBaseUrl) },
  })
  if (!response.ok) {
    return {
      available: false,
      stores: [],
      error: { kind: 'transport', message: `Store list request failed: ${response.status}` },
    }
  }
  // tRPC query GET returns `{ result: { data: ... } }`.
  const envelope = (await response.json()) as { result?: { data?: unknown } }
  const data = envelope.result?.data
  if (!data || typeof data !== 'object') {
    return {
      available: false,
      stores: [],
      error: { kind: 'transport', message: 'Malformed Store list response.' },
    }
  }
  return data as BackendStoreListEnvelope
}

/** Fetch the Store Inspector (`store doctor`) projection for one backend, optionally one Store id. */
export async function fetchBackendStoreInspector(
  options: BackendClientOptions & { storeId?: string }
): Promise<BackendStoreDoctorEnvelope> {
  const fetchImpl = options.fetchImpl ?? fetch
  const input = options.storeId
    ? encodeURIComponent(JSON.stringify({ id: options.storeId }))
    : 'null'
  const response = await fetchImpl(
    `${normalizeBaseUrl(options.apiBaseUrl)}/trpc/stores.doctor?input=${input}`,
    {
      cache: 'no-store',
      headers: { accept: 'application/json', ...authHeaders(options.apiBaseUrl) },
    }
  )
  if (!response.ok) {
    return {
      available: false,
      stores: [],
      error: { kind: 'transport', message: `Store doctor request failed: ${response.status}` },
    }
  }
  const envelope = (await response.json()) as { result?: { data?: unknown } }
  const data = envelope.result?.data
  if (!data || typeof data !== 'object') {
    return {
      available: false,
      stores: [],
      error: { kind: 'transport', message: 'Malformed Store doctor response.' },
    }
  }
  return data as BackendStoreDoctorEnvelope
}

/** Fetch the project Root Context (`openspec context --json` joined with Doctor) for the Context Matrix. */
export async function fetchBackendRootContext(
  options: BackendClientOptions
): Promise<RootContextState | null> {
  const fetchImpl = options.fetchImpl ?? fetch
  const response = await fetchImpl(`${normalizeBaseUrl(options.apiBaseUrl)}/trpc/rootContext.get`, {
    cache: 'no-store',
    headers: { accept: 'application/json', ...authHeaders(options.apiBaseUrl) },
  })
  if (!response.ok) return null
  const envelope = (await response.json()) as { result?: { data?: unknown } }
  const data = envelope.result?.data
  if (!data || typeof data !== 'object') return null
  return data as RootContextState
}

/** Store mutation kind, mirroring the backend `stores.mutate` procedure. */
export type BackendStoreMutationKind = 'setup' | 'register' | 'unregister' | 'remove'

export interface BackendStoreMutateInput {
  requestId: string
  kind: BackendStoreMutationKind
  storeId?: string
  path?: string
  initGit?: boolean
  remote?: string
  id?: string
  confirmIdentity?: boolean
  confirmDelete?: boolean
}

/** One backend-owned Store mutation lifecycle record returned by `stores.mutate`. */
export interface BackendStoreMutationRecord {
  requestId: string
  kind: BackendStoreMutationKind
  status: 'accepted' | 'running' | 'succeeded' | 'failed' | 'indeterminate'
  storeId?: string
  result?: { exitStatus: number | null; stdout?: string; stderr?: string; payload?: unknown }
  observedAt: number
}

/**
 * Start a backend-owned Store mutation via the hosted `stores.mutate` procedure. The mutation runs
 * server-side under the `StoreMutationService` lifecycle; client disconnect only detaches observation
 * and does not kill the CLI. V1 has no Cancel and no automatic retry.
 */
export async function mutateBackendStore(
  options: BackendClientOptions,
  input: BackendStoreMutateInput
): Promise<BackendStoreMutationRecord> {
  const fetchImpl = options.fetchImpl ?? fetch
  const response = await fetchImpl(`${normalizeBaseUrl(options.apiBaseUrl)}/trpc/stores.mutate`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      ...authHeaders(options.apiBaseUrl),
    },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    return {
      requestId: input.requestId,
      kind: input.kind,
      status: 'indeterminate',
      storeId: input.storeId,
      result: { exitStatus: null, stderr: `Store mutation request failed: ${response.status}` },
      observedAt: Date.now(),
    }
  }
  const envelope = (await response.json()) as { result?: { data?: unknown } }
  const data = envelope.result?.data
  if (!data || typeof data !== 'object') {
    return {
      requestId: input.requestId,
      kind: input.kind,
      status: 'indeterminate',
      storeId: input.storeId,
      observedAt: Date.now(),
    }
  }
  return data as BackendStoreMutationRecord
}
