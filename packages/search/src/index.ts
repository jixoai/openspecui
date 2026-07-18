/**
 * Orthogonal intents (updated 2026-07-18 Asia/Shanghai):
 * 1. Publish the browser-safe Search engine, schemas, provider, and contracts.
 * 2. Publish project source-scope contracts without coupling Search to project services.
 *
 * Original request (2026-07-15): "Referenced Specs are navigable and searchable but visibly read-only."
 * Derived requirement (2026-07-18): Checkpoint 6.10 scopes Search to the active root or direct Referenced Specs.
 */
export {
  buildSearchIndex,
  createSnippet,
  normalizeText,
  searchIndex,
  splitTerms,
} from './engine.js'

export {
  ProjectSearchDocumentSchema,
  ProjectSearchHitSchema,
  ProjectSearchQuerySchema,
  ProjectSearchScopeSchema,
  SearchDocumentKindSchema,
  SearchDocumentSchema,
  SearchHitSchema,
  SearchQuerySchema,
  SearchWorkerRequestSchema,
  SearchWorkerResponseSchema,
  parseProjectSearchHits,
  type ProjectSearchQueryInput,
  type SearchDocumentInput,
  type SearchHitOutput,
  type SearchQueryInput,
  type SearchWorkerRequest,
  type SearchWorkerResponse,
} from './protocol.js'

export { WebWorkerSearchProvider } from './webworker-provider.js'

export type {
  ProjectSearchDocument,
  ProjectSearchHit,
  ProjectSearchScope,
  SearchDocument,
  SearchDocumentKind,
  SearchHit,
  SearchIndex,
  SearchIndexDocument,
  SearchProvider,
  SearchQuery,
} from './types.js'
