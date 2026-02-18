const sharedRuntimeSource = String.raw`
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const SNIPPET_SIZE = 180;

function normalizeText(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function splitTerms(query) {
  return normalizeText(query)
    .split(' ')
    .map((term) => term.trim())
    .filter((term) => term.length > 0);
}

function toSearchIndexDocument(doc) {
  return {
    id: doc.id,
    kind: doc.kind,
    title: doc.title,
    href: doc.href,
    path: doc.path,
    content: doc.content,
    updatedAt: doc.updatedAt,
    normalizedTitle: normalizeText(doc.title),
    normalizedPath: normalizeText(doc.path),
    normalizedContent: normalizeText(doc.content),
  };
}

function buildSearchIndex(docs) {
  return {
    documents: Array.isArray(docs) ? docs.map(toSearchIndexDocument) : [],
  };
}

function resolveLimit(limit) {
  if (typeof limit !== 'number' || Number.isNaN(limit)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(limit)));
}

function isDocumentMatch(doc, terms) {
  return terms.every(
    (term) =>
      doc.normalizedTitle.includes(term) ||
      doc.normalizedPath.includes(term) ||
      doc.normalizedContent.includes(term)
  );
}

function scoreDocument(doc, terms) {
  let score = 0;

  for (const term of terms) {
    if (doc.normalizedTitle.includes(term)) score += 30;
    if (doc.normalizedPath.includes(term)) score += 20;

    const contentIdx = doc.normalizedContent.indexOf(term);
    if (contentIdx >= 0) {
      score += 8;
      if (contentIdx < 160) score += 4;
    }
  }

  return score;
}

function createSnippet(content, terms) {
  const source = String(content || '').trim();
  if (!source) return '';

  const normalizedSource = normalizeText(source);
  let matchIndex = -1;

  for (const term of terms) {
    const idx = normalizedSource.indexOf(term);
    if (idx >= 0 && (matchIndex < 0 || idx < matchIndex)) {
      matchIndex = idx;
    }
  }

  if (matchIndex < 0) {
    return source.slice(0, SNIPPET_SIZE);
  }

  const start = Math.max(0, matchIndex - Math.floor(SNIPPET_SIZE / 3));
  const end = Math.min(source.length, start + SNIPPET_SIZE);

  const prefix = start > 0 ? '...' : '';
  const suffix = end < source.length ? '...' : '';
  return prefix + source.slice(start, end) + suffix;
}

function searchIndex(index, query) {
  const terms = splitTerms(query && query.query ? query.query : '');
  if (terms.length === 0) return [];

  const hits = [];

  for (const doc of index.documents) {
    if (!isDocumentMatch(doc, terms)) continue;

    hits.push({
      documentId: doc.id,
      kind: doc.kind,
      title: doc.title,
      href: doc.href,
      path: doc.path,
      score: scoreDocument(doc, terms),
      snippet: createSnippet(doc.content, terms),
      updatedAt: doc.updatedAt,
    });
  }

  hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.updatedAt - a.updatedAt;
  });

  return hits.slice(0, resolveLimit(query ? query.limit : undefined));
}

let index = buildSearchIndex([]);

function handleMessage(payload) {
  try {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Invalid worker request payload');
    }

    if (payload.type === 'init' || payload.type === 'replaceAll') {
      index = buildSearchIndex(Array.isArray(payload.docs) ? payload.docs : []);
      return { id: payload.id, type: 'ok' };
    }

    if (payload.type === 'search') {
      const hits = searchIndex(index, payload.query || { query: '' });
      return { id: payload.id, type: 'results', hits };
    }

    if (payload.type === 'dispose') {
      index = buildSearchIndex([]);
      return { id: payload.id, type: 'ok' };
    }

    throw new Error('Unsupported worker request type');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { id: payload?.id ?? 'unknown', type: 'error', message };
  }
}
`

export function buildWebWorkerSource(): string {
  return `${sharedRuntimeSource}\nself.onmessage = (event) => { self.postMessage(handleMessage(event.data)); };`
}

export function buildNodeWorkerSource(): string {
  return `${sharedRuntimeSource}\nconst { parentPort } = require('node:worker_threads');\nif (!parentPort) { throw new Error('Missing parentPort'); }\nparentPort.on('message', (payload) => { parentPort.postMessage(handleMessage(payload)); });`
}
