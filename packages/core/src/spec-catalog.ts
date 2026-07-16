/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Define collision-safe owned and referenced Spec identity.
 * 2. Build one source-aware live/static Spec Catalog without bare-id deduplication.
 * 3. Define source-distinct Spec detail projections without inventing upstream fields.
 * 4. Centralize route, cache, search, and provider lookup identity.
 *
 * Original request (2026-07-15): "Live and static modes share one source-aware Spec Catalog."
 */
import { z } from 'zod'
import type { CliDiagnostic, CliReferenceIndexEntry, CliShowSpec } from './cli-contracts/index.js'
import type { Spec } from './schemas.js'

export const OwnedSpecIdentitySchema = z.object({
  kind: z.literal('owned'),
  specId: z.string().min(1),
})

export const ReferencedSpecIdentitySchema = z.object({
  kind: z.literal('referenced'),
  storeId: z.string().min(1),
  specId: z.string().min(1),
})

export const SpecIdentitySchema = z.discriminatedUnion('kind', [
  OwnedSpecIdentitySchema,
  ReferencedSpecIdentitySchema,
])

export type OwnedSpecIdentity = z.infer<typeof OwnedSpecIdentitySchema>
export type ReferencedSpecIdentity = z.infer<typeof ReferencedSpecIdentitySchema>
export type SpecIdentity = z.infer<typeof SpecIdentitySchema>

export interface OwnedSpecCatalogEntry {
  identity: OwnedSpecIdentity
  source: 'owned'
  readOnly: false
  name: string
  summary: null
  updatedAt: number
}

export interface ReferencedSpecCatalogEntry {
  identity: ReferencedSpecIdentity
  source: 'referenced'
  readOnly: true
  /** Reference indexes expose ids and summaries, not a distinct title field. */
  name: string
  summary: string
  updatedAt: 0
}

export type SpecCatalogEntry = OwnedSpecCatalogEntry | ReferencedSpecCatalogEntry

export interface SpecCatalog {
  entries: SpecCatalogEntry[]
  observedAt: number
}

export interface SpecCommandEvidence {
  success: boolean
  stdout: string
  stderr: string
  exitCode: number | null
  diagnostics: CliDiagnostic[]
  contractError?: string
}

export type CliShowSpecDocument = Extract<CliShowSpec, { id: string }>

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

export interface ReferencedSpecDocumentProjection {
  identity: ReferencedSpecIdentity
  source: 'referenced'
  readOnly: true
  state: 'ready' | 'error'
  spec: null
  rawMarkdown: null
  upstream: CliShowSpecDocument | null
  evidence: SpecCommandEvidence
}

export type SpecDocumentProjection = OwnedSpecDocumentProjection | ReferencedSpecDocumentProjection

export function specIdentityKey(identity: SpecIdentity): string {
  const specId = encodeURIComponent(identity.specId)
  return identity.kind === 'owned'
    ? `owned:${specId}`
    : `referenced:${encodeURIComponent(identity.storeId)}:${specId}`
}

export function specRoutePath(identity: SpecIdentity): string {
  const specId = encodeURIComponent(identity.specId)
  return identity.kind === 'owned'
    ? `/specs/owned/${specId}`
    : `/specs/referenced/${encodeURIComponent(identity.storeId)}/${specId}`
}

export function specIdentityFromRoute(params: { specId: string; storeId?: string }): SpecIdentity {
  return params.storeId === undefined
    ? { kind: 'owned', specId: params.specId }
    : { kind: 'referenced', storeId: params.storeId, specId: params.specId }
}

export function mergeSpecCatalog(
  owned: readonly OwnedSpecCatalogEntry[],
  referenced: readonly ReferencedSpecCatalogEntry[],
  observedAt: number
): SpecCatalog {
  return { entries: [...owned, ...referenced], observedAt }
}

export function buildSpecCatalog(input: {
  owned: ReadonlyArray<{ id: string; name: string; updatedAt: number }>
  references: readonly CliReferenceIndexEntry[]
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
  const referenced: ReferencedSpecCatalogEntry[] = input.references.flatMap((reference) =>
    (reference.specs ?? []).map((spec) => ({
      identity: { kind: 'referenced', storeId: reference.store_id, specId: spec.id },
      source: 'referenced',
      readOnly: true,
      name: spec.id,
      summary: spec.summary,
      updatedAt: 0,
    }))
  )
  return mergeSpecCatalog(owned, referenced, input.observedAt)
}

export function getSpecCatalogEntry(
  catalog: SpecCatalog,
  identity: SpecIdentity
): SpecCatalogEntry | null {
  const key = specIdentityKey(identity)
  return catalog.entries.find((entry) => specIdentityKey(entry.identity) === key) ?? null
}

export function isReferencedSpecIdentity(
  identity: SpecIdentity
): identity is ReferencedSpecIdentity {
  return identity.kind === 'referenced'
}
