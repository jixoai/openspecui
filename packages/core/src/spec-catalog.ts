/**
 * Orthogonal intents (updated 2026-07-25 Asia/Shanghai):
 * 1. Define collision-safe owned and referenced Spec identity.
 * 2. Build one source-aware live/static Spec Catalog without bare-id deduplication or forged CLI evidence.
 * 3. Define source-distinct Spec detail projections without inventing upstream or snapshot fields.
 * 4. Centralize route, cache, search, and provider lookup identity.
 *
 * Original request (2026-07-15): "Live and static modes share one source-aware Spec Catalog."
 */
import { z } from 'zod'
import type { CliDiagnostic, CliShowSpec, CliSpecList } from './cli-contracts/index.js'
import type { Spec } from './schemas.js'

/** Runtime validator for one writable owned Spec identity. */
export const OwnedSpecIdentitySchema = z.object({
  kind: z.literal('owned'),
  specId: z.string().min(1),
})

/** Runtime validator for one Store-qualified read-only Spec identity. */
export const ReferencedSpecIdentitySchema = z.object({
  kind: z.literal('referenced'),
  storeId: z.string().min(1),
  specId: z.string().min(1),
})

/** Runtime validator for the complete compound Spec identity union. */
export const SpecIdentitySchema = z.discriminatedUnion('kind', [
  OwnedSpecIdentitySchema,
  ReferencedSpecIdentitySchema,
])

/** Writable planning-root Spec identity. */
export type OwnedSpecIdentity = z.infer<typeof OwnedSpecIdentitySchema>
/** Store-qualified read-only Spec identity. */
export type ReferencedSpecIdentity = z.infer<typeof ReferencedSpecIdentitySchema>
/** Complete collision-safe Spec identity union. */
export type SpecIdentity = z.infer<typeof SpecIdentitySchema>

/** Writable planning-root Spec metadata used in Catalog lists. */
export interface OwnedSpecCatalogEntry {
  identity: OwnedSpecIdentity
  source: 'owned'
  readOnly: false
  name: string
  summary: null
  updatedAt: number
}

/** Read-only Store-qualified Spec metadata from `list --specs --store --json`. */
export interface ReferencedSpecCatalogEntry {
  identity: ReferencedSpecIdentity
  source: 'referenced'
  readOnly: true
  /** Spec list exposes ids, not a distinct title field. */
  name: string
  summary: null
  requirementCount: number
  updatedAt: 0
}

/** Source-aware Spec Catalog entry union. */
export type SpecCatalogEntry = OwnedSpecCatalogEntry | ReferencedSpecCatalogEntry

/** Source-aware Spec list with per-Reference enumeration evidence. */
export interface SpecCatalog {
  entries: SpecCatalogEntry[]
  referenceSources: SpecCatalogReferenceSource[]
  observedAt: number
}

/** Raw process and contract evidence retained for one Spec CLI command. */
export interface SpecCommandEvidence {
  success: boolean
  stdout: string
  stderr: string
  exitCode: number | null
  diagnostics: CliDiagnostic[]
  contractError?: string
}

/** Per-Store Doctor and list evidence retained even when one live Reference cannot be enumerated. */
export interface LiveSpecCatalogReferenceSource {
  storeId: string
  provenance: 'live'
  state: 'ready' | 'error'
  diagnostics: CliDiagnostic[]
  evidence: SpecCommandEvidence
}

/** Published per-Store snapshot facts; static export never runs a CLI command. */
export interface StaticSpecCatalogReferenceSource {
  storeId: string
  provenance: 'static'
  state: 'ready' | 'error'
  snapshot: {
    policy: 'include'
    specCount: number
  }
}

/** Per-Store Reference projection, distinguished by live execution or published snapshot provenance. */
export type SpecCatalogReferenceSource =
  | LiveSpecCatalogReferenceSource
  | StaticSpecCatalogReferenceSource

/** Map published Reference source facts without implying a CLI execution occurred. */
export function createStaticSpecCatalogReferenceSource(input: {
  storeId: string
  state: 'ready' | 'error'
  specCount: number
}): StaticSpecCatalogReferenceSource {
  return {
    storeId: input.storeId,
    provenance: 'static',
    state: input.state,
    snapshot: { policy: 'include', specCount: input.specCount },
  }
}

/** Successful `show --type spec --json` document payload. */
export type CliShowSpecDocument = Extract<CliShowSpec, { id: string }>

/** Writable planning-root Spec document projection. */
export interface OwnedSpecDocumentProjection {
  identity: OwnedSpecIdentity
  source: 'owned'
  readOnly: false
  state: 'ready' | 'not-found'
  spec: Spec | null
  rawMarkdown: string | null
  upstream: null
  evidence: null
}

/** Read-only Store-qualified Spec document projection. */
interface ReferencedSpecDocumentProjectionBase {
  identity: ReferencedSpecIdentity
  source: 'referenced'
  readOnly: true
  state: 'ready' | 'error'
  /**
   * Live mode never parses a referenced Spec body; static mode materializes it through
   * `--references include` and exposes the parsed body here as a ready projection.
   */
  spec: Spec | null
  /**
   * Live mode never returns referenced raw markdown; static mode exposes the materialized
   * source when the snapshot carried the referenced Spec body.
   */
  rawMarkdown: string | null
  upstream: CliShowSpecDocument | null
}

/** Referenced document projected by a real OpenSpec CLI command. */
export interface LiveReferencedSpecDocumentProjection extends ReferencedSpecDocumentProjectionBase {
  provenance: { kind: 'live' }
  evidence: SpecCommandEvidence
}

/** Referenced document projected solely from the published static snapshot. */
export interface StaticReferencedSpecDocumentProjection
  extends ReferencedSpecDocumentProjectionBase {
  provenance:
    | {
        kind: 'static'
        state: 'included' | 'missing'
        policy: 'include' | 'unrecorded'
        source: StaticSpecCatalogReferenceSource | null
      }
    | {
        kind: 'static'
        state: 'omitted'
        policy: 'omit'
        referenceSourceCount: number
      }
    | { kind: 'static'; state: 'none'; policy: 'none' }
    | { kind: 'static'; state: 'snapshot-unavailable'; policy: 'absent' }
  evidence: null
}

/** Read-only Store-qualified document with source-discriminated evidence. */
export type ReferencedSpecDocumentProjection =
  | LiveReferencedSpecDocumentProjection
  | StaticReferencedSpecDocumentProjection

/** Source-aware owned/referenced Spec document projection union. */
export type SpecDocumentProjection = OwnedSpecDocumentProjection | ReferencedSpecDocumentProjection

/** Build a collision-safe cache/search key for a compound Spec identity. */
export function specIdentityKey(identity: SpecIdentity): string {
  const specId = encodeURIComponent(identity.specId)
  return identity.kind === 'owned'
    ? `owned:${specId}`
    : `referenced:${encodeURIComponent(identity.storeId)}:${specId}`
}

/** Build the canonical live/static route for a compound Spec identity. */
export function specRoutePath(identity: SpecIdentity): string {
  const specId = encodeURIComponent(identity.specId)
  return identity.kind === 'owned'
    ? `/specs/owned/${specId}`
    : `/specs/referenced/${encodeURIComponent(identity.storeId)}/${specId}`
}

/** Recover compound Spec identity from canonical route parameters. */
export function specIdentityFromRoute(params: { specId: string; storeId?: string }): SpecIdentity {
  return params.storeId === undefined
    ? { kind: 'owned', specId: params.specId }
    : { kind: 'referenced', storeId: params.storeId, specId: params.specId }
}

/** Merge already projected owned and referenced entries without bare-id deduplication. */
export function mergeSpecCatalog(
  owned: readonly OwnedSpecCatalogEntry[],
  referenced: readonly ReferencedSpecCatalogEntry[],
  referenceSources: readonly SpecCatalogReferenceSource[],
  observedAt: number
): SpecCatalog {
  return {
    entries: [...owned, ...referenced],
    referenceSources: [...referenceSources],
    observedAt,
  }
}

/** Project owned metadata and explicit per-Store Spec lists into one Catalog. */
export function buildSpecCatalog(input: {
  owned: ReadonlyArray<{ id: string; name: string; updatedAt: number }>
  referenced: ReadonlyArray<{ storeId: string; specs: CliSpecList['specs'] }>
  referenceSources: readonly SpecCatalogReferenceSource[]
  observedAt: number
}): SpecCatalog {
  const owned: OwnedSpecCatalogEntry[] = input.owned.map((spec) => ({
    identity: { kind: 'owned', specId: spec.id },
    source: 'owned',
    readOnly: false,
    name: spec.name,
    summary: null,
    updatedAt: spec.updatedAt,
  }))
  const referenced: ReferencedSpecCatalogEntry[] = input.referenced.flatMap((source) =>
    source.specs.map((spec) => ({
      identity: { kind: 'referenced', storeId: source.storeId, specId: spec.id },
      source: 'referenced',
      readOnly: true,
      name: spec.id,
      summary: null,
      requirementCount: spec.requirementCount,
      updatedAt: 0,
    }))
  )
  return mergeSpecCatalog(owned, referenced, input.referenceSources, input.observedAt)
}

/** Look up only the exact compound identity in a Catalog. */
export function getSpecCatalogEntry(
  catalog: SpecCatalog,
  identity: SpecIdentity
): SpecCatalogEntry | null {
  const key = specIdentityKey(identity)
  return catalog.entries.find((entry) => specIdentityKey(entry.identity) === key) ?? null
}

/** Narrow a compound Spec identity to its Store-qualified read-only form. */
export function isReferencedSpecIdentity(
  identity: SpecIdentity
): identity is ReferencedSpecIdentity {
  return identity.kind === 'referenced'
}
