/**
 * Orthogonal intents (updated 2026-07-18 Asia/Shanghai):
 * 1. Define framework-neutral Search documents, queries, hits, indexes, and providers.
 * 2. Preserve optional project scope provenance for project-owned Search consumers.
 *
 * Original request (2026-07-15): "Referenced Specs are navigable and searchable but visibly read-only."
 * Derived requirement (2026-07-18): Checkpoint 6.10 scopes Search to the active root or direct Referenced Specs.
 */
export type SearchDocumentKind = string

/** The two objective document sources exposed by project Search. */
export type ProjectSearchScope = 'active-root' | 'referenced-specs'

/** A normalized document accepted by the shared Search index. */
export interface SearchDocument {
  id: string
  kind: SearchDocumentKind
  scope?: ProjectSearchScope
  title: string
  href: string
  path: string
  content: string
  updatedAt: number
}

/** A project Search document whose source provenance is always explicit. */
export interface ProjectSearchDocument extends SearchDocument {
  scope: ProjectSearchScope
}

/** A shared Search request; project consumers may select one source scope. */
export interface SearchQuery {
  query: string
  scope?: ProjectSearchScope
  limit?: number
}

/** A Search result with the source scope preserved when supplied by the document. */
export interface SearchHit {
  documentId: string
  kind: SearchDocumentKind
  scope?: ProjectSearchScope
  title: string
  href: string
  path: string
  score: number
  snippet: string
  updatedAt: number
}

/** A project Search result whose source provenance is always explicit. */
export interface ProjectSearchHit extends SearchHit {
  scope: ProjectSearchScope
}

/** An asynchronous provider for a replaceable Search document collection. */
export interface SearchProvider {
  init(docs: SearchDocument[]): Promise<void>
  replaceAll(docs: SearchDocument[]): Promise<void>
  search(query: SearchQuery): Promise<SearchHit[]>
  dispose(): Promise<void>
}

/** A Search document enriched with engine-private normalized fields. */
export interface SearchIndexDocument extends SearchDocument {
  normalizedTitle: string
  normalizedPath: string
  normalizedContent: string
}

/** The immutable collection searched by the synchronous engine. */
export interface SearchIndex {
  documents: SearchIndexDocument[]
}
