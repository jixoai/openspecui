/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Track daemon Workspace admission/dismissal so an unchanged snapshot never reopens a closed Workspace (3.7).
 * 2. Distinguish genuinely-new daemon ids from repeated snapshots and disappeared ids.
 * 3. Keep this state credential-free and runtime-only; credential binding lives in the locator owner.
 *
 * Original request (2026-07-30): "Workspace需要记住曾经打开的目录。"
 * Implementation decision (2026-07-30): new daemon id auto-opens once; same snapshot does not reopen
 *   after explicit close; explicit Open clears dismissal; disappearance retires the runtime candidate.
 *
 * This is the pure admission/dismissal reducer. The candidate/open Workspace separation (3.3–3.6) and
 * the React owner integration live elsewhere; this module is the provable transition core.
 */

/** Opaque daemon-issued Workspace id (the snapshot `workspaces[*].id`). */
export type DaemonWorkspaceId = string

/** One admission decision produced by reducing a snapshot against prior state. */
export type DaemonAdmissionDecision =
  | { kind: 'admit'; workspaceId: DaemonWorkspaceId }
  | { kind: 'no-change'; workspaceId: DaemonWorkspaceId }
  | { kind: 'already-dismissed'; workspaceId: DaemonWorkspaceId }
  | { kind: 'retire'; workspaceId: DaemonWorkspaceId }

/** Runtime admission ledger; credential-free, never persisted. */
export interface DaemonWorkspaceAdmissionState {
  /**
   * Workspace ids the daemon currently publishes. Reducing a snapshot keeps this in sync with the
   * daemon ledger so disappearance can be detected and retired.
   */
  readonly current: readonly DaemonWorkspaceId[]
  /** Workspace ids the user explicitly closed; an unchanged snapshot must not reopen them. */
  readonly dismissed: ReadonlySet<DaemonWorkspaceId>
  /** Workspace ids already admitted at least once; a repeat snapshot never re-admits them. */
  readonly admitted: ReadonlySet<DaemonWorkspaceId>
}

export function createEmptyAdmissionState(): DaemonWorkspaceAdmissionState {
  return { current: [], dismissed: new Set(), admitted: new Set() }
}

/**
 * Reduce one daemon snapshot into admission decisions.
 *
 * Transition law:
 *  - a genuinely-new id (not previously admitted) -> `admit` (auto-open/focus once)
 *  - an already-admitted id that is not dismissed -> `no-change`
 *  - an already-admitted id that the user dismissed -> `already-dismissed` (do NOT reopen)
 *  - a previously-current id absent from the new snapshot -> `retire` (runtime candidate retires)
 */
export function reduceDaemonSnapshot(
  prev: DaemonWorkspaceAdmissionState,
  nextWorkspaceIds: readonly DaemonWorkspaceId[]
): { state: DaemonWorkspaceAdmissionState; decisions: readonly DaemonAdmissionDecision[] } {
  const nextSet = new Set(nextWorkspaceIds)
  const decisions: DaemonAdmissionDecision[] = []
  const admitted = new Set(prev.admitted)
  const dismissed = new Set(prev.dismissed)

  // Retire ids that disappeared from the daemon ledger.
  for (const id of prev.current) {
    if (!nextSet.has(id)) {
      decisions.push({ kind: 'retire', workspaceId: id })
      // A retired id leaves the runtime candidate set; if it genuinely reappears later it is new again.
      admitted.delete(id)
      dismissed.delete(id)
    }
  }

  // Admit or classify each current id.
  for (const id of nextWorkspaceIds) {
    if (!admitted.has(id)) {
      admitted.add(id)
      // A genuinely-new admission is not dismissed; auto-open once.
      dismissed.delete(id)
      decisions.push({ kind: 'admit', workspaceId: id })
    } else if (dismissed.has(id)) {
      decisions.push({ kind: 'already-dismissed', workspaceId: id })
    } else {
      decisions.push({ kind: 'no-change', workspaceId: id })
    }
  }

  return {
    state: { current: nextWorkspaceIds, admitted, dismissed },
    decisions,
  }
}

/** Record that the user explicitly closed an open Workspace; an unchanged snapshot must not reopen it. */
export function dismissWorkspace(
  state: DaemonWorkspaceAdmissionState,
  workspaceId: DaemonWorkspaceId
): DaemonWorkspaceAdmissionState {
  if (!state.current.includes(workspaceId)) return state
  if (state.dismissed.has(workspaceId)) return state
  return { ...state, dismissed: new Set(state.dismissed).add(workspaceId) }
}

/** Record an explicit Open of a closed row; clears dismissal so it may auto-open on future snapshots. */
export function clearDismissal(
  state: DaemonWorkspaceAdmissionState,
  workspaceId: DaemonWorkspaceId
): DaemonWorkspaceAdmissionState {
  if (!state.dismissed.has(workspaceId)) return state
  const dismissed = new Set(state.dismissed)
  dismissed.delete(workspaceId)
  return { ...state, dismissed }
}

/** Whether a workspace id is currently published by the daemon and not retired. */
export function isDaemonCandidate(
  state: DaemonWorkspaceAdmissionState,
  workspaceId: DaemonWorkspaceId
): boolean {
  return state.current.includes(workspaceId)
}
