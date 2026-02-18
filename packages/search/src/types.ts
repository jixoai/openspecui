export type SearchDocumentKind = 'spec' | 'change' | 'archive'

export interface SearchDocument {
  id: string
  kind: SearchDocumentKind
  title: string
  href: string
  path: string
  content: string
  updatedAt: number
}

export interface SearchQuery {
  query: string
  limit?: number
}

export interface SearchHit {
  documentId: string
  kind: SearchDocumentKind
  title: string
  href: string
  path: string
  score: number
  snippet: string
  updatedAt: number
}

export interface SearchProvider {
  init(docs: SearchDocument[]): Promise<void>
  replaceAll(docs: SearchDocument[]): Promise<void>
  search(query: SearchQuery): Promise<SearchHit[]>
  dispose(): Promise<void>
}

export interface SearchIndexDocument extends SearchDocument {
  normalizedTitle: string
  normalizedPath: string
  normalizedContent: string
}

export interface SearchIndex {
  documents: SearchIndexDocument[]
}
