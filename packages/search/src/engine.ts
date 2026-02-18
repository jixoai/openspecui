import type {
  SearchDocument,
  SearchHit,
  SearchIndex,
  SearchIndexDocument,
  SearchQuery,
} from './types.js'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200
const SNIPPET_SIZE = 180

export function normalizeText(input: string): string {
  return input.toLowerCase().replace(/\s+/g, ' ').trim()
}

export function splitTerms(query: string): string[] {
  return normalizeText(query)
    .split(' ')
    .map((term) => term.trim())
    .filter((term) => term.length > 0)
}

export function toSearchIndexDocument(doc: SearchDocument): SearchIndexDocument {
  return {
    ...doc,
    normalizedTitle: normalizeText(doc.title),
    normalizedPath: normalizeText(doc.path),
    normalizedContent: normalizeText(doc.content),
  }
}

export function buildSearchIndex(docs: SearchDocument[]): SearchIndex {
  return {
    documents: docs.map(toSearchIndexDocument),
  }
}

export function resolveLimit(limit?: number): number {
  if (typeof limit !== 'number' || Number.isNaN(limit)) return DEFAULT_LIMIT
  return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(limit)))
}

export function isDocumentMatch(doc: SearchIndexDocument, terms: string[]): boolean {
  return terms.every(
    (term) =>
      doc.normalizedTitle.includes(term) ||
      doc.normalizedPath.includes(term) ||
      doc.normalizedContent.includes(term)
  )
}

export function scoreDocument(doc: SearchIndexDocument, terms: string[]): number {
  let score = 0

  for (const term of terms) {
    if (doc.normalizedTitle.includes(term)) score += 30
    if (doc.normalizedPath.includes(term)) score += 20

    const contentIdx = doc.normalizedContent.indexOf(term)
    if (contentIdx >= 0) {
      score += 8
      if (contentIdx < 160) score += 4
    }
  }

  return score
}

export function createSnippet(content: string, terms: string[]): string {
  const source = content.trim()
  if (!source) return ''

  const normalizedSource = normalizeText(source)
  let matchIndex = -1

  for (const term of terms) {
    const idx = normalizedSource.indexOf(term)
    if (idx >= 0 && (matchIndex < 0 || idx < matchIndex)) {
      matchIndex = idx
    }
  }

  if (matchIndex < 0) {
    return source.slice(0, SNIPPET_SIZE)
  }

  const start = Math.max(0, matchIndex - Math.floor(SNIPPET_SIZE / 3))
  const end = Math.min(source.length, start + SNIPPET_SIZE)

  const prefix = start > 0 ? '...' : ''
  const suffix = end < source.length ? '...' : ''
  return `${prefix}${source.slice(start, end)}${suffix}`
}

export function searchIndex(index: SearchIndex, query: SearchQuery): SearchHit[] {
  const terms = splitTerms(query.query)
  if (terms.length === 0) return []

  const hits: SearchHit[] = []

  for (const doc of index.documents) {
    if (!isDocumentMatch(doc, terms)) continue

    hits.push({
      documentId: doc.id,
      kind: doc.kind,
      title: doc.title,
      href: doc.href,
      path: doc.path,
      score: scoreDocument(doc, terms),
      snippet: createSnippet(doc.content, terms),
      updatedAt: doc.updatedAt,
    })
  }

  hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return b.updatedAt - a.updatedAt
  })

  return hits.slice(0, resolveLimit(query.limit))
}
