/**
 * Orthogonal intents (updated 2026-07-27 Asia/Shanghai):
 * 1. Define collision-safe owned and referenced Spec identity.
 * 2. Build one source-aware live/static Spec Catalog with CLI-owned membership and source-exact provenance.
 * 3. Define source-distinct Spec detail projections without inventing upstream or snapshot fields.
 * 4. Publish browser-safe Catalog/document runtime schemas for typed Projection Pull.
 *
 * Original request (2026-07-15): "Live and static modes share one source-aware Spec Catalog."
 * Original request (2026-07-26): "展开全面的接口升级和内核升级和测试升级。"
 */
import { match } from 'ts-pattern'
import { z } from 'zod'
import {
  CliDiagnosticSchema,
  CliRootSchema,
  CliShowSpecDocumentSchema,
  type CliDiagnostic,
  type CliRoot,
  type CliShowSpec,
  type CliSpecList,
} from './cli-contracts/index.js'
import {
  CliProjectionCommandEvidenceSchema,
  type CliProjectionCommandEvidence,
} from './cli-projection.js'
import { SpecSchema, type Spec } from './schemas.js'

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
  requirementCount: number
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
  ownedProjection: SpecCatalogOwnedProjection
  referenceSources: SpecCatalogReferenceSource[]
  referenceProjection: SpecCatalogReferenceProjection
  observedAt: number
}

/** Raw process and contract evidence retained for one Spec CLI command. */
export type SpecCommandEvidence = CliProjectionCommandEvidence

export const SpecCommandEvidenceSchema = CliProjectionCommandEvidenceSchema

/** Owned Catalog membership projected by a real OpenSpec CLI list command. */
export interface LiveSpecCatalogOwnedProjection {
  provenance: 'live'
  root: CliRoot
  evidence: SpecCommandEvidence
}

/** Owned Catalog membership projected solely from a published static snapshot. */
export type StaticSpecCatalogOwnedProjection =
  | { provenance: 'static'; state: 'available'; snapshot: { specCount: number } }
  | { provenance: 'static'; state: 'unavailable' }

/** Source-exact provenance for the writable Spec inventory. */
export type SpecCatalogOwnedProjection =
  | LiveSpecCatalogOwnedProjection
  | StaticSpecCatalogOwnedProjection

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

/** Whole-Catalog Reference provenance when live source inventory is present. */
export interface LiveSpecCatalogReferenceProjection {
  provenance: 'live'
}

/** Whole-Catalog published static policy without invented Store identity or CLI evidence. */
export type StaticSpecCatalogReferenceProjection =
  | { provenance: 'static'; policy: 'include' }
  | { provenance: 'static'; policy: 'omit'; referenceSourceCount: number }
  | { provenance: 'static'; policy: 'none' }
  | { provenance: 'static'; policy: 'unavailable' }

/** Whole-Catalog Reference inventory or published static policy fact. */
export type SpecCatalogReferenceProjection =
  | LiveSpecCatalogReferenceProjection
  | StaticSpecCatalogReferenceProjection

const OwnedSpecCatalogEntrySchema = z.object({
  identity: OwnedSpecIdentitySchema,
  source: z.literal('owned'),
  readOnly: z.literal(false),
  name: z.string(),
  summary: z.null(),
  requirementCount: z.number(),
  updatedAt: z.number(),
})

const SpecCatalogOwnedProjectionSchema = z.union([
  z.object({
    provenance: z.literal('live'),
    root: CliRootSchema,
    evidence: SpecCommandEvidenceSchema,
  }),
  z.discriminatedUnion('state', [
    z.object({
      provenance: z.literal('static'),
      state: z.literal('available'),
      snapshot: z.object({ specCount: z.number().int().nonnegative() }),
    }),
    z.object({ provenance: z.literal('static'), state: z.literal('unavailable') }),
  ]),
])

const ReferencedSpecCatalogEntrySchema = z.object({
  identity: ReferencedSpecIdentitySchema,
  source: z.literal('referenced'),
  readOnly: z.literal(true),
  name: z.string(),
  summary: z.null(),
  requirementCount: z.number(),
  updatedAt: z.literal(0),
})

const LiveSpecCatalogReferenceSourceSchema = z.object({
  storeId: z.string(),
  provenance: z.literal('live'),
  state: z.enum(['ready', 'error']),
  diagnostics: z.array(CliDiagnosticSchema),
  evidence: SpecCommandEvidenceSchema,
})

const StaticSpecCatalogReferenceSourceSchema = z.object({
  storeId: z.string(),
  provenance: z.literal('static'),
  state: z.enum(['ready', 'error']),
  snapshot: z.object({ policy: z.literal('include'), specCount: z.number() }),
})

const SpecCatalogReferenceProjectionSchema = z.union([
  z.object({ provenance: z.literal('live') }),
  z.discriminatedUnion('policy', [
    z.object({ provenance: z.literal('static'), policy: z.literal('include') }),
    z.object({
      provenance: z.literal('static'),
      policy: z.literal('omit'),
      referenceSourceCount: z.number(),
    }),
    z.object({ provenance: z.literal('static'), policy: z.literal('none') }),
    z.object({ provenance: z.literal('static'), policy: z.literal('unavailable') }),
  ]),
])

/** Runtime schema for the complete source-aware Spec Catalog. */
export const SpecCatalogSchema: z.ZodType<SpecCatalog, z.ZodTypeDef, unknown> = z.object({
  entries: z.array(z.union([OwnedSpecCatalogEntrySchema, ReferencedSpecCatalogEntrySchema])),
  ownedProjection: SpecCatalogOwnedProjectionSchema,
  referenceSources: z.array(
    z.union([LiveSpecCatalogReferenceSourceSchema, StaticSpecCatalogReferenceSourceSchema])
  ),
  referenceProjection: SpecCatalogReferenceProjectionSchema,
  observedAt: z.number(),
})

/** Map a published snapshot count without implying that the browser executed OpenSpec CLI. */
export function createStaticSpecCatalogOwnedProjection(
  specCount?: number
): StaticSpecCatalogOwnedProjection {
  return specCount === undefined
    ? { provenance: 'static', state: 'unavailable' }
    : { provenance: 'static', state: 'available', snapshot: { specCount } }
}

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

/** Map published static policy without converting omitted or unavailable facts into empty live inventory. */
export function createStaticSpecCatalogReferenceProjection(
  policy:
    | { kind: 'include' }
    | { kind: 'omit'; referenceSourceCount: number }
    | { kind: 'none' }
    | undefined
): StaticSpecCatalogReferenceProjection {
  return match(policy)
    .with(undefined, () => ({ provenance: 'static' as const, policy: 'unavailable' as const }))
    .with({ kind: 'include' }, () => ({
      provenance: 'static' as const,
      policy: 'include' as const,
    }))
    .with({ kind: 'omit' }, ({ referenceSourceCount }) => ({
      provenance: 'static' as const,
      policy: 'omit' as const,
      referenceSourceCount,
    }))
    .with({ kind: 'none' }, () => ({ provenance: 'static' as const, policy: 'none' as const }))
    .exhaustive()
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

const OwnedSpecDocumentProjectionSchema = z.object({
  identity: OwnedSpecIdentitySchema,
  source: z.literal('owned'),
  readOnly: z.literal(false),
  state: z.enum(['ready', 'not-found']),
  spec: SpecSchema.nullable(),
  rawMarkdown: z.string().nullable(),
  upstream: z.null(),
  evidence: z.null(),
})

const LiveReferencedSpecDocumentProjectionSchema = z.object({
  identity: ReferencedSpecIdentitySchema,
  source: z.literal('referenced'),
  readOnly: z.literal(true),
  state: z.enum(['ready', 'error']),
  spec: z.null(),
  rawMarkdown: z.null(),
  upstream: CliShowSpecDocumentSchema.nullable(),
  provenance: z.object({ kind: z.literal('live') }),
  evidence: SpecCommandEvidenceSchema,
})

const StaticReferencedSpecDocumentProjectionSchema = z.object({
  identity: ReferencedSpecIdentitySchema,
  source: z.literal('referenced'),
  readOnly: z.literal(true),
  state: z.enum(['ready', 'error']),
  spec: SpecSchema.nullable(),
  rawMarkdown: z.string().nullable(),
  upstream: CliShowSpecDocumentSchema.nullable(),
  provenance: z.discriminatedUnion('state', [
    z.object({
      kind: z.literal('static'),
      state: z.enum(['included', 'missing']),
      policy: z.enum(['include', 'unrecorded']),
      source: StaticSpecCatalogReferenceSourceSchema.nullable(),
    }),
    z.object({
      kind: z.literal('static'),
      state: z.literal('omitted'),
      policy: z.literal('omit'),
      referenceSourceCount: z.number(),
    }),
    z.object({ kind: z.literal('static'), state: z.literal('none'), policy: z.literal('none') }),
    z.object({
      kind: z.literal('static'),
      state: z.literal('snapshot-unavailable'),
      policy: z.literal('absent'),
    }),
  ]),
  evidence: z.null(),
})

/** Runtime schema for one source-aware owned or referenced Spec document projection. */
export const SpecDocumentProjectionSchema: z.ZodType<
  SpecDocumentProjection,
  z.ZodTypeDef,
  unknown
> = z.union([
  OwnedSpecDocumentProjectionSchema,
  LiveReferencedSpecDocumentProjectionSchema,
  StaticReferencedSpecDocumentProjectionSchema,
])

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
  ownedProjection: SpecCatalogOwnedProjection,
  referenceSources: readonly SpecCatalogReferenceSource[],
  observedAt: number,
  referenceProjection: SpecCatalogReferenceProjection = { provenance: 'live' }
): SpecCatalog {
  return {
    entries: [...owned, ...referenced],
    ownedProjection,
    referenceSources: [...referenceSources],
    referenceProjection,
    observedAt,
  }
}

/** Project CLI-owned Spec membership and explicit per-Store Spec lists into one Catalog. */
export function buildSpecCatalog(input: {
  owned: CliSpecList['specs']
  ownedProjection: SpecCatalogOwnedProjection
  referenced: ReadonlyArray<{ storeId: string; specs: CliSpecList['specs'] }>
  referenceSources: readonly SpecCatalogReferenceSource[]
  observedAt: number
}): SpecCatalog {
  const owned: OwnedSpecCatalogEntry[] = input.owned.map((spec) => ({
    identity: { kind: 'owned', specId: spec.id },
    source: 'owned',
    readOnly: false,
    name: spec.id,
    summary: null,
    requirementCount: spec.requirementCount,
    updatedAt: 0,
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
  return mergeSpecCatalog(
    owned,
    referenced,
    input.ownedProjection,
    input.referenceSources,
    input.observedAt
  )
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
