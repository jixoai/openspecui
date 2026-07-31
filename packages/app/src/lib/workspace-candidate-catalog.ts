/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Define a credential-free Workspace connection candidate identity distinct from open Workspace tabs (3.3).
 * 2. Persist only normalized locator + optional display metadata; never credentials or private fragments.
 * 3. Join daemon-live and manually-retained sources under one candidate identity without merging open state.
 *
 * Original request (2026-07-30): "Workspaces融合了Connections，点击`+`，那么弹出的Dialog就会包含Connnections列表。"
 * Implementation decision (2026-07-30): a connection candidate and an open Workspace have separate identity,
 *   lifecycle, and persistence contracts.
 *
 * This module owns the candidate catalog ONLY. Open Workspace tab/session/frame identity (3.4) and the open/
 * focus/close/reorder transitions (3.6) live in separate modules; this separation is the whole point of 3.1.
 */

import { normalizeHostedApiBaseUrl } from './shell-state'

const WORKSPACE_CANDIDATE_CATALOG_STORAGE_KEY = 'openspecui-app:workspace-candidates'
const WORKSPACE_CANDIDATE_CATALOG_VERSION = 1 as const

/** Source of a candidate: a daemon-live binding or a manually-retained locator. */
export type WorkspaceCandidateSource = 'daemon-live' | 'manual'

/** Credential-free identity for one Workspace connection candidate. */
export interface WorkspaceCandidateEntry {
  /** Normalized credential-free backend API locator (the durable candidate identity). */
  readonly apiBaseUrl: string
  /** Where this candidate originated. Daemon-live candidates are runtime-only; manual ones persist. */
  readonly source: WorkspaceCandidateSource
  /**
   * Optional display label (e.g. project name). Display-only metadata; never used as identity and never
   * derived into a credential or path. Daemon-live candidates may carry observed display metadata.
   */
  readonly label?: string
  /** Recency of the last manual connection; manual candidates persist this, daemon-live candidates omit it. */
  readonly lastConnectedAt?: number
}

/** Versioned persisted candidate catalog; runtime-parsed and rejected when malformed. */
export interface WorkspaceCandidateCatalog {
  readonly version: typeof WORKSPACE_CANDIDATE_CATALOG_VERSION
  /** Only manual-source candidates persist; daemon-live candidates are runtime-only and never stored. */
  readonly candidates: readonly WorkspaceCandidateEntry[]
}

export function createEmptyWorkspaceCandidateCatalog(): WorkspaceCandidateCatalog {
  return { version: WORKSPACE_CANDIDATE_CATALOG_VERSION, candidates: [] }
}

export function getWorkspaceCandidateCatalogStorageKey(): string {
  return WORKSPACE_CANDIDATE_CATALOG_STORAGE_KEY
}

interface PersistedCandidateCatalog {
  version?: unknown
  candidates?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isManualCandidateEntry(value: unknown): value is WorkspaceCandidateEntry {
  if (!isRecord(value)) return false
  if (typeof value.apiBaseUrl !== 'string' || value.apiBaseUrl.length === 0) return false
  // Persisted entries must be manual-source and credential-free.
  if (value.source !== undefined && value.source !== 'manual') return false
  if (value.label !== undefined && typeof value.label !== 'string') return false
  if (value.lastConnectedAt !== undefined) {
    if (typeof value.lastConnectedAt !== 'number' || !Number.isFinite(value.lastConnectedAt))
      return false
  }
  // Reject any field that looks like a credential/private fragment leak.
  for (const key of ['credential', 'password', 'token', 'fragment', 'authorization']) {
    if (key in value) return false
  }
  return true
}

/**
 * Parse untrusted persisted storage into a typed candidate catalog.
 *
 * Malformed or wrong-version storage is rejected as the empty catalog. Daemon-live candidates never
 * persist; any persisted non-manual source is dropped. Additive unknown fields are tolerated only when
 * every required field is present and no credential-like field appears.
 */
export function parseWorkspaceCandidateCatalog(raw: unknown): WorkspaceCandidateCatalog {
  if (!isRecord(raw)) return createEmptyWorkspaceCandidateCatalog()
  const persisted = raw as PersistedCandidateCatalog
  if (persisted.version !== WORKSPACE_CANDIDATE_CATALOG_VERSION) {
    return createEmptyWorkspaceCandidateCatalog()
  }
  if (!Array.isArray(persisted.candidates)) return createEmptyWorkspaceCandidateCatalog()

  const seen = new Set<string>()
  const candidates: WorkspaceCandidateEntry[] = []
  for (const candidate of persisted.candidates) {
    if (!isManualCandidateEntry(candidate)) continue
    const normalized = normalizeHostedApiBaseUrl(candidate.apiBaseUrl)
    if (!normalized) continue
    if (seen.has(normalized)) continue
    seen.add(normalized)
    candidates.push({
      apiBaseUrl: normalized,
      source: 'manual',
      ...(candidate.label !== undefined ? { label: candidate.label } : {}),
      ...(candidate.lastConnectedAt !== undefined
        ? { lastConnectedAt: candidate.lastConnectedAt }
        : {}),
    })
  }
  return { version: WORKSPACE_CANDIDATE_CATALOG_VERSION, candidates }
}

/** Load the credential-free candidate catalog from storage; empty catalog on any failure. */
export function loadWorkspaceCandidateCatalog(
  storage: Pick<Storage, 'getItem'>
): WorkspaceCandidateCatalog {
  try {
    const raw = storage.getItem(WORKSPACE_CANDIDATE_CATALOG_STORAGE_KEY)
    if (!raw) return createEmptyWorkspaceCandidateCatalog()
    return parseWorkspaceCandidateCatalog(JSON.parse(raw))
  } catch {
    return createEmptyWorkspaceCandidateCatalog()
  }
}

/** Persist the candidate catalog. Persistence failures are ignored (convenience cache). */
export function saveWorkspaceCandidateCatalog(
  storage: Pick<Storage, 'setItem'>,
  catalog: WorkspaceCandidateCatalog
): void {
  try {
    // Never persist daemon-live candidates; they are runtime-only.
    const persistable = catalog.candidates.filter((candidate) => candidate.source === 'manual')
    storage.setItem(
      WORKSPACE_CANDIDATE_CATALOG_STORAGE_KEY,
      JSON.stringify({ version: WORKSPACE_CANDIDATE_CATALOG_VERSION, candidates: persistable })
    )
  } catch {
    // ignore persistence failures in the convenience candidate catalog
  }
}

function normalizeLocator(apiBaseUrl: string): string | null {
  return normalizeHostedApiBaseUrl(apiBaseUrl)
}

/** Upsert a manual candidate after a successful connection; bumps recency. Never stores credentials. */
export function recordManualCandidate(
  catalog: WorkspaceCandidateCatalog,
  apiBaseUrl: string,
  options?: { now?: number; label?: string }
): WorkspaceCandidateCatalog {
  const normalized = normalizeLocator(apiBaseUrl)
  if (!normalized) return catalog
  const now = options?.now ?? Date.now()
  const index = catalog.candidates.findIndex(
    (candidate) => candidate.apiBaseUrl === normalized && candidate.source === 'manual'
  )
  const entry: WorkspaceCandidateEntry = {
    apiBaseUrl: normalized,
    source: 'manual',
    ...(options?.label !== undefined ? { label: options.label } : {}),
    lastConnectedAt: now,
  }
  if (index < 0) {
    return { ...catalog, candidates: [...catalog.candidates, entry] }
  }
  const candidates = [...catalog.candidates]
  candidates[index] = { ...candidates[index]!, ...entry }
  return { ...catalog, candidates }
}

/** Forget a manual candidate by locator (the launcher row "forget/remove" action). */
export function forgetManualCandidate(
  catalog: WorkspaceCandidateCatalog,
  apiBaseUrl: string
): WorkspaceCandidateCatalog {
  const normalized = normalizeLocator(apiBaseUrl)
  if (!normalized) return catalog
  return {
    ...catalog,
    candidates: catalog.candidates.filter(
      (candidate) => !(candidate.apiBaseUrl === normalized && candidate.source === 'manual')
    ),
  }
}

/**
 * Compose the launcher candidate list: persisted manual candidates plus runtime daemon-live candidates.
 * Daemon-live candidates are runtime-only and never persisted. The same locator resolves to one row.
 */
export function composeLauncherCandidates(
  manualCatalog: WorkspaceCandidateCatalog,
  daemonLiveCandidates: readonly WorkspaceCandidateEntry[]
): readonly WorkspaceCandidateEntry[] {
  const byLocator = new Map<string, WorkspaceCandidateEntry>()
  for (const candidate of manualCatalog.candidates) {
    byLocator.set(candidate.apiBaseUrl, candidate)
  }
  for (const candidate of daemonLiveCandidates) {
    if (candidate.source !== 'daemon-live') continue
    // Daemon-live takes precedence for display when both exist, but never persists.
    byLocator.set(candidate.apiBaseUrl, candidate)
  }
  return [...byLocator.values()]
}
