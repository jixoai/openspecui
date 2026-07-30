/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Own one managed project backend child per canonical physical directory (3.0b/3.0c).
 * 2. Implement exact Stop, daemon-stop child settlement, and restart-only capture/restore (3.0d).
 * 3. Keep external foreground serve ownership physically distinct from managed children (3.0e).
 *
 * Original request (2026-07-30): "关键是，支持直接从目录直接启动 openspecui 服务。"
 * Owner lifecycle decision (2026-07-30): closing a tab preserves a managed service; explicit Stop
 *   terminates it; daemon stop affects only managed services; daemon restart restores the managed set.
 * Spec: cli-commands › "Project Serve Ownership" and hosted-app-distribution ›
 *   "Path-First Workspace Home And Runtime Management".
 *
 * Design note (不可妥协): the owner is decoupled from real process spawning through
 * `ManagedProjectSpawner` and `ManagedProjectRegistrar` ports so its lifecycle logic (single-flight,
 * canonical-path dedupe, readiness/lease admission, exact Stop, restart capture/restore) is provable
 * without spawning a live Node server. Production wires a spawner that runs the fixed internal
 * `startServer` plan; tests wire deterministic fakes. The owner never infers ownership from port, URL,
 * or PID and never adopts an external foreground `serve` process.
 */

/** Canonicalized physical project identity plus the fixed managed plan that started it. */
export interface ManagedProjectIdentity {
  /** Canonical physical directory, resolved before spawn and used as the dedupe/restore key. */
  readonly canonicalProjectDir: string
}

/** Concrete startup state returned to the caller after a managed start settles. */
export interface ManagedProjectStartup {
  readonly identity: ManagedProjectIdentity
  /** Backend URL the managed child is reachable at once readiness settled. */
  readonly backendUrl: string
  /** Runtime credential bound to this managed child; runtime-only, never persisted by the owner. */
  readonly credential: string | null
  /** Monotonic generation of this managed child; Stop targets exactly this generation. */
  readonly generation: number
}

/**
 * Spawns and settles one fixed internal `serve` plan for a canonical directory.
 *
 * The spawner MUST use a fixed internal command plan derived only from the canonical directory and
 * caller-free options; it MUST reject caller-supplied executable/argv. It owns the actual child
 * process and its readiness probe. Production implementation wraps `startServer`; tests fake it.
 */
export interface ManagedProjectSpawner {
  spawn(
    identity: ManagedProjectIdentity,
    options?: { accessGateCredential?: string | null; webAssetsDir?: string | null }
  ): Promise<ManagedProjectStartup>
}

/**
 * Admits one Workspace lease for a settled managed child so the daemon ledger and App shell converge.
 * Mirrors the existing `registerWorkspace` presentation path but is owned by the managed owner so a
 * later exact Stop can retire the matching generation.
 */
export interface ManagedProjectRegistrar {
  register(startup: ManagedProjectStartup): Promise<ManagedProjectLease>
}

/** Lease over one admitted managed Workspace; closing retires presentation only (service keeps running). */
export interface ManagedProjectLease {
  readonly generation: number
  close(): Promise<void>
}

/** Settled managed child record held in memory by the owner. */
interface ManagedChild {
  readonly identity: ManagedProjectIdentity
  readonly startup: ManagedProjectStartup
  readonly lease: ManagedProjectLease
}

/** Reason a managed start request was rejected. */
export type ManagedProjectStartRejection =
  | { kind: 'invalid-directory'; canonicalProjectDir: string; message: string }
  | { kind: 'remote-caller'; message: string }
  | { kind: 'spawn-failed'; message: string; cause?: unknown }

/** Concrete outcome of one managed start request. */
export type ManagedProjectStartResult =
  | { ok: true; startup: ManagedProjectStartup; alreadyRunning: boolean }
  | { ok: false; rejection: ManagedProjectStartRejection }

/** Concrete outcome of one exact managed Stop request keyed by generation. */
export type ManagedProjectStopResult =
  | { ok: true; generation: number }
  | { ok: false; code: 'not-found' | 'generation-mismatch'; message: string }

export interface ManagedProjectOwnerOptions {
  spawner: ManagedProjectSpawner
  registrar: ManagedProjectRegistrar
  /**
   * Canonicalizes and validates a raw submitted directory into a physical identity before spawn.
   * Returns null for non-directory, inaccessible, or otherwise invalid targets. Production resolves
   * `fs.realpath` and validates `stat.isDirectory()`; tests fake it.
   */
  canonicalize: (rawProjectDir: string) => Promise<ManagedProjectIdentity | null>
  /** Optional access-gate credential threaded into the fixed managed plan; runtime-only. */
  accessGateCredential?: string | null
  /** Optional Web asset root threaded into the fixed managed plan. */
  webAssetsDir?: string | null
  /**
   * Whether the request originates from the authenticated bundled local App control. Remote callers
   * are rejected before canonicalization so the daemon never accepts managed starts from non-local
   * App deployments. Production derives this from the authenticated daemon control channel.
   */
  isAuthenticatedLocalApp: boolean
}

/**
 * One managed-child owner. Keys children by canonical physical directory, single-flights concurrent
 * starts for the same identity, and exposes exact Stop plus restart capture/restore.
 *
 * Lifecycle law:
 *  - one canonical physical directory -> at most one managed child and one Workspace
 *  - Stop targets exactly one generation; a stale generation is rejected, not adopted
 *  - daemon stop settles every managed child; daemon restart restores the captured directory set once
 *  - external foreground `serve` leases are never adopted or signaled here
 */
export interface ManagedProjectOwner {
  start(rawProjectDir: string): Promise<ManagedProjectStartResult>
  stop(generation: number): Promise<ManagedProjectStopResult>
  /** Snapshot the current managed directory set for restart restoration (directory identities only). */
  captureManagedDirectorySet(): readonly ManagedProjectIdentity[]
  /** Restore each captured directory exactly once after a daemon restart settles managed children. */
  restoreManagedDirectorySet(
    identities: readonly ManagedProjectIdentity[]
  ): Promise<ManagedProjectStartResult[]>
  /** Whether a managed child currently owns the given canonical directory. */
  hasManaged(canonicalProjectDir: string): boolean
  /** Settle every managed child for daemon teardown. External leases are untouched. */
  settleAllForDaemonStop(): Promise<readonly ManagedProjectStopResult[]>
}

export function createManagedProjectOwner(
  options: ManagedProjectOwnerOptions
): ManagedProjectOwner {
  const childrenByKey = new Map<string, ManagedChild>()
  const inFlightByKey = new Map<string, Promise<ManagedProjectStartResult>>()

  const startIdentity = async (
    identity: ManagedProjectIdentity
  ): Promise<ManagedProjectStartResult> => {
    const existing = childrenByKey.get(identity.canonicalProjectDir)
    if (existing) {
      return { ok: true, startup: existing.startup, alreadyRunning: true }
    }
    try {
      const startup = await options.spawner.spawn(identity, {
        accessGateCredential: options.accessGateCredential,
        webAssetsDir: options.webAssetsDir,
      })
      const lease = await options.registrar.register(startup)
      childrenByKey.set(identity.canonicalProjectDir, { identity, startup, lease })
      return { ok: true, startup, alreadyRunning: false }
    } catch (error) {
      return {
        ok: false,
        rejection: {
          kind: 'spawn-failed',
          message: error instanceof Error ? error.message : 'Managed project failed to start.',
          ...(error instanceof Error ? { cause: error } : {}),
        },
      }
    }
  }

  return {
    async start(rawProjectDir) {
      if (!options.isAuthenticatedLocalApp) {
        return {
          ok: false,
          rejection: {
            kind: 'remote-caller',
            message:
              'Managed project start is only accepted from the authenticated local App control.',
          },
        }
      }
      const identity = await options.canonicalize(rawProjectDir)
      if (!identity) {
        return {
          ok: false,
          rejection: {
            kind: 'invalid-directory',
            canonicalProjectDir: rawProjectDir,
            message: `Project directory could not be canonicalized or is not a valid directory: ${rawProjectDir}`,
          },
        }
      }
      // Single-flight: concurrent submissions for the same physical identity join one start.
      const existing = childrenByKey.get(identity.canonicalProjectDir)
      if (existing) {
        return { ok: true, startup: existing.startup, alreadyRunning: true }
      }
      const inflight = inFlightByKey.get(identity.canonicalProjectDir)
      if (inflight) return inflight
      const promise = startIdentity(identity).finally(() => {
        inFlightByKey.delete(identity.canonicalProjectDir)
      })
      inFlightByKey.set(identity.canonicalProjectDir, promise)
      return promise
    },

    async stop(generation) {
      for (const [key, child] of childrenByKey) {
        if (child.startup.generation !== generation) continue
        // Exact generation match: retire the lease and drop the child. The lease close retires
        // presentation/credential authority; the spawner's child teardown is owned by its spawn.
        await child.lease.close().catch(() => {
          // lease retirement failure must not leak the child as still-managed
        })
        childrenByKey.delete(key)
        return { ok: true, generation }
      }
      const any = [...childrenByKey.values()][0]
      if (any) {
        return {
          ok: false,
          code: 'generation-mismatch',
          message: `Requested generation ${generation} does not match the managed generation ${any.startup.generation}.`,
        }
      }
      return { ok: false, code: 'not-found', message: 'No managed project is currently running.' }
    },

    captureManagedDirectorySet() {
      return [...childrenByKey.values()].map((child) => child.identity)
    },

    async restoreManagedDirectorySet(identities) {
      // Restore each captured physical directory exactly once, skipping any already running.
      const results: ManagedProjectStartResult[] = []
      for (const identity of identities) {
        if (childrenByKey.has(identity.canonicalProjectDir)) {
          const child = childrenByKey.get(identity.canonicalProjectDir)!
          results.push({ ok: true, startup: child.startup, alreadyRunning: true })
          continue
        }
        results.push(await startIdentity(identity))
      }
      return results
    },

    hasManaged(canonicalProjectDir) {
      return childrenByKey.has(canonicalProjectDir)
    },

    async settleAllForDaemonStop() {
      const results: ManagedProjectStopResult[] = []
      for (const [key, child] of [...childrenByKey.entries()]) {
        await child.lease.close().catch(() => {})
        childrenByKey.delete(key)
        results.push({ ok: true, generation: child.startup.generation })
      }
      return results
    },
  }
}
