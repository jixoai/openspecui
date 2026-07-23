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
import { fetchBackendRootContext } from './backend-client'
import {
  probeHostedBackend,
  type HostedBackendProbeResult,
  type HostedTabReachability,
} from './reachability'
import type { HostedShellTab } from './shell-state'
import { useConnections } from './use-connections'

const REFRESH_INTERVAL_MS = 15_000

export type RootObservationStatus = 'idle' | 'loading' | 'ready' | 'error'

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
  rootError: string | null
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
  refresh(apiBaseUrls?: readonly string[]): Promise<void>
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
  const retainedTabs = new Map<string, HostedShellTab>()
  const generations = new Map<string, number>()
  const observations = new Map<string, ConnectionObservation>()
  let revision = 0
  let snapshot: ConnectionObservationSnapshot = { revision, observations: [] }

  const publish = (): void => {
    revision += 1
    snapshot = {
      revision,
      observations: [...retainedTabs.keys()].flatMap((apiBaseUrl) => {
        const observation = observations.get(apiBaseUrl)
        return observation ? [observation] : []
      }),
    }
    listeners.forEach((listener) => listener())
  }

  const isCurrentGeneration = (apiBaseUrl: string, generation: number): boolean =>
    retainedTabs.has(apiBaseUrl) && generations.get(apiBaseUrl) === generation

  const update = (
    apiBaseUrl: string,
    generation: number,
    resolve: (previous: ConnectionObservation) => ConnectionObservation
  ): boolean => {
    if (!isCurrentGeneration(apiBaseUrl, generation)) return false
    const previous = observations.get(apiBaseUrl)
    if (!previous) return false
    observations.set(apiBaseUrl, resolve(previous))
    publish()
    return true
  }

  const observe = async (apiBaseUrl: string): Promise<void> => {
    const tab = retainedTabs.get(apiBaseUrl)
    if (!tab) return
    const generation = (generations.get(apiBaseUrl) ?? 0) + 1
    generations.set(apiBaseUrl, generation)
    const previous = observations.get(apiBaseUrl)
    observations.set(apiBaseUrl, {
      ...(previous ?? createInitialObservation(tab, generation, dependencies.now())),
      tabId: tab.id,
      generation,
      reachability: 'checking',
      healthError: null,
      current: false,
      stale: Boolean(previous?.health || previous?.rootContext),
      observedAt: dependencies.now(),
    })
    publish()

    const probe = await dependencies.probe(apiBaseUrl)
    if (probe.reachability !== 'online' || !probe.health) {
      update(apiBaseUrl, generation, (current) => ({
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
      !update(apiBaseUrl, generation, (current) => ({
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
      const rootContext = await dependencies.fetchRootContext(apiBaseUrl)
      update(apiBaseUrl, generation, (current) => ({
        ...current,
        rootContext,
        rootStatus: rootContext
          ? rootContext.state === 'error'
            ? 'error'
            : rootContext.state === 'ready'
              ? 'ready'
              : 'loading'
          : 'error',
        rootError: rootContext ? null : 'Root Context response is unavailable.',
        observedAt: dependencies.now(),
      }))
    } catch (error) {
      update(apiBaseUrl, generation, (current) => ({
        ...current,
        rootStatus: 'error',
        rootError: error instanceof Error ? error.message : String(error),
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
      const nextByUrl = new Map(tabs.map((tab) => [tab.apiBaseUrl, tab] as const))
      let changed = false
      for (const apiBaseUrl of retainedTabs.keys()) {
        if (nextByUrl.has(apiBaseUrl)) continue
        retainedTabs.delete(apiBaseUrl)
        generations.set(apiBaseUrl, (generations.get(apiBaseUrl) ?? 0) + 1)
        observations.delete(apiBaseUrl)
        changed = true
      }

      const added: string[] = []
      for (const [apiBaseUrl, tab] of nextByUrl) {
        const retained = retainedTabs.get(apiBaseUrl)
        retainedTabs.set(apiBaseUrl, tab)
        if (!retained) {
          const generation = (generations.get(apiBaseUrl) ?? 0) + 1
          generations.set(apiBaseUrl, generation)
          observations.set(
            apiBaseUrl,
            createInitialObservation(tab, generation, dependencies.now())
          )
          added.push(apiBaseUrl)
          changed = true
        } else if (retained.id !== tab.id) {
          const generation = (generations.get(apiBaseUrl) ?? 0) + 1
          generations.set(apiBaseUrl, generation)
          observations.set(
            apiBaseUrl,
            createInitialObservation(tab, generation, dependencies.now())
          )
          added.push(apiBaseUrl)
          changed = true
        }
      }

      if (changed) publish()
      for (const apiBaseUrl of added) void observe(apiBaseUrl)
    },
    async refresh(apiBaseUrls) {
      const targetSet = apiBaseUrls ? new Set(apiBaseUrls) : null
      const targets = [...retainedTabs.keys()].filter(
        (apiBaseUrl) => !targetSet || targetSet.has(apiBaseUrl)
      )
      await Promise.all(targets.map(observe))
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
