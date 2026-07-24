/**
 * Orthogonal intents (updated 2026-07-25 Asia/Shanghai):
 * 1. Project backend Store list/doctor through the hosted REST boundary without registry semantics.
 * 2. Preserve upstream Store facts and exit status; never invent health/completeness/ownership.
 * 3. Resolve Access Gate credentials only from the runtime registry for the request locator.
 * 4. Decode every successful hosted tRPC envelope through the shared browser-safe contract boundary.
 *
 * Original request (2026-07-15): "我仍然需要看到一个初版的 Store Manager。"
 * Section 9.6/9.8 App Store Inspector/Inventory wiring against the backend store procedures.
 *
 * 关键中性约束（AGENTS.md）：
 *  - Inventory 投影 `openspec store list --json`；Inspector 投影 `openspec store doctor [id] --json`。
 *  - Hosted 封套可加 provenance，但不替换或重解释上游 payload 事实。
 *  - App 是 observed-only 投影；不做 Store Git clone/pull/push/sync，不做文件系统扫描。
 */
import {
  decodeHostedTrpcData,
  HostedBackendContractError,
  HostedRootContextStateSchema,
  HostedStoreDoctorEnvelopeSchema,
  HostedStoreListEnvelopeSchema,
  HostedStoreMutationStartResponseSchema,
  type HostedRootContextState,
  type HostedStoreDoctorEnvelope,
  type HostedStoreListEnvelope,
  type HostedStoreMutationStartResponse,
} from '@openspecui/core/hosted-contract'
import { readLaunchCredential } from './launch-credential'

/** Minimal REST shapes returned by the backend Store feature envelope. */
export type BackendStoreListEnvelope = HostedStoreListEnvelope
export type BackendStoreDoctorEnvelope = HostedStoreDoctorEnvelope

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

function unavailableStoreList(error: {
  kind: string
  message: string
  cause?: unknown
}): BackendStoreListEnvelope {
  return {
    available: false,
    stores: [],
    error: error.cause ? { ...error, cause: error.cause } : error,
  }
}

function unavailableStoreDoctor(error: {
  kind: string
  message: string
  cause?: unknown
}): BackendStoreDoctorEnvelope {
  return {
    available: false,
    stores: [],
    error: error.cause ? { ...error, cause: error.cause } : error,
  }
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
    return unavailableStoreList({
      kind: 'transport',
      message: `Store list request failed: ${response.status}`,
    })
  }
  let payload: unknown
  try {
    payload = await response.json()
  } catch (error) {
    return unavailableStoreList({
      kind: 'contract',
      message: 'Malformed Store list JSON response.',
      cause: new HostedBackendContractError('Malformed Store list JSON response.', {
        cause: error,
      }),
    })
  }
  const decoded = decodeHostedTrpcData(HostedStoreListEnvelopeSchema, payload)
  if (decoded.kind === 'contract-error') {
    return unavailableStoreList({
      kind: 'contract',
      message: 'Malformed Store list contract response.',
      cause: decoded.error,
    })
  }
  return decoded.data
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
    return unavailableStoreDoctor({
      kind: 'transport',
      message: `Store doctor request failed: ${response.status}`,
    })
  }
  let payload: unknown
  try {
    payload = await response.json()
  } catch (error) {
    return unavailableStoreDoctor({
      kind: 'contract',
      message: 'Malformed Store doctor JSON response.',
      cause: new HostedBackendContractError('Malformed Store doctor JSON response.', {
        cause: error,
      }),
    })
  }
  const decoded = decodeHostedTrpcData(HostedStoreDoctorEnvelopeSchema, payload)
  if (decoded.kind === 'contract-error') {
    return unavailableStoreDoctor({
      kind: 'contract',
      message: 'Malformed Store doctor contract response.',
      cause: decoded.error,
    })
  }
  return decoded.data
}

/** Fetch the project Root Context (`openspec context --json` joined with Doctor) for the Context Matrix. */
export async function fetchBackendRootContext(
  options: BackendClientOptions
): Promise<HostedRootContextState> {
  const fetchImpl = options.fetchImpl ?? fetch
  const response = await fetchImpl(`${normalizeBaseUrl(options.apiBaseUrl)}/trpc/rootContext.get`, {
    cache: 'no-store',
    headers: { accept: 'application/json', ...authHeaders(options.apiBaseUrl) },
  })
  if (!response.ok) {
    throw new Error(`Root Context request failed: ${response.status}`)
  }
  let payload: unknown
  try {
    payload = await response.json()
  } catch (error) {
    throw new HostedBackendContractError('Root Context contract JSON response is malformed.', {
      cause: error,
    })
  }
  const decoded = decodeHostedTrpcData(HostedRootContextStateSchema, payload)
  if (decoded.kind === 'contract-error') {
    throw new HostedBackendContractError('Root Context contract response is malformed.', {
      cause: decoded.error,
    })
  }
  return decoded.data
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
