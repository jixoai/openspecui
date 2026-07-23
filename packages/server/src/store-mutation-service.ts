/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Own backend Store mutation lifecycle: accepted -> running -> succeeded | failed | indeterminate.
 * 2. Deduplicate mutation starts within one backend process by client request id.
 * 3. Preserve terminal CLI evidence; report unrecoverable loss as indeterminate, never as failure.
 *
 * Original request (2026-07-15): "Store 变更是 backend-owned 操作，生命周期：accepted -> running -> succeeded | failed。"
 * Section 8.7/8.8: mutation lifecycle + request-id deduplication.
 *
 * Invariants (AGENTS.md):
 *  - Client disconnect only detaches observation; it does not kill the CLI.
 *  - V1 exposes no Cancel and performs no automatic retry.
 *  - A client request id deduplicates starts within one backend process.
 *  - Final results preserve CLI JSON, diagnostics, stdout/stderr, and exit status.
 *  - Each terminal or indeterminate outcome invalidates affected projections before they are pulled again.
 */
import {
  asEnvUri,
  isTerminalMutationStatus,
  type EnvUri,
  type StoreMutation,
  type StoreMutationKind,
  type StoreMutationResult,
  type StoreMutationStatus,
} from '@openspecui/core'

/** Input to start a backend-owned Store mutation. */
export interface StartStoreMutationInput {
  requestId: string
  envUri: EnvUri
  kind: StoreMutationKind
  storeId?: string
  /** The CLI-bearing operation; the service observes its lifecycle. */
  run: () => Promise<StoreMutationResult>
}

/**
 * Backend-owned Store mutation registry. One instance per backend process; tracks active and terminal
 * mutations by request id, deduplicates starts, and reports indeterminate loss for unrecoverable
 * terminal results.
 */
export class StoreMutationService {
  private readonly mutations = new Map<string, StoreMutation>()
  private readonly active = new Map<string, Promise<StoreMutation>>()
  private readonly listeners = new Set<(mutation: StoreMutation) => void>()

  /** Read-only snapshot of every known mutation (active and terminal). */
  list(): readonly StoreMutation[] {
    return [...this.mutations.values()]
  }

  /** Subscribe to mutation lifecycle updates. Returns an unsubscribe function. */
  subscribe(listener: (mutation: StoreMutation) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private publish(mutation: StoreMutation): void {
    for (const listener of this.listeners) listener(mutation)
  }

  private record(mutation: StoreMutation): void {
    this.mutations.set(mutation.requestId, mutation)
    this.publish(mutation)
  }

  /**
   * Start (or rejoin) a mutation by request id. If a mutation with the same request id already exists,
   * the existing record is returned without starting a duplicate (deduplication). Otherwise the
   * mutation enters `accepted`, then `running`, then a terminal status with the CLI result.
   */
  async start(input: StartStoreMutationInput): Promise<StoreMutation> {
    const existing = this.mutations.get(input.requestId)
    if (existing) {
      // Deduplicate: a terminal mutation replays its result; an active one awaits the same promise.
      if (isTerminalMutationStatus(existing.status)) return existing
      const active = this.active.get(input.requestId)
      if (active) return active
    }

    const accepted: StoreMutation = {
      requestId: input.requestId,
      envUri: input.envUri,
      kind: input.kind,
      status: 'accepted',
      storeId: input.storeId,
      observedAt: Date.now(),
    }
    this.record(accepted)

    const running: StoreMutation = { ...accepted, status: 'running', observedAt: Date.now() }
    this.record(running)

    const promise = (async (): Promise<StoreMutation> => {
      try {
        const result = await input.run()
        const status: StoreMutationStatus = result.exitStatus === 0 ? 'succeeded' : 'failed'
        const terminal: StoreMutation = {
          ...running,
          status,
          result,
          observedAt: Date.now(),
        }
        this.record(terminal)
        this.active.delete(input.requestId)
        return terminal
      } catch (error) {
        // An unrecoverable loss (e.g. the CLI process disappeared during disconnect) is indeterminate;
        // it is never fabricated as a deterministic failure or cancellation.
        const indeterminate: StoreMutation = {
          ...running,
          status: 'indeterminate',
          result: {
            exitStatus: null,
            stderr: error instanceof Error ? error.message : String(error),
          },
          observedAt: Date.now(),
        }
        this.record(indeterminate)
        this.active.delete(input.requestId)
        return indeterminate
      }
    })()

    this.active.set(input.requestId, promise)
    return promise
  }

  /**
   * Mark a mutation indeterminate when its terminal result is unrecoverable (e.g. observed via a
   * reconnect after the CLI settled during disconnect). Used when the backend cannot confirm the
   * outcome rather than fabricating success/failure.
   */
  markIndeterminate(requestId: string, reason: string): StoreMutation | null {
    const current = this.mutations.get(requestId)
    if (!current) return null
    if (isTerminalMutationStatus(current.status)) return current
    const indeterminate: StoreMutation = {
      ...current,
      status: 'indeterminate',
      result: { exitStatus: null, stderr: reason },
      observedAt: Date.now(),
    }
    this.record(indeterminate)
    this.active.delete(requestId)
    return indeterminate
  }

  /** Drop terminal mutations older than the cutoff to bound memory. Active mutations are retained. */
  pruneTerminalOlderThan(cutoffMs: number): void {
    const now = Date.now()
    for (const [id, mutation] of this.mutations) {
      if (isTerminalMutationStatus(mutation.status) && now - mutation.observedAt > cutoffMs) {
        this.mutations.delete(id)
      }
    }
  }
}

/** Construct an EnvUri-typed envUri for the mutation service from a backend-issued string. */
export function storeMutationEnvUri(envUri: string): EnvUri {
  return asEnvUri(envUri)
}
