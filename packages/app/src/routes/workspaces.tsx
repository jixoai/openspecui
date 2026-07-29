/**
 * Orthogonal intents (updated 2026-07-30 Asia/Shanghai):
 * 1. Mark the persistent multi-project Workspace route without acquiring iframe ownership.
 *
 * Original request (2026-07-29): "App 中 Workspaces 替代现有的 Sessions。"
 */

/** Workspaces is a route marker; persistent iframe ownership belongs to AppLayout. */
export function WorkspacesRoute() {
  return null
}
