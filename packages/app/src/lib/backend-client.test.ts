/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Prove the Store Inventory/Inspector client parses backend envelopes and preserves upstream facts.
 * 2. Prove transport failure degrades to an unavailable envelope without crashing.
 *
 * Original request (2026-07-15): "我仍然需要看到一个初版的 Store Manager。"
 * Section 9.6/9.8 App Store data wiring.
 */
import { describe, expect, it, vi } from 'vitest'
import { fetchBackendStoreInspector, fetchBackendStoreInventory } from './backend-client'

function mockFetch(response: unknown, ok = true): typeof fetch {
  return vi.fn(async () => ({
    ok,
    status: ok ? 200 : 500,
    json: async () => response,
  })) as unknown as typeof fetch
}

describe('backend-client store inventory', () => {
  it('parses an available tRPC envelope and preserves upstream stores', async () => {
    const fetchImpl = mockFetch({
      result: {
        data: {
          available: true,
          stores: [{ id: 'team', root: '/stores/team' }],
          evidence: { success: true },
        },
      },
    })
    const envelope = await fetchBackendStoreInventory({
      apiBaseUrl: 'http://localhost:3100/',
      fetchImpl,
    })
    expect(envelope.available).toBe(true)
    expect(envelope.stores).toEqual([{ id: 'team', root: '/stores/team' }])
  })

  it('degrades to unavailable on a non-ok response without throwing', async () => {
    const fetchImpl = mockFetch({}, false)
    const envelope = await fetchBackendStoreInventory({
      apiBaseUrl: 'http://localhost:3100',
      fetchImpl,
    })
    expect(envelope.available).toBe(false)
    expect(envelope.error?.kind).toBe('transport')
  })

  it('sends the Authorization header when a credential is supplied', async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({ result: { data: { available: true, stores: [] } } }),
    })) as unknown as typeof fetch
    await fetchBackendStoreInventory({
      apiBaseUrl: 'http://localhost:3100',
      credential: 'secret',
      fetchImpl,
    })
    const init = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[1] as RequestInit
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secret')
  })
})

describe('backend-client store inspector', () => {
  it('parses an available doctor envelope', async () => {
    const fetchImpl = mockFetch({
      result: {
        data: {
          available: true,
          stores: [{ id: 'team', healthy: true }],
        },
      },
    })
    const envelope = await fetchBackendStoreInspector({
      apiBaseUrl: 'http://localhost:3100',
      storeId: 'team',
      fetchImpl,
    })
    expect(envelope.available).toBe(true)
    expect(envelope.stores).toEqual([{ id: 'team', healthy: true }])
  })

  it('encodes the optional storeId input safely', async () => {
    const fetchImpl = mockFetch({ result: { data: { available: true, stores: [] } } })
    await fetchBackendStoreInspector({
      apiBaseUrl: 'http://localhost:3100',
      storeId: 'team id',
      fetchImpl,
    })
    const url = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string
    // The storeId is JSON-encoded then URL-encoded; spaces are never raw in the URL.
    expect(url).not.toContain('team id')
    expect(url).toContain('input=')
  })
})
