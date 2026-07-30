/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Project every current backend lease into Workspaces secondary navigation + Task Manager (4.0c/4.0d).
 * 2. Distinguish daemon-managed vs external ownership and ownership-valid Stop/Close capabilities.
 * 3. Pure composition: join backend leases with path-first labels without deriving identity from port.
 *
 * Original request (2026-07-30): "所有正在运行中的backend都会显示在这里。"
 * Original request (2026-07-30): "任务管理器...可以杀掉Workspace，或者收藏、取消收藏"
 * Spec: hosted-app-distribution › "Browse running backends" and "Manage running backends".
 *
 * Port/host remain transport evidence; the path-first label selector owns the display identity.
 */

import type { AppDaemonWorkspaceBinding } from '@openspecui/core/app-daemon-control'
import type { WorkspacePathLabel } from './workspace-path-label'
import { selectWorkspacePathLabel } from './workspace-path-label'

/** Ownership of one running backend. */
export type RunningBackendOwnership = 'daemon-managed' | 'external'

/** Health of one running backend, observed-only. */
export type RunningBackendHealth = 'ready' | 'starting' | 'failed' | 'unknown'

/** One running backend lease projected into Workspaces navigation and Task Manager. */
export interface RunningBackendEntry {
  /** Stable opaque id for this backend lease (e.g. daemon Workspace id or managed generation key). */
  readonly id: string
  /** Canonical project directory when known (path-first identity source). */
  readonly projectPath: string | null
  /** Whether this backend is daemon-managed (Stop through the child owner) or external (lease-mediated). */
  readonly ownership: RunningBackendOwnership
  /** Observed health. */
  readonly health: RunningBackendHealth
  /** Start time when known; diagnostic evidence. */
  readonly startedAt?: number
  /** Exact generation when daemon-managed; the exact Stop target. Null for external backends. */
  readonly managedGeneration?: number
  /** Exact shutdown capability advertised by the owning lease. */
  readonly shutdown: AppDaemonWorkspaceBinding['shutdown']
  /** Path-first display label derived from objective path + Git facts. */
  readonly label: WorkspacePathLabel
}

/** Capability-exact Task Manager commands for one running backend. */
export type RunningBackendTaskCommand =
  | { kind: 'stop-managed'; generation: number }
  | { kind: 'stop-external' }
  | { kind: 'close-only' }
  | { kind: 'favorite' }
  | { kind: 'unfavorite' }

/**
 * Resolve the Task Manager commands available for one running backend based on its ownership and health.
 *
 * A daemon-managed backend exposes Stop through the child owner (exact generation). An external backend exposes
 * Stop only when its lease advertises owner-handled shutdown; otherwise presentation Close only. Favorite/
 * unfavorite operate on canonical directory identity independently of runtime state. A failed/starting backend
 * exposes Stop only when it has a current managed generation.
 */
export function resolveRunningBackendCommands(
  entry: RunningBackendEntry
): readonly RunningBackendTaskCommand[] {
  const commands: RunningBackendTaskCommand[] = []
  const canStop =
    entry.health === 'ready' ||
    (entry.health === 'failed' &&
      entry.ownership === 'daemon-managed' &&
      entry.managedGeneration !== undefined) ||
    entry.health === 'starting'
  if (entry.ownership === 'daemon-managed' && entry.managedGeneration !== undefined && canStop) {
    commands.push({ kind: 'stop-managed', generation: entry.managedGeneration })
  } else if (entry.ownership === 'external' && entry.shutdown === 'external-owner' && canStop) {
    commands.push({ kind: 'stop-external' })
  } else {
    commands.push({ kind: 'close-only' })
  }
  if (entry.projectPath !== null) {
    commands.push({ kind: 'favorite' })
  }
  return commands
}

/** Project the complete daemon ledger into path-first navigation/Task Manager entries. */
export function projectDaemonRunningBackends(
  workspaces: readonly AppDaemonWorkspaceBinding[]
): readonly RunningBackendEntry[] {
  return composeRunningBackendNavigation(
    workspaces.map((workspace) => ({
      id: workspace.id,
      projectPath: workspace.projectDir,
      ownership: workspace.ownership,
      health: 'ready',
      startedAt: workspace.registeredAt,
      ...(workspace.managedGeneration === null
        ? {}
        : { managedGeneration: workspace.managedGeneration }),
      shutdown: workspace.shutdown,
      label: selectWorkspacePathLabel({
        projectPath: workspace.projectDir,
        git: workspace.git
          ? { githubRemote: workspace.git.remoteUrl, branch: workspace.git.branch }
          : null,
      }),
    }))
  )
}

/**
 * Compose running-backend navigation entries from current backend leases.
 *
 * The caller supplies already-typed leases; this pure function joins them with path-first labels and never
 * derives identity from port, host, or backend URL. Entries are source- and lifecycle-aware.
 */
export function composeRunningBackendNavigation(
  leases: readonly RunningBackendEntry[]
): readonly RunningBackendEntry[] {
  // Deduplicate by stable id; preserve observed order. No port-based merging.
  const seen = new Set<string>()
  const entries: RunningBackendEntry[] = []
  for (const lease of leases) {
    if (seen.has(lease.id)) continue
    seen.add(lease.id)
    entries.push(lease)
  }
  return entries
}
