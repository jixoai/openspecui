import type {
  TranslationModelCandidate,
  TranslationModelSearchEvent,
  TranslationModelSearchInput,
  TranslationModelSearchResult,
} from '@openspecui/core'
import { resolveGgufModelDownloadPlanFromRepositoryFiles } from '@openspecui/local-llama-translator'
import { type Dispatcher } from 'undici'
import { buildHuggingFaceApiBaseUrl } from './huggingface-endpoint.js'
import { getDefaultLocalLlamaModelFetchCachePath } from './local-llama-model-cache-path.js'
import { LocalModelFetchCacheStore } from './local-model-fetch-cache-store.js'
import { createProxyAwareDispatcher } from './network-dispatcher.js'
import { isRetryableNetworkError, isRetryableNetworkStatusCode } from './network-retry.js'

const DEFAULT_SEARCH_LIMIT = 6
const MAX_SEARCH_FETCH_LIMIT = 12
const DEFAULT_RECOMMENDED_MODEL_IDS = ['tencent/Hy-MT2-1.8B-1.25Bit-GGUF'] as const
const HUGGING_FACE_FETCH_RETRY_COUNT = 2
const HUGGING_FACE_FETCH_RETRY_DELAY_MS = 750

const HUGGING_FACE_FETCH_DISPATCHER: Dispatcher = createProxyAwareDispatcher()

export interface LlamaModelSearchCatalogOptions {
  fetchCacheStore?: LocalModelFetchCacheStore
  hfEndpoint?: string
}

interface HfModelListItem {
  id: string
  pipeline_tag?: string
  tags: string[]
  downloads: number
  likes: number
  trendingScore?: number
  lastModified?: string
}

interface HfModelDetail extends HfModelListItem {
  siblings: Array<{
    rfilename: string
    size?: number
  }>
}

export async function searchLlamaModels(
  input: Omit<TranslationModelSearchInput, 'engineId'>,
  options: LlamaModelSearchCatalogOptions = {}
): Promise<TranslationModelSearchResult> {
  if (!input.query?.trim()) {
    return {
      items: await readRecommendedCandidates(options),
    }
  }
  const list = await fetchHuggingFaceModelList(input, options)
  const detailItems = await Promise.all(
    list.items.map(async (item) => {
      const detail = await getHuggingFaceModelDetail(item.id, input, options).catch(() => null)
      return detail
        ? toTranslationModelCandidate(detail, input)
        : toTranslationModelCandidate(item, input)
    })
  )
  return {
    items: rankCandidates(detailItems, input).slice(0, normalizeSearchLimit(input.limit)),
    nextCursor: list.nextCursor,
  }
}

export async function searchLlamaModelsProgressively(
  input: Omit<TranslationModelSearchInput, 'engineId'> & { requestId: string },
  options: LlamaModelSearchCatalogOptions = {}
): Promise<TranslationModelSearchEvent[]> {
  if (!input.query?.trim()) {
    const recommended = await readRecommendedCandidates(options)
    return [
      { requestId: input.requestId, phase: 'candidates', items: recommended },
      { requestId: input.requestId, phase: 'enriched', items: recommended },
      { requestId: input.requestId, phase: 'complete', items: recommended },
    ]
  }

  const list = await fetchHuggingFaceModelList(input, options)
  const candidateShells = rankCandidates(
    list.items.map((item) => toTranslationModelCandidate(item, input)),
    input
  ).slice(0, normalizeSearchLimit(input.limit))
  const events: TranslationModelSearchEvent[] = [
    {
      requestId: input.requestId,
      phase: 'candidates',
      items: candidateShells,
      nextCursor: list.nextCursor,
    },
  ]
  const enriched = await Promise.all(
    candidateShells.map(async (candidate) => {
      const detail = await getHuggingFaceModelDetail(candidate.id, input, options).catch(() => null)
      return detail ? toTranslationModelCandidate(detail, input) : candidate
    })
  )
  const ranked = rankCandidates(enriched, input).slice(0, normalizeSearchLimit(input.limit))
  events.push({
    requestId: input.requestId,
    phase: 'enriched',
    items: ranked,
    nextCursor: list.nextCursor,
  })
  events.push({
    requestId: input.requestId,
    phase: 'complete',
    items: ranked,
    nextCursor: list.nextCursor,
  })
  return events
}

async function readRecommendedCandidates(
  options: LlamaModelSearchCatalogOptions
): Promise<TranslationModelCandidate[]> {
  const details = await Promise.all(
    DEFAULT_RECOMMENDED_MODEL_IDS.map((modelId) =>
      getHuggingFaceModelDetail(modelId, undefined, options).catch(() => null)
    )
  )
  const candidates = details
    .filter((detail): detail is HfModelDetail => detail !== null)
    .map((detail) => toTranslationModelCandidate(detail, {}))
  return rankCandidates(candidates, {}).slice(0, DEFAULT_SEARCH_LIMIT)
}

async function fetchHuggingFaceModelList(
  input: Omit<TranslationModelSearchInput, 'engineId'>,
  options: LlamaModelSearchCatalogOptions
): Promise<{ items: HfModelListItem[]; nextCursor?: string }> {
  const limit = normalizeSearchLimit(input.limit)
  const fetchLimit = Math.min(Math.max(limit * 2, limit), MAX_SEARCH_FETCH_LIMIT)
  const params = new URLSearchParams({
    sort: 'trendingScore',
    direction: '-1',
    limit: String(fetchLimit),
  })
  if (input.query?.trim()) params.set('search', input.query.trim())
  if (input.cursor?.trim()) params.set('cursor', input.cursor.trim())

  const url = `${buildHuggingFaceApiBaseUrl(options.hfEndpoint)}/models?${params.toString()}`
  const response = await fetchHuggingFace(url)
  const responseBody = await response.text()
  const fetchCacheStore = getFetchCacheStore(options)
  await fetchCacheStore.upsertProviderFetch({
    url,
    status: response.status,
    ok: response.ok,
    headers: headersToRecord(response.headers),
    bodyText: responseBody,
    queryContext: buildQueryContext(input),
  })
  if (!response.ok) {
    throw new Error(`Hugging Face model search failed with status ${response.status}.`)
  }
  const listJson = parseJson(responseBody)
  const rawItems = Array.isArray(listJson) ? listJson.filter(isRecord) : []
  const items = rawItems
    .map(normalizeHfModelListItem)
    .filter((item): item is HfModelListItem => item !== null)
  for (const raw of rawItems) {
    const item = normalizeHfModelListItem(raw)
    if (!item) continue
    await fetchCacheStore.upsertListItem({
      modelId: item.id,
      raw,
      queryContext: buildQueryContext(input),
    })
  }
  return {
    items,
    nextCursor: readNextCursor(response.headers.get('link')),
  }
}

async function getHuggingFaceModelDetail(
  modelId: string,
  input: Omit<TranslationModelSearchInput, 'engineId'> | undefined,
  options: LlamaModelSearchCatalogOptions
): Promise<HfModelDetail> {
  const [namespace, repo] = modelId.split('/', 2)
  const modelPath =
    namespace && repo
      ? `${encodeURIComponent(namespace)}/${encodeURIComponent(repo)}`
      : encodeURIComponent(modelId)
  const url = `${buildHuggingFaceApiBaseUrl(options.hfEndpoint)}/models/${modelPath}?blobs=true`
  const response = await fetchHuggingFace(url)
  const responseBody = await response.text()
  await getFetchCacheStore(options).upsertProviderFetch({
    url,
    status: response.status,
    ok: response.ok,
    headers: headersToRecord(response.headers),
    bodyText: responseBody,
    queryContext: input ? buildQueryContext(input) : undefined,
  })
  if (!response.ok) {
    throw new Error(`Hugging Face model detail failed with status ${response.status}.`)
  }
  const detailJson = parseJson(responseBody)
  const raw = isRecord(detailJson) ? detailJson : {}
  await getFetchCacheStore(options).upsertDetail({
    modelId,
    raw,
    queryContext: input ? buildQueryContext(input) : undefined,
  })
  return normalizeHfModelDetail(detailJson, modelId)
}

function toTranslationModelCandidate(
  detail: HfModelListItem | HfModelDetail,
  input: Omit<TranslationModelSearchInput, 'engineId'>
): TranslationModelCandidate {
  const plan = isHfModelDetail(detail)
    ? resolveGgufModelDownloadPlanFromRepositoryFiles({
        modelId: detail.id,
        files: detail.siblings.map((entry) => ({
          path: entry.rfilename,
          sizeBytes: entry.size,
        })),
      })
    : null
  const estimatedTotalBytes = plan?.estimatedTotalBytes
  const verified = plan !== null
  return {
    id: detail.id,
    label: detail.id,
    summary: buildCandidateSummary(detail, verified, estimatedTotalBytes),
    downloads: detail.downloads,
    likes: detail.likes,
    trendingScore: detail.trendingScore,
    lastModified: detail.lastModified,
    pipelineTag: detail.pipeline_tag,
    tags: detail.tags,
    compatibility: {
      transformersJs: false,
      onnx: false,
      localRuntimeVerified: verified,
    },
    size: {
      estimatedTotalBytes,
      primaryBytes: estimatedTotalBytes,
    },
    downloadGroups: plan?.groups,
    languageMatch: buildLanguageMatch(detail, input.query),
  }
}

function buildCandidateSummary(
  detail: HfModelListItem | HfModelDetail,
  verified: boolean,
  estimatedTotalBytes: number | undefined
): string {
  const parts = [verified ? 'Verified GGUF runtime model.' : 'Model from Hugging Face.']
  if (hasGgufSignal(detail)) {
    parts.push('GGUF artifact detected.')
  }
  if (estimatedTotalBytes !== undefined) {
    parts.push(`Estimated download ${formatBytes(estimatedTotalBytes)}.`)
  }
  return parts.join(' ')
}

function buildLanguageMatch(
  detail: HfModelListItem | HfModelDetail,
  query: string | undefined
): TranslationModelCandidate['languageMatch'] {
  const normalizedQuery = query?.trim().toLowerCase() ?? ''
  const haystack = `${detail.id} ${detail.tags.join(' ')}`.toLowerCase()
  const queryMatched = normalizedQuery.length > 0 && haystack.includes(normalizedQuery)
  return {
    sourceMatched: queryMatched,
    targetMatched: queryMatched,
    directionalScore: queryMatched ? 1 : 0,
  }
}

function rankCandidates(
  candidates: ReadonlyArray<TranslationModelCandidate>,
  input: Omit<TranslationModelSearchInput, 'engineId'>
): TranslationModelCandidate[] {
  const verifiedCandidates = candidates.filter(
    (candidate) => candidate.compatibility.localRuntimeVerified
  )
  return [
    ...(input.query?.trim()
      ? candidates
      : verifiedCandidates.length > 0
        ? verifiedCandidates
        : candidates),
  ].sort((left, right) => scoreCandidate(right, input) - scoreCandidate(left, input))
}

function scoreCandidate(
  candidate: TranslationModelCandidate,
  input: Omit<TranslationModelSearchInput, 'engineId'>
): number {
  const normalizedQuery = input.query?.trim().toLowerCase() ?? ''
  const queryMatchBoost =
    normalizedQuery.length > 0 && candidate.id.toLowerCase().includes(normalizedQuery) ? 18 : 0
  const verifiedBoost = candidate.compatibility.localRuntimeVerified ? 36 : 0
  const ggufBoost = candidate.tags.some((tag) => tag.toLowerCase() === 'gguf') ? 12 : 0
  const recommendedBoost = DEFAULT_RECOMMENDED_MODEL_IDS.includes(candidate.id as never) ? 24 : 0
  const signalBoost = candidate.tags.some((tag) => /translation|multilingual|mt/iu.test(tag))
    ? 8
    : candidate.tags.some((tag) => /conversational|chat/iu.test(tag))
      ? 3
      : 0
  return (
    verifiedBoost +
    ggufBoost +
    recommendedBoost +
    signalBoost +
    queryMatchBoost +
    Math.min(candidate.downloads / 10_000, 12) +
    Math.min(candidate.likes / 200, 8) +
    Math.min(candidate.trendingScore ?? 0, 20)
  )
}

function hasGgufSignal(detail: HfModelListItem | HfModelDetail): boolean {
  if (detail.tags.some((tag) => tag.toLowerCase() === 'gguf')) return true
  return isHfModelDetail(detail)
    ? detail.siblings.some((entry) => entry.rfilename.toLowerCase().endsWith('.gguf'))
    : false
}

function normalizeSearchLimit(limit: number | undefined): number {
  return Math.min(Math.max(limit ?? DEFAULT_SEARCH_LIMIT, 1), DEFAULT_SEARCH_LIMIT)
}

function buildQueryContext(input: Omit<TranslationModelSearchInput, 'engineId'>): {
  query?: string
  sourceLanguage?: string
  targetLanguage?: string
} {
  return {
    ...(input.query?.trim() ? { query: input.query.trim() } : {}),
    ...(input.sourceLanguage?.trim() ? { sourceLanguage: input.sourceLanguage.trim() } : {}),
    ...(input.targetLanguage?.trim() ? { targetLanguage: input.targetLanguage.trim() } : {}),
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

function headersToRecord(headers: Headers): Record<string, string> {
  return Object.fromEntries(headers.entries())
}

async function fetchHuggingFace(input: string): Promise<Response> {
  let lastError: unknown
  for (let attempt = 0; attempt <= HUGGING_FACE_FETCH_RETRY_COUNT; attempt += 1) {
    try {
      const response = await fetchWithDispatcher(input)
      if (response.ok || !isRetryableNetworkStatusCode(response.status)) {
        return response
      }
      lastError = new Error(`Hugging Face request failed with status ${response.status}.`)
      if (attempt === HUGGING_FACE_FETCH_RETRY_COUNT) {
        return response
      }
      await response.body?.cancel().catch(() => undefined)
    } catch (error) {
      lastError = error
      if (!isRetryableNetworkError(error) || attempt === HUGGING_FACE_FETCH_RETRY_COUNT) {
        throw error
      }
    }
    await delay(HUGGING_FACE_FETCH_RETRY_DELAY_MS * (attempt + 1))
  }
  throw lastError instanceof Error ? lastError : new Error('Hugging Face request failed.')
}

async function fetchWithDispatcher(input: string): Promise<Response> {
  return fetch(input, {
    dispatcher: HUGGING_FACE_FETCH_DISPATCHER,
    headers: {
      Accept: 'application/json',
    },
  } as RequestInit & { dispatcher: Dispatcher })
}

function normalizeHfModelListItem(value: Record<string, unknown>): HfModelListItem | null {
  const id = typeof value.id === 'string' ? value.id : null
  if (!id) return null
  return {
    id,
    pipeline_tag: typeof value.pipeline_tag === 'string' ? value.pipeline_tag : undefined,
    tags: Array.isArray(value.tags)
      ? value.tags.filter((tag): tag is string => typeof tag === 'string')
      : [],
    downloads: typeof value.downloads === 'number' ? value.downloads : 0,
    likes: typeof value.likes === 'number' ? value.likes : 0,
    trendingScore: typeof value.trendingScore === 'number' ? value.trendingScore : undefined,
    lastModified: typeof value.lastModified === 'string' ? value.lastModified : undefined,
  }
}

function normalizeHfModelDetail(value: unknown, modelId: string): HfModelDetail {
  const record = isRecord(value) ? value : {}
  const base = normalizeHfModelListItem({ id: modelId, ...record }) ?? {
    id: modelId,
    tags: [],
    downloads: 0,
    likes: 0,
  }
  return {
    ...base,
    siblings: Array.isArray(record.siblings)
      ? record.siblings
          .filter(isRecord)
          .map((entry) => ({
            rfilename: typeof entry.rfilename === 'string' ? entry.rfilename : '',
            size: typeof entry.size === 'number' ? entry.size : undefined,
          }))
          .filter((entry) => entry.rfilename.length > 0)
      : [],
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isHfModelDetail(value: HfModelListItem | HfModelDetail): value is HfModelDetail {
  return Array.isArray((value as HfModelDetail).siblings)
}

function readNextCursor(linkHeader: string | null): string | undefined {
  if (!linkHeader) return undefined
  const nextMatch = linkHeader.match(/<[^>]*[?&]cursor=([^&>]+)[^>]*>;\s*rel="next"/iu)
  return nextMatch?.[1] ? decodeURIComponent(nextMatch[1]) : undefined
}

function getFetchCacheStore(options: LlamaModelSearchCatalogOptions): LocalModelFetchCacheStore {
  return (
    options.fetchCacheStore ??
    new LocalModelFetchCacheStore({
      cachePath: getDefaultLocalLlamaModelFetchCachePath(),
    })
  )
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let size = value / 1024
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }
  const digits = size >= 100 ? 0 : size >= 10 ? 1 : 2
  return `${size.toFixed(digits)} ${units[unitIndex]}`
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}
