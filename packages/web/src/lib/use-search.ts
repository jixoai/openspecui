import { WebWorkerSearchProvider, type SearchHit } from '@openspecui/search'
import { useEffect, useMemo, useState } from 'react'
import * as StaticProvider from './static-data-provider'
import { isStaticMode } from './static-mode'
import { trpcClient } from './trpc'

export interface SearchState {
  data: SearchHit[]
  isLoading: boolean
  error: Error | null
}

let staticProvider: WebWorkerSearchProvider | null = null
let staticProviderInitPromise: Promise<WebWorkerSearchProvider> | null = null
let dynamicSearchSubscribeSupported: boolean | null = null

interface Unsubscribable {
  unsubscribe: () => void
}

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

export function useSearch(query: string, limit = 50): SearchState {
  const [state, setState] = useState<SearchState>({
    data: [],
    isLoading: false,
    error: null,
  })

  const trimmedQuery = useMemo(() => query.trim(), [query])

  useEffect(() => {
    let active = true

    if (trimmedQuery.length === 0) {
      setState({ data: [], isLoading: false, error: null })
      return () => {
        active = false
      }
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    if (isStaticMode()) {
      getStaticProvider()
        .then((provider) => provider.search({ query: trimmedQuery, limit }))
        .then((data) => {
          if (!active) return
          setState({ data, isLoading: false, error: null })
        })
        .catch((error: unknown) => {
          if (!active) return
          setState({
            data: [],
            isLoading: false,
            error: error instanceof Error ? error : new Error(String(error)),
          })
        })

      return () => {
        active = false
      }
    }

    let legacySubscription: Unsubscribable | null = null
    const legacyUnsubscribe = () => {
      legacySubscription?.unsubscribe()
      legacySubscription = null
    }

    const runLegacyReactiveSearch = () => {
      const runQuery = () => {
        trpcClient.search.query
          .query({ query: trimmedQuery, limit })
          .then((data) => {
            if (!active) return
            setState({ data, isLoading: false, error: null })
          })
          .catch((error: unknown) => {
            if (!active) return
            setState({
              data: [],
              isLoading: false,
              error: error instanceof Error ? error : new Error(String(error)),
            })
          })
      }

      runQuery()

      legacySubscription = trpcClient.realtime.onFileChange.subscribe(undefined, {
        onData: () => {
          if (!active) return
          runQuery()
        },
        onError: (error) => {
          if (!active) return
          setState({
            data: [],
            isLoading: false,
            error,
          })
        },
      })
    }

    if (dynamicSearchSubscribeSupported === false) {
      runLegacyReactiveSearch()
      return () => {
        active = false
        legacyUnsubscribe()
      }
    }

    const subscription = trpcClient.search.subscribe.subscribe(
      { query: trimmedQuery, limit },
      {
        onData: (data) => {
          dynamicSearchSubscribeSupported = true
          if (!active) return
          setState({ data, isLoading: false, error: null })
        },
        onError: (error) => {
          if (isMissingSearchSubscribeProcedureError(error)) {
            dynamicSearchSubscribeSupported = false
            if (!active) return
            runLegacyReactiveSearch()
            return
          }
          if (!active) return
          setState({
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
      legacyUnsubscribe()
    }
  }, [limit, trimmedQuery])

  return state
}
