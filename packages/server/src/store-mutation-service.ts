/**
 * Orthogonal intents (updated 2026-07-24 Asia/Shanghai):
 * 1. Own backend Store mutation lifecycle: accepted -> running -> succeeded | failed | indeterminate.
 * 2. Deduplicate mutation starts within one backend process by client request id.
 * 3. Preserve terminal CLI evidence; publish invalidation before one terminal record.
 *
 * Original request (2026-07-15): "Store 变更是 backend-owned 操作，生命周期：accepted -> running -> succeeded | failed。"
 * Section 8.7/8.8: mutation lifecycle + request-id deduplication.
 * Original request (2026-07-24): "apply openspec-change: close-openspec-cli16-delivery-gaps"
 *
 * Invariants (AGENTS.md):
 *  - Client disconnect only detaches observation; it does not kill the CLI.
 *  - V1 exposes no Cancel and performs no automatic retry.
 *  - A client request id deduplicates starts within one backend process.
 *  - Final results preserve CLI JSON, diagnostics, stdout/stderr, and exit status.
 *  - Each terminal or indeterminate outcome invalidates affected projections before they are pulled again.
 */
import {
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

/** One admitted operation's mutable Server-local ownership state. */
interface ActiveStoreMutation {
  phase: 'accepted' | 'running' | 'settled'
}

/** Internal Server ledger event; Router runtime-decoding owns the browser protocol boundary. */
interface StoreMutationChangedEvent {
  type: 'changed'
  cursor: number
  record: StoreMutation
}

/** Server-local lifecycle snapshot plus the listener release function. */
export interface StoreMutationSubscription {
  snapshot: {
    type: 'snapshot'
    cursor: number
    records: readonly StoreMutation[]
  }
  unsubscribe: () => void
}

/** Admission result: a newly accepted record or the current record for one request-id rejoin. */
export interface StoreMutationStartResult {
  record: StoreMutation
  rejoined: boolean
}

/**
 * Backend-owned Store mutation registry. One instance per backend process; tracks active and terminal
 * mutations by request id, deduplicates starts, and reports indeterminate loss for unrecoverable
 * terminal results.
 */
export class StoreMutationService {
  private readonly mutations = new Map<string, StoreMutation>()
  private readonly active = new Map<string, ActiveStoreMutation>()
  private readonly listeners = new Set<(event: StoreMutationChangedEvent) => void>()
  private cursor = 0
  private disposed = false

  constructor(private readonly onTerminal: () => void) {}

  /** Read-only snapshot of every known mutation (active and terminal). */
  list(): readonly StoreMutation[] {
    return [...this.mutations.values()]
  }

  /** Subscribe after receiving the current process-local snapshot. */
  subscribe(listener: (event: StoreMutationChangedEvent) => void): StoreMutationSubscription {
    const snapshot = { type: 'snapshot' as const, cursor: this.cursor, records: this.list() }
    this.listeners.add(listener)
    return {
      snapshot,
      unsubscribe: () => {
        this.listeners.delete(listener)
      },
    }
  }

  /** Retire subscribers during Server shutdown without cancelling admitted CLI work. */
  dispose(): void {
    this.disposed = true
    this.listeners.clear()
  }

  private publish(mutation: StoreMutation): void {
    const event = {
      type: 'changed' as const,
      cursor: ++this.cursor,
      record: mutation,
    }
    if (this.disposed) return
    for (const listener of this.listeners) listener(event)
  }

  private record(mutation: StoreMutation): void {
    this.mutations.set(mutation.requestId, mutation)
    this.publish(mutation)
  }

  private async settle(requestId: string, terminal: StoreMutation): Promise<StoreMutation> {
    const active = this.active.get(requestId)
    const current = this.mutations.get(requestId)
    if (
      !active ||
      active.phase === 'settled' ||
      !current ||
      isTerminalMutationStatus(current.status)
    ) {
      return current ?? terminal
    }
    active.phase = 'settled'
    // Pull projections after invalidation; terminal lifecycle evidence is published second.
    this.onTerminal()
    // Runtime invalidation coalesces listener notifications into a microtask. Let that notification reach
    // its projection subscribers before exposing the terminal lifecycle record.
    await Promise.resolve()
    this.record(terminal)
    this.active.delete(requestId)
    return terminal
  }

  /**
   * Start (or rejoin) a mutation by request id. If a mutation with the same request id already exists,
   * the existing record is returned without starting a duplicate (deduplication). Otherwise the
   * mutation enters `accepted`, then `running`, then a terminal status with the CLI result.
   */
  start(input: StartStoreMutationInput): StoreMutationStartResult {
    const existing = this.mutations.get(input.requestId)
    if (existing) {
      return { record: existing, rejoined: true }
    }

    const accepted: StoreMutation = {
      requestId: input.requestId,
      envUri: input.envUri,
      kind: input.kind,
      status: 'accepted',
      storeId: input.storeId,
      observedAt: Date.now(),
    }
    // Ownership exists before an observer can re-enter after the first lifecycle publication.
    this.active.set(input.requestId, { phase: 'accepted' })
    this.record(accepted)
    queueMicrotask(() => {
      const active = this.active.get(input.requestId)
      if (!active || active.phase !== 'accepted') return
      active.phase = 'running'
      const running: StoreMutation = { ...accepted, status: 'running', observedAt: Date.now() }
      this.record(running)
      void (async () => {
        try {
          const result = await input.run()
          const status: StoreMutationStatus =
            result.exitStatus === 0 && result.contractError === undefined ? 'succeeded' : 'failed'
          const terminal: StoreMutation = {
            ...running,
            status,
            result,
            observedAt: Date.now(),
          }
          await this.settle(input.requestId, terminal)
        } catch (error) {
          // A thrown spawn/contract error is deterministic failed evidence. Only an explicit post-admission
          // loss transition may produce indeterminate.
          const failed: StoreMutation = {
            ...running,
            status: 'failed',
            result: {
              exitStatus: null,
              stderr: error instanceof Error ? error.message : String(error),
            },
            observedAt: Date.now(),
          }
          await this.settle(input.requestId, failed)
        }
      })()
    })
    return { record: accepted, rejoined: false }
  }

  /**
   * Mark a mutation indeterminate when its terminal result is unrecoverable (e.g. observed via a
   * reconnect after the CLI settled during disconnect). Used when the backend cannot confirm the
   * outcome rather than fabricating success/failure.
   */
  async markIndeterminate(requestId: string, reason: string): Promise<StoreMutation | null> {
    const current = this.mutations.get(requestId)
    if (!current) return null
    if (isTerminalMutationStatus(current.status)) return current
    const active = this.active.get(requestId)
    if (!active || active.phase !== 'running' || current.status !== 'running') return current
    const indeterminate: StoreMutation = {
      ...current,
      status: 'indeterminate',
      result: { exitStatus: null, stderr: reason },
      observedAt: Date.now(),
    }
    return this.settle(requestId, indeterminate)
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
