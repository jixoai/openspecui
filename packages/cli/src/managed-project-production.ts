/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Spawn one fixed internal `serve` plan for a canonical directory (3.0c production spawner).
 * 2. Canonicalize and validate a submitted directory before spawn (3.0b production canonicalizer).
 * 3. Adapt the owner to the daemon IPC managed-project control surface (3.0c/3.0d control adapter).
 *
 * Original request (2026-07-30): "关键是，支持直接从目录直接启动 openspecui 服务。"
 *
 * Production wiring only. The owner lifecycle logic itself (dedupe, single-flight, exact Stop,
 * restart restore) is unit-proven in `managed-project-owner.test.ts` through fakes; this module
 * supplies the real `startServer` plan, `fs.realpath` canonicalization, and Workspace-lease
 * registration so the daemon can supervise managed children without spawning a parallel domain.
 *
 * The fixed plan carries NO caller-supplied executable or argv: only the canonical project
 * directory, optional Access Gate credential, and the fixed Web asset root. `open` is always false.
 */
import { realpath, stat } from 'node:fs/promises'
import type { DaemonManagedProjectControl } from './daemon-server.js'
import type {
  ManagedProjectIdentity,
  ManagedProjectLease,
  ManagedProjectOwner,
  ManagedProjectRegistrar,
  ManagedProjectSpawner,
  ManagedProjectStartup,
} from './managed-project-owner.js'

/** Production canonicalizer: resolve the physical path and require it to be a directory. */
export async function canonicalizeProjectDirectory(
  rawProjectDir: string
): Promise<ManagedProjectIdentity | null> {
  try {
    const canonicalProjectDir = await realpath(rawProjectDir)
    const info = await stat(canonicalProjectDir)
    if (!info.isDirectory()) return null
    return { canonicalProjectDir }
  } catch {
    return null
  }
}

/** Dependencies the production spawner needs to run the fixed `serve` plan. */
export interface ProductionManagedSpawnerOptions {
  /**
   * Start one project Server using the fixed internal plan. Production injects a wrapper over the
   * CLI `startServer` that returns the reachable URL, its teardown, and any runtime Access Gate
   * credential the fixed plan produced. The plan derives ONLY from projectDir +
   * accessGateCredential + webAssetsDir; no caller argv.
   */
  startServer: (options: {
    projectDir: string
    accessGateCredential?: string | null
    webAssetsDir?: string | null
  }) => Promise<{ url: string; credential: string | null; close: () => Promise<void> }>
  /** Runtime Access Gate credential threaded into the managed plan; runtime-only. */
  accessGateCredential?: string | null
  /** Fixed Web asset root threaded into the managed plan. */
  webAssetsDir?: string | null
  /**
   * Monotonic generation source. Production derives this from a process-stable counter so each
   * spawned managed child carries a unique exact Stop target.
   */
  nextGeneration: () => number
}

/** Build the production spawner that runs the fixed internal `serve` plan per canonical directory. */
export function createProductionManagedSpawner(options: ProductionManagedSpawnerOptions): {
  spawner: ManagedProjectSpawner
} {
  const children = new Map<string, { close: () => Promise<void> }>()
  const spawner: ManagedProjectSpawner = {
    async spawn(identity: ManagedProjectIdentity): Promise<ManagedProjectStartup> {
      // Fixed plan: no caller argv, no caller port, no caller open. `open` is always false.
      const running = await options.startServer({
        projectDir: identity.canonicalProjectDir,
        accessGateCredential: options.accessGateCredential,
        webAssetsDir: options.webAssetsDir,
      })
      children.set(identity.canonicalProjectDir, { close: running.close })
      return {
        identity,
        backendUrl: running.url,
        credential: running.credential,
        generation: options.nextGeneration(),
      }
    },
    async settle(startup) {
      const key = startup.identity.canonicalProjectDir
      const child = children.get(key)
      if (!child) return
      children.delete(key)
      await child.close()
    },
  }
  return { spawner }
}

/**
 * Adapt the owner into the daemon IPC managed-project control surface. The adapter maps owner
 * rejection/stop codes to their daemon wire error codes. External foreground `serve` leases remain
 * physically distinct and are never routed through this adapter.
 */
export type DaemonManagedProjectControlLike = DaemonManagedProjectControl

/** Build the daemon managed-project control from a managed owner. */
export function adaptOwnerToManagedControl(
  owner: ManagedProjectOwner
): DaemonManagedProjectControlLike {
  return {
    async start(rawProjectDir) {
      const result = await owner.start(rawProjectDir)
      if (result.ok) {
        return {
          ok: true,
          startup: {
            canonicalProjectDir: result.startup.identity.canonicalProjectDir,
            backendUrl: result.startup.backendUrl,
            credential: result.startup.credential,
            generation: result.startup.generation,
          },
          alreadyRunning: result.alreadyRunning,
        }
      }
      const code =
        result.rejection.kind === 'invalid-directory'
          ? 'MANAGED_PROJECT_INVALID_DIRECTORY'
          : result.rejection.kind === 'remote-caller'
            ? 'MANAGED_PROJECT_REMOTE_CALLER'
            : 'MANAGED_PROJECT_SPAWN_FAILED'
      return { ok: false, code, message: result.rejection.message }
    },
    async stop(generation) {
      const result = await owner.stop(generation)
      if (result.ok) return { ok: true, generation: result.generation }
      // Both not-found and generation-mismatch surface as the generation-mismatch wire code; the
      // message distinguishes them. There is no separate not-found wire code for managed Stop.
      return { ok: false, code: 'MANAGED_PROJECT_GENERATION_MISMATCH', message: result.message }
    },
    async settleAllForDaemonStop() {
      await owner.settleAllForDaemonStop()
    },
    captureManagedDirectorySet() {
      return owner.captureManagedDirectorySet().map((identity) => identity.canonicalProjectDir)
    },
  }
}

/**
 * Build a registrar that admits a Workspace lease for a settled managed startup. Production injects
 * the daemon controller's `registerWorkspace`; the lease close retires presentation only.
 */
export function createManagedRegistrar(
  registerWorkspace: (startup: ManagedProjectStartup) => Promise<{ close(): Promise<void> }>
): ManagedProjectRegistrar {
  return {
    async register(startup: ManagedProjectStartup): Promise<ManagedProjectLease> {
      const lease = await registerWorkspace(startup)
      return {
        generation: startup.generation,
        close: () => lease.close(),
      }
    },
  }
}
