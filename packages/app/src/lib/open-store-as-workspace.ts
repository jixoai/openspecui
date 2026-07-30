/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Define the Open-as-Workspace capability contract for Store Detail (7.13).
 * 2. Resolve whether a Store can be opened as a Workspace from a real daemon/backend owner.
 *
 * Original request (2026-07-30): "Stores 完全可以融入 `Environment Center` 这个东西。"
 * Spec: hosted-app-distribution › "Deeper work requires a Workspace" — `Open as Workspace` exists only when a real
 *   daemon or backend production owner can focus or establish that Workspace through a canonical managed directory
 *   or exact current external lease.
 *
 * Until that capability exists, omit the action rather than render a disabled promise. This module is the capability
 * contract + resolver; the actual daemon/backend owner wiring lands with the hosted-shell integration (P8).
 */

/** A real production owner capable of focusing or establishing a Store Workspace. */
export interface OpenStoreAsWorkspaceCapability {
  /** Whether this owner can currently focus or establish a Workspace for the given Store root. */
  canOpen(storeRoot: string): boolean
  /** Focus or establish the Workspace; returns the Workspace id or rejects with a concrete error. */
  open(storeRoot: string): Promise<string>
}

/** The resolution result for one Store's Open-as-Workspace capability. */
export type OpenStoreAsWorkspaceResolution =
  | { kind: 'available'; capability: OpenStoreAsWorkspaceCapability }
  | { kind: 'unavailable'; reason: string }

/**
 * Resolve the Open-as-Workspace action for one Store root.
 *
 * Returns `available` only when a real production owner advertises the capability for this root. Otherwise returns
 * `unavailable` and the Store Detail MUST omit the action (not render a disabled promise).
 */
export function resolveOpenStoreAsWorkspace(
  capability: OpenStoreAsWorkspaceCapability | null | undefined,
  storeRoot: string
): OpenStoreAsWorkspaceResolution {
  if (!capability) {
    return {
      kind: 'unavailable',
      reason: 'No daemon or backend owner can establish this Store as a Workspace.',
    }
  }
  if (!capability.canOpen(storeRoot)) {
    return {
      kind: 'unavailable',
      reason: 'The current owner cannot focus or establish this Store Workspace.',
    }
  }
  return { kind: 'available', capability }
}
