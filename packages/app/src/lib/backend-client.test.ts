/**
 * Orthogonal intents (updated 2026-07-25 Asia/Shanghai):
 * 1. Prove Store Inventory/Inspector transport preserves backend envelopes and failures.
 * 2. Prove every hosted HTTP/RPC request resolves credentials by its own normalized locator.
 * 3. Prove successful hosted envelopes are decoded instead of asserted into Store/Root/Mutation contracts.
 *
 * Original request (2026-07-15): "我仍然需要看到一个初版的 Store Manager。"
 * Delivery correction (2026-07-24): callers cannot supply another locator's credential.
 */
import { HostedBackendContractError } from '@openspecui/core/hosted-contract'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  BackendStoreMutationContractError,
  BackendStoreMutationRequestError,
  fetchBackendRootContext,
  fetchBackendStoreInspector,
  fetchBackendStoreInventory,
  mutateBackendStore,
} from './backend-client'
import { bindLaunchCredential, clearLaunchCredential } from './launch-credential'

const API_A = 'http://localhost:3100'
const API_B = 'http://localhost:3200'

function createJsonFetch(response: unknown, status = 200): typeof fetch {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(response), {
        status,
        headers: { 'content-type': 'application/json' },
      })
  )
}

afterEach(() => {
  clearLaunchCredential(API_A)
  clearLaunchCredential(API_B)
})

describe('backend-client store inventory', () => {
  it('parses an available tRPC envelope and preserves upstream stores', async () => {
    const fetchImpl = createJsonFetch({
      result: {
        data: {
          available: true,
          stores: [{ id: 'team', root: '/stores/team' }],
          evidence: { success: true },
        },
      },
    })
    const envelope = await fetchBackendStoreInventory({
      apiBaseUrl: `${API_A}/`,
      fetchImpl,
    })
    expect(envelope.available).toBe(true)
    expect(envelope.stores).toEqual([{ id: 'team', root: '/stores/team' }])
  })

  it('degrades to unavailable on a non-ok response without throwing', async () => {
    const fetchImpl = createJsonFetch({}, 500)
    const envelope = await fetchBackendStoreInventory({ apiBaseUrl: API_A, fetchImpl })
    expect(envelope.available).toBe(false)
    expect(envelope.error?.kind).toBe('transport')
  })

  it('classifies malformed 200 Store data as a contract error instead of a successful empty inventory', async () => {
    const envelope = await fetchBackendStoreInventory({
      apiBaseUrl: API_A,
      fetchImpl: createJsonFetch({ result: { data: { available: true } } }),
    })

    expect(envelope).toMatchObject({
      available: false,
      stores: [],
      error: { kind: 'contract' },
    })
  })
})

describe('backend-client store inspector', () => {
  it('parses an available doctor envelope', async () => {
    const fetchImpl = createJsonFetch({
      result: { data: { available: true, stores: [{ id: 'team', healthy: true }] } },
    })
    const envelope = await fetchBackendStoreInspector({
      apiBaseUrl: API_A,
      storeId: 'team',
      fetchImpl,
    })
    expect(envelope.available).toBe(true)
    expect(envelope.stores).toEqual([{ id: 'team', healthy: true }])
  })

  it('encodes the optional storeId input safely', async () => {
    let requestedUrl = ''
    const fetchImpl: typeof fetch = vi.fn(async (input) => {
      requestedUrl = String(input)
      return new Response(JSON.stringify({ result: { data: { available: true, stores: [] } } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })
    await fetchBackendStoreInspector({ apiBaseUrl: API_A, storeId: 'team id', fetchImpl })
    expect(requestedUrl).not.toContain('team id')
    expect(requestedUrl).toContain('input=')
  })

  it('classifies malformed 200 Store doctor data as a contract error instead of a successful empty inspector', async () => {
    const envelope = await fetchBackendStoreInspector({
      apiBaseUrl: API_A,
      fetchImpl: createJsonFetch({ result: { data: { available: true } } }),
    })

    expect(envelope).toMatchObject({
      available: false,
      stores: [],
      error: { kind: 'contract' },
    })
  })
})

describe('backend-client credential ownership', () => {
  it('uses the matching locator credential for every existing hosted HTTP/RPC client', async () => {
    bindLaunchCredential(API_A, 'credential-a')
    bindLaunchCredential(API_B, 'credential-b')
    const observed: Array<{ url: string; authorization: string | null }> = []
    const fetchImpl: typeof fetch = vi.fn(async (input, init) => {
      const url = String(input)
      observed.push({
        url,
        authorization: new Headers(init?.headers).get('authorization'),
      })
      const data = url.includes('stores.mutate')
        ? {
            requestId: 'request-b',
            envUri: 'openspecui-env://1/b',
            kind: 'register',
            status: 'accepted',
            observedAt: 1,
            rejoined: false,
          }
        : url.includes('rootContext.get')
          ? { state: 'loading', data: null, attempt: null, error: null, observedAt: 1 }
          : { available: true, stores: [] }
      return new Response(JSON.stringify({ result: { data } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })

    await fetchBackendStoreInventory({ apiBaseUrl: API_A, fetchImpl })
    await fetchBackendStoreInspector({ apiBaseUrl: API_B, fetchImpl })
    await fetchBackendRootContext({ apiBaseUrl: API_A, fetchImpl })
    await mutateBackendStore(
      { apiBaseUrl: API_B, fetchImpl },
      { requestId: 'request-b', kind: 'register', path: '/tmp/store-b' }
    )

    expect(observed.map(({ authorization }) => authorization)).toEqual([
      'Bearer credential-a',
      'Bearer credential-b',
      'Bearer credential-a',
      'Bearer credential-b',
    ])
  })
})

describe('backend-client Root Context', () => {
  it('rejects malformed 200 Root Context data instead of collapsing it to null', async () => {
    await expect(
      fetchBackendRootContext({
        apiBaseUrl: API_A,
        fetchImpl: createJsonFetch({ result: { data: { state: 'ready' } } }),
      })
    ).rejects.toThrow('Root Context contract')
  })

  it('keeps a non-ok Root Context response as a transport request failure, not a contract failure', async () => {
    const failure = await fetchBackendRootContext({
      apiBaseUrl: API_A,
      fetchImpl: createJsonFetch({}, 503),
    }).catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(Error)
    expect(failure).not.toBeInstanceOf(HostedBackendContractError)
    expect(failure).toMatchObject({ message: 'Root Context request failed: 503' })
  })
})

describe('backend-client Store mutation admission', () => {
  it.each([
    {
      status: 'accepted' as const,
      rejoined: false,
    },
    {
      status: 'running' as const,
      rejoined: true,
    },
  ])('decodes a flat $status response with rejoined=$rejoined', async ({ status, rejoined }) => {
    const data = {
      requestId: 'request-a',
      envUri: 'openspecui-env://1/a',
      kind: 'setup',
      status,
      observedAt: 4,
      rejoined,
    }
    const result = await mutateBackendStore(
      {
        apiBaseUrl: API_A,
        fetchImpl: createJsonFetch({ result: { data } }),
      },
      { requestId: 'request-a', kind: 'setup', path: '/tmp/store-a' }
    )

    expect(result).toEqual(data)
  })

  it('throws a typed request error for HTTP/auth/validation rejection without a fake record', async () => {
    const promise = mutateBackendStore(
      { apiBaseUrl: API_A, fetchImpl: createJsonFetch({ error: 'Unauthorized' }, 401) },
      { requestId: 'rejected', kind: 'remove', storeId: 'team', confirmDelete: true }
    )

    await expect(promise).rejects.toMatchObject({
      name: 'BackendStoreMutationRequestError',
      status: 401,
    })
    await expect(promise).rejects.toBeInstanceOf(BackendStoreMutationRequestError)
  })

  it('throws a typed contract error for malformed tRPC data without indeterminate evidence', async () => {
    const promise = mutateBackendStore(
      {
        apiBaseUrl: API_A,
        fetchImpl: createJsonFetch({
          result: {
            data: {
              requestId: 'malformed',
              kind: 'register',
              status: 'indeterminate',
              observedAt: Date.now(),
            },
          },
        }),
      },
      { requestId: 'malformed', kind: 'register', path: '/tmp/store' }
    )

    await expect(promise).rejects.toBeInstanceOf(BackendStoreMutationContractError)
    await expect(promise).rejects.toMatchObject({ name: 'BackendStoreMutationContractError' })
    await expect(promise).rejects.toMatchObject({ cause: expect.any(Error) })
  })
})
