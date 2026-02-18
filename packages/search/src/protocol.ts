import { z } from 'zod'

export const SearchDocumentKindSchema = z.enum(['spec', 'change', 'archive'])

export const SearchDocumentSchema = z.object({
  id: z.string(),
  kind: SearchDocumentKindSchema,
  title: z.string(),
  href: z.string(),
  path: z.string(),
  content: z.string(),
  updatedAt: z.number(),
})

export const SearchQuerySchema = z.object({
  query: z.string(),
  limit: z.number().int().positive().optional(),
})

export const SearchHitSchema = z.object({
  documentId: z.string(),
  kind: SearchDocumentKindSchema,
  title: z.string(),
  href: z.string(),
  path: z.string(),
  score: z.number(),
  snippet: z.string(),
  updatedAt: z.number(),
})

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
export type SearchQueryInput = z.infer<typeof SearchQuerySchema>
export type SearchHitOutput = z.infer<typeof SearchHitSchema>
export type SearchWorkerRequest = z.infer<typeof SearchWorkerRequestSchema>
export type SearchWorkerResponse = z.infer<typeof SearchWorkerResponseSchema>
