import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SearchHit } from '@openspecui/search'

const modeState = vi.hoisted(() => ({ staticMode: true }))
const docsMock = vi.fn().mockResolvedValue([])
const trpcQueryMock = vi.fn().mockResolvedValue([])
const realtimeSubscribeMock = vi.fn((_input: undefined, _handlers: { onData: () => void; onError: (error: Error) => void }) => ({
  unsubscribe: vi.fn(),
}))
interface SearchSubscribeHandlers {
  onData: (data: SearchHit[]) => void
  onError: (error: Error) => void
}

const trpcSubscribeMock = vi.fn(
  (_input: { query: string; limit?: number }, _handlers: SearchSubscribeHandlers) => ({
    unsubscribe: vi.fn(),
  })
)
const initMock = vi.fn<() => Promise<void>>()
const searchMock = vi.fn()

vi.mock('./static-mode', () => ({
  isStaticMode: () => modeState.staticMode,
}))

vi.mock('./static-data-provider', () => ({
  getSearchDocuments: docsMock,
}))

vi.mock('./trpc', () => ({
  trpcClient: {
    search: {
      subscribe: {
        subscribe: trpcSubscribeMock,
      },
      query: {
        query: trpcQueryMock,
      },
    },
    realtime: {
      onFileChange: {
        subscribe: realtimeSubscribeMock,
      },
    },
  },
}))

vi.mock('@openspecui/search', () => ({
  WebWorkerSearchProvider: class MockWebWorkerSearchProvider {
    async init(): Promise<void> {
      return initMock()
    }

    async replaceAll(): Promise<void> {
      return Promise.resolve()
    }

    async search() {
      return searchMock()
    }

    async dispose(): Promise<void> {
      return Promise.resolve()
    }
  },
}))

describe('useSearch static provider recovery', () => {
  afterEach(() => {
    modeState.staticMode = true
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('retries provider initialization after a failed init', async () => {
    initMock
      .mockRejectedValueOnce(new Error('init failed'))
      .mockResolvedValueOnce(undefined)
    searchMock.mockResolvedValueOnce([
      {
        documentId: 'spec:auth',
        kind: 'spec',
        title: 'Auth',
        href: '/specs/auth',
        path: 'openspec/specs/auth/spec.md',
        score: 10,
        snippet: 'Auth',
        updatedAt: 1,
      },
    ])

    const { useSearch } = await import('./use-search')

    const { result, rerender } = renderHook(
      ({ query }: { query: string }) => useSearch(query),
      {
        initialProps: { query: 'auth' },
      }
    )

    await waitFor(() => {
      expect(result.current.error?.message).toBe('init failed')
    })

    rerender({ query: 'auth again' })

    await waitFor(() => {
      expect(result.current.error).toBeNull()
      expect(result.current.data).toHaveLength(1)
    })

    expect(initMock).toHaveBeenCalledTimes(2)
    expect(docsMock).toHaveBeenCalledTimes(2)
  })

  it('uses subscription in dynamic mode', async () => {
    modeState.staticMode = false

    trpcSubscribeMock.mockImplementation((_input: { query: string; limit?: number }, handlers: SearchSubscribeHandlers) => {
      handlers.onData([
        {
          documentId: 'change:add-auth',
          kind: 'change',
          title: 'Add Auth',
          href: '/changes/add-auth',
          path: 'openspec/changes/add-auth',
          score: 10,
          snippet: 'Auth',
          updatedAt: 1,
        },
      ])
      return { unsubscribe: vi.fn() }
    })

    const { useSearch } = await import('./use-search')
    const { result } = renderHook(() => useSearch('auth'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
      expect(result.current.data[0]?.documentId).toBe('change:add-auth')
    })

    expect(trpcSubscribeMock).toHaveBeenCalledTimes(1)
  })

  it('falls back to query + realtime subscription when backend lacks search.subscribe', async () => {
    modeState.staticMode = false

    trpcSubscribeMock.mockImplementation((_input: { query: string; limit?: number }, handlers: SearchSubscribeHandlers) => {
      handlers.onError(new Error('No "subscription"-procedure on path "search.subscribe"'))
      return { unsubscribe: vi.fn() }
    })
    trpcQueryMock.mockResolvedValueOnce([
      {
        documentId: 'spec:auth',
        kind: 'spec',
        title: 'Auth',
        href: '/specs/auth',
        path: 'openspec/specs/auth/spec.md',
        score: 10,
        snippet: 'Auth',
        updatedAt: 1,
      },
    ])

    const { useSearch } = await import('./use-search')
    const { result } = renderHook(() => useSearch('auth'))

    await waitFor(() => {
      expect(result.current.error).toBeNull()
      expect(result.current.data[0]?.documentId).toBe('spec:auth')
    })

    expect(trpcSubscribeMock).toHaveBeenCalledTimes(1)
    expect(trpcQueryMock).toHaveBeenCalledWith({ query: 'auth', limit: 50 })
    expect(realtimeSubscribeMock).toHaveBeenCalledTimes(1)
  })
})
