import {
  buildSearchIndex,
  createSnippet,
  isDocumentMatch,
  normalizeText,
  resolveLimit,
  scoreDocument,
  searchIndex,
  splitTerms,
  toSearchIndexDocument,
} from './engine.js'

const sharedRuntimeSource = String.raw`
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const SNIPPET_SIZE = 180;
const normalizeText = ${normalizeText.toString()};
const splitTerms = ${splitTerms.toString()};
const toSearchIndexDocument = ${toSearchIndexDocument.toString()};
const buildSearchIndex = ${buildSearchIndex.toString()};
const resolveLimit = ${resolveLimit.toString()};
const isDocumentMatch = ${isDocumentMatch.toString()};
const scoreDocument = ${scoreDocument.toString()};
const createSnippet = ${createSnippet.toString()};
const searchIndex = ${searchIndex.toString()};
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
