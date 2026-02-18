export {
  buildSearchIndex,
  createSnippet,
  normalizeText,
  searchIndex,
  splitTerms,
} from './engine.js'

export {
  SearchDocumentKindSchema,
  SearchDocumentSchema,
  SearchHitSchema,
  SearchQuerySchema,
  SearchWorkerRequestSchema,
  SearchWorkerResponseSchema,
  type SearchDocumentInput,
  type SearchHitOutput,
  type SearchQueryInput,
  type SearchWorkerRequest,
  type SearchWorkerResponse,
} from './protocol.js'

export { WebWorkerSearchProvider } from './webworker-provider.js'

export type {
  SearchDocument,
  SearchDocumentKind,
  SearchHit,
  SearchIndex,
  SearchIndexDocument,
  SearchProvider,
  SearchQuery,
} from './types.js'
