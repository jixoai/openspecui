/**
 * Orthogonal intents (created 2026-07-31 Asia/Shanghai):
 * 1. Observe every daemon-registered backend independently from open Workspace tabs.
 * 2. Require compatible Health API evidence plus an established WebSocket subscription for Running.
 * 3. Retire stale asynchronous evidence and WebSocket authority when a lease disappears or is replaced.
 * 4. Preserve non-running registered rows with an objective transport/authentication state.
 *
 * Owner correction (2026-07-31): "runnings必须客观表达目前正在运行中的backend，也就是说，对于External backend，你必须基于 health-api，必须建立WebSocket才能确定它的状况"
 */
import type { AppDaemonWorkspaceBinding } from '@openspecui/core/app-daemon-control'
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

/** Objective runtime state for one daemon-registered backend. */
export type RunningBackendObservationState =
  | 'checking'
  | 'running'
  | 'offline'
  | 'authentication-required'
  | 'unsupported'
  | 'realtime-unavailable'

/** Health and realtime evidence for one current daemon registration. */
export interface RunningBackendObservation {
  readonly workspaceId: string
  readonly backendUrl: string
  readonly registeredAt: number
  readonly state: RunningBackendObservationState
  readonly healthReachability: HostedTabReachability
  readonly websocket: 'connecting' | 'connected' | 'disconnected'
  readonly error: string | null
  readonly observedAt: number
}

/** Immutable replacement snapshot for all daemon-registered backend observations. */
export interface RunningBackendObservationSnapshot {
  readonly revision: number
  readonly observations: readonly RunningBackendObservation[]
}

export interface RunningBackendObservationOwner {
  getSnapshot(): RunningBackendObservationSnapshot
  subscribe(listener: () => void): () => void
  setWorkspaces(workspaces: readonly AppDaemonWorkspaceBinding[]): void
  refresh(workspaceIds?: readonly string[]): Promise<void>
  dispose(): void
}

interface RunningBackendObservationDependencies {
  probe: (apiBaseUrl: string) => Promise<HostedBackendProbeResult>
  projectionTransportFactory: CliProjectionTransportFactory
  now: () => number
}

interface RuntimeTransport {
  readonly epoch: number
  readonly transport: CliProjectionTransport
}

function sameRegistration(
  left: AppDaemonWorkspaceBinding,
  right: AppDaemonWorkspaceBinding
): boolean {
  return (
    left.id === right.id &&
    left.backendUrl === right.backendUrl &&
    left.registeredAt === right.registeredAt
  )
}

function resolveState(
  reachability: HostedTabReachability,
  websocket: RunningBackendObservation['websocket']
): RunningBackendObservationState {
  if (reachability === 'authentication-required') return 'authentication-required'
  if (reachability === 'unsupported') return 'unsupported'
  if (reachability === 'offline') return 'offline'
  if (reachability !== 'online') return 'checking'
  if (websocket === 'connected') return 'running'
  return websocket === 'disconnected' ? 'realtime-unavailable' : 'checking'
}

/** Create the App-lifetime observer that verifies daemon registrations through HTTP and WebSocket. */
export function createRunningBackendObservationOwner(
  overrides: Partial<RunningBackendObservationDependencies> = {}
): RunningBackendObservationOwner {
  const dependencies: RunningBackendObservationDependencies = {
    probe: (apiBaseUrl) => probeHostedBackend(apiBaseUrl),
    projectionTransportFactory: createTRPCCliProjectionTransportFactory(),
    now: Date.now,
    ...overrides,
  }
  const listeners = new Set<() => void>()
  const registrations = new Map<string, AppDaemonWorkspaceBinding>()
  const observations = new Map<string, RunningBackendObservation>()
  const transports = new Map<string, RuntimeTransport>()
  const probeFlights = new Map<string, Promise<void>>()
  let nextEpoch = 0
  let revision = 0
  let snapshot: RunningBackendObservationSnapshot = { revision, observations: [] }
  let disposed = false

  const publish = (): void => {
    revision += 1
    snapshot = {
      revision,
      observations: [...registrations.keys()].flatMap((workspaceId) => {
        const observation = observations.get(workspaceId)
        return observation ? [observation] : []
      }),
    }
    listeners.forEach((listener) => listener())
  }

  const update = (
    workspaceId: string,
    epoch: number,
    project: (current: RunningBackendObservation) => RunningBackendObservation
  ): boolean => {
    if (disposed || transports.get(workspaceId)?.epoch !== epoch) return false
    const current = observations.get(workspaceId)
    if (!current) return false
    observations.set(workspaceId, project(current))
    publish()
    return true
  }

  const observeHealth = (workspaceId: string): Promise<void> => {
    const existing = probeFlights.get(workspaceId)
    if (existing) return existing
    const registration = registrations.get(workspaceId)
    const runtime = transports.get(workspaceId)
    if (!registration || !runtime) return Promise.resolve()
    const { epoch } = runtime
    const promise = dependencies.probe(registration.backendUrl).then((result) => {
      update(workspaceId, epoch, (current) => ({
        ...current,
        healthReachability: result.reachability,
        state: resolveState(result.reachability, current.websocket),
        error: result.errorMessage,
        observedAt: dependencies.now(),
      }))
    })
    probeFlights.set(workspaceId, promise)
    void promise.finally(() => {
      if (probeFlights.get(workspaceId) === promise) probeFlights.delete(workspaceId)
    })
    return promise
  }

  const retire = (workspaceId: string): void => {
    registrations.delete(workspaceId)
    observations.delete(workspaceId)
    probeFlights.delete(workspaceId)
    const runtime = transports.get(workspaceId)
    transports.delete(workspaceId)
    runtime?.transport.unsubscribe()
  }

  const connect = (registration: AppDaemonWorkspaceBinding): void => {
    const epoch = ++nextEpoch
    registrations.set(registration.id, registration)
    observations.set(registration.id, {
      workspaceId: registration.id,
      backendUrl: registration.backendUrl,
      registeredAt: registration.registeredAt,
      state: 'checking',
      healthReachability: 'checking',
      websocket: 'connecting',
      error: null,
      observedAt: dependencies.now(),
    })
    // Install the epoch before connect because a test or transport may synchronously publish state.
    transports.set(registration.id, {
      epoch,
      transport: { unsubscribe() {} },
    })
    const markConnected = (): void => {
      const changed = update(registration.id, epoch, (current) => ({
        ...current,
        websocket: 'connected',
        state: resolveState(current.healthReachability, 'connected'),
        error: current.healthReachability === 'online' ? null : current.error,
        observedAt: dependencies.now(),
      }))
      if (changed) void observeHealth(registration.id)
    }
    const markDisconnected = (error: string): void => {
      update(registration.id, epoch, (current) => ({
        ...current,
        websocket: 'disconnected',
        state: resolveState(current.healthReachability, 'disconnected'),
        error,
        observedAt: dependencies.now(),
      }))
    }
    const markConnecting = (): void => {
      update(registration.id, epoch, (current) => {
        const websocket = current.websocket === 'connected' ? 'disconnected' : 'connecting'
        return {
          ...current,
          websocket,
          state: resolveState(current.healthReachability, websocket),
          error:
            websocket === 'disconnected' ? 'Realtime subscription reconnecting.' : current.error,
          observedAt: dependencies.now(),
        }
      })
    }
    const transport = dependencies.projectionTransportFactory.connect(
      registration.backendUrl,
      { kind: 'root-context' },
      {
        onNotice: markConnected,
        onConnectionState(state) {
          if (state === 'pending') {
            markConnected()
          } else {
            markConnecting()
          }
        },
        onError(error) {
          markDisconnected(error instanceof Error ? error.message : String(error))
        },
        onStopped() {
          markDisconnected('Realtime subscription stopped.')
        },
        onComplete() {
          markDisconnected('Realtime subscription completed.')
        },
      }
    )
    transports.set(registration.id, { epoch, transport })
    publish()
    void observeHealth(registration.id)
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    setWorkspaces(workspaces) {
      if (disposed) return
      const nextIds = new Set(workspaces.map((workspace) => workspace.id))
      for (const workspaceId of registrations.keys()) {
        if (!nextIds.has(workspaceId)) retire(workspaceId)
      }
      for (const workspace of workspaces) {
        const current = registrations.get(workspace.id)
        if (current && sameRegistration(current, workspace)) continue
        if (current) retire(workspace.id)
        connect(workspace)
      }
      publish()
    },
    async refresh(workspaceIds) {
      const selected = workspaceIds ?? [...registrations.keys()]
      await Promise.all(selected.map((workspaceId) => observeHealth(workspaceId)))
    },
    dispose() {
      if (disposed) return
      disposed = true
      for (const workspaceId of registrations.keys()) retire(workspaceId)
      listeners.clear()
    },
  }
}
