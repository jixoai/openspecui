/**
 * Orthogonal intents (updated 2026-07-18 Asia/Shanghai):
 * 1. Verify live and static Search transports recover and propagate source-scoped requests.
 * 2. Verify incompatible legacy backends fail closed without mixed Search fallback.
 * 3. Verify source switches retire stale subscriptions and reject late data.
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

vi.mock('@openspecui/search', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@openspecui/search')>()
  return {
    ...actual,
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
  }
})

describe('useSearch', () => {
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

  it('fails closed without a legacy query when backend lacks search.subscribe', async () => {
    modeState.staticMode = false

    trpcSubscribeMock.mockImplementation(
      (_input: SearchSubscribeInput, handlers: SearchSubscribeHandlers) => {
        handlers.onError(new Error('No "subscription"-procedure on path "search.subscribe"'))
        return { unsubscribe: vi.fn() }
      }
    )
    const { useSearch } = await import('./use-search')
    const { result, rerender } = renderHook(({ query }: { query: string }) => useSearch(query), {
      initialProps: { query: 'auth' },
    })

    await waitFor(() => {
      expect(result.current.error?.message).toMatch(/source-scoped Search/i)
    })

    expect(result.current.data).toEqual([])
    expect(result.current.isLoading).toBe(false)
    expect(trpcSubscribeMock).toHaveBeenCalledTimes(1)
    expect(trpcQueryMock).not.toHaveBeenCalled()
    expect(realtimeSubscribeMock).not.toHaveBeenCalled()

    rerender({ query: 'auth again' })
    await waitFor(() => {
      expect(result.current.error?.message).toMatch(/source-scoped Search/i)
    })
    expect(trpcSubscribeMock).toHaveBeenCalledTimes(1)
    expect(trpcQueryMock).not.toHaveBeenCalled()
    expect(realtimeSubscribeMock).not.toHaveBeenCalled()
  })

  it.each([
    ['missing', undefined],
    ['wrong', 'active-root' as const],
  ])('exposes a live Reference hit with %s scope provenance as an error', async (_kind, scope) => {
    modeState.staticMode = false
    trpcSubscribeMock.mockImplementation(
      (_input: SearchSubscribeInput, handlers: SearchSubscribeHandlers) => {
        handlers.onData([
          {
            documentId: 'spec:referenced:platform:auth',
            kind: 'spec',
            scope,
            title: 'Auth',
            href: '/specs/referenced/platform/auth',
            path: 'referenced:platform:specs/auth',
            score: 10,
            snippet: 'Auth',
            updatedAt: 0,
          },
        ])
        return { unsubscribe: vi.fn() }
      }
    )

    const { useSearch } = await import('./use-search')
    const { result } = renderHook(() => useSearch('auth', 'referenced-specs'))

    await waitFor(() => {
      expect(result.current.error?.message).toMatch(/scope/i)
    })
    expect(result.current.data).toEqual([])
  })

  it('clears prior-scope hits before the replacement subscription responds', async () => {
    modeState.staticMode = false
    const handlersByScope = new Map<ProjectSearchScope, SearchSubscribeHandlers>()
    const unsubscribeByScope = new Map<ProjectSearchScope, ReturnType<typeof vi.fn>>()
    trpcSubscribeMock.mockImplementation(
      (input: SearchSubscribeInput, handlers: SearchSubscribeHandlers) => {
        handlersByScope.set(input.scope, handlers)
        const unsubscribe = vi.fn()
        unsubscribeByScope.set(input.scope, unsubscribe)
        return { unsubscribe }
      }
    )

    const { useSearch } = await import('./use-search')
    const { result, rerender, unmount } = renderHook(
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
    expect(unsubscribeByScope.get('active-root')).toHaveBeenCalledTimes(1)
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

    expect(unsubscribeByScope.get('active-root')).toHaveBeenCalledTimes(1)
    unmount()
    expect(unsubscribeByScope.get('active-root')).toHaveBeenCalledTimes(1)
    expect(unsubscribeByScope.get('referenced-specs')).toHaveBeenCalledTimes(1)
  })
})
