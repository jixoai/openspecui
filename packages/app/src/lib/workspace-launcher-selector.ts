/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Compose launcher rows joining candidates, open Workspaces, and reachability into exhaustive commands (4.2/4.3).
 * 2. Pure selector: never acquires subscriptions; the caller supplies already-typed facts.
 * 3. Deterministic Focus/Open/unavailable command selection per row (4.3/4.4/4.5/4.6).
 *
 * Original request (2026-07-30): "Workspaces融合了Connections，点击`+`，那么弹出的Dialog就会包含Connnections列表，而不是一个URL-Input"
 * Spec: hosted-app-distribution › "Candidate-Backed Workspace Launcher".
 *
 * The selector is subscription-free presentation logic. It derives one deterministic command per candidate row:
 *  - open Workspace exists           -> Focus (activate the existing exact Workspace, no new tab/session/frame)
 *  - reachable current candidate      -> Open (create exactly one Workspace)
 *  - checking                         -> locked visual activity (no command)
 *  - authentication-required/offline/unsupported/failed -> direct unavailable state (no Open, no Tooltip hide)
 */

/** One launcher candidate supplied by the caller (already-typed, credential-free). */
export interface LauncherCandidate {
  /** Normalized credential-free backend locator (the candidate identity). */
  readonly apiBaseUrl: string
  /** Path-first project identity when known; absent for opaque backend candidates. */
  readonly label?: { title: string; subtitle?: string | null; detail?: string } | null
  /** Backend-issued Environment identity when known; display fact only. */
  readonly envUri?: string | null
  /** Current reachability of this candidate. */
  readonly reachability: LauncherReachability
  /** Source: daemon-live or manual retained. */
  readonly source: 'daemon-live' | 'manual'
}

/** Reachability states that map to distinct launcher command outcomes (4.6). */
export type LauncherReachability =
  | 'online'
  | 'checking'
  | 'offline'
  | 'authentication-required'
  | 'unsupported'
  | 'failed'

/** Whether a candidate currently has an open Workspace (Focus target). */
export interface LauncherOpenWorkspace {
  /** Normalized backend locator that has an open Workspace. */
  readonly apiBaseUrl: string
}

/** One pending open/connect command keyed by locator (row loading lock, 4.5). */
export interface LauncherPendingCommand {
  readonly apiBaseUrl: string
  readonly kind: 'open' | 'connect'
}

/** The deterministic command for one launcher row. */
export type LauncherRowCommand =
  | { kind: 'focus'; apiBaseUrl: string }
  | { kind: 'open'; apiBaseUrl: string }
  | { kind: 'unavailable'; apiBaseUrl: string; reason: Exclude<LauncherReachability, 'online'> }

/** One composed launcher row. */
export interface LauncherRow {
  readonly candidate: LauncherCandidate
  readonly command: LauncherRowCommand
  readonly pending: boolean
}

/**
 * Compose launcher rows from candidates + open Workspaces + pending commands.
 *
 * Pure presentation: joins facts without acquiring subscriptions. Each row carries one deterministic command:
 * Focus when an open Workspace exists; Open when the candidate is online and not open; unavailable otherwise.
 * Duplicate locators collapse to one row. Forgetting a candidate is a separate row-menu action (4.8), distinct from
 * closing an open Workspace.
 */
export function selectLauncherRows(input: {
  candidates: readonly LauncherCandidate[]
  openWorkspaces: readonly LauncherOpenWorkspace[]
  pending: readonly LauncherPendingCommand[]
}): readonly LauncherRow[] {
  const openSet = new Set(input.openWorkspaces.map((workspace) => workspace.apiBaseUrl))
  const pendingByUrl = new Map(input.pending.map((command) => [command.apiBaseUrl, command]))
  const seen = new Set<string>()
  const rows: LauncherRow[] = []
  for (const candidate of input.candidates) {
    if (seen.has(candidate.apiBaseUrl)) continue
    seen.add(candidate.apiBaseUrl)
    const pending = pendingByUrl.has(candidate.apiBaseUrl)
    let command: LauncherRowCommand
    if (openSet.has(candidate.apiBaseUrl)) {
      command = { kind: 'focus', apiBaseUrl: candidate.apiBaseUrl }
    } else if (candidate.reachability === 'online') {
      command = { kind: 'open', apiBaseUrl: candidate.apiBaseUrl }
    } else {
      command = {
        kind: 'unavailable',
        apiBaseUrl: candidate.apiBaseUrl,
        reason: candidate.reachability === 'checking' ? 'checking' : candidate.reachability,
      }
    }
    rows.push({ candidate, command, pending })
  }
  return rows
}

/** Whether a row command is currently locked by a pending operation (loading lock, 4.5/4.9). */
export function isLauncherRowLocked(row: LauncherRow): boolean {
  return row.pending || row.command.kind === 'unavailable'
}
