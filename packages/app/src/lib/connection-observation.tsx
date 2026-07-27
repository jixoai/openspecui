/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Own same-identity health-probe and replacement-observation single-flight across failure, refresh, and reconnect.
 * 2. Retire late results when a locator is removed, replaced, or refreshed.
 * 3. Correlate mutation authority with the full tab identity and observation generation.
 * 4. Keep retained renderable health/Root evidence separate from the current attempt and authority.
 * 5. Share one runtime owner across Hosted Shell and App-native routes with timer-free focus/visibility refresh.
 *
 * Original request (2026-07-24): "apply openspec-change: close-openspec-cli16-delivery-gaps"
 * Owner-reported defect (2026-07-26): "Dashboard加载完成的一瞬间开始reload。"
 * Owner requirement (2026-07-27): reconnect must refresh objective health/CLI/credential facts.
 * Original request (2026-07-27): "统一修复所有类似的问题，特别是app 那边新增的页面。"
 */
import type {
  HostedBackendHealthResponse,
  HostedCliProjectionNotice,
  HostedRootContextProjectionState,
  HostedRootContextState,
} from '@openspecui/core/hosted-contract'
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import type { RootObservationError, RootObservationStatus } from '../types/root-context'
import {
  fetchBackendRootContextProjection,
  refreshBackendRootContextProjection,
} from './backend-client'
import {
  createTRPCCliProjectionTransportFactory,
  type CliProjectionTransport,
  type CliProjectionTransportFactory,
} from './cli-projection-transport'
import {
  probeHostedBackend,
  type HostedBackendProbeResult,
  type HostedTabReachability,
} from './reachability'
import type { HostedShellTab } from './shell-state'
import { useConnections } from './use-connections'

/** Exact authority captured by an environment-scoped action. */
export interface ConnectionObservationAuthority {
  tabId: string
  sessionId: string
  apiBaseUrl: string
  tabCreatedAt: number
  generation: number
}

/** Immutable provenance for the last committed Root/Reference evidence. */
export interface ConnectionRootEvidence {
  tabId: string
  sessionId: string
  apiBaseUrl: string
  tabCreatedAt: number
  generation: number
  health: HostedBackendHealthResponse
  rootContext: HostedRootContextState
  observedAt: number
}

/** Lifecycle and source for the current generation's Root observation attempt. */
export interface ConnectionRootAttempt {
  tabId: string
  sessionId: string
  apiBaseUrl: string
  tabCreatedAt: number
  generation: number
  health: HostedBackendHealthResponse | null
  status: RootObservationStatus
  error: RootObservationError | null
  observedAt: number
}

/** Current or retained evidence for one credential-free backend locator. */
export interface ConnectionObservation {
  tabId: string
  sessionId: string
  apiBaseUrl: string
  tabCreatedAt: number
  generation: number
  reachability: HostedTabReachability
  health: HostedBackendHealthResponse | null
  healthError: string | null
  rootEvidence: ConnectionRootEvidence | null
  rootAttempt: ConnectionRootAttempt
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
  fetchRootProjection: (apiBaseUrl: string) => Promise<HostedRootContextProjectionState>
  refreshRootProjection: (apiBaseUrl: string) => Promise<void>
  projectionTransportFactory: CliProjectionTransportFactory
  now: () => number
}

interface ConnectionObservationReplacement {
  tab: HostedShellTab
  phase: 'probing' | 'settling'
  invalidateProjection: boolean
  promise: Promise<void>
}

export interface ConnectionObservationOwner {
  getSnapshot(): ConnectionObservationSnapshot
  subscribe(listener: () => void): () => void
  setTabs(tabs: readonly HostedShellTab[]): void
  refresh(tabIds?: readonly string[]): Promise<void>
  isCurrentAuthority(authority: ConnectionObservationAuthority): boolean
}

interface ConnectionObservationRefreshWindow {
  addEventListener(type: 'focus', listener: () => void): void
  removeEventListener(type: 'focus', listener: () => void): void
}

interface ConnectionObservationRefreshDocument {
  readonly visibilityState: DocumentVisibilityState
  addEventListener(type: 'visibilitychange', listener: () => void): void
  removeEventListener(type: 'visibilitychange', listener: () => void): void
}

/** Bind explicit browser-lifecycle refreshes without introducing a healthy-path polling timer. */
export function bindConnectionObservationRefreshTriggers(input: {
  owner: Pick<ConnectionObservationOwner, 'refresh'>
  windowTarget: ConnectionObservationRefreshWindow
  documentTarget: ConnectionObservationRefreshDocument
}): () => void {
  const refresh = () => void input.owner.refresh()
  const onVisibilityChange = () => {
    if (input.documentTarget.visibilityState === 'visible') refresh()
  }
  input.windowTarget.addEventListener('focus', refresh)
  input.documentTarget.addEventListener('visibilitychange', onVisibilityChange)
  return () => {
    input.windowTarget.removeEventListener('focus', refresh)
    input.documentTarget.removeEventListener('visibilitychange', onVisibilityChange)
  }
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
    sessionId: tab.sessionId,
    apiBaseUrl: tab.apiBaseUrl,
    tabCreatedAt: tab.createdAt,
    generation,
    reachability: 'checking',
    health: null,
    healthError: null,
    rootEvidence: null,
    rootAttempt: {
      tabId: tab.id,
      sessionId: tab.sessionId,
      apiBaseUrl: tab.apiBaseUrl,
      tabCreatedAt: tab.createdAt,
      generation,
      health: null,
      status: 'idle',
      error: null,
      observedAt: now,
    },
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
    fetchRootProjection: (apiBaseUrl) => fetchBackendRootContextProjection({ apiBaseUrl }),
    refreshRootProjection: (apiBaseUrl) => refreshBackendRootContextProjection({ apiBaseUrl }),
    projectionTransportFactory: createTRPCCliProjectionTransportFactory(),
    now: Date.now,
    ...overrides,
  }
  const listeners = new Set<() => void>()
  let retainedTabs = new Map<string, HostedShellTab>()
  const observations = new Map<string, ConnectionObservation>()
  const projectionTransports = new Map<
    string,
    { tab: HostedShellTab; epoch: number; transport: CliProjectionTransport }
  >()
  const rootPullSequences = new Map<string, number>()
  const rootAdmissionPulls = new Map<string, { generation: number }>()
  const rootProjectionStates = new Map<
    string,
    { generation: number; state: HostedRootContextProjectionState }
  >()
  const healthProbes = new Map<
    string,
    { tab: HostedShellTab; promise: Promise<HostedBackendProbeResult> }
  >()
  const replacementObservations = new Map<string, ConnectionObservationReplacement>()
  let nextGeneration = 0
  let nextTransportEpoch = 0
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

  const isCurrentGeneration = (tabId: string, generation: number): boolean => {
    const tab = retainedTabs.get(tabId)
    const observation = observations.get(tabId)
    return Boolean(
      tab &&
        observation &&
        observation.generation === generation &&
        observation.sessionId === tab.sessionId &&
        observation.apiBaseUrl === tab.apiBaseUrl &&
        observation.tabCreatedAt === tab.createdAt
    )
  }

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

  const updateRootFailure = (tabId: string, generation: number, error: unknown): void => {
    update(tabId, generation, (current) => ({
      ...current,
      rootAttempt: {
        ...current.rootAttempt,
        status: 'error',
        error: {
          source: 'transport',
          message: error instanceof Error ? error.message : String(error),
        },
        observedAt: dependencies.now(),
      },
      stale: Boolean(current.rootEvidence),
      observedAt: dependencies.now(),
    }))
  }

  const retireRootPull = (tabId: string): void => {
    rootAdmissionPulls.delete(tabId)
    rootPullSequences.set(tabId, (rootPullSequences.get(tabId) ?? 0) + 1)
  }

  const pullRootProjection = async (
    tabId: string,
    generation: number,
    expectedNotice?: HostedCliProjectionNotice
  ): Promise<void> => {
    const tab = retainedTabs.get(tabId)
    const current = observations.get(tabId)
    if (!tab || !current || current.generation !== generation) return
    const pullSequence = (rootPullSequences.get(tabId) ?? 0) + 1
    rootPullSequences.set(tabId, pullSequence)
    const isCurrentPull = (): boolean =>
      rootPullSequences.get(tabId) === pullSequence && isCurrentGeneration(tabId, generation)

    try {
      const projection = await dependencies.fetchRootProjection(tab.apiBaseUrl)
      if (!isCurrentPull()) return
      if (
        expectedNotice &&
        (projection.identity !== expectedNotice.identity ||
          projection.workGeneration < expectedNotice.workGeneration ||
          (expectedNotice.snapshotGeneration !== null &&
            projection.snapshotGeneration !== null &&
            projection.snapshotGeneration < expectedNotice.snapshotGeneration))
      ) {
        return
      }
      rootProjectionStates.set(tabId, { generation, state: projection })
      update(tabId, generation, (observation) => {
        const health = observation.health
        const resolved = projection.data
        const canCommitEvidence = Boolean(observation.current && health && resolved?.data)
        const currentResolved = projection.state === 'ready' ? projection.data : null
        const shouldReplaceEvidence =
          currentResolved?.state === 'ready' || observation.rootEvidence === null
        const nextEvidence =
          canCommitEvidence && shouldReplaceEvidence && health && resolved
            ? {
                tabId: tab.id,
                sessionId: tab.sessionId,
                apiBaseUrl: tab.apiBaseUrl,
                tabCreatedAt: tab.createdAt,
                generation,
                health,
                rootContext: resolved,
                observedAt: resolved.observedAt,
              }
            : observation.rootEvidence

        const attempt = (() => {
          if (projection.state === 'loading') {
            return { status: 'loading' as const, error: null, observedAt: dependencies.now() }
          }
          if (projection.state === 'revalidating') {
            return {
              status: 'refreshing' as const,
              error: null,
              observedAt: resolved?.observedAt ?? dependencies.now(),
            }
          }
          if (projection.state === 'error' || projection.state === 'refresh-error') {
            return {
              status: 'error' as const,
              error: { source: 'transport' as const, message: projection.error.message },
              observedAt: resolved?.observedAt ?? dependencies.now(),
            }
          }
          const ready = projection.data
          if (ready.state === 'error') {
            return {
              status: 'error' as const,
              error: {
                source: 'root-context' as const,
                code: ready.error.code,
                message: ready.error.message,
              },
              observedAt: ready.observedAt,
            }
          }
          return { status: 'ready' as const, error: null, observedAt: ready.observedAt }
        })()

        return {
          ...observation,
          rootEvidence: nextEvidence,
          rootAttempt: {
            ...observation.rootAttempt,
            health,
            ...attempt,
          },
          stale: projection.state !== 'ready' || resolved?.state !== 'ready',
          observedAt: dependencies.now(),
        }
      })
    } catch (error) {
      if (isCurrentPull()) updateRootFailure(tabId, generation, error)
    }
  }

  const retireProjectionTransport = (tabId: string): void => {
    retireRootPull(tabId)
    healthProbes.delete(tabId)
    replacementObservations.delete(tabId)
    const existing = projectionTransports.get(tabId)
    if (!existing) return
    projectionTransports.delete(tabId)
    existing.transport.unsubscribe()
  }

  const probeHealth = (tab: HostedShellTab): Promise<HostedBackendProbeResult> => {
    const existing = healthProbes.get(tab.id)
    if (existing && isSameTab(existing.tab, tab)) return existing.promise
    const promise = dependencies.probe(tab.apiBaseUrl)
    const release = () => {
      const current = healthProbes.get(tab.id)
      if (current?.promise === promise && isSameTab(current.tab, tab)) {
        healthProbes.delete(tab.id)
      }
    }
    healthProbes.set(tab.id, { tab, promise })
    void promise.then(release, release)
    return promise
  }

  const probeTransportFailure = (tab: HostedShellTab, generation: number): void => {
    void probeHealth(tab).then((probe) => {
      if (probe.reachability === 'online' || !isCurrentGeneration(tab.id, generation)) return
      update(tab.id, generation, (current) => ({
        ...current,
        reachability: probe.reachability,
        healthError: probe.errorMessage,
        current: false,
        stale: Boolean(current.health || current.rootEvidence),
        observedAt: dependencies.now(),
      }))
    })
  }

  const ensureProjectionTransport = (tab: HostedShellTab): void => {
    const existing = projectionTransports.get(tab.id)
    if (existing && isSameTab(existing.tab, tab)) return
    if (existing) retireProjectionTransport(tab.id)

    const epoch = ++nextTransportEpoch
    const isActive = (): boolean => {
      const retained = retainedTabs.get(tab.id)
      const entry = projectionTransports.get(tab.id)
      return Boolean(
        retained && entry?.epoch === epoch && isSameTab(retained, tab) && isSameTab(entry.tab, tab)
      )
    }
    const currentGeneration = (): number | null => {
      if (!isActive()) return null
      return observations.get(tab.id)?.generation ?? null
    }
    let transportReady = false
    let needsReconnectProbe = false
    const transport = dependencies.projectionTransportFactory.connect(
      tab.apiBaseUrl,
      { kind: 'root-context' },
      {
        onNotice(notice) {
          const generation = currentGeneration()
          if (generation === null) return
          const latest = rootProjectionStates.get(tab.id)
          if (
            latest?.generation === generation &&
            latest.state.identity === notice.identity &&
            latest.state.workGeneration === notice.workGeneration &&
            latest.state.snapshotGeneration === notice.snapshotGeneration &&
            latest.state.state === notice.state
          ) {
            return
          }
          const admission = rootAdmissionPulls.get(tab.id)
          update(tab.id, generation, (current) => ({
            ...current,
            rootAttempt: {
              ...current.rootAttempt,
              status: current.rootEvidence ? 'refreshing' : 'loading',
              error: null,
              observedAt: dependencies.now(),
            },
            stale: Boolean(current.rootEvidence),
            observedAt: dependencies.now(),
          }))
          if (admission?.generation === generation && notice.invalidationCause === 'initial') {
            return
          }
          if (admission?.generation === generation) rootAdmissionPulls.delete(tab.id)
          void pullRootProjection(tab.id, generation, notice)
        },
        onConnectionState(state) {
          const generation = currentGeneration()
          if (generation === null) return
          if (state === 'pending') {
            if (!transportReady) {
              transportReady = true
              return
            }
            if (!needsReconnectProbe) return
            needsReconnectProbe = false
            void observeReplacement(tab.id, false)
            return
          }
          if (!transportReady) return
          if (transportReady) needsReconnectProbe = true
          retireRootPull(tab.id)
          update(tab.id, generation, (current) => ({
            ...current,
            reachability: 'checking',
            rootAttempt: {
              ...current.rootAttempt,
              status: current.rootEvidence ? 'refreshing' : 'loading',
              error: null,
              observedAt: dependencies.now(),
            },
            current: false,
            stale: Boolean(current.rootEvidence),
            observedAt: dependencies.now(),
          }))
          probeTransportFailure(tab, generation)
        },
        onError(error) {
          const generation = currentGeneration()
          if (generation !== null) {
            if (transportReady) needsReconnectProbe = true
            retireRootPull(tab.id)
            updateRootFailure(tab.id, generation, error)
            probeTransportFailure(tab, generation)
          }
        },
        onStopped() {
          const generation = currentGeneration()
          if (generation !== null) {
            if (transportReady) needsReconnectProbe = true
            retireRootPull(tab.id)
            updateRootFailure(tab.id, generation, new Error('Root Context subscription stopped.'))
            probeTransportFailure(tab, generation)
          }
        },
        onComplete() {
          const generation = currentGeneration()
          if (generation !== null) {
            if (transportReady) needsReconnectProbe = true
            retireRootPull(tab.id)
            updateRootFailure(tab.id, generation, new Error('Root Context subscription completed.'))
            probeTransportFailure(tab, generation)
          }
        },
      }
    )
    projectionTransports.set(tab.id, { tab, epoch, transport })
  }

  async function observe(
    tabId: string,
    replacement: ConnectionObservationReplacement | null
  ): Promise<void> {
    const tab = retainedTabs.get(tabId)
    if (!tab) return
    const generation = ++nextGeneration
    const previous = observations.get(tabId)
    const attemptStartedAt = dependencies.now()
    observations.set(tabId, {
      ...(previous ?? createInitialObservation(tab, generation, dependencies.now())),
      tabId: tab.id,
      sessionId: tab.sessionId,
      apiBaseUrl: tab.apiBaseUrl,
      tabCreatedAt: tab.createdAt,
      generation,
      reachability: 'checking',
      health: previous?.health ?? null,
      healthError: null,
      rootAttempt: {
        tabId: tab.id,
        sessionId: tab.sessionId,
        apiBaseUrl: tab.apiBaseUrl,
        tabCreatedAt: tab.createdAt,
        generation,
        health: null,
        status: 'idle',
        error: null,
        observedAt: attemptStartedAt,
      },
      current: false,
      stale: Boolean(previous?.health || previous?.rootEvidence),
      observedAt: attemptStartedAt,
    })
    publish()

    const probe = await probeHealth(tab)
    if (replacement) replacement.phase = 'settling'
    if (probe.reachability !== 'online' || !probe.health) {
      update(tabId, generation, (current) => ({
        ...current,
        reachability: probe.reachability,
        healthError: probe.errorMessage,
        current: false,
        stale: Boolean(current.health || current.rootEvidence),
        observedAt: dependencies.now(),
      }))
      return
    }
    const health = probe.health

    if (
      !update(tabId, generation, (current) => ({
        ...current,
        reachability: 'online',
        health,
        healthError: null,
        rootAttempt: {
          ...current.rootAttempt,
          health,
          status: 'loading',
          error: null,
          observedAt: dependencies.now(),
        },
        current: true,
        stale: Boolean(current.rootEvidence),
        observedAt: dependencies.now(),
      }))
    ) {
      return
    }
    try {
      if (replacement?.invalidateProjection) {
        await dependencies.refreshRootProjection(tab.apiBaseUrl)
      }
      const admission = { generation }
      rootAdmissionPulls.set(tabId, admission)
      const admissionPull = pullRootProjection(tabId, generation)
      ensureProjectionTransport(tab)
      await admissionPull
      if (rootAdmissionPulls.get(tabId) === admission) rootAdmissionPulls.delete(tabId)
    } catch (error) {
      const admission = rootAdmissionPulls.get(tabId)
      if (admission?.generation === generation) rootAdmissionPulls.delete(tabId)
      updateRootFailure(tabId, generation, error)
    }
  }

  const observeReplacement = (tabId: string, invalidateProjection: boolean): Promise<void> => {
    const tab = retainedTabs.get(tabId)
    if (!tab) return Promise.resolve()
    const existing = replacementObservations.get(tabId)
    if (existing && isSameTab(existing.tab, tab)) {
      if (!invalidateProjection || existing.invalidateProjection) return existing.promise
      if (invalidateProjection && existing.phase === 'probing') {
        existing.invalidateProjection = true
        return existing.promise
      }
    }

    const replacement: ConnectionObservationReplacement = {
      tab,
      phase: 'probing',
      invalidateProjection,
      promise: Promise.resolve(),
    }
    const promise = observe(tabId, replacement)
    replacement.promise = promise
    replacementObservations.set(tabId, replacement)
    const release = () => {
      if (replacementObservations.get(tabId) === replacement) {
        replacementObservations.delete(tabId)
      }
    }
    void promise.then(release, release)
    return promise
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
        retireProjectionTransport(tabId)
        observations.delete(tabId)
        rootProjectionStates.delete(tabId)
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
      for (const tabId of changedTabIds) {
        retireProjectionTransport(tabId)
        void observe(tabId, null)
      }
    },
    async refresh(tabIds) {
      const targetSet = tabIds ? new Set(tabIds) : null
      const targets = [...retainedTabs.keys()].filter((tabId) => !targetSet || targetSet.has(tabId))
      await Promise.all(targets.map((tabId) => observeReplacement(tabId, true)))
    },
    isCurrentAuthority(authority) {
      const observation = observations.get(authority.tabId)
      const tab = retainedTabs.get(authority.tabId)
      return Boolean(
        observation &&
          tab &&
          tab.sessionId === authority.sessionId &&
          tab.apiBaseUrl === authority.apiBaseUrl &&
          tab.createdAt === authority.tabCreatedAt &&
          observation.sessionId === authority.sessionId &&
          observation.apiBaseUrl === authority.apiBaseUrl &&
          observation.tabCreatedAt === authority.tabCreatedAt &&
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
    const releaseRefreshTriggers = bindConnectionObservationRefreshTriggers({
      owner,
      windowTarget: window,
      documentTarget: document,
    })
    return () => {
      releaseRefreshTriggers()
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
