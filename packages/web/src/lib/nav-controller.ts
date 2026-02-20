import type { HistoryLocation, RouterHistory } from '@tanstack/react-router'
import { isStaticMode } from './static-mode'

export type TabId =
  | '/dashboard'
  | '/config'
  | '/specs'
  | '/changes'
  | '/archive'
  | '/settings'
  | '/terminal'

export interface NavLayout {
  mainTabs: TabId[]
  bottomTabs: TabId[]
}

interface PersistedNavLayout extends NavLayout {
  updatedAt: number
}

export interface NavState extends NavLayout {
  mainLocation: HistoryLocation
  bottomLocation: HistoryLocation
  popLocation: HistoryLocation
  bottomActive: boolean
  popActive: boolean
}

type Area = 'main' | 'bottom' | 'pop'
type BrowserAction = 'PUSH' | 'REPLACE'
type RouterAction = 'PUSH' | 'REPLACE' | 'BACK'

type PersistEffect = 'none' | 'local_and_remote' | 'local_only'

interface UrlHistoryState {
  main?: unknown
  bottom?: unknown
  pop?: unknown
}

interface KernelState extends PersistedNavLayout {
  mainLocation: HistoryLocation
  bottomLocation: HistoryLocation
  popLocation: HistoryLocation
}

interface KernelTransition {
  nextState: KernelState
  changed: boolean
  urlAction?: BrowserAction
  notify: Array<{ area: Area; type: RouterAction }>
  persist: PersistEffect
}

type KernelEvent =
  | { type: 'NAVIGATE'; sourceArea: Area; action: BrowserAction; location: HistoryLocation }
  | {
      type: 'POPSTATE'
      mainLocation: HistoryLocation
      bottomLocation: HistoryLocation
      popLocation: HistoryLocation
    }
  | { type: 'MOVE_TAB'; tabId: TabId; targetArea: 'main' | 'bottom' }
  | { type: 'REORDER'; area: 'main' | 'bottom'; tabIds: TabId[] }
  | { type: 'CLOSE_TAB'; tabId: TabId }
  | { type: 'ACTIVATE_BOTTOM'; location: HistoryLocation }
  | { type: 'DEACTIVATE_BOTTOM' }
  | { type: 'ACTIVATE_POP'; location: HistoryLocation }
  | { type: 'DEACTIVATE_POP' }
  | { type: 'APPLY_LAYOUT'; layout: PersistedNavLayout }

type BehaviorEvent = KernelEvent | { type: 'BOOTSTRAP' }

type KernelBehaviorPlugin = (ctx: {
  prevState: KernelState
  nextState: KernelState
  event: BehaviorEvent
}) => KernelState

const ALL_TABS: readonly TabId[] = [
  '/dashboard',
  '/config',
  '/specs',
  '/changes',
  '/archive',
  '/settings',
  '/terminal',
]
const DEFAULT_MAIN_TABS: TabId[] = [
  '/dashboard',
  '/config',
  '/specs',
  '/changes',
  '/archive',
  '/settings',
]
const DEFAULT_BOTTOM_TABS: TabId[] = isStaticMode() ? [] : ['/terminal']
const POP_ROUTES = ['/search', '/opsx-new', '/opsx-compose'] as const
const KV_KEY = 'nav-layout'
const LS_KEY = 'nav-layout'
const PERSIST_DEBOUNCE = 300

function isTabId(value: string): value is TabId {
  return (ALL_TABS as readonly string[]).includes(value)
}

function normalizeTabList(value: unknown): TabId[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is TabId => typeof item === 'string' && isTabId(item))
}

function parsePersistedLayout(value: unknown): PersistedNavLayout | null {
  if (typeof value !== 'object' || value == null) return null
  const record = value as Record<string, unknown>
  if (!Array.isArray(record.mainTabs) || !Array.isArray(record.bottomTabs)) return null

  return {
    mainTabs: normalizeTabList(record.mainTabs),
    bottomTabs: normalizeTabList(record.bottomTabs),
    updatedAt: typeof record.updatedAt === 'number' ? record.updatedAt : 0,
  }
}

function toParsedHistoryState(state: unknown, fallbackKey: string): HistoryLocation['state'] {
  if (typeof state !== 'object' || state == null) {
    return { __TSR_index: 0, key: fallbackKey, __TSR_key: fallbackKey }
  }

  const record = state as Record<string, unknown>
  const key = typeof record.key === 'string' ? record.key : fallbackKey
  const tsrKey = typeof record.__TSR_key === 'string' ? record.__TSR_key : key
  const tsrIndex = typeof record.__TSR_index === 'number' ? record.__TSR_index : 0

  return {
    ...record,
    key,
    __TSR_key: tsrKey,
    __TSR_index: tsrIndex,
  } as HistoryLocation['state']
}

function parseHref(href: string, state?: unknown): HistoryLocation {
  const url = new URL(href, 'http://nav.local')
  const normalizedHref = `${url.pathname}${url.search}${url.hash}`
  const key = Math.random().toString(36).slice(2)

  return {
    href: normalizedHref,
    pathname: url.pathname || '/',
    search: url.search,
    hash: url.hash,
    state: toParsedHistoryState(state, key),
  }
}

function pathToTabId(path: string): TabId | null {
  for (const tab of ALL_TABS) {
    if (path === tab || path.startsWith(tab + '/')) {
      return tab
    }
  }
  return null
}

function activeTabForArea(state: KernelState, area: Area): TabId | null {
  if (area === 'pop') return null

  const location = area === 'main' ? state.mainLocation : state.bottomLocation
  const tabs = area === 'main' ? state.mainTabs : state.bottomTabs
  const tabId = pathToTabId(location.pathname)
  if (!tabId) return null
  return tabs.includes(tabId) ? tabId : null
}

function isPopPath(path: string): boolean {
  return POP_ROUTES.some((route) => path === route || path.startsWith(route + '/'))
}

function areaForPath(layout: NavLayout, path: string): Area {
  if (isPopPath(path)) return 'pop'
  const tabId = pathToTabId(path)
  if (tabId && layout.bottomTabs.includes(tabId)) return 'bottom'
  return 'main'
}

function mergeLayout(layout: NavLayout): NavLayout {
  const placed = new Set<TabId>()
  const mainTabs: TabId[] = []
  const bottomTabs: TabId[] = []

  for (const tab of layout.mainTabs) {
    if (!placed.has(tab)) {
      mainTabs.push(tab)
      placed.add(tab)
    }
  }

  for (const tab of layout.bottomTabs) {
    if (!placed.has(tab)) {
      bottomTabs.push(tab)
      placed.add(tab)
    }
  }

  for (const tab of ALL_TABS) {
    if (!placed.has(tab)) {
      if (DEFAULT_BOTTOM_TABS.includes(tab)) {
        bottomTabs.push(tab)
      } else {
        mainTabs.push(tab)
      }
    }
  }

  return { mainTabs, bottomTabs }
}

function sanitizeMainLocation(
  location: HistoryLocation,
  mainTabs: readonly TabId[]
): HistoryLocation {
  if (mainTabs.length === 0) return parseHref('/')

  const tabId = pathToTabId(location.pathname)
  if (tabId && !mainTabs.includes(tabId)) {
    return parseHref('/')
  }

  return location
}

function sanitizeBottomLocation(
  location: HistoryLocation,
  bottomTabs: readonly TabId[]
): HistoryLocation {
  if (bottomTabs.length === 0) return parseHref('/')
  if (location.pathname === '/') return parseHref('/', location.state)

  const tabId = pathToTabId(location.pathname)
  if (!tabId || !bottomTabs.includes(tabId)) {
    return parseHref('/')
  }

  return location
}

function sanitizePopLocation(location: HistoryLocation): HistoryLocation {
  if (location.pathname === '/') return parseHref('/', location.state)
  if (!isPopPath(location.pathname)) return parseHref('/')
  return location
}

function normalizeState(state: KernelState): KernelState {
  const merged = mergeLayout({ mainTabs: state.mainTabs, bottomTabs: state.bottomTabs })

  return {
    ...state,
    mainTabs: merged.mainTabs,
    bottomTabs: merged.bottomTabs,
    mainLocation: sanitizeMainLocation(state.mainLocation, merged.mainTabs),
    bottomLocation: sanitizeBottomLocation(state.bottomLocation, merged.bottomTabs),
    popLocation: sanitizePopLocation(state.popLocation),
  }
}

function parseBrowserLocation(
  loc: Location,
  layout: NavLayout
): {
  main: HistoryLocation
  bottom: HistoryLocation
  pop: HistoryLocation
} {
  const url = new URL(loc.href)
  const rawBottomHref = url.searchParams.get('_b')
  const rawPopHref = url.searchParams.get('_p')
  url.searchParams.delete('_b')
  url.searchParams.delete('_p')

  const historyState = window.history.state as UrlHistoryState | null
  const main = parseHref(`${url.pathname}${url.search}${url.hash}`, historyState?.main)
  const bottom = parseHref(rawBottomHref ?? '/', historyState?.bottom)
  const pop = parseHref(rawPopHref ?? '/', historyState?.pop)

  return {
    main: sanitizeMainLocation(main, layout.mainTabs),
    bottom: sanitizeBottomLocation(bottom, layout.bottomTabs),
    pop: sanitizePopLocation(pop),
  }
}

function buildCanonicalUrl(state: KernelState): string {
  const url = new URL(state.mainLocation.href, window.location.origin)
  url.searchParams.delete('_b')
  url.searchParams.delete('_p')

  if (state.bottomTabs.length > 0) {
    url.searchParams.set('_b', state.bottomLocation.href)
  }
  if (state.popLocation.pathname !== '/') {
    url.searchParams.set('_p', state.popLocation.href)
  }

  return `${url.pathname}${url.search}${url.hash}`
}

function areTabsEqual(a: readonly TabId[], b: readonly TabId[]): boolean {
  if (a.length !== b.length) return false
  return a.every((tab, index) => tab === b[index])
}

function createInitialState(): KernelState {
  return {
    mainTabs: [...DEFAULT_MAIN_TABS],
    bottomTabs: [...DEFAULT_BOTTOM_TABS],
    updatedAt: 0,
    mainLocation: parseHref('/dashboard'),
    bottomLocation: parseHref('/'),
    popLocation: parseHref('/'),
  }
}

function readLocalStorage(): PersistedNavLayout | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    return parsePersistedLayout(JSON.parse(raw))
  } catch {
    return null
  }
}

function writeLocalStorage(layout: PersistedNavLayout): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(layout))
  } catch {
    // ignore
  }
}

const carryActiveOnMovePlugin: KernelBehaviorPlugin = ({ prevState, nextState, event }) => {
  if (event.type !== 'MOVE_TAB') return nextState

  const sourceArea: Area = prevState.bottomTabs.includes(event.tabId) ? 'bottom' : 'main'
  const sourceActiveTab = activeTabForArea(prevState, sourceArea)
  if (sourceActiveTab !== event.tabId) return nextState

  const sourceLocation = sourceArea === 'main' ? prevState.mainLocation : prevState.bottomLocation
  const carriedLocation = parseHref(sourceLocation.href, sourceLocation.state)

  if (event.targetArea === 'main') {
    return { ...nextState, mainLocation: carriedLocation }
  }
  return { ...nextState, bottomLocation: carriedLocation }
}

const ensureMainHasActivePlugin: KernelBehaviorPlugin = ({ nextState }) => {
  if (nextState.mainTabs.length === 0) return nextState
  if (activeTabForArea(nextState, 'main') != null) return nextState

  return {
    ...nextState,
    mainLocation: parseHref(nextState.mainTabs[0]),
  }
}

const BUILTIN_BEHAVIOR_PLUGINS: readonly KernelBehaviorPlugin[] = [
  carryActiveOnMovePlugin,
  ensureMainHasActivePlugin,
]

function applyBehaviorPlugins(
  prevState: KernelState,
  nextState: KernelState,
  event: BehaviorEvent
): KernelState {
  let current = nextState
  for (const plugin of BUILTIN_BEHAVIOR_PLUGINS) {
    current = plugin({ prevState, nextState: current, event })
  }
  return current
}

function reduceKernel(state: KernelState, event: KernelEvent): KernelTransition {
  switch (event.type) {
    case 'NAVIGATE': {
      const targetArea =
        event.sourceArea === 'pop' ? 'pop' : areaForPath(state, event.location.pathname)
      const nextState =
        targetArea === 'main'
          ? { ...state, mainLocation: event.location }
          : targetArea === 'bottom'
            ? { ...state, bottomLocation: event.location }
            : { ...state, popLocation: event.location }

      return {
        nextState,
        changed: true,
        urlAction: event.action,
        notify: targetArea === event.sourceArea ? [] : [{ area: targetArea, type: event.action }],
        persist: 'none',
      }
    }

    case 'POPSTATE': {
      return {
        nextState: {
          ...state,
          mainLocation: event.mainLocation,
          bottomLocation: event.bottomLocation,
          popLocation: event.popLocation,
        },
        changed: true,
        notify: [
          { area: 'main', type: 'BACK' },
          { area: 'bottom', type: 'BACK' },
          { area: 'pop', type: 'BACK' },
        ],
        persist: 'none',
      }
    }

    case 'MOVE_TAB': {
      const sourceArea: Area = state.bottomTabs.includes(event.tabId) ? 'bottom' : 'main'
      if (sourceArea === event.targetArea) {
        return { nextState: state, changed: false, notify: [], persist: 'none' }
      }

      const mainTabs = state.mainTabs.filter((tab) => tab !== event.tabId)
      const bottomTabs = state.bottomTabs.filter((tab) => tab !== event.tabId)
      const nextMainTabs = event.targetArea === 'main' ? [...mainTabs, event.tabId] : mainTabs
      const nextBottomTabs =
        event.targetArea === 'bottom' ? [...bottomTabs, event.tabId] : bottomTabs

      let mainLocation = state.mainLocation
      let bottomLocation = state.bottomLocation
      const sourceLocation = sourceArea === 'main' ? state.mainLocation : state.bottomLocation

      if (pathToTabId(sourceLocation.pathname) === event.tabId) {
        if (sourceArea === 'main') {
          mainLocation = parseHref('/')
        } else {
          bottomLocation = parseHref('/')
        }
      }

      return {
        nextState: {
          ...state,
          mainTabs: nextMainTabs,
          bottomTabs: nextBottomTabs,
          mainLocation,
          bottomLocation,
        },
        changed: true,
        urlAction: 'REPLACE',
        notify: [
          { area: 'main', type: 'REPLACE' },
          { area: 'bottom', type: 'REPLACE' },
        ],
        persist: 'local_and_remote',
      }
    }

    case 'REORDER': {
      const currentTabs = event.area === 'main' ? state.mainTabs : state.bottomTabs
      const set = new Set(currentTabs)
      const ordered = event.tabIds.filter((tab) => set.has(tab))

      for (const tab of currentTabs) {
        if (!ordered.includes(tab)) {
          ordered.push(tab)
        }
      }

      if (areTabsEqual(currentTabs, ordered)) {
        return { nextState: state, changed: false, notify: [], persist: 'none' }
      }

      const nextState =
        event.area === 'main' ? { ...state, mainTabs: ordered } : { ...state, bottomTabs: ordered }

      return {
        nextState,
        changed: true,
        notify: [],
        persist: 'local_and_remote',
      }
    }

    case 'CLOSE_TAB': {
      const inBottom = state.bottomTabs.includes(event.tabId)
      const inMain = state.mainTabs.includes(event.tabId)
      if (!inBottom && !inMain) {
        return { nextState: state, changed: false, notify: [], persist: 'none' }
      }

      if (inBottom) {
        if (pathToTabId(state.bottomLocation.pathname) !== event.tabId) {
          return { nextState: state, changed: false, notify: [], persist: 'none' }
        }

        return {
          nextState: { ...state, bottomLocation: parseHref('/') },
          changed: true,
          urlAction: 'REPLACE',
          notify: [],
          persist: 'none',
        }
      }

      if (pathToTabId(state.mainLocation.pathname) !== event.tabId) {
        return { nextState: state, changed: false, notify: [], persist: 'none' }
      }

      return {
        nextState: { ...state, mainLocation: parseHref('/') },
        changed: true,
        urlAction: 'REPLACE',
        notify: [],
        persist: 'none',
      }
    }

    case 'ACTIVATE_BOTTOM': {
      if (areaForPath(state, event.location.pathname) !== 'bottom') {
        return { nextState: state, changed: false, notify: [], persist: 'none' }
      }

      return {
        nextState: { ...state, bottomLocation: event.location },
        changed: true,
        urlAction: 'PUSH',
        notify: [{ area: 'bottom', type: 'PUSH' }],
        persist: 'none',
      }
    }

    case 'DEACTIVATE_BOTTOM': {
      if (state.bottomLocation.pathname === '/') {
        return { nextState: state, changed: false, notify: [], persist: 'none' }
      }

      return {
        nextState: { ...state, bottomLocation: parseHref('/') },
        changed: true,
        urlAction: 'REPLACE',
        notify: [],
        persist: 'none',
      }
    }

    case 'ACTIVATE_POP': {
      if (areaForPath(state, event.location.pathname) !== 'pop') {
        return { nextState: state, changed: false, notify: [], persist: 'none' }
      }

      return {
        nextState: { ...state, popLocation: event.location },
        changed: true,
        urlAction: 'PUSH',
        notify: [{ area: 'pop', type: 'PUSH' }],
        persist: 'none',
      }
    }

    case 'DEACTIVATE_POP': {
      if (state.popLocation.pathname === '/') {
        return { nextState: state, changed: false, notify: [], persist: 'none' }
      }

      return {
        nextState: { ...state, popLocation: parseHref('/') },
        changed: true,
        urlAction: 'REPLACE',
        notify: [],
        persist: 'none',
      }
    }

    case 'APPLY_LAYOUT': {
      if (event.layout.updatedAt <= state.updatedAt) {
        return { nextState: state, changed: false, notify: [], persist: 'none' }
      }

      const merged = mergeLayout(event.layout)

      return {
        nextState: {
          ...state,
          mainTabs: merged.mainTabs,
          bottomTabs: merged.bottomTabs,
          updatedAt: event.layout.updatedAt,
        },
        changed: true,
        urlAction: 'REPLACE',
        notify: [
          { area: 'main', type: 'REPLACE' },
          { area: 'bottom', type: 'REPLACE' },
        ],
        persist: 'local_only',
      }
    }
  }
}

function locationHrefChanged(prevState: KernelState, nextState: KernelState, area: Area): boolean {
  if (area === 'main') {
    return prevState.mainLocation.href !== nextState.mainLocation.href
  }
  if (area === 'bottom') {
    return prevState.bottomLocation.href !== nextState.bottomLocation.href
  }
  return prevState.popLocation.href !== nextState.popLocation.href
}

function appendLocationNotifications(
  notifications: Array<{ area: Area; type: RouterAction }>,
  prevState: KernelState,
  nextState: KernelState
): Array<{ area: Area; type: RouterAction }> {
  const next = [...notifications]

  for (const area of ['main', 'bottom', 'pop'] as const) {
    const changed = locationHrefChanged(prevState, nextState, area)
    if (!changed) continue
    if (next.some((item) => item.area === area)) continue
    next.push({ area, type: 'REPLACE' })
  }

  return next
}

export class NavController {
  private mainHistory: RouterHistory | null = null
  private bottomHistory: RouterHistory | null = null
  private popHistory: RouterHistory | null = null

  private state: KernelState = createInitialState()

  private listeners = new Set<() => void>()
  private snapshotCache: NavState | null = null

  private persistTimer: ReturnType<typeof setTimeout> | null = null
  private kvUnsubscribe: (() => void) | null = null
  private initialized = false

  constructor() {
    if (typeof window === 'undefined') return
    const staticMode = isStaticMode()

    const local = staticMode ? null : readLocalStorage()
    if (local != null) {
      const merged = mergeLayout(local)
      this.state = {
        ...this.state,
        mainTabs: merged.mainTabs,
        bottomTabs: merged.bottomTabs,
        updatedAt: local.updatedAt,
      }
    }

    const parsed = parseBrowserLocation(window.location, this.state)
    let bootState = normalizeState({
      ...this.state,
      mainLocation: parsed.main,
      bottomLocation: parsed.bottom,
      popLocation: parsed.pop,
    })
    bootState = normalizeState(applyBehaviorPlugins(bootState, bootState, { type: 'BOOTSTRAP' }))
    this.state = bootState

    this.normalizeUrl()
    window.addEventListener('popstate', this.handlePopState)
  }

  setHistoryRef(area: Area, history: RouterHistory): void {
    if (area === 'main') {
      this.mainHistory = history
    } else if (area === 'bottom') {
      this.bottomHistory = history
    } else {
      this.popHistory = history
    }
  }

  getLocation(area: Area): HistoryLocation {
    if (area === 'main') return this.state.mainLocation
    if (area === 'bottom') return this.state.bottomLocation
    return this.state.popLocation
  }

  push(area: Area, path: string, state: unknown): void {
    this.dispatch({
      type: 'NAVIGATE',
      sourceArea: area,
      action: 'PUSH',
      location: parseHref(path, state),
    })
  }

  replace(area: Area, path: string, state: unknown): void {
    this.dispatch({
      type: 'NAVIGATE',
      sourceArea: area,
      action: 'REPLACE',
      location: parseHref(path, state),
    })
  }

  get mainTabs(): readonly TabId[] {
    return this.state.mainTabs
  }

  get bottomTabs(): readonly TabId[] {
    return this.state.bottomTabs
  }

  getAreaForPath(path: string): Area {
    return areaForPath(this.state, path)
  }

  moveTab(tabId: TabId, targetArea: 'main' | 'bottom'): void {
    this.dispatch({ type: 'MOVE_TAB', tabId, targetArea })
  }

  reorder(area: 'main' | 'bottom', tabIds: TabId[]): void {
    this.dispatch({ type: 'REORDER', area, tabIds })
  }

  closeTab(tabId: TabId): void {
    this.dispatch({ type: 'CLOSE_TAB', tabId })
  }

  activateBottom(path: string): void {
    this.dispatch({ type: 'ACTIVATE_BOTTOM', location: parseHref(path) })
  }

  deactivateBottom(): void {
    this.dispatch({ type: 'DEACTIVATE_BOTTOM' })
  }

  activatePop(path: string): void {
    this.dispatch({ type: 'ACTIVATE_POP', location: parseHref(path) })
  }

  deactivatePop(): void {
    this.dispatch({ type: 'DEACTIVATE_POP' })
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot(): NavState {
    if (this.snapshotCache) return this.snapshotCache

    const bottomTabId = pathToTabId(this.state.bottomLocation.pathname)
    this.snapshotCache = {
      mainTabs: [...this.state.mainTabs],
      bottomTabs: [...this.state.bottomTabs],
      mainLocation: this.state.mainLocation,
      bottomLocation: this.state.bottomLocation,
      popLocation: this.state.popLocation,
      bottomActive: bottomTabId != null && this.state.bottomTabs.includes(bottomTabId),
      popActive: this.state.popLocation.pathname !== '/',
    }

    return this.snapshotCache
  }

  async init(): Promise<void> {
    if (this.initialized || isStaticMode()) return
    this.initialized = true

    try {
      const { trpcClient } = await import('./trpc')
      const remote = parsePersistedLayout(await trpcClient.kv.get.query({ key: KV_KEY }))

      if (remote) {
        if (remote.updatedAt > this.state.updatedAt) {
          this.dispatch({ type: 'APPLY_LAYOUT', layout: remote })
        } else if (this.state.updatedAt > remote.updatedAt) {
          trpcClient.kv.set
            .mutate({
              key: KV_KEY,
              value: {
                mainTabs: this.state.mainTabs,
                bottomTabs: this.state.bottomTabs,
                updatedAt: this.state.updatedAt,
              },
            })
            .catch(() => {})
        }
      } else if (this.state.updatedAt > 0) {
        trpcClient.kv.set
          .mutate({
            key: KV_KEY,
            value: {
              mainTabs: this.state.mainTabs,
              bottomTabs: this.state.bottomTabs,
              updatedAt: this.state.updatedAt,
            },
          })
          .catch(() => {})
      }

      const subscription = trpcClient.kv.subscribe.subscribe(
        { key: KV_KEY },
        {
          onData: (data: unknown) => {
            const incoming = parsePersistedLayout(data)
            if (!incoming) return
            this.dispatch({ type: 'APPLY_LAYOUT', layout: incoming })
          },
        }
      )

      this.kvUnsubscribe = () => subscription.unsubscribe()
    } catch {
      // localStorage only mode
    }
  }

  destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('popstate', this.handlePopState)
    }

    this.cancelPersistTimer()

    if (this.kvUnsubscribe) {
      this.kvUnsubscribe()
      this.kvUnsubscribe = null
    }
  }

  private handlePopState = (): void => {
    const parsed = parseBrowserLocation(window.location, this.state)
    this.dispatch({
      type: 'POPSTATE',
      mainLocation: parsed.main,
      bottomLocation: parsed.bottom,
      popLocation: parsed.pop,
    })
  }

  private dispatch(event: KernelEvent): void {
    if (typeof window !== 'undefined' && event.type !== 'POPSTATE' && this.mainHistory == null) {
      const parsed = parseBrowserLocation(window.location, this.state)
      this.state = normalizeState({
        ...this.state,
        mainLocation: parsed.main,
        bottomLocation: parsed.bottom,
        popLocation: parsed.pop,
      })
    }

    const transition = reduceKernel(this.state, event)
    if (!transition.changed) return

    const prevState = this.state
    let nextState = applyBehaviorPlugins(prevState, transition.nextState, event)
    nextState = normalizeState(nextState)

    this.state = nextState

    if (transition.persist === 'local_and_remote') {
      this.persistLayout()
    } else if (transition.persist === 'local_only') {
      this.cancelPersistTimer()
      writeLocalStorage({
        mainTabs: this.state.mainTabs,
        bottomTabs: this.state.bottomTabs,
        updatedAt: this.state.updatedAt,
      })
    }

    const effectiveUrlAction =
      transition.urlAction ??
      (locationHrefChanged(prevState, this.state, 'main') ||
      locationHrefChanged(prevState, this.state, 'bottom') ||
      locationHrefChanged(prevState, this.state, 'pop')
        ? 'REPLACE'
        : undefined)

    if (effectiveUrlAction) {
      this.syncToUrl(effectiveUrlAction)
    }

    const notifications = appendLocationNotifications(transition.notify, prevState, this.state)
    this.notifyRouters(notifications)
    this.notifyListeners()
  }

  private notifyRouters(notifications: Array<{ area: Area; type: RouterAction }>): void {
    for (const notification of notifications) {
      const history =
        notification.area === 'main'
          ? this.mainHistory
          : notification.area === 'bottom'
            ? this.bottomHistory
            : this.popHistory
      history?.notify({ type: notification.type })
    }
  }

  private notifyListeners(): void {
    this.snapshotCache = null
    for (const listener of this.listeners) {
      listener()
    }
  }

  private syncToUrl(action: BrowserAction): void {
    const finalUrl = buildCanonicalUrl(this.state)
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`

    if (action === 'REPLACE' && finalUrl === currentUrl) return

    const historyState: UrlHistoryState = {
      main: this.state.mainLocation.state,
      bottom: this.state.bottomLocation.state,
      pop: this.state.popLocation.state,
    }

    if (action === 'PUSH') {
      window.history.pushState(historyState, '', finalUrl)
    } else {
      window.history.replaceState(historyState, '', finalUrl)
    }
  }

  private normalizeUrl(): void {
    const canonical = buildCanonicalUrl(this.state)
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
    if (canonical === current) return

    const historyState: UrlHistoryState = {
      main: this.state.mainLocation.state,
      bottom: this.state.bottomLocation.state,
      pop: this.state.popLocation.state,
    }

    window.history.replaceState(historyState, '', canonical)
  }

  private cancelPersistTimer(): void {
    if (!this.persistTimer) return
    clearTimeout(this.persistTimer)
    this.persistTimer = null
  }

  private persistLayout(): void {
    const now = Date.now()
    this.state = { ...this.state, updatedAt: now }

    writeLocalStorage({
      mainTabs: this.state.mainTabs,
      bottomTabs: this.state.bottomTabs,
      updatedAt: now,
    })

    this.cancelPersistTimer()
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null

      import('./trpc')
        .then(({ trpcClient }) =>
          trpcClient.kv.set.mutate({
            key: KV_KEY,
            value: {
              mainTabs: this.state.mainTabs,
              bottomTabs: this.state.bottomTabs,
              updatedAt: now,
            },
          })
        )
        .catch(() => {})
    }, PERSIST_DEBOUNCE)
  }
}

export const navController = new NavController()

if (typeof window !== 'undefined' && !isStaticMode()) {
  navController.init()
}
