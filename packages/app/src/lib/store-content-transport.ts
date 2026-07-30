/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Pull backend Store-content (Specs/active Changes) Projection Work through the hosted REST boundary (6.11).
 * 2. Reject malformed successful payloads and retain explicit contract-error evidence.
 * 3. Key requests by composite (envUri, Store id, kind); Store id alone is never sufficient.
 *
 * Original request (2026-07-30): "Stores 完全可以融入 `Environment Center` 这个东西。"
 * Spec: hosted-environment-delivery › "Environment-Scoped Store Content Projection".
 *
 * This transport consumes the hosted router procedure backed by the Server StoreContentProjectionService (P6/6.10).
 * Credential resolution stays in the locator-owned runtime memory owner; this transport is credential-free by shape
 * and never accepts client credentials in projection payloads.
 */
import {
  decodeHostedTrpcData,
  HostedBackendContractError,
  HostedStoreContentChangesProjectionStateSchema,
  HostedStoreContentSpecsProjectionStateSchema,
  type HostedStoreContentChangesProjectionState,
  type HostedStoreContentSpecsProjectionState,
  type HostedTrpcDecodeResult,
} from '@openspecui/core/hosted-contract'
import { readLaunchCredential } from './launch-credential'

/** Composite Store-content identity: envUri + Store id + kind. Store id alone is never sufficient (6.8). */
export interface StoreContentRequestIdentity {
  readonly envUri: string
  readonly storeId: string
  readonly kind: 'specs' | 'changes'
}

/** Hosted client locator; its optional Bearer credential is resolved from runtime memory at dispatch. */
export interface StoreContentTransportOptions {
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

/**
 * Fetch one Store-content Projection Work Pull state. Throws a `HostedBackendContractError` when a successful
 * response carries a malformed payload, retaining the decoder's parse cause (6.11).
 */
export function fetchBackendStoreContentProjection(
  options: StoreContentTransportOptions,
  identity: StoreContentRequestIdentity & { readonly kind: 'specs' }
): Promise<HostedStoreContentSpecsProjectionState>
export function fetchBackendStoreContentProjection(
  options: StoreContentTransportOptions,
  identity: StoreContentRequestIdentity & { readonly kind: 'changes' }
): Promise<HostedStoreContentChangesProjectionState>
export async function fetchBackendStoreContentProjection(
  options: StoreContentTransportOptions,
  identity: StoreContentRequestIdentity
): Promise<HostedStoreContentSpecsProjectionState | HostedStoreContentChangesProjectionState> {
  const fetchImpl = options.fetchImpl ?? fetch
  // Composite identity is encoded as the procedure input; Store id alone is never accepted as sufficient.
  const input = { envUri: identity.envUri, storeId: identity.storeId, kind: identity.kind }
  const procedure =
    identity.kind === 'specs'
      ? 'storesContent.readSpecsProjection'
      : 'storesContent.readChangesProjection'
  const requestUrl = `${normalizeBaseUrl(options.apiBaseUrl)}/trpc/${procedure}?input=${encodeURIComponent(
    JSON.stringify(input)
  )}`
  const response = await fetchImpl(requestUrl, {
    cache: 'no-store',
    headers: { accept: 'application/json', ...authHeaders(options.apiBaseUrl) },
  })
  if (!response.ok)
    throw new Error(`Store ${identity.kind} content request failed: ${response.status}`)
  let payload: unknown
  try {
    payload = await response.json()
  } catch (error) {
    throw new HostedBackendContractError(
      `Store ${identity.kind} content JSON response is malformed.`,
      {
        cause: error,
      }
    )
  }
  const schema =
    identity.kind === 'specs'
      ? HostedStoreContentSpecsProjectionStateSchema
      : HostedStoreContentChangesProjectionStateSchema
  const decoded: HostedTrpcDecodeResult<
    HostedStoreContentSpecsProjectionState | HostedStoreContentChangesProjectionState
  > = decodeHostedTrpcData(schema, payload)
  if (decoded.kind === 'contract-error') {
    throw new HostedBackendContractError(`Store ${identity.kind} content response is malformed.`, {
      cause: decoded.error,
    })
  }
  if (decoded.data.data && decoded.data.data.storeId !== identity.storeId) {
    throw new HostedBackendContractError(
      `Store ${identity.kind} content response belongs to another Store.`,
      {
        cause: new Error(
          `Expected Store ${identity.storeId}, received ${decoded.data.data.storeId}.`
        ),
      }
    )
  }
  return decoded.data
}
