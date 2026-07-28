/**
 * Orthogonal intents (created 2026-07-24 Asia/Shanghai):
 * 1. Own one Server mutation-ledger projection per normalized backend locator.
 * 2. Enforce snapshot, cursor, reconnect, and callback-epoch provenance.
 * 3. Keep lifecycle evidence separate from Store inventory and mutation authority.
 *
 * Original request (2026-07-24): "apply openspec-change: close-openspec-cli16-delivery-gaps"
 */
import {
  StoreMutationLifecycleEventSchema,
  type StoreMutationEnvelope,
  type StoreMutationLifecycleEvent,
} from '@openspecui/core/store-mutation-protocol'
import type { HostedShellTab } from './shell-state'
import { normalizeHostedApiBaseUrl } from './shell-state'

export type MutationObservationLifecycle =
  | 'connecting'
  | 'pending'
  | 'current'
  | 'reconnecting'
  | 'error'
  | 'stopped'
  | 'complete'
  | 'contract-error'

/** Public operation-ledger projection for one normalized backend locator. */
export interface MutationLocatorProjection {
  apiBaseUrl: string
  ownerEpoch: number
  lifecycle: MutationObservationLifecycle
  current: boolean
  cursor: number | null
  records: readonly StoreMutationEnvelope[]
  error: string | null
  observedAt: number
}

export interface MutationObservationSnapshot {
  revision: number
  projections: readonly MutationLocatorProjection[]
}

export interface MutationLifecycleCallbacks {
  onData(value: unknown): void
  onConnectionState(state: 'connecting' | 'pending'): void
  onError(error: unknown): void
  onStopped(): void
  onComplete(): void
}

export interface MutationLifecycleTransport {
  unsubscribe(): void
}

export interface MutationObservationTransportFactory {
  connect(apiBaseUrl: string, callbacks: MutationLifecycleCallbacks): MutationLifecycleTransport
}

interface OwnedLocator {
  epoch: number
  projection: MutationLocatorProjection
  transport: MutationLifecycleTransport | null
  hasSnapshot: boolean
}

/** Framework-neutral locator owner. HTTP admission results never enter this projection. */
export function createMutationObservationOwner(
  transportFactory: MutationObservationTransportFactory,
  now: () => number = Date.now
) {
  const listeners = new Set<() => void>()
  const locators = new Map<string, OwnedLocator>()
  let nextEpoch = 0
  let snapshot: MutationObservationSnapshot = { revision: 0, projections: [] }

  const getOwned = (apiBaseUrl: string, epoch: number): OwnedLocator | null => {
    const owned = locators.get(apiBaseUrl)
    return owned?.epoch === epoch ? owned : null
  }

  const publish = () => {
    snapshot = {
      revision: snapshot.revision + 1,
      projections: [...locators.values()].map(({ projection }) => projection),
    }
    for (const listener of listeners) listener()
  }

  const update = (
    apiBaseUrl: string,
    epoch: number,
    transform: (owned: OwnedLocator) => MutationLocatorProjection
  ) => {
    const owned = getOwned(apiBaseUrl, epoch)
    if (!owned) return
    owned.projection = transform(owned)
    publish()
  }

  const failContract = (apiBaseUrl: string, epoch: number, message: string) => {
    update(apiBaseUrl, epoch, (owned) => ({
      ...owned.projection,
      lifecycle: 'contract-error',
      current: false,
      error: message,
      observedAt: now(),
    }))
  }

  const acceptEvent = (apiBaseUrl: string, epoch: number, raw: unknown) => {
    const parsed = StoreMutationLifecycleEventSchema.safeParse(raw)
    if (!parsed.success) {
      failContract(apiBaseUrl, epoch, `Malformed mutation lifecycle event: ${parsed.error.message}`)
      return
    }
    const event: StoreMutationLifecycleEvent = parsed.data
    const owned = getOwned(apiBaseUrl, epoch)
    if (!owned) return
    if (event.type === 'snapshot') {
      owned.hasSnapshot = true
      update(apiBaseUrl, epoch, (current) => ({
        ...current.projection,
        lifecycle: 'current',
        current: true,
        cursor: event.cursor,
        records: event.records,
        error: null,
        observedAt: now(),
      }))
      return
    }
    if (!owned.hasSnapshot) {
      failContract(apiBaseUrl, epoch, 'Mutation lifecycle changed before the current snapshot.')
      return
    }
    const cursor = owned.projection.cursor
    if (cursor === null || event.cursor <= cursor) {
      failContract(apiBaseUrl, epoch, 'Mutation lifecycle cursor did not advance.')
      return
    }
    let replaced = false
    const records = owned.projection.records.map((record) => {
      if (record.requestId !== event.record.requestId) return record
      replaced = true
      return event.record
    })
    if (!replaced) records.push(event.record)
    update(apiBaseUrl, epoch, (current) => ({
      ...current.projection,
      lifecycle: 'current',
      current: true,
      cursor: event.cursor,
      records,
      error: null,
      observedAt: now(),
    }))
  }

  const connect = (apiBaseUrl: string, retained?: MutationLocatorProjection) => {
    const epoch = ++nextEpoch
    const projection: MutationLocatorProjection = retained
      ? {
          ...retained,
          ownerEpoch: epoch,
          lifecycle: 'reconnecting',
          current: false,
          error: null,
          observedAt: now(),
        }
      : {
          apiBaseUrl,
          ownerEpoch: epoch,
          lifecycle: 'connecting',
          current: false,
          cursor: null,
          records: [],
          error: null,
          observedAt: now(),
        }
    const markWaiting = (lifecycle: 'connecting' | 'pending') => {
      const owned = getOwned(apiBaseUrl, epoch)
      if (!owned) return
      owned.hasSnapshot = false
      update(apiBaseUrl, epoch, (current) => ({
        ...current.projection,
        lifecycle: current.projection.cursor === null ? lifecycle : 'reconnecting',
        current: false,
        error: null,
        observedAt: now(),
      }))
    }
    const markTerminal = (
      lifecycle: Extract<MutationObservationLifecycle, 'error' | 'stopped' | 'complete'>,
      error?: unknown
    ) => {
      const owned = getOwned(apiBaseUrl, epoch)
      if (!owned) return
      owned.hasSnapshot = false
      update(apiBaseUrl, epoch, (current) => ({
        ...current.projection,
        lifecycle,
        current: false,
        ...(error === undefined
          ? {}
          : { error: error instanceof Error ? error.message : String(error) }),
        observedAt: now(),
      }))
    }
    const callbacks: MutationLifecycleCallbacks = {
      onData: (event) => acceptEvent(apiBaseUrl, epoch, event),
      onConnectionState: markWaiting,
      onError: (error) => markTerminal('error', error),
      onStopped: () => markTerminal('stopped'),
      onComplete: () => markTerminal('complete'),
    }
    const owned: OwnedLocator = {
      epoch,
      projection,
      transport: null,
      hasSnapshot: false,
    }
    // The owner must exist before connect: a real or fixture transport may synchronously publish its
    // initial connection state or snapshot before returning its unsubscribe handle.
    locators.set(apiBaseUrl, owned)
    try {
      const transport = transportFactory.connect(apiBaseUrl, callbacks)
      if (getOwned(apiBaseUrl, epoch) === owned) {
        owned.transport = transport
      } else {
        transport.unsubscribe()
      }
    } catch (error) {
      markTerminal('error', error)
    }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    setTabs(tabs: readonly HostedShellTab[]) {
      const requested = tabs.flatMap((tab) => {
        const normalized = normalizeHostedApiBaseUrl(tab.apiBaseUrl)
        return normalized ? [normalized] : []
      })
      const requestedSet = new Set(requested)
      let changed = false
      for (const [apiBaseUrl, owned] of locators) {
        if (requestedSet.has(apiBaseUrl)) continue
        locators.delete(apiBaseUrl)
        owned.transport?.unsubscribe()
        changed = true
      }
      for (const apiBaseUrl of requested) {
        if (locators.has(apiBaseUrl)) continue
        connect(apiBaseUrl)
        changed = true
      }
      if (changed) publish()
    },
    reconnect(apiBaseUrl: string) {
      const normalized = normalizeHostedApiBaseUrl(apiBaseUrl)
      if (!normalized) return
      const owned = locators.get(normalized)
      if (!owned) return
      locators.delete(normalized)
      owned.transport?.unsubscribe()
      connect(normalized, owned.projection)
      publish()
    },
    dispose() {
      const retired = [...locators.values()]
      locators.clear()
      for (const owned of retired) owned.transport?.unsubscribe()
      publish()
    },
  }
}

export type MutationObservationOwner = ReturnType<typeof createMutationObservationOwner>
