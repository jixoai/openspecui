/**
 * Orthogonal intents (updated 2026-07-27 Asia/Shanghai):
 * 1. Pull backend Store and Root CLI Projection Work through the hosted REST boundary.
 * 2. Preserve upstream Store facts and exit status; never invent health/completeness/ownership.
 * 3. Resolve Access Gate credentials only from the runtime registry for the request locator.
 * 4. Decode every successful hosted tRPC envelope through the shared browser-safe contract boundary.
 * 5. Encode optional Store Doctor selection by presence and omit absent Projection input instead of sending null.
 *
 * Original request (2026-07-15): "我仍然需要看到一个初版的 Store Manager。"
 * Section 9.6/9.8 App Store Inspector/Inventory wiring against the backend store procedures.
 * Owner-reported defect (2026-07-26): Store Inspector sent `input=null` and received HTTP 400.
 *
 * 关键中性约束（AGENTS.md）：
 *  - Inventory 投影 `openspec store list --json`；Inspector 投影 `openspec store doctor [id] --json`。
 *  - Hosted 封套可加 provenance，但不替换或重解释上游 payload 事实。
 *  - App 是 observed-only 投影；不做 Store Git clone/pull/push/sync，不做文件系统扫描。
 */
import {
  decodeHostedTrpcData,
  HostedBackendContractError,
  HostedRootContextProjectionStateSchema,
  HostedStoreDoctorProjectionStateSchema,
  HostedStoreListProjectionStateSchema,
  HostedStoreMutationStartResponseSchema,
  type HostedRootContextProjectionState,
  type HostedStoreDoctorProjectionState,
  type HostedStoreListProjectionState,
  type HostedStoreMutationStartResponse,
  type HostedTrpcDecodeResult,
} from '@openspecui/core/hosted-contract'
import { readLaunchCredential } from './launch-credential'

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

async function fetchHostedProjection<T>(
  options: BackendClientOptions,
  requestUrl: string,
  decode: (payload: unknown) => HostedTrpcDecodeResult<T>,
  label: string
): Promise<T> {
  const fetchImpl = options.fetchImpl ?? fetch
  const response = await fetchImpl(requestUrl, {
    cache: 'no-store',
    headers: { accept: 'application/json', ...authHeaders(options.apiBaseUrl) },
  })
  if (!response.ok) throw new Error(`${label} request failed: ${response.status}`)
  let payload: unknown
  try {
    payload = await response.json()
  } catch (error) {
    throw new HostedBackendContractError(`${label} JSON response is malformed.`, { cause: error })
  }
  const decoded = decode(payload)
  if (decoded.kind === 'contract-error') {
    throw new HostedBackendContractError(`${label} response is malformed.`, {
      cause: decoded.error,
    })
  }
  return decoded.data
}

/** Pull the immediate Store Inventory Projection Work lifecycle. */
export function fetchBackendStoreInventoryProjection(
  options: BackendClientOptions
): Promise<HostedStoreListProjectionState> {
  return fetchHostedProjection(
    options,
    `${normalizeBaseUrl(options.apiBaseUrl)}/trpc/stores.readListProjection`,
    (payload) => decodeHostedTrpcData(HostedStoreListProjectionStateSchema, payload),
    'Store list projection'
  )
}

/** Pull the immediate selector-exact Store Doctor Projection Work lifecycle. */
export function fetchBackendStoreInspectorProjection(
  options: BackendClientOptions & { storeId?: string }
): Promise<HostedStoreDoctorProjectionState> {
  const endpoint = `${normalizeBaseUrl(options.apiBaseUrl)}/trpc/stores.readDoctorProjection`
  const requestUrl =
    options.storeId === undefined
      ? endpoint
      : `${endpoint}?input=${encodeURIComponent(JSON.stringify({ id: options.storeId }))}`
  return fetchHostedProjection(
    options,
    requestUrl,
    (payload) => decodeHostedTrpcData(HostedStoreDoctorProjectionStateSchema, payload),
    'Store doctor projection'
  )
}

/** Pull the immediate Root Context Projection Work lifecycle. */
export function fetchBackendRootContextProjection(
  options: BackendClientOptions
): Promise<HostedRootContextProjectionState> {
  return fetchHostedProjection(
    options,
    `${normalizeBaseUrl(options.apiBaseUrl)}/trpc/rootContext.readProjection`,
    (payload) => decodeHostedTrpcData(HostedRootContextProjectionStateSchema, payload),
    'Root Context projection'
  )
}

async function requestProjectionRefresh(
  options: BackendClientOptions,
  procedure: string,
  input?: unknown
): Promise<void> {
  const fetchImpl = options.fetchImpl ?? fetch
  const response = await fetchImpl(`${normalizeBaseUrl(options.apiBaseUrl)}/trpc/${procedure}`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      ...authHeaders(options.apiBaseUrl),
    },
    ...(input === undefined ? {} : { body: JSON.stringify(input) }),
  })
  if (!response.ok) throw new Error(`Projection refresh request failed: ${response.status}`)
}

/** Explicitly invalidate the Root Context Work; lifecycle Push wakes all clients. */
export function refreshBackendRootContextProjection(options: BackendClientOptions): Promise<void> {
  return requestProjectionRefresh(options, 'rootContext.refreshProjection')
}

/** Explicitly invalidate Store list and Doctor Work; lifecycle Push wakes all clients. */
export async function refreshBackendStoreProjections(options: BackendClientOptions): Promise<void> {
  await Promise.all([
    requestProjectionRefresh(options, 'stores.refreshProjection', { kind: 'list' }),
    requestProjectionRefresh(options, 'stores.refreshProjection', { kind: 'doctor' }),
  ])
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

/** Decoded backend admission/rejoin evidence; active/recent records come only from the lifecycle stream. */
export type BackendStoreMutationRecord = HostedStoreMutationStartResponse

/** HTTP/auth/validation failure before Store mutation admission. */
export class BackendStoreMutationRequestError extends Error {
  readonly kind = 'request'

  constructor(
    readonly status: number,
    readonly statusText: string
  ) {
    super(`Store mutation request failed: ${status}${statusText ? ` ${statusText}` : ''}.`)
    this.name = 'BackendStoreMutationRequestError'
  }
}

/** Browser contract failure while decoding a successful tRPC Store mutation response. */
export class BackendStoreMutationContractError extends HostedBackendContractError {
  constructor(message: string, options: ErrorOptions) {
    super(message, options)
    this.name = 'BackendStoreMutationContractError'
  }
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
    throw new BackendStoreMutationRequestError(response.status, response.statusText)
  }
  let payload: unknown
  try {
    payload = await response.json()
  } catch (error) {
    throw new BackendStoreMutationContractError('Malformed Store mutation JSON response.', {
      cause: error,
    })
  }
  const decoded = decodeHostedTrpcData(HostedStoreMutationStartResponseSchema, payload)
  if (decoded.kind === 'contract-error') {
    throw new BackendStoreMutationContractError('Malformed Store mutation admission.', {
      cause: decoded.error,
    })
  }
  return decoded.data
}
