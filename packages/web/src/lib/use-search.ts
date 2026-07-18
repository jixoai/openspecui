/**
 * Orthogonal intents (updated 2026-07-18 Asia/Shanghai):
 * 1. Share one reactive Search hook across source-aware live and static providers.
 * 2. Propagate project source scope and prevent stale cross-scope result rendering.
 * 3. Fail closed when a backend predates source-scoped Search subscriptions.
 *
 * Original request (2026-07-15): "Referenced Specs are navigable and searchable but visibly read-only."
 * Derived requirement (2026-07-18): Checkpoint 6.10 scopes Search to the active root or direct Referenced Specs.
 */
import {
  parseProjectSearchHits,
  WebWorkerSearchProvider,
  type ProjectSearchHit,
  type ProjectSearchScope,
} from '@openspecui/search'
import { useEffect, useMemo, useState } from 'react'
import * as StaticProvider from './static-data-provider'
import { isStaticMode } from './static-mode'
import { trpcClient } from './trpc'

/** Current Search result state attributed to exactly one project source. */
export interface SearchState {
  scope: ProjectSearchScope
  data: ProjectSearchHit[]
  isLoading: boolean
  error: Error | null
}

let staticProvider: WebWorkerSearchProvider | null = null
let staticProviderInitPromise: Promise<WebWorkerSearchProvider> | null = null
let dynamicSearchSubscribeSupported: boolean | null = null

const SOURCE_SCOPED_SEARCH_UNAVAILABLE =
  'This backend does not support source-scoped Search. Upgrade the OpenSpecUI backend to search Active root and Referenced Specs safely.'

function isMissingSearchSubscribeProcedureError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('No "subscription"-procedure on path "search.subscribe"')
}

async function getStaticProvider(): Promise<WebWorkerSearchProvider> {
  if (staticProvider) return staticProvider
  if (staticProviderInitPromise) return staticProviderInitPromise

  staticProviderInitPromise = (async () => {
    const provider = new WebWorkerSearchProvider()
    try {
      const docs = await StaticProvider.getSearchDocuments()
      await provider.init(docs)
      staticProvider = provider
      return provider
    } catch (error) {
      await provider.dispose().catch(() => {})
      throw error
    } finally {
      staticProviderInitPromise = null
    }
  })()

  return staticProviderInitPromise
}

/** Search one objective project source without retaining results from another source. */
export function useSearch(
  query: string,
  scope: ProjectSearchScope = 'active-root',
  limit = 50
): SearchState {
  const [state, setState] = useState<SearchState>({
    scope,
    data: [],
    isLoading: false,
    error: null,
  })

  const trimmedQuery = useMemo(() => query.trim(), [query])

  useEffect(() => {
    let active = true

    if (trimmedQuery.length === 0) {
      setState({ scope, data: [], isLoading: false, error: null })
      return () => {
        active = false
      }
    }

    setState({ scope, data: [], isLoading: true, error: null })

    if (isStaticMode()) {
      getStaticProvider()
        .then((provider) => provider.search({ query: trimmedQuery, scope, limit }))
        .then((data) => {
          if (!active) return
          setState({
            scope,
            data: parseProjectSearchHits(data, scope),
            isLoading: false,
            error: null,
          })
        })
        .catch((error: unknown) => {
          if (!active) return
          setState({
            scope,
            data: [],
            isLoading: false,
            error: error instanceof Error ? error : new Error(String(error)),
          })
        })

      return () => {
        active = false
      }
    }

    if (dynamicSearchSubscribeSupported === false) {
      setState({
        scope,
        data: [],
        isLoading: false,
        error: new Error(SOURCE_SCOPED_SEARCH_UNAVAILABLE),
      })
      return () => {
        active = false
      }
    }

    const subscription = trpcClient.search.subscribe.subscribe(
      { query: trimmedQuery, scope, limit },
      {
        onData: (data) => {
          dynamicSearchSubscribeSupported = true
          if (!active) return
          try {
            setState({
              scope,
              data: parseProjectSearchHits(data, scope),
              isLoading: false,
              error: null,
            })
          } catch (error) {
            setState({
              scope,
              data: [],
              isLoading: false,
              error: error instanceof Error ? error : new Error(String(error)),
            })
          }
        },
        onError: (error) => {
          if (isMissingSearchSubscribeProcedureError(error)) {
            dynamicSearchSubscribeSupported = false
            if (!active) return
            setState({
              scope,
              data: [],
              isLoading: false,
              error: new Error(SOURCE_SCOPED_SEARCH_UNAVAILABLE),
            })
            return
          }
          if (!active) return
          setState({
            scope,
            data: [],
            isLoading: false,
            error,
          })
        },
      }
    )

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [limit, scope, trimmedQuery])

  if (state.scope !== scope) {
    return {
      scope,
      data: [],
      isLoading: trimmedQuery.length > 0,
      error: null,
    }
  }

  return state
}
