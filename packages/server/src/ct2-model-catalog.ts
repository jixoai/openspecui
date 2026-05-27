import type {
  TranslationModelCandidate,
  TranslationModelDownloadPlan,
  TranslationModelSearchEvent,
  TranslationModelSearchInput,
  TranslationModelSearchResult,
} from '@openspecui/core'
import { resolveCt2ModelDownloadPlanFromRepositoryFiles } from '@openspecui/local-ct2-translator'
import { type Dispatcher } from 'undici'
import { getDefaultLocalCt2ModelFetchCachePath } from './ct2-model-cache-path.js'
import { buildHuggingFaceApiBaseUrl } from './huggingface-endpoint.js'
import { LocalModelFetchCacheStore } from './local-model-fetch-cache-store.js'
import { createProxyAwareDispatcher } from './network-dispatcher.js'
import { isRetryableNetworkError, isRetryableNetworkStatusCode } from './network-retry.js'

const DEFAULT_SEARCH_LIMIT = 6
const MAX_SEARCH_FETCH_LIMIT = 12
const DEFAULT_SMALL_VERIFY_MODEL_ID = 'ooeoeo/opus-mt-en-zh-ct2-float16'
const HUGGING_FACE_FETCH_RETRY_COUNT = 2
const HUGGING_FACE_FETCH_RETRY_DELAY_MS = 750

const HUGGING_FACE_FETCH_DISPATCHER: Dispatcher = createProxyAwareDispatcher()

export interface Ct2ModelSearchCatalogOptions {
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

export async function searchCt2Models(
  input: Omit<TranslationModelSearchInput, 'engineId'>,
  options: Ct2ModelSearchCatalogOptions = {}
): Promise<TranslationModelSearchResult> {
  const list = await fetchHuggingFaceModelList(input, options)
  const detailItems = await Promise.all(
    list.items.map(async (item) => {
      const detail = await getHuggingFaceModelDetail(item.id, input, options).catch(() => null)
      return detail
        ? toTranslationModelCandidate(detail, input)
        : toTranslationModelCandidate(item, input)
    })
  )
  const rankedCandidates = rankCandidates(detailItems, input)
  return {
    items: rankedCandidates.slice(0, normalizeSearchLimit(input.limit)),
    nextCursor: list.nextCursor,
  }
}

export async function searchCt2ModelsProgressively(
  input: Omit<TranslationModelSearchInput, 'engineId'> & { requestId: string },
  options: Ct2ModelSearchCatalogOptions = {}
): Promise<TranslationModelSearchEvent[]> {
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

async function fetchHuggingFaceModelList(
  input: Omit<TranslationModelSearchInput, 'engineId'>,
  options: Ct2ModelSearchCatalogOptions
): Promise<{ items: HfModelListItem[]; nextCursor?: string }> {
  const limit = normalizeSearchLimit(input.limit)
  const fetchLimit = Math.min(Math.max(limit * 2, limit), MAX_SEARCH_FETCH_LIMIT)
  const params = new URLSearchParams({
    pipeline_tag: 'translation',
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
  options: Ct2ModelSearchCatalogOptions
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
  const plan = isHfModelDetail(detail) ? resolveCt2ModelPlan(detail) : null
  const verified = plan !== null
  const estimatedTotalBytes = plan?.estimatedTotalBytes
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
    languageMatch: buildLanguageMatch(detail, input.sourceLanguage, input.targetLanguage),
  }
}

function resolveCt2ModelPlan(detail: HfModelDetail): TranslationModelDownloadPlan | null {
  return resolveCt2ModelDownloadPlanFromRepositoryFiles({
    modelId: detail.id,
    files: detail.siblings.map((entry) => ({
      path: entry.rfilename,
      sizeBytes: entry.size,
    })),
  })
}

function buildCandidateSummary(
  detail: HfModelListItem | HfModelDetail,
  verified: boolean,
  estimatedTotalBytes: number | undefined
): string {
  const parts = [
    verified ? 'Verified CTranslate2 translation model.' : 'Translation model from Hugging Face.',
  ]
  if (estimatedTotalBytes !== undefined) {
    parts.push(`Estimated download ${formatBytes(estimatedTotalBytes)}.`)
  }
  if (detail.tags.includes('translation')) {
    parts.push('Tagged for translation.')
  }
  return parts.join(' ')
}

function rankCandidate(candidate: TranslationModelCandidate): number {
  const smallVerifyBoost = candidate.id === DEFAULT_SMALL_VERIFY_MODEL_ID ? 18 : 0
  const compatibilityBoost = candidate.compatibility.localRuntimeVerified ? 140 : -80
  const trend = (candidate.trendingScore ?? 0) * 100
  const directionalBoost = candidate.languageMatch.directionalScore * 45
  const downloadsBoost = Math.log10(candidate.downloads + 1) * 12
  const likesBoost = candidate.likes * 0.15
  const sizePenalty =
    candidate.size.estimatedTotalBytes === undefined
      ? 0
      : Math.log10(candidate.size.estimatedTotalBytes / (1024 * 1024) + 1) * 12
  return (
    smallVerifyBoost +
    compatibilityBoost +
    trend +
    directionalBoost +
    downloadsBoost +
    likesBoost -
    sizePenalty
  )
}

function rankCandidates(
  candidates: ReadonlyArray<TranslationModelCandidate>,
  input: Omit<TranslationModelSearchInput, 'engineId'>
): TranslationModelCandidate[] {
  const verifiedCandidates = candidates.filter(
    (candidate) => candidate.compatibility.localRuntimeVerified
  )
  return [...(input.query?.trim() ? candidates : verifiedCandidates)].sort(
    (left, right) => rankCandidate(right) - rankCandidate(left)
  )
}

function buildLanguageMatch(
  detail: HfModelListItem | HfModelDetail,
  sourceLanguage: string | undefined,
  targetLanguage: string | undefined
): TranslationModelCandidate['languageMatch'] {
  const sourceTokens = buildLanguageTokens(sourceLanguage)
  const targetTokens = buildLanguageTokens(targetLanguage)
  const searchable = [detail.id, ...detail.tags].join(' ').toLowerCase()
  const sourceMatched = sourceTokens.some((token) => searchable.includes(token))
  const targetMatched = targetTokens.some((token) => searchable.includes(token))
  let directionalScore = 0
  if (sourceTokens.length > 0 && targetTokens.length > 0) {
    for (const sourceToken of sourceTokens) {
      for (const targetToken of targetTokens) {
        if (
          searchable.includes(`${sourceToken}-${targetToken}`) ||
          searchable.includes(`${sourceToken}_${targetToken}`) ||
          searchable.includes(`-${sourceToken}-${targetToken}`)
        ) {
          directionalScore = Math.max(directionalScore, 2)
        }
      }
    }
  }
  if (targetMatched) directionalScore += 1
  if (sourceMatched) directionalScore += 0.5
  return { sourceMatched, targetMatched, directionalScore }
}

function buildLanguageTokens(language: string | undefined): string[] {
  if (!language) return []
  const normalized = language.trim().toLowerCase()
  if (!normalized) return []
  const primary = normalized.split(/[-_]/, 1)[0] ?? normalized
  return [...new Set([normalized, primary].filter(Boolean))]
}

function normalizeHfModelDetail(value: unknown, fallbackId: string): HfModelDetail {
  const base = normalizeHfModelListItem(value) ?? {
    id: fallbackId,
    tags: [],
    downloads: 0,
    likes: 0,
  }
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  return {
    ...base,
    siblings: Array.isArray(record.siblings)
      ? record.siblings
          .map((entry) => normalizeSibling(entry))
          .filter((entry): entry is { rfilename: string; size?: number } => entry !== null)
      : [],
  }
}

function normalizeHfModelListItem(value: unknown): HfModelListItem | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (typeof record.id !== 'string' || record.id.length === 0) return null
  return {
    id: record.id,
    pipeline_tag: typeof record.pipeline_tag === 'string' ? record.pipeline_tag : undefined,
    tags: Array.isArray(record.tags) ? record.tags.filter(isString) : [],
    downloads: normalizeNonNegativeNumber(record.downloads),
    likes: normalizeNonNegativeNumber(record.likes),
    trendingScore: normalizeOptionalNumber(record.trendingScore),
    lastModified: typeof record.lastModified === 'string' ? record.lastModified : undefined,
  }
}

function normalizeSibling(value: unknown): { rfilename: string; size?: number } | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (typeof record.rfilename !== 'string' || record.rfilename.length === 0) return null
  return {
    rfilename: record.rfilename,
    size: normalizeOptionalNumber(record.size),
  }
}

function getFetchCacheStore(options: Ct2ModelSearchCatalogOptions): LocalModelFetchCacheStore {
  return (
    options.fetchCacheStore ??
    new LocalModelFetchCacheStore({ cachePath: getDefaultLocalCt2ModelFetchCachePath() })
  )
}

async function fetchHuggingFace(input: string): Promise<Response> {
  let lastError: unknown
  for (let attempt = 0; attempt <= HUGGING_FACE_FETCH_RETRY_COUNT; attempt += 1) {
    try {
      const response = await fetch(input, {
        dispatcher: HUGGING_FACE_FETCH_DISPATCHER,
      } as RequestInit & { dispatcher: Dispatcher })
      if (response.ok || !isRetryableNetworkStatusCode(response.status)) {
        return response
      }
      lastError = new Error(`Hugging Face request failed with status ${response.status}.`)
      if (attempt === HUGGING_FACE_FETCH_RETRY_COUNT) return response
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

function readNextCursor(linkHeader: string | null): string | undefined {
  if (!linkHeader) return undefined
  const match = /[?&]cursor=([^&>]+).*rel="next"/.exec(linkHeader)
  if (!match) return undefined
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

function normalizeSearchLimit(limit: number | undefined): number {
  return Math.min(Math.max(limit ?? DEFAULT_SEARCH_LIMIT, 1), 20)
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = value
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }
  const digits = size >= 100 || unitIndex === 0 ? 0 : 1
  return `${size.toFixed(digits)} ${units[unitIndex]}`
}

function normalizeNonNegativeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
}

function normalizeOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

function isHfModelDetail(value: HfModelListItem | HfModelDetail): value is HfModelDetail {
  return 'siblings' in value
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
