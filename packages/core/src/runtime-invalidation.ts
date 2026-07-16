/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Define runtime invalidation facet identity without carrying projected domain data.
 * 2. Expose monotonic generations as ReactiveContext dependencies.
 * 3. Coalesce direct-listener pushes per facet while generations advance synchronously.
 *
 * Original request (2026-07-15): "Push 通知变更，然后让多端基于订阅拉取更新。"
 */
import { ReactiveState } from './reactive-fs/reactive-state.js'

/** Complete runtime projection facet vocabulary. */
export const RUNTIME_INVALIDATION_FACETS = [
  'project',
  'stores',
  'worksets',
  'schemas',
  'context',
] as const

/** One invalidatable runtime projection facet. */
export type RuntimeInvalidationFacet = (typeof RUNTIME_INVALIDATION_FACETS)[number]

/** Monotonic invalidation identity for one runtime facet. */
export interface RuntimeInvalidationToken {
  facet: RuntimeInvalidationFacet
  generation: number
}

/** Listener notified with invalidation identities rather than projected data. */
export type RuntimeInvalidationListener = (tokens: RuntimeInvalidationToken[]) => void

/** Read/subscribe surface for runtime invalidation identities. */
export interface RuntimeInvalidationReader {
  track(...facets: RuntimeInvalidationFacet[]): RuntimeInvalidationToken[]
  subscribe(
    facets: readonly RuntimeInvalidationFacet[],
    listener: RuntimeInvalidationListener
  ): () => void
}

/** Mutable runtime invalidation surface used by backend owners. */
export interface RuntimeInvalidationController extends RuntimeInvalidationReader {
  invalidate(facets: readonly RuntimeInvalidationFacet[]): RuntimeInvalidationToken[]
}

interface ListenerRecord {
  facets: Set<RuntimeInvalidationFacet>
  listener: RuntimeInvalidationListener
}

/** Environment-local invalidation identity. Authoritative data stays in CLI-backed projections. */
export class RuntimeInvalidationIndex implements RuntimeInvalidationController {
  private readonly generations = new Map<RuntimeInvalidationFacet, number>()
  private readonly states = new Map<RuntimeInvalidationFacet, ReactiveState<number>>()
  private readonly listeners = new Set<ListenerRecord>()
  private pendingNotifications = new Map<
    ListenerRecord,
    Map<RuntimeInvalidationFacet, RuntimeInvalidationToken>
  >()
  private notificationScheduled = false

  constructor() {
    for (const facet of RUNTIME_INVALIDATION_FACETS) {
      this.generations.set(facet, 0)
      this.states.set(facet, new ReactiveState(0))
    }
  }

  current(facet: RuntimeInvalidationFacet): number {
    return this.generations.get(facet) ?? 0
  }

  track(...facets: RuntimeInvalidationFacet[]): RuntimeInvalidationToken[] {
    return facets.map((facet) => ({
      facet,
      generation: this.states.get(facet)?.get() ?? 0,
    }))
  }

  invalidate(facets: readonly RuntimeInvalidationFacet[]): RuntimeInvalidationToken[] {
    const uniqueFacets = [...new Set(facets)]
    const tokens = uniqueFacets.map((facet) => {
      const generation = this.current(facet) + 1
      this.generations.set(facet, generation)
      this.states.get(facet)?.set(generation)
      return { facet, generation }
    })

    this.enqueueNotifications(tokens)
    return tokens
  }

  private enqueueNotifications(tokens: readonly RuntimeInvalidationToken[]): void {
    for (const record of this.listeners) {
      let pending = this.pendingNotifications.get(record)
      for (const token of tokens) {
        if (!record.facets.has(token.facet)) continue
        pending ??= new Map()
        pending.set(token.facet, token)
      }
      if (pending) this.pendingNotifications.set(record, pending)
    }
    if (this.pendingNotifications.size === 0 || this.notificationScheduled) return

    this.notificationScheduled = true
    queueMicrotask(() => this.flushNotifications())
  }

  private flushNotifications(): void {
    const notifications = this.pendingNotifications
    this.pendingNotifications = new Map()
    this.notificationScheduled = false

    for (const [record, pending] of notifications) {
      if (!this.listeners.has(record)) continue
      const tokens = RUNTIME_INVALIDATION_FACETS.flatMap((facet) => {
        const token = pending.get(facet)
        return token ? [token] : []
      })
      if (tokens.length === 0) continue
      try {
        record.listener(tokens)
      } catch (error) {
        console.error('Runtime invalidation listener failed:', error)
      }
    }
  }

  subscribe(
    facets: readonly RuntimeInvalidationFacet[],
    listener: RuntimeInvalidationListener
  ): () => void {
    const record: ListenerRecord = { facets: new Set(facets), listener }
    this.listeners.add(record)
    return () => {
      this.listeners.delete(record)
      this.pendingNotifications.delete(record)
    }
  }
}
