const SHELL_STORAGE_KEY = 'openspecui-app:shell'

export interface HostedShellLaunchRequest {
  apiBaseUrl: string
}

export interface HostedShellTab {
  id: string
  sessionId: string
  apiBaseUrl: string
  createdAt: number
}

export interface HostedShellState {
  activeTabId: string | null
  tabs: HostedShellTab[]
}

interface PersistedHostedShellState {
  activeTabId?: unknown
  tabs?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function normalizeHostedApiBaseUrl(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }

  url.hash = ''
  url.search = ''
  const pathname = url.pathname.replace(/\/+$/, '')
  url.pathname = pathname.length > 0 ? pathname : '/'
  return url.toString().replace(/\/$/, url.pathname === '/' ? '' : '')
}

function isHostedShellTab(value: unknown): value is HostedShellTab {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.sessionId === 'string' &&
    value.sessionId.length > 0 &&
    typeof value.apiBaseUrl === 'string' &&
    normalizeHostedApiBaseUrl(value.apiBaseUrl) !== null &&
    typeof value.createdAt === 'number' &&
    Number.isFinite(value.createdAt)
  )
}

export function createEmptyHostedShellState(): HostedShellState {
  return {
    activeTabId: null,
    tabs: [],
  }
}

export function getHostedShellStorageKey(): string {
  return SHELL_STORAGE_KEY
}

export function parseHostedShellState(raw: unknown): HostedShellState {
  if (!isRecord(raw)) {
    return createEmptyHostedShellState()
  }

  const persisted = raw as PersistedHostedShellState
  const tabs = Array.isArray(persisted.tabs)
    ? persisted.tabs.filter(isHostedShellTab).map((tab) => ({
        ...tab,
        apiBaseUrl: normalizeHostedApiBaseUrl(tab.apiBaseUrl) ?? tab.apiBaseUrl,
      }))
    : []

  const activeTabId =
    typeof persisted.activeTabId === 'string' &&
    tabs.some((tab) => tab.id === persisted.activeTabId)
      ? persisted.activeTabId
      : (tabs[0]?.id ?? null)

  return {
    activeTabId,
    tabs,
  }
}

export function loadHostedShellState(storage: Pick<Storage, 'getItem'>): HostedShellState {
  try {
    const raw = storage.getItem(SHELL_STORAGE_KEY)
    if (!raw) {
      return createEmptyHostedShellState()
    }
    return parseHostedShellState(JSON.parse(raw))
  } catch {
    return createEmptyHostedShellState()
  }
}

export function saveHostedShellState(
  storage: Pick<Storage, 'setItem'>,
  state: HostedShellState
): void {
  try {
    storage.setItem(SHELL_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore persistence failures in the hosted shell
  }
}

export function generateHostedSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `hosted-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function findMatchingTabIndex(state: HostedShellState, request: HostedShellLaunchRequest): number {
  return state.tabs.findIndex((tab) => tab.apiBaseUrl === request.apiBaseUrl)
}

export function applyHostedLaunchRequest(
  state: HostedShellState,
  request: HostedShellLaunchRequest,
  options?: {
    now?: number
    sessionId?: string
  }
): HostedShellState {
  const matchingIndex = findMatchingTabIndex(state, request)
  if (matchingIndex >= 0) {
    return {
      ...state,
      activeTabId: state.tabs[matchingIndex]?.id ?? state.activeTabId,
    }
  }

  const sessionId = options?.sessionId ?? generateHostedSessionId()
  const nextTab: HostedShellTab = {
    id: sessionId,
    sessionId,
    apiBaseUrl: request.apiBaseUrl,
    createdAt: options?.now ?? Date.now(),
  }

  return {
    activeTabId: nextTab.id,
    tabs: [...state.tabs, nextTab],
  }
}

export function removeHostedTab(state: HostedShellState, tabId: string): HostedShellState {
  const removedIndex = state.tabs.findIndex((tab) => tab.id === tabId)
  if (removedIndex < 0) return state

  const tabs = state.tabs.filter((tab) => tab.id !== tabId)
  if (state.activeTabId !== tabId) {
    return {
      activeTabId: state.activeTabId,
      tabs,
    }
  }

  const nextActive = tabs[removedIndex]?.id ?? tabs[removedIndex - 1]?.id ?? null
  return {
    activeTabId: nextActive,
    tabs,
  }
}

export function activateHostedTab(state: HostedShellState, tabId: string): HostedShellState {
  if (!state.tabs.some((tab) => tab.id === tabId)) return state
  if (state.activeTabId === tabId) return state
  return {
    ...state,
    activeTabId: tabId,
  }
}

export function buildHostedVersionEntryUrl(tab: HostedShellTab, channel: string): string {
  const params = new URLSearchParams({
    api: tab.apiBaseUrl,
    session: tab.sessionId,
  })
  return `/versions/${channel}/index.html?${params.toString()}`
}

export function getHostedTabLabel(tab: Pick<HostedShellTab, 'apiBaseUrl'>): string {
  try {
    return new URL(tab.apiBaseUrl).host
  } catch {
    return tab.apiBaseUrl
  }
}
