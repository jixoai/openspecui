import type { TabsHandle } from '@/components/tabs'
import { navController } from '@/lib/nav-controller'
import { isStaticMode } from '@/lib/static-mode'
import { getRouterContext } from '@tanstack/react-router'
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { flushSync } from 'react-dom'
import type { VTArea } from './route-semantics'
import { runViewTransition } from './runtime'
import {
  captureTabScrollMemory,
  cleanupFrozenTab,
  finalizeFrozenIncomingTab,
  freezeIncomingTab,
  freezeOutgoingTab,
  resolveTabScrollElements,
  type FrozenTabState,
  type TabScrollMemory,
} from './tab-scroll-freeze'

export interface UseRoutedCarouselTabsOptions<TTabId extends string> {
  queryKey: string
  tabs: Array<{ id: TTabId }>
  initialTab?: TTabId
  area?: VTArea
  history?: 'replace' | 'push'
  allowUnknownSelection?: boolean
  viewportSelector?: string
}

interface RoutedTabsLocation {
  pathname: string
  search: string
  hash: string
  state: unknown
}

interface RouterContextValue {
  __store: {
    state: {
      location: {
        pathname: string
        searchStr: string
        hash: string
        state: unknown
      }
    }
    subscribe: (listener: () => void) => () => void
  }
  navigate: (options: {
    href: string
    replace?: boolean
    state?: unknown
  }) => Promise<unknown> | void
}

const SERVER_LOCATION: RoutedTabsLocation = {
  pathname: '/',
  search: '',
  hash: '',
  state: undefined,
}

function resolveSelectedTab<TTabId extends string>(options: {
  tabs: Array<{ id: TTabId }>
  queryKey: string
  search: string
  initialTab?: TTabId
  allowUnknownSelection?: boolean
}): TTabId {
  const validIds = new Set(options.tabs.map((tab) => tab.id))
  const value = new URLSearchParams(options.search).get(options.queryKey)
  if (value && (validIds.has(value as TTabId) || options.allowUnknownSelection)) {
    return value as TTabId
  }

  if (options.initialTab && validIds.has(options.initialTab)) {
    return options.initialTab
  }

  return options.tabs[0]?.id ?? ('' as TTabId)
}

function buildHrefWithQuery(
  pathname: string,
  search: string,
  hash: string,
  key: string,
  value: string
): string {
  const params = new URLSearchParams(search)
  params.set(key, value)
  const nextSearch = params.toString()
  return `${pathname}${nextSearch.length > 0 ? `?${nextSearch}` : ''}${hash}`
}

function resolveTabArea(pathname: string, area?: VTArea): VTArea {
  if (area) return area
  return isStaticMode() ? 'main' : navController.getAreaForPath(pathname)
}

function readWindowLocation(): RoutedTabsLocation {
  if (typeof window === 'undefined') return SERVER_LOCATION
  return {
    pathname: window.location.pathname || '/',
    search: window.location.search,
    hash: window.location.hash,
    state: window.history.state,
  }
}

function readRouterLocation(router: RouterContextValue): RoutedTabsLocation {
  const location = router.__store.state.location
  return {
    pathname: location.pathname,
    search: location.searchStr,
    hash: location.hash,
    state: location.state,
  }
}

function writeWindowLocation(href: string, replace: boolean, state: unknown): void {
  if (typeof window === 'undefined') return
  const url = new URL(href, window.location.origin)
  const nextHref = `${url.pathname}${url.search}${url.hash}`

  if (replace) {
    window.history.replaceState(state, '', nextHref)
  } else {
    window.history.pushState(state, '', nextHref)
  }

  window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
}

function useRoutedTabsLocation(): {
  location: RoutedTabsLocation
  router: RouterContextValue | null
} {
  const router = useContext(getRouterContext()) as RouterContextValue | null
  const snapshotRef = useRef<RoutedTabsLocation>(SERVER_LOCATION)
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (router?.__store) {
        return router.__store.subscribe(() => {
          onStoreChange()
        })
      }
      if (typeof window === 'undefined') {
        return () => {}
      }

      window.addEventListener('popstate', onStoreChange)
      window.addEventListener('hashchange', onStoreChange)
      return () => {
        window.removeEventListener('popstate', onStoreChange)
        window.removeEventListener('hashchange', onStoreChange)
      }
    },
    [router]
  )
  const getSnapshot = useCallback(() => {
    const nextSnapshot = router?.__store ? readRouterLocation(router) : readWindowLocation()
    const currentSnapshot = snapshotRef.current

    if (
      currentSnapshot.pathname === nextSnapshot.pathname &&
      currentSnapshot.search === nextSnapshot.search &&
      currentSnapshot.hash === nextSnapshot.hash &&
      currentSnapshot.state === nextSnapshot.state
    ) {
      return currentSnapshot
    }

    snapshotRef.current = nextSnapshot
    return nextSnapshot
  }, [router])
  const location = useSyncExternalStore(subscribe, getSnapshot, () => SERVER_LOCATION)

  return { location, router }
}

function collectTabEntries(handle: TabsHandle | null, tabId: string): Array<[HTMLElement, string]> {
  if (!handle) return []

  const entries: Array<[HTMLElement, string]> = []
  const panel = handle.getPanel(tabId)
  if (panel) {
    entries.push([panel, 'vt-tab-panel'])
  }
  return entries
}

export function useRoutedCarouselTabs<TTabId extends string>({
  queryKey,
  tabs,
  initialTab,
  area,
  history = 'replace',
  allowUnknownSelection = false,
  viewportSelector,
}: UseRoutedCarouselTabsOptions<TTabId>) {
  const { location, router } = useRoutedTabsLocation()
  const tabsRef = useRef<TabsHandle | null>(null)
  const scrollMemoryByTabRef = useRef(new Map<string, TabScrollMemory>())
  const frozenTabsRef = useRef(new Map<string, FrozenTabState>())
  const selectedFromLocation = useMemo(
    () =>
      resolveSelectedTab({
        tabs,
        queryKey,
        search: location.search,
        initialTab,
        allowUnknownSelection,
      }),
    [allowUnknownSelection, initialTab, location.search, queryKey, tabs]
  )
  const [selectedTab, setSelectedTabState] = useState<TTabId>(selectedFromLocation)
  const latestRef = useRef({
    allowUnknownSelection,
    area,
    history,
    location,
    queryKey,
    router,
    selectedFromLocation,
    selectedTab,
    tabs,
    viewportSelector,
  })

  latestRef.current = {
    allowUnknownSelection,
    area,
    history,
    location,
    queryKey,
    router,
    selectedFromLocation,
    selectedTab,
    tabs,
    viewportSelector,
  }

  const cleanupFrozenTabById = useCallback((tabId: string) => {
    const frozenState = frozenTabsRef.current.get(tabId)
    if (!frozenState) {
      return
    }

    cleanupFrozenTab(frozenState)
    frozenTabsRef.current.delete(tabId)
  }, [])

  const cleanupAllFrozenTabs = useCallback(() => {
    for (const frozenState of frozenTabsRef.current.values()) {
      cleanupFrozenTab(frozenState)
    }
    frozenTabsRef.current.clear()
  }, [])

  const captureOutgoingTab = useCallback(
    (tabId: string, nextViewportSelector?: string) => {
      const elements = resolveTabScrollElements(tabsRef.current, tabId, nextViewportSelector)
      if (!elements) {
        return
      }

      const snapshot = captureTabScrollMemory(elements)
      if (!snapshot) {
        return
      }

      scrollMemoryByTabRef.current.set(tabId, snapshot)
      cleanupFrozenTabById(tabId)
      frozenTabsRef.current.set(tabId, freezeOutgoingTab(elements, snapshot))
    },
    [cleanupFrozenTabById]
  )

  const prepareIncomingTab = useCallback(
    (tabId: string, nextViewportSelector?: string) => {
      const elements = resolveTabScrollElements(tabsRef.current, tabId, nextViewportSelector)
      if (!elements) {
        return false
      }

      const snapshot = scrollMemoryByTabRef.current.get(tabId) ?? captureTabScrollMemory(elements)
      if (!snapshot) {
        return false
      }

      cleanupFrozenTabById(tabId)
      frozenTabsRef.current.set(tabId, freezeIncomingTab(elements, snapshot))
      return true
    },
    [cleanupFrozenTabById]
  )

  const finalizeIncomingTab = useCallback((tabId: string) => {
    const frozenState = frozenTabsRef.current.get(tabId)
    if (!frozenState) {
      return
    }

    finalizeFrozenIncomingTab(frozenState)
    frozenTabsRef.current.delete(tabId)
  }, [])

  useEffect(() => {
    setSelectedTabState((current) =>
      current === selectedFromLocation ? current : selectedFromLocation
    )
  }, [selectedFromLocation])

  useEffect(() => {
    const validIds = new Set(tabs.map((tab) => tab.id))

    for (const tabId of scrollMemoryByTabRef.current.keys()) {
      if (!validIds.has(tabId as TTabId)) {
        scrollMemoryByTabRef.current.delete(tabId)
      }
    }

    for (const tabId of Array.from(frozenTabsRef.current.keys())) {
      if (!validIds.has(tabId as TTabId)) {
        cleanupFrozenTabById(tabId)
      }
    }
  }, [cleanupFrozenTabById, tabs])

  useEffect(() => {
    scrollMemoryByTabRef.current.clear()
    cleanupAllFrozenTabs()
  }, [cleanupAllFrozenTabs, location.pathname])

  useEffect(
    () => () => {
      cleanupAllFrozenTabs()
    },
    [cleanupAllFrozenTabs]
  )

  const setSelectedTab = useCallback(
    (
      nextTabId: TTabId,
      options?: {
        animate?: boolean
        history?: 'replace' | 'push'
      }
    ) => {
      const {
        allowUnknownSelection: allowUnknown,
        area: latestArea,
        history: defaultHistory,
        location: latestLocation,
        queryKey: latestQueryKey,
        router: latestRouter,
        selectedFromLocation: latestSelectedFromLocation,
        selectedTab: currentTab,
        tabs: latestTabs,
        viewportSelector: latestViewportSelector,
      } = latestRef.current

      const validIds = new Set(latestTabs.map((tab) => tab.id))
      if (!validIds.has(nextTabId) && !allowUnknown) return

      const nextHistory = options?.history ?? defaultHistory
      if (currentTab === nextTabId && latestSelectedFromLocation === nextTabId) {
        return
      }

      const commitSelection = () => {
        setSelectedTabState(nextTabId)
        const href = buildHrefWithQuery(
          latestLocation.pathname,
          latestLocation.search,
          latestLocation.hash,
          latestQueryKey,
          nextTabId
        )

        if (isStaticMode()) {
          if (latestRouter) {
            void latestRouter.navigate({
              href,
              replace: nextHistory === 'replace',
              state: latestLocation.state,
            })
            return
          }

          writeWindowLocation(href, nextHistory === 'replace', latestLocation.state)
          return
        }

        const nextArea = resolveTabArea(latestLocation.pathname, latestArea)
        if (nextHistory === 'replace') {
          navController.replace(nextArea, href, latestLocation.state)
          return
        }
        navController.push(nextArea, href, latestLocation.state)
      }

      const runSelectionWithScrollTransfer = (animated: boolean) => {
        captureOutgoingTab(currentTab, latestViewportSelector)

        if (!animated) {
          flushSync(() => {
            commitSelection()
          })
          prepareIncomingTab(nextTabId, latestViewportSelector)
          finalizeIncomingTab(nextTabId)
          cleanupFrozenTabById(currentTab)
          return
        }

        let hasPreparedIncoming = false
        void runViewTransition({
          intent: {
            area: resolveTabArea(latestLocation.pathname, latestArea),
            kind: 'tab-carousel',
            direction,
          },
          collectBeforeEntries: () => collectTabEntries(tabsRef.current, currentTab),
          collectAfterEntries: () => {
            if (!hasPreparedIncoming) {
              hasPreparedIncoming = prepareIncomingTab(nextTabId, latestViewportSelector)
            }
            return collectTabEntries(tabsRef.current, nextTabId)
          },
          update: commitSelection,
        }).finally(() => {
          if (!hasPreparedIncoming) {
            prepareIncomingTab(nextTabId, latestViewportSelector)
          }
          finalizeIncomingTab(nextTabId)
          cleanupFrozenTabById(currentTab)
        })
      }

      if (!options?.animate || currentTab === nextTabId) {
        runSelectionWithScrollTransfer(false)
        return
      }

      const currentIndex = latestTabs.findIndex((tab) => tab.id === currentTab)
      const nextIndex = latestTabs.findIndex((tab) => tab.id === nextTabId)
      if (currentIndex < 0 || nextIndex < 0) {
        runSelectionWithScrollTransfer(false)
        return
      }
      const direction = nextIndex >= currentIndex ? 'forward' : 'backward'
      runSelectionWithScrollTransfer(true)
    },
    [captureOutgoingTab, cleanupFrozenTabById, finalizeIncomingTab, prepareIncomingTab]
  )

  return {
    tabsRef,
    selectedTab,
    setSelectedTab,
    onTabChange: useCallback(
      (nextTabId: string) => {
        setSelectedTab(nextTabId as TTabId, { animate: true })
      },
      [setSelectedTab]
    ),
  }
}
