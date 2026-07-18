/**
 * Orthogonal intents (updated 2026-07-18 Asia/Shanghai):
 * 1. Validate Search document, query, hit, and worker message boundaries.
 * 2. Define the defaulted project Search source contract.
 *
 * Original request (2026-07-15): "Referenced Specs are navigable and searchable but visibly read-only."
 * Derived requirement (2026-07-18): Checkpoint 6.10 scopes Search to the active root or direct Referenced Specs.
 */
import { z } from 'zod'
import type { ProjectSearchHit, ProjectSearchScope } from './types.js'

export const SearchDocumentKindSchema = z.string().min(1)

/** The source scopes supported by one project workspace's Search surface. */
export const ProjectSearchScopeSchema = z.enum(['active-root', 'referenced-specs'])

export const SearchDocumentSchema = z.object({
  id: z.string(),
  kind: SearchDocumentKindSchema,
  scope: ProjectSearchScopeSchema.optional(),
  title: z.string(),
  href: z.string(),
  path: z.string(),
  content: z.string(),
  updatedAt: z.number(),
})

/** Runtime validator for a source-attributed project Search document. */
export const ProjectSearchDocumentSchema = SearchDocumentSchema.extend({
  scope: ProjectSearchScopeSchema,
})

export const SearchQuerySchema = z.object({
  query: z.string(),
  scope: ProjectSearchScopeSchema.optional(),
  limit: z.number().int().positive().optional(),
})

/** A project Search request normalized to the writable Planning-root source by default. */
export const ProjectSearchQuerySchema = SearchQuerySchema.extend({
  scope: ProjectSearchScopeSchema.default('active-root'),
})

export const SearchHitSchema = z.object({
  documentId: z.string(),
  kind: SearchDocumentKindSchema,
  scope: ProjectSearchScopeSchema.optional(),
  title: z.string(),
  href: z.string(),
  path: z.string(),
  score: z.number(),
  snippet: z.string(),
  updatedAt: z.number(),
})

/** Runtime validator for a source-attributed project Search result. */
export const ProjectSearchHitSchema = SearchHitSchema.extend({
  scope: ProjectSearchScopeSchema,
})

/** Validate project hits and reject provenance that differs from the selected source. */
export function parseProjectSearchHits(
  input: unknown,
  expectedScope: ProjectSearchScope
): ProjectSearchHit[] {
  const hits = ProjectSearchHitSchema.array().parse(input)
  const mismatchedHit = hits.find((hit) => hit.scope !== expectedScope)
  if (mismatchedHit) {
    throw new Error(
      `Project Search hit "${mismatchedHit.documentId}" has scope "${mismatchedHit.scope}"; expected "${expectedScope}".`
    )
  }
  return hits
}

export const SearchWorkerRequestSchema = z.discriminatedUnion('type', [
  z.object({ id: z.string(), type: z.literal('init'), docs: z.array(SearchDocumentSchema) }),
  z.object({ id: z.string(), type: z.literal('replaceAll'), docs: z.array(SearchDocumentSchema) }),
  z.object({ id: z.string(), type: z.literal('search'), query: SearchQuerySchema }),
  z.object({ id: z.string(), type: z.literal('dispose') }),
])

export const SearchWorkerResponseSchema = z.discriminatedUnion('type', [
  z.object({ id: z.string(), type: z.literal('ok') }),
  z.object({ id: z.string(), type: z.literal('results'), hits: z.array(SearchHitSchema) }),
  z.object({ id: z.string(), type: z.literal('error'), message: z.string() }),
])

export type SearchDocumentInput = z.infer<typeof SearchDocumentSchema>
export type ProjectSearchQueryInput = z.infer<typeof ProjectSearchQuerySchema>
export type SearchQueryInput = z.infer<typeof SearchQuerySchema>
export type SearchHitOutput = z.infer<typeof SearchHitSchema>
export type SearchWorkerRequest = z.infer<typeof SearchWorkerRequestSchema>
export type SearchWorkerResponse = z.infer<typeof SearchWorkerResponseSchema>
