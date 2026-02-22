import { useCallback, useEffect, useMemo, useState } from 'react'

interface UseTabsStatusByQueryParams {
  tabsId: string
  tabs: Array<{ id: string }>
  initialTab?: string
}

export function useTabsStatusByQuery({ tabsId, tabs, initialTab }: UseTabsStatusByQueryParams) {
  const validIds = useMemo(() => new Set(tabs.map((t) => t.id)), [tabs])

  const readFromUrl = useCallback(() => {
    if (typeof window === 'undefined') return null
    const params = new URLSearchParams(window.location.search)
    const value = params.get(tabsId)
    return value && validIds.has(value) ? value : null
  }, [tabsId, validIds])

  const pickInitial = useCallback(() => {
    return readFromUrl() ?? initialTab ?? tabs[0]?.id ?? ''
  }, [readFromUrl, initialTab, tabs])

  const [selectedTab, setSelectedTab] = useState<string>(pickInitial)

  const writeToUrl = useCallback(
    (id: string) => {
      if (typeof window === 'undefined') return
      const url = new URL(window.location.href)
      url.searchParams.set(tabsId, id)
      window.history.replaceState(null, '', url.toString())
    },
    [tabsId]
  )

  const setBoth = useCallback(
    (id: string) => {
      if (!validIds.has(id)) return
      setSelectedTab(id)
      writeToUrl(id)
    },
    [validIds, writeToUrl]
  )

  // keep in sync when tabs or URL change
  useEffect(() => {
    const fromUrl = readFromUrl()
    const candidate = fromUrl ?? initialTab ?? tabs[0]?.id ?? ''
    if (candidate && candidate !== selectedTab && validIds.has(candidate)) {
      setSelectedTab(candidate)
    } else if (!validIds.has(selectedTab) && candidate) {
      setSelectedTab(candidate)
    }
  }, [readFromUrl, initialTab, tabs, selectedTab, validIds])

  // respond to browser navigation
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = () => {
      const next = readFromUrl()
      if (next && validIds.has(next)) {
        setSelectedTab((prev) => (prev === next ? prev : next))
      }
    }
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [readFromUrl, validIds])

  // reflect current selection into URL
  useEffect(() => {
    if (!validIds.has(selectedTab) || typeof window === 'undefined') return
    const current = readFromUrl()
    if (current === selectedTab) return
    writeToUrl(selectedTab)
  }, [selectedTab, validIds, writeToUrl, readFromUrl])

  return { selectedTab, setSelectedTab: setBoth }
}
