/**
 * Orthogonal intents (updated 2026-07-18 Asia/Shanghai):
 * 1. Verify live, fallback-live, and static Search transports recover and propagate requests.
 * 2. Verify source switches clear stale hits before the replacement subscription responds.
 *
 * Original request (2026-07-15): "Referenced Specs are navigable and searchable but visibly read-only."
 * Derived requirement (2026-07-18): Checkpoint 6.10 scopes Search to the active root or direct Referenced Specs.
 */
import type { ProjectSearchScope, SearchHit } from '@openspecui/search'
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const modeState = vi.hoisted(() => ({ staticMode: true }))
const docsMock = vi.fn().mockResolvedValue([])
const trpcQueryMock = vi.fn().mockResolvedValue([])
const realtimeSubscribeMock = vi.fn(
  (_input: undefined, _handlers: { onData: () => void; onError: (error: Error) => void }) => ({
    unsubscribe: vi.fn(),
  })
)
interface SearchSubscribeHandlers {
  onData: (data: SearchHit[]) => void
  onError: (error: Error) => void
}
interface SearchSubscribeInput {
  query: string
  scope: ProjectSearchScope
  limit?: number
}

const trpcSubscribeMock = vi.fn(
  (_input: SearchSubscribeInput, _handlers: SearchSubscribeHandlers) => ({
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

    async search(input: SearchSubscribeInput) {
      return searchMock(input)
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
    initMock.mockRejectedValueOnce(new Error('init failed')).mockResolvedValueOnce(undefined)
    searchMock.mockResolvedValueOnce([
      {
        documentId: 'spec:owned:auth',
        kind: 'spec',
        scope: 'active-root',
        title: 'Auth',
        href: '/specs/owned/auth',
        path: 'owned:openspec/specs/auth/spec.md',
        score: 10,
        snippet: 'Auth',
        updatedAt: 1,
      },
    ])

    const { useSearch } = await import('./use-search')

    const { result, rerender } = renderHook(({ query }: { query: string }) => useSearch(query), {
      initialProps: { query: 'auth' },
    })

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
    expect(searchMock).toHaveBeenLastCalledWith({
      query: 'auth again',
      scope: 'active-root',
      limit: 50,
    })
  })

  it('uses subscription in dynamic mode', async () => {
    modeState.staticMode = false

    trpcSubscribeMock.mockImplementation(
      (_input: SearchSubscribeInput, handlers: SearchSubscribeHandlers) => {
        handlers.onData([
          {
            documentId: 'change:add-auth',
            kind: 'change',
            scope: 'active-root',
            title: 'Add Auth',
            href: '/changes/add-auth',
            path: 'openspec/changes/add-auth',
            score: 10,
            snippet: 'Auth',
            updatedAt: 1,
          },
        ])
        return { unsubscribe: vi.fn() }
      }
    )

    const { useSearch } = await import('./use-search')
    const { result } = renderHook(() => useSearch('auth'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
      expect(result.current.data[0]?.documentId).toBe('change:add-auth')
    })

    expect(trpcSubscribeMock).toHaveBeenCalledTimes(1)
    expect(trpcSubscribeMock).toHaveBeenCalledWith(
      { query: 'auth', scope: 'active-root', limit: 50 },
      expect.any(Object)
    )
  })

  it('falls back to query + realtime subscription when backend lacks search.subscribe', async () => {
    modeState.staticMode = false

    trpcSubscribeMock.mockImplementation(
      (_input: SearchSubscribeInput, handlers: SearchSubscribeHandlers) => {
        handlers.onError(new Error('No "subscription"-procedure on path "search.subscribe"'))
        return { unsubscribe: vi.fn() }
      }
    )
    trpcQueryMock.mockResolvedValueOnce([
      {
        documentId: 'spec:owned:auth',
        kind: 'spec',
        scope: 'active-root',
        title: 'Auth',
        href: '/specs/owned/auth',
        path: 'owned:openspec/specs/auth/spec.md',
        score: 10,
        snippet: 'Auth',
        updatedAt: 1,
      },
    ])

    const { useSearch } = await import('./use-search')
    const { result } = renderHook(() => useSearch('auth'))

    await waitFor(() => {
      expect(result.current.error).toBeNull()
      expect(result.current.data[0]?.documentId).toBe('spec:owned:auth')
    })

    expect(trpcSubscribeMock).toHaveBeenCalledTimes(1)
    expect(trpcQueryMock).toHaveBeenCalledWith({
      query: 'auth',
      scope: 'active-root',
      limit: 50,
    })
    expect(realtimeSubscribeMock).toHaveBeenCalledTimes(1)
  })

  it('clears prior-scope hits before the replacement subscription responds', async () => {
    modeState.staticMode = false
    const handlersByScope = new Map<ProjectSearchScope, SearchSubscribeHandlers>()
    trpcSubscribeMock.mockImplementation(
      (input: SearchSubscribeInput, handlers: SearchSubscribeHandlers) => {
        handlersByScope.set(input.scope, handlers)
        return { unsubscribe: vi.fn() }
      }
    )

    const { useSearch } = await import('./use-search')
    const { result, rerender } = renderHook(
      ({ scope }: { scope: ProjectSearchScope }) => useSearch('auth', scope),
      { initialProps: { scope: 'active-root' } }
    )

    await waitFor(() => {
      expect(handlersByScope.has('active-root')).toBe(true)
    })
    handlersByScope.get('active-root')?.onData([
      {
        documentId: 'spec:owned:auth',
        kind: 'spec',
        scope: 'active-root',
        title: 'Auth',
        href: '/specs/owned/auth',
        path: 'owned:openspec/specs/auth/spec.md',
        score: 10,
        snippet: 'Auth',
        updatedAt: 1,
      },
    ])
    await waitFor(() => expect(result.current.data).toHaveLength(1))

    rerender({ scope: 'referenced-specs' })

    expect(result.current.scope).toBe('referenced-specs')
    expect(result.current.data).toEqual([])
    expect(result.current.isLoading).toBe(true)
    await waitFor(() => {
      expect(handlersByScope.has('referenced-specs')).toBe(true)
    })

    handlersByScope.get('active-root')?.onData([
      {
        documentId: 'spec:owned:late',
        kind: 'spec',
        scope: 'active-root',
        title: 'Late',
        href: '/specs/owned/late',
        path: 'owned:openspec/specs/late/spec.md',
        score: 10,
        snippet: 'Late',
        updatedAt: 1,
      },
    ])
    expect(result.current.data).toEqual([])

    handlersByScope.get('referenced-specs')?.onData([
      {
        documentId: 'spec:referenced:platform:auth',
        kind: 'spec',
        scope: 'referenced-specs',
        title: 'Auth',
        href: '/specs/referenced/platform/auth',
        path: 'referenced:platform:specs/auth',
        score: 10,
        snippet: 'Auth',
        updatedAt: 0,
      },
    ])
    await waitFor(() => {
      expect(result.current.data[0]?.documentId).toBe('spec:referenced:platform:auth')
    })
  })
})
