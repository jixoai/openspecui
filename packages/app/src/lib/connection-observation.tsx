/**
 * Orthogonal intents (created 2026-07-24 Asia/Shanghai):
 * 1. Own health and Root Context observation for every retained backend locator.
 * 2. Retire late results when a locator is removed, replaced, or refreshed.
 * 3. Separate all-source observation from exact active-tab mutation authority.
 * 4. Share one runtime owner across Hosted Shell and App-native environment routes.
 *
 * Original request (2026-07-24): "apply openspec-change: close-openspec-cli16-delivery-gaps"
 */
import type { HostedBackendHealthResponse, RootContextState } from '@openspecui/core'
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import type { RootObservationError, RootObservationStatus } from '../types/root-context'
import { fetchBackendRootContext } from './backend-client'
import {
  probeHostedBackend,
  type HostedBackendProbeResult,
  type HostedTabReachability,
} from './reachability'
import type { HostedShellTab } from './shell-state'
import { useConnections } from './use-connections'

const REFRESH_INTERVAL_MS = 15_000

/** Exact authority captured by an environment-scoped action. */
export interface ConnectionObservationAuthority {
  tabId: string
  apiBaseUrl: string
  generation: number
}

/** Current or retained evidence for one credential-free backend locator. */
export interface ConnectionObservation {
  tabId: string
  apiBaseUrl: string
  generation: number
  reachability: HostedTabReachability
  health: HostedBackendHealthResponse | null
  healthError: string | null
  rootContext: RootContextState | null
  rootStatus: RootObservationStatus
  rootError: RootObservationError | null
  /** True only after this generation's compatible health probe succeeds. */
  current: boolean
  /** Retained evidence exists but cannot authorize current operations. */
  stale: boolean
  observedAt: number
}

export interface ConnectionObservationSnapshot {
  revision: number
  observations: readonly ConnectionObservation[]
}

interface ConnectionObservationDependencies {
  probe: (apiBaseUrl: string) => Promise<HostedBackendProbeResult>
  fetchRootContext: (apiBaseUrl: string) => Promise<RootContextState | null>
  now: () => number
}

export interface ConnectionObservationOwner {
  getSnapshot(): ConnectionObservationSnapshot
  subscribe(listener: () => void): () => void
  setTabs(tabs: readonly HostedShellTab[]): void
  refresh(tabIds?: readonly string[]): Promise<void>
  isCurrentAuthority(authority: ConnectionObservationAuthority): boolean
}

function isSameTab(left: HostedShellTab, right: HostedShellTab): boolean {
  return (
    left.id === right.id &&
    left.sessionId === right.sessionId &&
    left.apiBaseUrl === right.apiBaseUrl &&
    left.createdAt === right.createdAt
  )
}

function createInitialObservation(
  tab: HostedShellTab,
  generation: number,
  now: number
): ConnectionObservation {
  return {
    tabId: tab.id,
    apiBaseUrl: tab.apiBaseUrl,
    generation,
    reachability: 'checking',
    health: null,
    healthError: null,
    rootContext: null,
    rootStatus: 'idle',
    rootError: null,
    current: false,
    stale: false,
    observedAt: now,
  }
}

/** Create the App's single multi-backend observation owner. */
export function createConnectionObservationOwner(
  overrides: Partial<ConnectionObservationDependencies> = {}
): ConnectionObservationOwner {
  const dependencies: ConnectionObservationDependencies = {
    probe: (apiBaseUrl) => probeHostedBackend(apiBaseUrl),
    fetchRootContext: (apiBaseUrl) => fetchBackendRootContext({ apiBaseUrl }),
    now: Date.now,
    ...overrides,
  }
  const listeners = new Set<() => void>()
  let retainedTabs = new Map<string, HostedShellTab>()
  const observations = new Map<string, ConnectionObservation>()
  let nextGeneration = 0
  let revision = 0
  let snapshot: ConnectionObservationSnapshot = { revision, observations: [] }

  const publish = (): void => {
    revision += 1
    snapshot = {
      revision,
      observations: [...retainedTabs.keys()].flatMap((tabId) => {
        const observation = observations.get(tabId)
        return observation ? [observation] : []
      }),
    }
    listeners.forEach((listener) => listener())
  }

  const isCurrentGeneration = (tabId: string, generation: number): boolean =>
    retainedTabs.has(tabId) && observations.get(tabId)?.generation === generation

  const update = (
    tabId: string,
    generation: number,
    resolve: (previous: ConnectionObservation) => ConnectionObservation
  ): boolean => {
    if (!isCurrentGeneration(tabId, generation)) return false
    const previous = observations.get(tabId)
    if (!previous) return false
    observations.set(tabId, resolve(previous))
    publish()
    return true
  }

  const observe = async (tabId: string): Promise<void> => {
    const tab = retainedTabs.get(tabId)
    if (!tab) return
    const generation = ++nextGeneration
    const previous = observations.get(tabId)
    observations.set(tabId, {
      ...(previous ?? createInitialObservation(tab, generation, dependencies.now())),
      tabId: tab.id,
      apiBaseUrl: tab.apiBaseUrl,
      generation,
      reachability: 'checking',
      healthError: null,
      current: false,
      stale: Boolean(previous?.health || previous?.rootContext),
      observedAt: dependencies.now(),
    })
    publish()

    const probe = await dependencies.probe(tab.apiBaseUrl)
    if (probe.reachability !== 'online' || !probe.health) {
      update(tabId, generation, (current) => ({
        ...current,
        reachability: probe.reachability,
        healthError: probe.errorMessage,
        current: false,
        stale: Boolean(current.health || current.rootContext),
        observedAt: dependencies.now(),
      }))
      return
    }

    if (
      !update(tabId, generation, (current) => ({
        ...current,
        reachability: 'online',
        health: probe.health,
        healthError: null,
        rootStatus: 'loading',
        rootError: null,
        current: true,
        stale: false,
        observedAt: dependencies.now(),
      }))
    ) {
      return
    }

    try {
      const rootContext = await dependencies.fetchRootContext(tab.apiBaseUrl)
      update(tabId, generation, (current) => ({
        ...current,
        rootContext,
        rootStatus: rootContext?.state ?? 'error',
        rootError:
          rootContext?.state === 'error'
            ? {
                source: 'root-context',
                code: rootContext.error.code,
                message: rootContext.error.message,
              }
            : rootContext
              ? null
              : { source: 'transport', message: 'Root Context response is unavailable.' },
        observedAt: dependencies.now(),
      }))
    } catch (error) {
      update(tabId, generation, (current) => ({
        ...current,
        rootStatus: 'error',
        rootError: {
          source: 'transport',
          message: error instanceof Error ? error.message : String(error),
        },
        observedAt: dependencies.now(),
      }))
    }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    setTabs(tabs) {
      const nextTabs = new Map(tabs.map((tab) => [tab.id, tab] as const))
      const previousTabIds = [...retainedTabs.keys()]
      const nextTabIds = [...nextTabs.keys()]
      const changedTabIds: string[] = []

      for (const tabId of retainedTabs.keys()) {
        if (nextTabs.has(tabId)) continue
        observations.delete(tabId)
      }

      for (const [tabId, tab] of nextTabs) {
        const retained = retainedTabs.get(tabId)
        if (!retained || !isSameTab(retained, tab)) changedTabIds.push(tabId)
      }

      const reordered =
        previousTabIds.length !== nextTabIds.length ||
        previousTabIds.some((tabId, index) => tabId !== nextTabIds[index])
      retainedTabs = nextTabs
      if (changedTabIds.length === 0 && reordered) publish()
      for (const tabId of changedTabIds) void observe(tabId)
    },
    async refresh(tabIds) {
      const targetSet = tabIds ? new Set(tabIds) : null
      const targets = [...retainedTabs.keys()].filter((tabId) => !targetSet || targetSet.has(tabId))
      await Promise.all(targets.map(observe))
    },
    isCurrentAuthority(authority) {
      const observation = observations.get(authority.tabId)
      return Boolean(
        observation &&
          observation.apiBaseUrl === authority.apiBaseUrl &&
          observation.generation === authority.generation &&
          observation.current &&
          observation.reachability === 'online' &&
          observation.health
      )
    },
  }
}

const ConnectionObservationContext = createContext<ConnectionObservationOwner | null>(null)

/** Install one connection owner above every App route and Hosted Shell session. */
export function ConnectionObservationProvider({ children }: { children: ReactNode }) {
  const connections = useConnections()
  const [owner] = useState(createConnectionObservationOwner)

  useEffect(() => {
    owner.setTabs(connections.tabs)
  }, [connections.tabs, owner])

  useEffect(() => {
    const refresh = () => void owner.refresh()
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    const interval = window.setInterval(refresh, REFRESH_INTERVAL_MS)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      owner.setTabs([])
    }
  }, [owner])

  return (
    <ConnectionObservationContext.Provider value={owner}>
      {children}
    </ConnectionObservationContext.Provider>
  )
}

/** Supply an owner only when a component is mounted outside the App root (for isolated fixtures). */
export function ConnectionObservationBoundary({ children }: { children: ReactNode }) {
  const owner = useContext(ConnectionObservationContext)
  return owner ? (
    children
  ) : (
    <ConnectionObservationProvider>{children}</ConnectionObservationProvider>
  )
}

/** Read the shared owner for explicit refreshes initiated by Hosted Shell controls. */
export function useConnectionObservationOwner(): ConnectionObservationOwner {
  const owner = useContext(ConnectionObservationContext)
  if (!owner) throw new Error('ConnectionObservationProvider is required.')
  return owner
}

/** Subscribe to every current retained backend observation. */
export function useConnectionObservations(): ConnectionObservationSnapshot {
  const owner = useConnectionObservationOwner()
  return useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot)
}
