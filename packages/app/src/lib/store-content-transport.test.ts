/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Prove the Store-content transport fetches a composite-identity Pull projection (6.11).
 * 2. Prove malformed successful payloads are rejected with explicit contract-error evidence.
 * 3. Prove the request encodes the composite identity (envUri + Store id + kind), never Store id alone.
 *
 * Original request (2026-07-30): "Stores 完全可以融入 `Environment Center` 这个东西。"
 */
import { HostedBackendContractError } from '@openspecui/core/hosted-contract'
import { describe, expect, it, vi } from 'vitest'
import { fetchBackendStoreContentProjection } from './store-content-transport'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function hostedEnvelope(data: unknown) {
  return { result: { data } }
}

function readySpecsState() {
  return {
    identity: 'env://1|team|specs',
    workGeneration: 1,
    invalidationCause: 'initial',
    state: 'ready',
    data: { available: true, specs: [{ id: 'auth', requirementCount: 3 }], storeId: 'team' },
    freshness: 'current',
    snapshotGeneration: 1,
    error: null,
  }
}

describe('Store-content transport (6.11)', () => {
  it('fetches a Specs Pull projection keyed by composite identity', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const target = typeof url === 'string' ? url : url.toString()
      expect(target).toContain('/trpc/storesContent.readSpecsProjection?input=')
      // The composite identity (envUri + storeId + kind) is encoded in the input, not Store id alone.
      expect(target).toContain(encodeURIComponent('"storeId":"team"'))
      expect(target).toContain(encodeURIComponent('"envUri":"env://1"'))
      expect(target).toContain(encodeURIComponent('"kind":"specs"'))
      return jsonResponse(hostedEnvelope(readySpecsState()))
    })
    const state = await fetchBackendStoreContentProjection(
      { apiBaseUrl: 'http://127.0.0.1:3100', fetchImpl },
      { envUri: 'env://1', storeId: 'team', kind: 'specs' }
    )
    expect(state.state).toBe('ready')
  })

  it('fetches a Changes Pull projection through the changes procedure', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const target = typeof url === 'string' ? url : url.toString()
      expect(target).toContain('/trpc/storesContent.readChangesProjection?input=')
      return jsonResponse(
        hostedEnvelope({
          identity: 'env://1|team|changes',
          workGeneration: 1,
          invalidationCause: 'initial',
          state: 'ready',
          data: {
            available: true,
            changes: [
              {
                name: 'reshape',
                completedTasks: 1,
                totalTasks: 4,
                lastModified: '2026-07-30',
                status: 'in-progress',
              },
            ],
            storeId: 'team',
          },
          freshness: 'current',
          snapshotGeneration: 1,
          error: null,
        })
      )
    })
    const state = await fetchBackendStoreContentProjection(
      { apiBaseUrl: 'http://127.0.0.1:3100/', fetchImpl },
      { envUri: 'env://1', storeId: 'team', kind: 'changes' }
    )
    expect(state.state).toBe('ready')
  })

  it('rejects a malformed successful payload with a contract error retaining the parse cause', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(hostedEnvelope({ available: true, specs: [] }))
    )
    await expect(
      fetchBackendStoreContentProjection(
        { apiBaseUrl: 'http://127.0.0.1:3100', fetchImpl },
        { envUri: 'env://1', storeId: 'team', kind: 'specs' }
      )
    ).rejects.toThrow(HostedBackendContractError)
  })

  it('throws on a non-OK response status', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: 'unauthorized' }, 401))
    await expect(
      fetchBackendStoreContentProjection(
        { apiBaseUrl: 'http://127.0.0.1:3100', fetchImpl },
        { envUri: 'env://1', storeId: 'team', kind: 'specs' }
      )
    ).rejects.toThrow('failed: 401')
  })
})
