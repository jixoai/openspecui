import type { TabsHandle } from '@/components/tabs'
import { navController } from '@/lib/nav-controller'
import { isStaticMode } from '@/lib/static-mode'
import { getRouterContext } from '@tanstack/react-router'
import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
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
  restorePanelContentScroll,
  restorePanelViewportScroll,
  type FrozenTabState,
  type TabScrollMemory,
  type ViewportSelector,
} from './tab-scroll-freeze'

interface FrozenTabEntry {
  state: FrozenTabState
  token: number
}

export interface UseRoutedCarouselTabsOptions<TTabId extends string> {
  queryKey: string
  tabs: Array<{ id: TTabId }>
  initialTab?: TTabId
  area?: VTArea
  history?: 'replace' | 'push'
  allowUnknownSelection?: boolean
  viewportSelector?: string | readonly string[]
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

function normalizeViewportSelectorOption(
  viewportSelector?: ViewportSelector
): readonly string[] | undefined {
  if (!viewportSelector) {
    return undefined
  }

  const selectors =
    typeof viewportSelector === 'string' ? viewportSelector.split(',') : [...viewportSelector]
  const normalized = selectors
    .map((selector) => selector.trim())
    .filter((selector) => selector.length > 0)

  return normalized.length > 0 ? normalized : undefined
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
  const headerShell = handle.getHeaderShell()
  if (headerShell) {
    entries.push([headerShell, 'vt-tab-header-shell'])
  }

  const selectionIndicator = handle.getSelectionIndicator()
  if (selectionIndicator) {
    entries.push([selectionIndicator, 'vt-tab-edge'])
  }

  const headerForeground = handle.getHeaderForeground()
  if (headerForeground) {
    entries.push([headerForeground, 'vt-tab-header-foreground'])
  }

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
  const viewportSelectorValue = useMemo(
    () => normalizeViewportSelectorOption(viewportSelector),
    [typeof viewportSelector === 'string' ? viewportSelector : (viewportSelector ?? []).join('\0')]
  )
  const scrollMemoryByTabRef = useRef(new Map<string, TabScrollMemory>())
  const frozenTabsRef = useRef(new Map<string, FrozenTabEntry>())
  const frozenTabTokenRef = useRef(0)
  const skipNextRestoreTabRef = useRef<string | null>(null)
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
    viewportSelector: viewportSelectorValue,
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
    viewportSelector: viewportSelectorValue,
  }

  const cleanupFrozenTabById = useCallback((tabId: string, token?: number) => {
    const frozenEntry = frozenTabsRef.current.get(tabId)
    if (!frozenEntry || (token != null && frozenEntry.token !== token)) {
      return
    }

    cleanupFrozenTab(frozenEntry.state)
    frozenTabsRef.current.delete(tabId)
  }, [])

  const cleanupAllFrozenTabs = useCallback(() => {
    for (const frozenEntry of frozenTabsRef.current.values()) {
      cleanupFrozenTab(frozenEntry.state)
    }
    frozenTabsRef.current.clear()
  }, [])

  const captureTabSnapshot = useCallback(
    (tabId: string, nextViewportSelector?: ViewportSelector) => {
      const elements = resolveTabScrollElements(tabsRef.current, tabId, nextViewportSelector)
      if (!elements) {
        return null
      }

      return captureTabScrollMemory(elements)
    },
    []
  )

  const captureOutgoingTab = useCallback(
    (
      tabId: string,
      nextViewportSelector?: ViewportSelector,
      snapshotOverride?: TabScrollMemory | null
    ) => {
      const elements = resolveTabScrollElements(tabsRef.current, tabId, nextViewportSelector)
      if (!elements) {
        return
      }

      const snapshot = snapshotOverride ?? captureTabScrollMemory(elements)
      if (!snapshot) {
        return
      }

      scrollMemoryByTabRef.current.set(tabId, snapshot)
      cleanupFrozenTabById(tabId)
      const token = ++frozenTabTokenRef.current
      frozenTabsRef.current.set(tabId, {
        token,
        state: freezeOutgoingTab(elements, snapshot),
      })
      return token
    },
    [cleanupFrozenTabById]
  )

  const prepareIncomingTab = useCallback(
    (
      tabId: string,
      nextViewportSelector?: ViewportSelector,
      fallbackSnapshot?: TabScrollMemory | null
    ) => {
      const elements = resolveTabScrollElements(tabsRef.current, tabId, nextViewportSelector)
      if (!elements) {
        return null
      }

      const snapshot =
        scrollMemoryByTabRef.current.get(tabId) ??
        fallbackSnapshot ??
        captureTabScrollMemory(elements)
      if (!snapshot) {
        return null
      }

      if (!scrollMemoryByTabRef.current.has(tabId)) {
        scrollMemoryByTabRef.current.set(tabId, snapshot)
      }
      cleanupFrozenTabById(tabId)
      const token = ++frozenTabTokenRef.current
      frozenTabsRef.current.set(tabId, {
        token,
        state: freezeIncomingTab(elements, snapshot),
      })
      return token
    },
    [cleanupFrozenTabById]
  )

  const finalizeIncomingTab = useCallback((tabId: string, token?: number) => {
    const frozenEntry = frozenTabsRef.current.get(tabId)
    if (!frozenEntry || (token != null && frozenEntry.token !== token)) {
      return
    }

    finalizeFrozenIncomingTab(frozenEntry.state)
    frozenTabsRef.current.delete(tabId)
  }, [])

  useEffect(() => {
    setSelectedTabState((current) =>
      current === selectedFromLocation ? current : selectedFromLocation
    )
  }, [selectedFromLocation])

  useLayoutEffect(() => {
    if (skipNextRestoreTabRef.current === selectedTab) {
      skipNextRestoreTabRef.current = null
      return
    }

    const snapshot = scrollMemoryByTabRef.current.get(selectedTab)
    const elements = resolveTabScrollElements(tabsRef.current, selectedTab, viewportSelectorValue)
    const panel = elements?.panel ?? tabsRef.current?.getPanel(selectedTab) ?? null
    restorePanelContentScroll(panel, snapshot)
    restorePanelViewportScroll(panel, elements?.viewport ?? null, snapshot)
  }, [selectedTab, viewportSelectorValue])

  useEffect(() => {
    const elements = resolveTabScrollElements(tabsRef.current, selectedTab, viewportSelectorValue)
    const contentScrollRoot = elements?.contentScrollRoot
    if (!elements || !contentScrollRoot || contentScrollRoot === elements.panel) {
      return
    }

    const rememberContentScroll = () => {
      const existingSnapshot = scrollMemoryByTabRef.current.get(selectedTab)
      if (!existingSnapshot) {
        return
      }

      scrollMemoryByTabRef.current.set(selectedTab, {
        ...existingSnapshot,
        contentScrollTop: contentScrollRoot.scrollTop,
      })
    }

    rememberContentScroll()
    contentScrollRoot.addEventListener('scroll', rememberContentScroll, { passive: true })

    return () => {
      contentScrollRoot.removeEventListener('scroll', rememberContentScroll)
    }
  }, [selectedTab, viewportSelectorValue])

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
        transferScroll?: boolean
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
      const transferScroll = options?.transferScroll ?? true
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

      if (!transferScroll) {
        const outgoingSnapshot = captureTabSnapshot(currentTab, latestViewportSelector)
        if (outgoingSnapshot) {
          scrollMemoryByTabRef.current.set(currentTab, outgoingSnapshot)
        }
        skipNextRestoreTabRef.current = nextTabId

        if (!options?.animate || currentTab === nextTabId) {
          commitSelection()
          return
        }

        void runViewTransition({
          intent: {
            area: resolveTabArea(latestLocation.pathname, latestArea),
            kind: 'tab-carousel',
            direction: 'forward',
          },
          collectBeforeEntries: () => collectTabEntries(tabsRef.current, currentTab),
          collectAfterEntries: () => collectTabEntries(tabsRef.current, nextTabId),
          update: commitSelection,
        })
        return
      }

      const runSelectionWithScrollTransfer = (animated: boolean) => {
        const outgoingSnapshot = captureTabSnapshot(currentTab, latestViewportSelector)
        const incomingSeedSnapshot =
          scrollMemoryByTabRef.current.get(nextTabId) ??
          outgoingSnapshot ??
          captureTabSnapshot(nextTabId, latestViewportSelector)
        const outgoingToken = captureOutgoingTab(
          currentTab,
          latestViewportSelector,
          outgoingSnapshot
        )

        if (!animated) {
          flushSync(() => {
            commitSelection()
          })
          const incomingToken = prepareIncomingTab(
            nextTabId,
            latestViewportSelector,
            incomingSeedSnapshot
          )
          if (incomingToken != null) {
            finalizeIncomingTab(nextTabId, incomingToken)
          }
          if (outgoingToken != null) {
            cleanupFrozenTabById(currentTab, outgoingToken)
          }
          return
        }

        let incomingToken: number | null = null
        void runViewTransition({
          intent: {
            area: resolveTabArea(latestLocation.pathname, latestArea),
            kind: 'tab-carousel',
            direction,
          },
          collectBeforeEntries: () => collectTabEntries(tabsRef.current, currentTab),
          collectAfterEntries: () => {
            if (incomingToken == null) {
              incomingToken = prepareIncomingTab(
                nextTabId,
                latestViewportSelector,
                incomingSeedSnapshot
              )
            }
            return collectTabEntries(tabsRef.current, nextTabId)
          },
          update: commitSelection,
        }).finally(() => {
          if (incomingToken == null) {
            incomingToken = prepareIncomingTab(
              nextTabId,
              latestViewportSelector,
              incomingSeedSnapshot
            )
          }
          if (incomingToken != null) {
            finalizeIncomingTab(nextTabId, incomingToken)
          }
          if (outgoingToken != null) {
            cleanupFrozenTabById(currentTab, outgoingToken)
          }
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
    [
      captureOutgoingTab,
      captureTabSnapshot,
      cleanupFrozenTabById,
      finalizeIncomingTab,
      prepareIncomingTab,
    ]
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
