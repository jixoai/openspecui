/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Project backend Store list/doctor through the hosted REST boundary without registry semantics.
 * 2. Preserve upstream Store facts and exit status; never invent health/completeness/ownership.
 * 3. Keep the App read-only over Stores it observes; mutations stay backend-owned.
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

/** Optional Bearer credential passed by the App when the backend Access Gate is enabled. */
export interface BackendClientOptions {
  apiBaseUrl: string
  /** Bearer credential held only in session memory; never persisted to localStorage/tabs. */
  credential?: string | null
  fetchImpl?: typeof fetch
}

function normalizeBaseUrl(apiBaseUrl: string): string {
  return apiBaseUrl.replace(/\/+$/, '')
}

function authHeaders(credential?: string | null): Record<string, string> {
  return credential ? { Authorization: `Bearer ${credential}` } : {}
}

/** Fetch the Store Inventory (`store list`) projection for one backend. */
export async function fetchBackendStoreInventory(
  options: BackendClientOptions
): Promise<BackendStoreListEnvelope> {
  const fetchImpl = options.fetchImpl ?? fetch
  const response = await fetchImpl(`${normalizeBaseUrl(options.apiBaseUrl)}/trpc/stores.list`, {
    cache: 'no-store',
    headers: { accept: 'application/json', ...authHeaders(options.credential) },
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
      headers: { accept: 'application/json', ...authHeaders(options.credential) },
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
    headers: { accept: 'application/json', ...authHeaders(options.credential) },
  })
  if (!response.ok) return null
  const envelope = (await response.json()) as { result?: { data?: unknown } }
  const data = envelope.result?.data
  if (!data || typeof data !== 'object') return null
  return data as RootContextState
}
