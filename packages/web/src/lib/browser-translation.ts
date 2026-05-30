import {
  createBrowserTranslatorFactory,
  prepareBrowserTranslator,
  probeBrowserTranslator,
  scanBrowserTranslationSupportTable,
  type BrowserTranslationAvailability,
  type BrowserTranslationAvailabilityRow,
  type BrowserTranslationStatus,
  type BrowserTranslationSupportTable,
} from '@openspecui/browser-translator'
import {
  TRANSLATION_CACHE_POLICY_VERSION,
  type DocumentTranslationDisplayMode,
  type TranslationCacheEntry,
  type TranslationCacheWriteInput,
} from '@openspecui/core/document-translation'
import {
  parseMarkdownFacts,
  type MarkdownFact,
  type MarkdownFactKind,
} from '@openspecui/core/markdown-facts'
import { getMarkdownFactSpan } from '@openspecui/core/markdown-reading'
import { checkLocalDirectionalModelLanguagePair } from '@openspecui/core/translation-language-pair'
import {
  DEFAULT_BATCH_TRANSLATION_TIMEOUT_MS,
  DEFAULT_TRANSLATION_ENGINE_ID,
  TRANSLATOR_CONTRACT_VERSION,
  isDirectionalManagedLocalTranslationEngineId,
  type BatchTranslationResult,
  type TranslationEngineId,
  type Translator,
  type TranslatorFactory,
} from '@openspecui/core/translator'
import type { Element, Root, RootContent } from 'hast'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import {
  createTranslationPlaceholderProtocol,
  getTranslatableBlockChildren,
  getTranslationSourceText,
  restoreTranslatedPlaceholderFragment,
  type TranslationPlaceholderProtocol,
} from './browser-translation-placeholders'
import {
  appendTranslationAdaptiveConcurrencyLog,
  createTranslationAdaptiveConcurrencyScopeKey,
  readRecentTranslationAdaptiveConcurrencyLogs,
} from './translation-adaptive-concurrency-log'
import {
  SUPPORTED_TRANSLATION_LANGUAGES,
  type TranslationLanguageCode,
} from './translation-languages'

export type {
  BrowserTranslationAvailability,
  BrowserTranslationAvailabilityRow,
  BrowserTranslationStatus,
  BrowserTranslationSupportTable,
} from '@openspecui/browser-translator'

export interface BrowserTranslationSupportTableState {
  state: 'idle' | 'checking' | 'ready' | 'unavailable' | 'missing' | 'error'
  table: BrowserTranslationSupportTable | null
  message?: string
}

const browserSupportTableCache = new Map<string, BrowserTranslationSupportTableState>()

export interface BrowserTranslationPrepareInput {
  sourceLanguage?: string
  signal: AbortSignal
  onStatus?: (status: BrowserTranslationStatus) => void
}

export interface TranslationSegment {
  id: string
  sourceStartOffset: number
  sourceEndOffset: number
  sourceKind: MarkdownFactKind
  source: string
  sourcePrefix?: string
  translatorInput: string
  target?: string
  targetNodes?: RootContent[]
  sourceLanguage?: string
  targetLanguage?: string
  status?: 'pending' | 'translated' | 'error'
  error?: string
  kind: 'heading' | 'listItem' | 'paragraph' | 'blockquote' | 'text'
  placeholderTopologyHash?: string
  attributeTopologyHash?: string
  displayPolicyVersion?: number
  placeholderProtocol?: TranslationPlaceholderProtocol
}

export interface DocumentTranslationResult {
  segments: readonly TranslationSegment[]
  displayMode: DocumentTranslationDisplayMode
  sourceLanguage?: string
  targetLanguage?: string
}

export interface DocumentTranslationProgressPatch {
  segmentIndex: number
  segment: TranslationSegment
}

function isFiniteTranslationOffset(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isTranslationSegmentKind(value: unknown): value is TranslationSegment['kind'] {
  return (
    value === 'heading' ||
    value === 'listItem' ||
    value === 'paragraph' ||
    value === 'blockquote' ||
    value === 'text'
  )
}

export function isRenderableTranslationSegment(segment: unknown): segment is TranslationSegment {
  if (typeof segment !== 'object' || segment === null || Array.isArray(segment)) return false

  const id = Reflect.get(segment, 'id')
  const sourceStartOffset = Reflect.get(segment, 'sourceStartOffset')
  const sourceEndOffset = Reflect.get(segment, 'sourceEndOffset')
  const sourceKind = Reflect.get(segment, 'sourceKind')
  const source = Reflect.get(segment, 'source')
  const translatorInput = Reflect.get(segment, 'translatorInput')
  const kind = Reflect.get(segment, 'kind')

  return (
    typeof id === 'string' &&
    isFiniteTranslationOffset(sourceStartOffset) &&
    isFiniteTranslationOffset(sourceEndOffset) &&
    typeof sourceKind === 'string' &&
    typeof source === 'string' &&
    typeof translatorInput === 'string' &&
    isTranslationSegmentKind(kind)
  )
}

interface PendingTranslationJob {
  segmentIndex: number
  segment: TranslationSegment
  sourceLanguage: string
  cacheKey: SegmentCacheKey | null
  protectedInput: { text: string; restore: (output: string) => string }
  estimatedTokens: number
}

interface PackedTranslationBatch {
  jobs: PendingTranslationJob[]
  estimatedTokens: number
}

interface BatchTranslationCollectionResult {
  outputs: Map<number, string>
  errors: Map<number, string>
}

export interface BrowserTranslationCache {
  read(keyHash: string): Promise<TranslationCacheEntry | null>
  write(input: TranslationCacheWriteInput): Promise<{ accepted: boolean } | void>
}

interface TranslationEngineCacheIdentity {
  engineId: TranslationEngineId
  engineVersion?: string
  model?: string
  selectedGroupId?: string
  translatorContractVersion: number
}

export interface TranslationEngineExecution {
  factory: TranslatorFactory
  cacheIdentity: TranslationEngineCacheIdentity
}

export function createBrowserTranslationExecution(): TranslationEngineExecution {
  return {
    factory: createBrowserTranslatorFactory(),
    cacheIdentity: {
      engineId: DEFAULT_TRANSLATION_ENGINE_ID,
      translatorContractVersion: TRANSLATOR_CONTRACT_VERSION,
    },
  }
}

interface BrowserLanguageDetector {
  detect(input: string): Promise<Array<{ detectedLanguage: string; confidence: number }>>
  destroy?: () => void
}

interface BrowserLanguageDetectorFactory {
  availability(): Promise<string>
  create(): Promise<BrowserLanguageDetector>
}

interface WindowWithChromeAi extends Window {
  LanguageDetector?: BrowserLanguageDetectorFactory
}

interface WindowWithTranslator extends Window {
  Translator?: unknown
}

const DEFAULT_SOURCE_LANGUAGE = 'en'
const DOCUMENT_LANGUAGE_CONFIDENCE_THRESHOLD = 0.45
const SEGMENT_LANGUAGE_CONFIDENCE_THRESHOLD = 0.62
const TRANSLATION_DISPLAY_POLICY_VERSION = TRANSLATION_CACHE_POLICY_VERSION
const BROWSER_SOURCE_LANGUAGE_ORDER: ReadonlyMap<TranslationLanguageCode, number> = new Map(
  SUPPORTED_TRANSLATION_LANGUAGES.map((language, index) => [language.code, index] as const)
)
const SUPPORTED_TRANSLATION_LANGUAGE_CODES: ReadonlySet<string> = new Set(
  SUPPORTED_TRANSLATION_LANGUAGES.map((language) => language.code)
)

export function isBrowserTranslationSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!(window as WindowWithChromeAi & WindowWithTranslator).Translator
  )
}

export async function probeBrowserTranslation(
  targetLanguage: string,
  sourceLanguage = DEFAULT_SOURCE_LANGUAGE
): Promise<BrowserTranslationStatus> {
  if (typeof window === 'undefined') {
    return { availability: 'missing', message: 'Browser translation is not available.' }
  }

  return probeBrowserTranslator(targetLanguage, sourceLanguage)
}

export async function prepareBrowserTranslation(
  targetLanguage: string,
  input: BrowserTranslationPrepareInput
): Promise<BrowserTranslationStatus> {
  if (typeof window === 'undefined') {
    return { availability: 'missing', message: 'Browser translation is not available.' }
  }
  return prepareBrowserTranslator(targetLanguage, {
    sourceLanguage: input.sourceLanguage ?? DEFAULT_SOURCE_LANGUAGE,
    signal: input.signal,
    onStatus: input.onStatus,
    win: window,
  })
}

export function getBrowserSupportTableState(
  targetLanguage: string
): BrowserTranslationSupportTableState | null {
  return browserSupportTableCache.get(normalizeBrowserSupportTargetKey(targetLanguage)) ?? null
}

export function setBrowserSupportTableState(
  targetLanguage: string,
  state: BrowserTranslationSupportTableState
): void {
  browserSupportTableCache.set(normalizeBrowserSupportTargetKey(targetLanguage), state)
}

export function patchBrowserSupportTableRow(
  targetLanguage: string,
  row: BrowserTranslationAvailabilityRow,
  options: {
    state?: BrowserTranslationSupportTableState['state']
    message?: string
  } = {}
): BrowserTranslationSupportTableState {
  const targetKey = normalizeBrowserSupportTargetKey(targetLanguage)
  const current = browserSupportTableCache.get(targetKey)
  const table = current?.table ?? {
    targetLanguage: targetKey,
    checked: 0,
    total: 0,
    updatedAt: Date.now(),
    rows: [],
  }
  const nextTable: BrowserTranslationSupportTable = {
    ...table,
    targetLanguage: targetKey,
    updatedAt: Date.now(),
    rows: mergeBrowserSupportRows(table.rows, row),
  }
  const resolved = buildBrowserSupportResolvedState(nextTable)
  const nextState: BrowserTranslationSupportTableState = {
    ...resolved,
    state: options.state ?? resolved.state,
    message: options.message ?? resolved.message,
  }
  browserSupportTableCache.set(targetKey, nextState)
  return nextState
}

export async function scanBrowserTranslationPairs(
  targetLanguage: string,
  options: {
    signal: AbortSignal
    onProgress?: (state: BrowserTranslationSupportTableState) => void
  }
): Promise<BrowserTranslationSupportTableState> {
  if (typeof window === 'undefined') {
    const nextState: BrowserTranslationSupportTableState = {
      state: 'missing',
      table: null,
      message: 'Browser translation is not available.',
    }
    setBrowserSupportTableState(targetLanguage, nextState)
    return nextState
  }
  if (!isBrowserTranslationSupported()) {
    const nextState: BrowserTranslationSupportTableState = {
      state: 'missing',
      table: null,
      message: 'Browser Translator API is not exposed.',
    }
    setBrowserSupportTableState(targetLanguage, nextState)
    return nextState
  }

  const sourceLanguages = SUPPORTED_TRANSLATION_LANGUAGES.map((language) => language.code)
  const targetKey = normalizeBrowserSupportTargetKey(targetLanguage)
  const currentTable = browserSupportTableCache.get(targetKey)?.table

  const checkingState: BrowserTranslationSupportTableState = {
    state: 'checking',
    table: currentTable
      ? {
          ...currentTable,
          targetLanguage: targetKey,
          checked: 0,
          total: sourceLanguages.length,
          updatedAt: Date.now(),
        }
      : {
          targetLanguage: targetKey,
          checked: 0,
          total: sourceLanguages.length,
          updatedAt: Date.now(),
          rows: [],
        },
    message: buildBrowserSupportCheckingMessage(0, sourceLanguages.length),
  }
  browserSupportTableCache.set(targetKey, checkingState)
  options.onProgress?.(checkingState)

  try {
    const table = await scanBrowserTranslationSupportTable({
      sourceLanguages,
      targetLanguage: targetKey,
      signal: options.signal,
      win: window,
      onRow: (row) => {
        const current = browserSupportTableCache.get(targetKey)?.table
        const nextState: BrowserTranslationSupportTableState = {
          state: 'checking',
          table: current
            ? {
                ...current,
                updatedAt: Date.now(),
                rows: mergeBrowserSupportRows(current.rows, row),
              }
            : {
                targetLanguage: targetKey,
                checked: 0,
                total: sourceLanguages.length,
                updatedAt: Date.now(),
                rows: mergeBrowserSupportRows([], row),
              },
          message: buildBrowserSupportCheckingMessage(
            current?.checked ?? 0,
            current?.total ?? sourceLanguages.length
          ),
        }
        browserSupportTableCache.set(targetKey, nextState)
        options.onProgress?.(nextState)
      },
      onProgress: ({ checked, total }) => {
        const current = browserSupportTableCache.get(targetKey)?.table
        const nextState: BrowserTranslationSupportTableState = {
          state: 'checking',
          table: current
            ? {
                ...current,
                checked,
                total,
              }
            : {
                targetLanguage: targetKey,
                checked,
                total,
                updatedAt: Date.now(),
                rows: [],
              },
          message: buildBrowserSupportCheckingMessage(checked, total),
        }
        browserSupportTableCache.set(targetKey, nextState)
        options.onProgress?.(nextState)
      },
    })
    const nextState = buildBrowserSupportResolvedState({
      ...table,
      targetLanguage: targetKey,
      rows: sortBrowserSupportRows(table.rows),
    })
    browserSupportTableCache.set(targetKey, nextState)
    return nextState
  } catch (error) {
    if (options.signal.aborted) {
      const cached = browserSupportTableCache.get(targetKey)
      return (
        cached ?? {
          state: 'idle',
          table: null,
        }
      )
    }
    const nextState: BrowserTranslationSupportTableState = {
      state: 'error',
      table: null,
      message:
        error instanceof Error ? error.message : 'Unable to check browser translation pairs.',
    }
    browserSupportTableCache.set(targetKey, nextState)
    return nextState
  }
}

function normalizeBrowserSupportTargetKey(targetLanguage: string): string {
  return targetLanguage.trim()
}

function buildBrowserSupportCheckingMessage(checked: number, total: number): string {
  return total > 0
    ? `Checking browser translation pairs… ${checked}/${total}`
    : 'Checking browser translation pairs…'
}

function buildBrowserSupportResolvedState(
  table: BrowserTranslationSupportTable
): BrowserTranslationSupportTableState {
  const actionableRows = sortBrowserSupportRows(
    table.rows.filter(
      (row) =>
        row.availability === 'available' ||
        row.availability === 'downloading' ||
        row.availability === 'downloadable'
    )
  )
  if (actionableRows.length === 0) {
    const hasErrors = table.rows.some((row) => row.availability === 'error')
    if (hasErrors) {
      return {
        state: 'error',
        table: {
          ...table,
          rows: [],
        },
        message: 'Unable to resolve browser translation pairs.',
      }
    }
    return {
      state: 'unavailable',
      table: {
        ...table,
        rows: [],
      },
      message: 'No browser translation pairs are available for this target language.',
    }
  }
  const nextTable = {
    ...table,
    rows: actionableRows,
  }
  return {
    state: 'ready',
    table: nextTable,
    message: buildBrowserSupportReadyMessage(nextTable),
  }
}

function buildBrowserSupportReadyMessage(table: BrowserTranslationSupportTable): string {
  const counts = {
    available: 0,
    downloading: 0,
    downloadable: 0,
    error: 0,
  }
  for (const row of table.rows) {
    switch (row.availability) {
      case 'available':
        counts.available += 1
        break
      case 'downloading':
        counts.downloading += 1
        break
      case 'downloadable':
        counts.downloadable += 1
        break
      case 'error':
        counts.error += 1
        break
    }
  }
  const parts = [
    counts.available > 0 ? `${counts.available} ready` : null,
    counts.downloading > 0 ? `${counts.downloading} downloading` : null,
    counts.downloadable > 0 ? `${counts.downloadable} downloadable` : null,
    counts.error > 0 ? `${counts.error} error` : null,
  ].filter((part): part is string => part !== null)
  return parts.length > 0
    ? `Browser translation pairs: ${parts.join(' · ')}.`
    : 'Browser translation pairs are ready.'
}

function mergeBrowserSupportRows(
  rows: readonly BrowserTranslationAvailabilityRow[],
  row: BrowserTranslationAvailabilityRow
): BrowserTranslationAvailabilityRow[] {
  const normalizedRow: BrowserTranslationAvailabilityRow = {
    ...row,
    progress: row.availability === 'downloading' ? row.progress : undefined,
  }
  const nextRows = rows.filter(
    (candidate) =>
      candidate.sourceLanguage !== normalizedRow.sourceLanguage ||
      candidate.targetLanguage !== normalizedRow.targetLanguage
  )
  if (normalizedRow.availability !== 'unavailable' && normalizedRow.availability !== 'missing') {
    nextRows.push(normalizedRow)
  }
  return sortBrowserSupportRows(nextRows)
}

function sortBrowserSupportRows(
  rows: readonly BrowserTranslationAvailabilityRow[]
): BrowserTranslationAvailabilityRow[] {
  return [...rows].sort((left, right) => {
    const leftOrder = getBrowserSourceLanguageOrder(left.sourceLanguage) ?? Number.MAX_SAFE_INTEGER
    const rightOrder =
      getBrowserSourceLanguageOrder(right.sourceLanguage) ?? Number.MAX_SAFE_INTEGER
    if (leftOrder !== rightOrder) return leftOrder - rightOrder
    const targetDelta = left.targetLanguage.localeCompare(right.targetLanguage)
    if (targetDelta !== 0) return targetDelta
    return left.sourceLanguage.localeCompare(right.sourceLanguage)
  })
}

function getBrowserSourceLanguageOrder(sourceLanguage: string): number | undefined {
  return isSupportedTranslationLanguageCode(sourceLanguage)
    ? BROWSER_SOURCE_LANGUAGE_ORDER.get(sourceLanguage)
    : undefined
}

function isSupportedTranslationLanguageCode(language: string): language is TranslationLanguageCode {
  return SUPPORTED_TRANSLATION_LANGUAGE_CODES.has(language)
}

export async function translateMarkdownDocument(args: {
  markdown: string
  targetLanguage: string
  displayMode: DocumentTranslationDisplayMode
  signal: AbortSignal
  timeoutMs?: number
  cache?: BrowserTranslationCache
  engine?: TranslationEngineExecution
}): Promise<DocumentTranslationResult> {
  const translatedSegments: TranslationSegment[] = []
  return translateMarkdownDocumentProgressively(args, ({ segmentIndex, segment }) => {
    translatedSegments[segmentIndex] = segment
  }).then((result) => ({
    ...result,
    segments: normalizeTranslationSegments(
      translatedSegments.length > 0 ? translatedSegments : result.segments
    ),
  }))
}

export async function translateMarkdownDocumentProgressively(
  args: {
    markdown: string
    targetLanguage: string
    displayMode: DocumentTranslationDisplayMode
    signal: AbortSignal
    timeoutMs?: number
    cache?: BrowserTranslationCache
    engine?: TranslationEngineExecution
  },
  onPatch: (patch: DocumentTranslationProgressPatch) => void
): Promise<DocumentTranslationResult> {
  const segments = extractTranslatableSegments(args.markdown)
  if (segments.length === 0) {
    return {
      segments: [],
      displayMode: args.displayMode,
      targetLanguage: args.targetLanguage,
    }
  }

  const engine = args.engine ?? createBrowserTranslationExecution()
  const languageDetection = await createSourceLanguageDetectionSession(args.markdown, args.signal)
  const translatedSegments: TranslationSegment[] = [...segments]
  const pendingJobsBySourceLanguage = new Map<string, PendingTranslationJob[]>()

  try {
    for (const [segmentIndex, segment] of segments.entries()) {
      throwIfAborted(args.signal)
      const sourceLanguage = await languageDetection.detectSegmentLanguage(
        segment.translatorInput,
        args.signal
      )
      throwIfAborted(args.signal)

      try {
        if (areEquivalentTranslationLanguages(sourceLanguage, args.targetLanguage)) {
          const translatedSegment = {
            ...segment,
            target: segment.source,
            sourceLanguage,
            targetLanguage: args.targetLanguage,
            status: 'translated' as const,
          }
          translatedSegments[segmentIndex] = translatedSegment
          onPatch({ segmentIndex, segment: translatedSegment })
          continue
        }

        const cacheKey = createSegmentCacheKey(
          segment,
          sourceLanguage,
          args.targetLanguage,
          engine.cacheIdentity
        )
        const cachedSegment = cacheKey
          ? await readCachedTranslationSegment(args.cache, cacheKey, segment, {
              sourceLanguage,
              targetLanguage: args.targetLanguage,
            })
          : null
        if (cachedSegment) {
          translatedSegments[segmentIndex] = cachedSegment
          onPatch({ segmentIndex, segment: cachedSegment })
          continue
        }

        const protectedInput = segment.placeholderProtocol
          ? { text: segment.translatorInput, restore: (output: string) => output }
          : protectTranslatorInput(segment.translatorInput)
        const pendingJob: PendingTranslationJob = {
          segmentIndex,
          segment,
          sourceLanguage,
          cacheKey,
          protectedInput,
          estimatedTokens: estimateTranslationTokens(segment.translatorInput),
        }
        const pendingJobs = pendingJobsBySourceLanguage.get(sourceLanguage) ?? []
        pendingJobs.push(pendingJob)
        pendingJobsBySourceLanguage.set(sourceLanguage, pendingJobs)
      } catch (error) {
        if (args.signal.aborted) throw error
        const failedSegment = {
          ...segment,
          sourceLanguage,
          targetLanguage: args.targetLanguage,
          status: 'error' as const,
          error: getErrorMessage(error),
        }
        translatedSegments[segmentIndex] = failedSegment
        onPatch({ segmentIndex, segment: failedSegment })
      }
    }

    await Promise.all(
      [...pendingJobsBySourceLanguage.entries()].map(([sourceLanguage, jobs]) =>
        translatePendingJobsBySourceLanguage({
          engine,
          sourceLanguage,
          targetLanguage: args.targetLanguage,
          signal: args.signal,
          timeoutMs: args.timeoutMs,
          cache: args.cache,
          jobs,
          translatedSegments,
          onPatch,
        })
      )
    )

    return {
      segments: normalizeTranslationSegments(translatedSegments),
      displayMode: args.displayMode,
      sourceLanguage: languageDetection.documentLanguage,
      targetLanguage: args.targetLanguage,
    }
  } finally {
    languageDetection.destroy()
  }
}

async function translatePendingJobsBySourceLanguage(input: {
  engine: TranslationEngineExecution
  sourceLanguage: string
  targetLanguage: string
  signal: AbortSignal
  timeoutMs?: number
  cache?: BrowserTranslationCache
  jobs: PendingTranslationJob[]
  translatedSegments: TranslationSegment[]
  onPatch: (patch: DocumentTranslationProgressPatch) => void
}): Promise<void> {
  const markJobsError = (jobs: readonly PendingTranslationJob[], message: string): void => {
    for (const job of jobs) {
      const failedSegment = {
        ...job.segment,
        sourceLanguage: job.sourceLanguage,
        targetLanguage: input.targetLanguage,
        status: 'error' as const,
        error: message,
      }
      input.translatedSegments[job.segmentIndex] = failedSegment
      input.onPatch({ segmentIndex: job.segmentIndex, segment: failedSegment })
    }
  }
  const unsupportedLanguagePairMessage = getUnsupportedEngineLanguagePairMessage({
    engine: input.engine,
    sourceLanguage: input.sourceLanguage,
    targetLanguage: input.targetLanguage,
  })
  if (unsupportedLanguagePairMessage) {
    markJobsError(input.jobs, unsupportedLanguagePairMessage)
    return
  }

  const batches = packTranslationJobs(input.jobs)
  if (batches.length === 0) return

  const maxConcurrency = Math.min(6, batches.length)
  const scopeKey = createTranslationAdaptiveConcurrencyScopeKey({
    engineId: input.engine.cacheIdentity.engineId,
    engineVersion: input.engine.cacheIdentity.engineVersion,
    model: input.engine.cacheIdentity.model,
    selectedGroupId: input.engine.cacheIdentity.selectedGroupId,
    sourceLanguage: input.sourceLanguage,
    targetLanguage: input.targetLanguage,
    translatorContractVersion: input.engine.cacheIdentity.translatorContractVersion,
  })
  let desiredConcurrency = 1
  let nextBatchIndex = 0
  let activeWorkers = 0
  let completedBatches = 0
  const workerPromises = new Set<Promise<void>>()

  const startWorkersToDesired = () => {
    while (
      activeWorkers < desiredConcurrency &&
      nextBatchIndex < batches.length &&
      !input.signal.aborted
    ) {
      startWorker()
    }
  }

  const maybeGrowConcurrency = () => {
    if (desiredConcurrency >= maxConcurrency) return
    const recentLogs = readRecentTranslationAdaptiveConcurrencyLogs({
      scopeKey,
      limit: Math.max(4, desiredConcurrency * 2),
    })
    if (desiredConcurrency === 1) {
      if (completedBatches >= 1 && batches.length > 1 && recentLogs.length > 0) {
        desiredConcurrency = 2
        startWorkersToDesired()
      }
      return
    }
    if (completedBatches < desiredConcurrency) return
    if (recentLogs.length < desiredConcurrency * 2) return
    const window = recentLogs.slice(-desiredConcurrency * 2)
    const split = Math.max(1, Math.floor(window.length / 2))
    const earlierThroughput = summarizeTranslationLogThroughput(window.slice(0, split))
    const laterThroughput = summarizeTranslationLogThroughput(window.slice(split))
    if (earlierThroughput > 0 && laterThroughput >= earlierThroughput * 1.08) {
      desiredConcurrency = Math.min(maxConcurrency, desiredConcurrency + 1)
      startWorkersToDesired()
    }
  }

  const applyBatchResult = async (
    batch: PackedTranslationBatch,
    result: BatchTranslationCollectionResult
  ): Promise<void> => {
    for (const [offset, job] of batch.jobs.entries()) {
      const error = result.errors.get(offset)
      if (error) {
        const failedSegment = {
          ...job.segment,
          sourceLanguage: job.sourceLanguage,
          targetLanguage: input.targetLanguage,
          status: 'error' as const,
          error,
        }
        input.translatedSegments[job.segmentIndex] = failedSegment
        input.onPatch({ segmentIndex: job.segmentIndex, segment: failedSegment })
        continue
      }

      const target = result.outputs.get(offset) ?? ''
      const restoredTarget = job.segment.placeholderProtocol
        ? restoreTranslatedPlaceholderFragment(target, job.segment.placeholderProtocol)
        : { target: job.protectedInput.restore(target).trim() }
      const translatedSegment = {
        ...job.segment,
        ...restoredTarget,
        sourceLanguage: job.sourceLanguage,
        targetLanguage: input.targetLanguage,
        status: 'translated' as const,
      }
      input.translatedSegments[job.segmentIndex] = translatedSegment
      if (job.cacheKey) {
        void writeCachedTranslationSegment(input.cache, job.cacheKey, translatedSegment)
      }
      input.onPatch({ segmentIndex: job.segmentIndex, segment: translatedSegment })
    }
  }

  const markBatchError = (batch: PackedTranslationBatch, error: unknown): void => {
    markJobsError(batch.jobs, getErrorMessage(error))
  }

  const startWorker = () => {
    if (input.signal.aborted || nextBatchIndex >= batches.length) return

    activeWorkers += 1
    let workerPromise: Promise<void>
    workerPromise = (async () => {
      let translator: Translator | null = null
      try {
        translator = await input.engine.factory.create({
          sourceLanguage: input.sourceLanguage,
          targetLanguage: input.targetLanguage,
          signal: input.signal,
        })
        while (!input.signal.aborted) {
          const batchIndex = nextBatchIndex
          if (batchIndex >= batches.length) break
          nextBatchIndex += 1
          const batch = batches[batchIndex]
          const startedAt = getCurrentTimeMs()
          try {
            const outputs = await collectBatchTranslationOutputs(
              translator.batchTranslate(
                batch.jobs.map((job) => job.protectedInput.text),
                {
                  signal: input.signal,
                  timeoutMs: input.timeoutMs ?? DEFAULT_BATCH_TRANSLATION_TIMEOUT_MS,
                }
              ),
              batch.jobs.length
            )
            await applyBatchResult(batch, outputs)
            completedBatches += 1
            const elapsedMs = Math.max(1, getCurrentTimeMs() - startedAt)
            appendTranslationAdaptiveConcurrencyLog({
              scopeKey,
              recordedAt: Date.now(),
              engineId: input.engine.cacheIdentity.engineId,
              engineVersion: input.engine.cacheIdentity.engineVersion,
              model: input.engine.cacheIdentity.model,
              selectedGroupId: input.engine.cacheIdentity.selectedGroupId,
              sourceLanguage: input.sourceLanguage,
              targetLanguage: input.targetLanguage,
              batchIndex,
              batchSize: batch.jobs.length,
              estimatedTokens: batch.estimatedTokens,
              elapsedMs,
              throughputTokensPerMs: batch.estimatedTokens / elapsedMs,
              desiredConcurrency,
              activeWorkers,
              maxConcurrency,
            })
            maybeGrowConcurrency()
          } catch (error) {
            if (input.signal.aborted) throw error
            markBatchError(batch, error)
          }
        }
      } finally {
        translator?.destroy?.()
      }
    })().finally(() => {
      activeWorkers -= 1
      workerPromises.delete(workerPromise)
      startWorkersToDesired()
    })

    workerPromises.add(workerPromise)
  }

  startWorkersToDesired()
  while (workerPromises.size > 0) {
    await Promise.race(workerPromises)
  }
}

export async function retryTranslationSegment(input: {
  segment: TranslationSegment
  sourceLanguage?: string
  targetLanguage: string
  signal: AbortSignal
  timeoutMs?: number
  cache?: BrowserTranslationCache
  engine?: TranslationEngineExecution
}): Promise<TranslationSegment> {
  const engine = input.engine ?? createBrowserTranslationExecution()
  const sourceLanguage =
    input.sourceLanguage ?? input.segment.sourceLanguage ?? DEFAULT_SOURCE_LANGUAGE

  if (areEquivalentTranslationLanguages(sourceLanguage, input.targetLanguage)) {
    return {
      ...input.segment,
      target: input.segment.source,
      sourceLanguage,
      targetLanguage: input.targetLanguage,
      status: 'translated',
      error: undefined,
    }
  }

  const unsupportedLanguagePairMessage = getUnsupportedEngineLanguagePairMessage({
    engine,
    sourceLanguage,
    targetLanguage: input.targetLanguage,
  })
  if (unsupportedLanguagePairMessage) {
    return {
      ...input.segment,
      sourceLanguage,
      targetLanguage: input.targetLanguage,
      status: 'error',
      error: unsupportedLanguagePairMessage,
    }
  }

  const cacheKey = createSegmentCacheKey(
    input.segment,
    sourceLanguage,
    input.targetLanguage,
    engine.cacheIdentity
  )
  const cachedSegment = cacheKey
    ? await readCachedTranslationSegment(input.cache, cacheKey, input.segment, {
        sourceLanguage,
        targetLanguage: input.targetLanguage,
      })
    : null
  if (cachedSegment) return cachedSegment

  const protectedInput = input.segment.placeholderProtocol
    ? { text: input.segment.translatorInput, restore: (output: string) => output }
    : protectTranslatorInput(input.segment.translatorInput)

  let translator: Translator | null = null
  try {
    translator = await engine.factory.create({
      sourceLanguage,
      targetLanguage: input.targetLanguage,
      signal: input.signal,
    })
    const result = await collectBatchTranslationOutputs(
      translator.batchTranslate([protectedInput.text], {
        signal: input.signal,
        timeoutMs: input.timeoutMs ?? DEFAULT_BATCH_TRANSLATION_TIMEOUT_MS,
      }),
      1
    )
    const error = result.errors.get(0)
    if (error) {
      return {
        ...input.segment,
        sourceLanguage,
        targetLanguage: input.targetLanguage,
        status: 'error',
        error,
      }
    }

    const target = result.outputs.get(0) ?? ''
    const restoredTarget = input.segment.placeholderProtocol
      ? restoreTranslatedPlaceholderFragment(target, input.segment.placeholderProtocol)
      : { target: protectedInput.restore(target).trim() }
    const translatedSegment: TranslationSegment = {
      ...input.segment,
      ...restoredTarget,
      sourceLanguage,
      targetLanguage: input.targetLanguage,
      status: 'translated',
      error: undefined,
    }
    if (cacheKey) {
      void writeCachedTranslationSegment(input.cache, cacheKey, translatedSegment)
    }
    return translatedSegment
  } catch (error) {
    if (input.signal.aborted) throw error
    return {
      ...input.segment,
      sourceLanguage,
      targetLanguage: input.targetLanguage,
      status: 'error',
      error: getErrorMessage(error),
    }
  } finally {
    translator?.destroy?.()
  }
}

function getUnsupportedEngineLanguagePairMessage(input: {
  engine: TranslationEngineExecution
  sourceLanguage: string
  targetLanguage: string
}): string | null {
  if (!isDirectionalManagedLocalTranslationEngineId(input.engine.cacheIdentity.engineId)) {
    return null
  }
  const directionCheck = checkLocalDirectionalModelLanguagePair({
    model: input.engine.cacheIdentity.model,
    sourceLanguage: input.sourceLanguage,
    targetLanguage: input.targetLanguage,
  })
  if (directionCheck.supported) return null
  return (
    directionCheck.message ??
    'Selected local model does not support the detected translation direction.'
  )
}

export function normalizeTranslationSegments(
  segments: readonly TranslationSegment[]
): TranslationSegment[] {
  return segments.filter(isRenderableTranslationSegment)
}

function summarizeTranslationLogThroughput(
  logs: readonly {
    estimatedTokens: number
    elapsedMs: number
  }[]
): number {
  if (logs.length === 0) return 0
  const totalTokens = logs.reduce((total, log) => total + log.estimatedTokens, 0)
  const totalElapsedMs = logs.reduce((total, log) => total + log.elapsedMs, 0)
  if (totalTokens <= 0 || totalElapsedMs <= 0) return 0
  return totalTokens / totalElapsedMs
}

function packTranslationJobs(jobs: readonly PendingTranslationJob[]): PackedTranslationBatch[] {
  if (jobs.length === 0) return []

  const averageTokens =
    jobs.reduce((total, job) => total + job.estimatedTokens, 0) / Math.max(1, jobs.length)
  const targetTokens = Math.max(1, Math.round(averageTokens * 6))
  const batches: PackedTranslationBatch[] = []
  let currentJobs: PendingTranslationJob[] = []
  let currentTokens = 0

  const flush = () => {
    if (currentJobs.length === 0) return
    batches.push({ jobs: currentJobs, estimatedTokens: currentTokens })
    currentJobs = []
    currentTokens = 0
  }

  for (const job of jobs) {
    if (currentJobs.length === 0) {
      currentJobs = [job]
      currentTokens = job.estimatedTokens
      continue
    }

    const nextTokens = currentTokens + job.estimatedTokens
    if (nextTokens <= targetTokens) {
      currentJobs.push(job)
      currentTokens = nextTokens
      continue
    }

    const withoutDelta = Math.abs(currentTokens - targetTokens)
    const withDelta = Math.abs(nextTokens - targetTokens)
    if (withDelta <= withoutDelta) {
      currentJobs.push(job)
      currentTokens = nextTokens
      flush()
      continue
    }

    flush()
    currentJobs = [job]
    currentTokens = job.estimatedTokens
  }

  flush()
  return batches
}

async function collectBatchTranslationOutputs(
  stream: AsyncGenerator<BatchTranslationResult>,
  expectedCount: number
): Promise<BatchTranslationCollectionResult> {
  const outputs = new Map<number, string>()
  const errors = new Map<number, string>()

  for await (const item of stream) {
    if (item.index < 0 || item.index >= expectedCount) {
      throw new Error(`Translator yielded output for unexpected index ${item.index}.`)
    }
    if (item.output !== undefined && !outputs.has(item.index)) {
      outputs.set(item.index, item.output)
    }
    if (item.error && !errors.has(item.index)) {
      errors.set(item.index, item.error.message)
    }
  }

  if (outputs.size + errors.size !== expectedCount) {
    throw new Error(
      `Translator returned ${outputs.size + errors.size} results for ${expectedCount} inputs.`
    )
  }

  return { outputs, errors }
}

function estimateTranslationTokens(input: string): number {
  const trimmed = input.trim()
  if (!trimmed) return 1

  const segmenter = getTokenSegmenter()
  if (!segmenter) {
    return Math.max(1, trimmed.split(/\s+/).filter(Boolean).length)
  }

  let count = 0
  for (const segment of segmenter.segment(trimmed)) {
    if (segment.isWordLike ?? segment.segment.trim().length > 0) {
      count += 1
    }
  }
  return Math.max(1, count)
}

function getTokenSegmenter(): Intl.Segmenter | null {
  if (typeof Intl === 'undefined' || typeof Intl.Segmenter !== 'function') return null
  try {
    return new Intl.Segmenter(undefined, { granularity: 'word' })
  } catch {
    return null
  }
}

function getCurrentTimeMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
}

interface SourceLanguageDetectionSession {
  documentLanguage: string
  detectSegmentLanguage(input: string, signal: AbortSignal): Promise<string>
  destroy(): void
}

async function createSourceLanguageDetectionSession(
  markdown: string,
  signal: AbortSignal
): Promise<SourceLanguageDetectionSession> {
  const detectorFactory = (window as WindowWithChromeAi).LanguageDetector
  if (!detectorFactory) return createFallbackLanguageDetectionSession(DEFAULT_SOURCE_LANGUAGE)

  try {
    const availability = normalizeAvailability(await detectorFactory.availability())
    if (availability !== 'available') {
      return createFallbackLanguageDetectionSession(DEFAULT_SOURCE_LANGUAGE)
    }

    throwIfAborted(signal)
    const detector = await raceAbort(detectorFactory.create(), signal, (createdDetector) =>
      createdDetector.destroy?.()
    )
    const sample = createLanguageDetectionSample(markdown)
    const results = sample ? await raceAbort(detector.detect(sample), signal) : []
    const documentLanguage =
      selectDetectedLanguage(results, DOCUMENT_LANGUAGE_CONFIDENCE_THRESHOLD) ??
      DEFAULT_SOURCE_LANGUAGE
    const segmentLanguageCache = new Map<string, string>()

    return {
      documentLanguage,
      async detectSegmentLanguage(input, segmentSignal) {
        const segmentSample = createLanguageDetectionInput(input)
        if (!segmentSample) return documentLanguage

        const cached = segmentLanguageCache.get(segmentSample)
        if (cached) return cached

        try {
          const segmentResults = await raceAbort(detector.detect(segmentSample), segmentSignal)
          const segmentLanguage =
            selectDetectedLanguage(segmentResults, SEGMENT_LANGUAGE_CONFIDENCE_THRESHOLD) ??
            documentLanguage
          segmentLanguageCache.set(segmentSample, segmentLanguage)
          return segmentLanguage
        } catch (error) {
          if (segmentSignal.aborted) throw error
          return documentLanguage
        }
      },
      destroy() {
        detector.destroy?.()
      },
    }
  } catch {
    return createFallbackLanguageDetectionSession(DEFAULT_SOURCE_LANGUAGE)
  }
}

function createFallbackLanguageDetectionSession(
  documentLanguage: string
): SourceLanguageDetectionSession {
  return {
    documentLanguage,
    async detectSegmentLanguage() {
      return documentLanguage
    },
    destroy() {
      return undefined
    },
  }
}

function createLanguageDetectionSample(markdown: string): string {
  return createLanguageDetectionInput(markdown.replace(/```[\s\S]*?```/g, '')).slice(0, 4000)
}

function createLanguageDetectionInput(input: string): string {
  return input
    .replace(/`[^`]+`/g, ' ')
    .replace(/<\/?[A-Za-z][A-Za-z0-9:-]*(?:\s+[^<>\n]*?)?\s*\/?>/g, ' ')
    .replace(/https?:\/\/[^\s)]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function selectDetectedLanguage(
  results: Array<{ detectedLanguage: string; confidence: number }>,
  confidenceThreshold: number
): string | undefined {
  return results
    .filter((result) => result.confidence >= confidenceThreshold)
    .sort((left, right) => right.confidence - left.confidence)[0]?.detectedLanguage
}

function areEquivalentTranslationLanguages(
  sourceLanguage: string,
  targetLanguage: string
): boolean {
  const source = normalizeLanguageTag(sourceLanguage)
  const target = normalizeLanguageTag(targetLanguage)
  if (!source || !target) return false
  if (source === target) return true

  const sourcePrimary = source.split('-')[0]
  const targetPrimary = target.split('-')[0]
  return sourcePrimary === targetPrimary
}

function normalizeLanguageTag(language: string): string {
  return language.trim().toLowerCase()
}

interface SegmentCacheKey {
  key: string
  keyHash: string
  placeholderTopologyHash: string
  attributeTopologyHash: string
  displayPolicyVersion: number
  engineId: TranslationEngineId
  engineVersion?: string
  model?: string
  selectedGroupId?: string
  translatorContractVersion: number
}

function createSegmentCacheKey(
  segment: TranslationSegment,
  sourceLanguage: string,
  targetLanguage: string,
  engine: TranslationEngineCacheIdentity
): SegmentCacheKey | null {
  const placeholderTopologyHash = segment.placeholderTopologyHash
  const attributeTopologyHash = segment.attributeTopologyHash
  const displayPolicyVersion = segment.displayPolicyVersion ?? TRANSLATION_CACHE_POLICY_VERSION
  if (!placeholderTopologyHash || !attributeTopologyHash) return null

  const key = stableJsonStringify({
    sourceText: segment.source,
    translatorInput: segment.translatorInput,
    sourceLanguage,
    targetLanguage,
    placeholderTopologyHash,
    attributeTopologyHash,
    displayPolicyVersion,
    engineId: engine.engineId,
    engineVersion: engine.engineVersion,
    model: engine.model,
    selectedGroupId: engine.selectedGroupId,
    translatorContractVersion: engine.translatorContractVersion,
  })

  return {
    key,
    keyHash: hashString(key),
    placeholderTopologyHash,
    attributeTopologyHash,
    displayPolicyVersion,
    engineId: engine.engineId,
    engineVersion: engine.engineVersion,
    model: engine.model,
    selectedGroupId: engine.selectedGroupId,
    translatorContractVersion: engine.translatorContractVersion,
  }
}

async function readCachedTranslationSegment(
  cache: BrowserTranslationCache | undefined,
  cacheKey: SegmentCacheKey,
  segment: TranslationSegment,
  languages: { sourceLanguage: string; targetLanguage: string }
): Promise<TranslationSegment | null> {
  if (!cache) return null

  try {
    const entry = await cache.read(cacheKey.keyHash)
    if (!entry || !isCacheEntryForSegment(entry, cacheKey, segment, languages)) return null
    return {
      ...segment,
      target: entry.translatedText,
      ...(entry.targetNodesJson
        ? { targetNodes: parseCachedTargetNodes(entry.targetNodesJson) }
        : {}),
      sourceLanguage: languages.sourceLanguage,
      targetLanguage: languages.targetLanguage,
      status: 'translated',
    }
  } catch {
    return null
  }
}

async function writeCachedTranslationSegment(
  cache: BrowserTranslationCache | undefined,
  cacheKey: SegmentCacheKey,
  segment: TranslationSegment
): Promise<void> {
  if (!cache || !segment.target || !segment.sourceLanguage || !segment.targetLanguage) return

  try {
    await cache.write({
      key: cacheKey.key,
      keyHash: cacheKey.keyHash,
      sourceText: segment.source,
      translatedText: segment.target,
      ...(segment.targetNodes ? { targetNodesJson: JSON.stringify(segment.targetNodes) } : {}),
      sourceLanguage: segment.sourceLanguage,
      targetLanguage: segment.targetLanguage,
      placeholderTopologyHash: cacheKey.placeholderTopologyHash,
      attributeTopologyHash: cacheKey.attributeTopologyHash,
      displayPolicyVersion: cacheKey.displayPolicyVersion,
      engineId: cacheKey.engineId,
      engineVersion: cacheKey.engineVersion,
      model: cacheKey.model,
      translatorContractVersion: cacheKey.translatorContractVersion,
    })
  } catch {
    // Cache writes are non-critical projection acceleration.
  }
}

function isCacheEntryForSegment(
  entry: TranslationCacheEntry,
  cacheKey: SegmentCacheKey,
  segment: TranslationSegment,
  languages: { sourceLanguage: string; targetLanguage: string }
): boolean {
  return (
    entry.key === cacheKey.key &&
    entry.keyHash === cacheKey.keyHash &&
    entry.sourceText === segment.source &&
    entry.sourceLanguage === languages.sourceLanguage &&
    entry.targetLanguage === languages.targetLanguage &&
    entry.placeholderTopologyHash === cacheKey.placeholderTopologyHash &&
    entry.attributeTopologyHash === cacheKey.attributeTopologyHash &&
    entry.displayPolicyVersion === cacheKey.displayPolicyVersion &&
    entry.engineId === cacheKey.engineId &&
    entry.engineVersion === cacheKey.engineVersion &&
    entry.model === cacheKey.model &&
    entry.translatorContractVersion === cacheKey.translatorContractVersion
  )
}

function parseCachedTargetNodes(value: string): RootContent[] | undefined {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter(isRootContent) : undefined
  } catch {
    return undefined
  }
}

function isRootContent(value: unknown): value is RootContent {
  if (!value || typeof value !== 'object') return false
  const type = (value as { type?: unknown }).type
  return type === 'text' || type === 'element' || type === 'comment'
}

export function extractHastTranslatableSegments(markdown: string): TranslationSegment[] {
  try {
    const tree = parseMarkdownToHast(markdown)
    const segments: TranslationSegment[] = []
    collectHastTranslatableSegments(tree.children, segments)
    return segments
  } catch {
    return []
  }
}

function parseMarkdownToHast(markdown: string): Root {
  const processor = unified().use(remarkParse).use(remarkGfm).use(remarkRehype)
  return processor.runSync(processor.parse(markdown)) as Root
}

function collectHastTranslatableSegments(
  nodes: readonly RootContent[],
  segments: TranslationSegment[]
): void {
  for (const node of nodes) {
    if (!isElement(node)) continue

    if (isTranslatableBlockOwner(node)) {
      const sourceNodes = getTranslatableBlockChildren(node)
      const protocol = createTranslationPlaceholderProtocol(sourceNodes)
      const source = getTranslationSourceText(sourceNodes)
      if (source) {
        const sourceStartOffset = getNodeStartOffset(node) ?? segments.length
        const sourceEndOffset = getNodeEndOffset(node) ?? sourceStartOffset + source.length
        segments.push({
          id: `hast-${sourceStartOffset}-${segments.length}`,
          sourceStartOffset,
          sourceEndOffset,
          sourceKind: toMarkdownFactKindFromHast(node.tagName),
          source,
          translatorInput: protocol.translatorInput,
          kind: toTranslationSegmentKindFromHast(node.tagName),
          placeholderProtocol: protocol,
          placeholderTopologyHash: hashStableJson(
            protocol.placeholders.map((placeholder) => ({
              id: placeholder.id,
              tagName: placeholder.tagName,
              displayPolicy: placeholder.displayPolicy,
              children: placeholder.sourceChildren.length,
            }))
          ),
          attributeTopologyHash: hashStableJson(
            protocol.placeholders.flatMap((placeholder) =>
              placeholder.translatableAttributes.map((attribute) => ({
                placeholderId: placeholder.id,
                id: attribute.id,
                propertyName: attribute.propertyName,
              }))
            )
          ),
          displayPolicyVersion: TRANSLATION_DISPLAY_POLICY_VERSION,
        })
      }
    }

    collectHastTranslatableSegments(node.children, segments)
  }
}

function isTranslatableBlockOwner(node: Element): boolean {
  return (
    /^h[1-6]$/.test(node.tagName) ||
    node.tagName === 'p' ||
    node.tagName === 'li' ||
    node.tagName === 'blockquote' ||
    node.tagName === 'td' ||
    node.tagName === 'th'
  )
}

function toMarkdownFactKindFromHast(tagName: string): MarkdownFactKind {
  if (/^h[1-6]$/.test(tagName)) return 'heading'
  if (tagName === 'li') return 'listItem'
  if (tagName === 'blockquote') return 'blockquote'
  if (tagName === 'td' || tagName === 'th') return 'tableCell'
  return 'paragraph'
}

function toTranslationSegmentKindFromHast(tagName: string): TranslationSegment['kind'] {
  if (/^h[1-6]$/.test(tagName)) return 'heading'
  if (tagName === 'li') return 'listItem'
  if (tagName === 'blockquote') return 'blockquote'
  return 'paragraph'
}

function isElement(node: RootContent): node is Element {
  return node.type === 'element'
}

function getNodeStartOffset(node: Element): number | undefined {
  return node.position?.start.offset
}

function getNodeEndOffset(node: Element): number | undefined {
  return node.position?.end.offset
}

function hashStableJson(value: unknown): string {
  return hashString(JSON.stringify(value))
}

function stableJsonStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJsonStringify).join(',')}]`
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableJsonStringify(entryValue)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function hashString(value: string): string {
  let hash = 0
  for (let index = 0; index < value.length; index++) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0
  }
  return hash.toString(36)
}

export function extractTranslatableSegments(markdown: string): TranslationSegment[] {
  const hastSegments = extractHastTranslatableSegments(markdown)
  if (hastSegments.length > 0) return hastSegments

  try {
    const document = parseMarkdownFacts(markdown)
    const factById = new Map(document.facts.map((fact) => [fact.id, fact]))
    const selectedFactIds = new Set<string>()
    const segments: TranslationSegment[] = []

    for (const fact of document.facts) {
      if (!isTranslatableFact(fact, factById)) continue
      if (hasSelectedAncestor(fact, factById, selectedFactIds)) continue

      const span = getMarkdownFactSpan(fact)
      const sourceParts = getTranslatableSourceParts(fact, factById)
      const source = normalizeSegmentSource(sourceParts.source)
      if (!span || !source) continue

      selectedFactIds.add(fact.id)
      segments.push({
        id: fact.id,
        sourceStartOffset: sourceParts.sourceStartOffset ?? span.start,
        sourceEndOffset: sourceParts.sourceEndOffset ?? span.end,
        sourceKind: fact.kind,
        source,
        ...getTranslatorInputParts(fact, source),
        kind: toTranslationSegmentKind(fact.kind),
      })
    }

    return segments
  } catch {
    return extractLineFallbackSegments(markdown)
  }
}

function extractLineFallbackSegments(markdown: string): TranslationSegment[] {
  const segments: TranslationSegment[] = []
  const lines = markdown.split('\n')
  let inFence = false
  let offset = 0

  lines.forEach((line, index) => {
    if (/^\s*```/.test(line)) {
      inFence = !inFence
      offset += line.length + 1
      return
    }
    if (inFence) {
      offset += line.length + 1
      return
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line)
    if (heading) {
      const source = heading[2].trim()
      const start = offset + line.indexOf(heading[2])
      segments.push({
        id: `line-${index}`,
        sourceStartOffset: start,
        sourceEndOffset: start + source.length,
        sourceKind: 'heading',
        source,
        translatorInput: source,
        kind: 'heading',
      })
      offset += line.length + 1
      return
    }

    const listItem = /^(\s*[-*+]\s+)(.+)$/.exec(line)
    if (listItem) {
      const source = listItem[2].trim()
      const start = offset + line.indexOf(listItem[2])
      segments.push({
        id: `line-${index}`,
        sourceStartOffset: start,
        sourceEndOffset: start + source.length,
        sourceKind: 'listItem',
        source,
        translatorInput: source,
        kind: 'listItem',
      })
      offset += line.length + 1
      return
    }

    const blockquote = /^(\s*>\s?)(.+)$/.exec(line)
    if (blockquote) {
      const source = blockquote[2].trim()
      const start = offset + line.indexOf(blockquote[2])
      segments.push({
        id: `line-${index}`,
        sourceStartOffset: start,
        sourceEndOffset: start + source.length,
        sourceKind: 'blockquote',
        source,
        translatorInput: source,
        kind: 'blockquote',
      })
      offset += line.length + 1
      return
    }

    const text = line.trim()
    if (!text || text.startsWith('|') || /^[-:| ]+$/.test(text)) {
      offset += line.length + 1
      return
    }
    const start = offset + line.indexOf(text)
    segments.push({
      id: `line-${index}`,
      sourceStartOffset: start,
      sourceEndOffset: start + text.length,
      sourceKind: 'paragraph',
      source: text,
      translatorInput: text,
      kind: 'paragraph',
    })
    offset += line.length + 1
  })

  return segments
}

function isTranslatableFact(
  fact: MarkdownFact,
  factById: ReadonlyMap<string, MarkdownFact>
): boolean {
  if (!fact.text.trim()) return false
  const parent = fact.parentId ? factById.get(fact.parentId) : undefined
  if (fact.kind === 'paragraph' && parent?.kind === 'listItem') return false
  return (
    fact.kind === 'heading' ||
    fact.kind === 'paragraph' ||
    fact.kind === 'listItem' ||
    fact.kind === 'blockquote'
  )
}

function hasSelectedAncestor(
  fact: MarkdownFact,
  factById: ReadonlyMap<string, MarkdownFact>,
  selectedFactIds: ReadonlySet<string>
): boolean {
  let parentId = fact.parentId
  while (parentId) {
    const parent = factById.get(parentId)
    if (selectedFactIds.has(parentId) && parent?.kind !== 'listItem') return true
    parentId = parent?.parentId
  }
  return false
}

function normalizeSegmentSource(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function getTranslatableSourceParts(
  fact: MarkdownFact,
  factById: ReadonlyMap<string, MarkdownFact>
): { source: string; sourceStartOffset?: number; sourceEndOffset?: number } {
  if (fact.kind !== 'listItem') return { source: getTranslatableSource(fact) }

  const directTextChildren = fact.children
    .map((childId) => factById.get(childId))
    .filter((child): child is MarkdownFact => child !== undefined && child.kind !== 'list')
  const source = directTextChildren
    .map((child) => getTranslatableSource(child))
    .filter((text) => text.trim())
    .join('\n\n')

  if (!source) return { source: getTranslatableSource(fact) }

  const childSpans = directTextChildren
    .map((child) => getMarkdownFactSpan(child))
    .filter((span): span is NonNullable<ReturnType<typeof getMarkdownFactSpan>> => Boolean(span))
  return {
    source,
    ...(childSpans.at(-1) ? { sourceEndOffset: childSpans.at(-1)!.end } : {}),
  }
}

function getTranslatableSource(fact: MarkdownFact): string {
  const rawMarkdown = fact.range?.rawMarkdown.trim()
  if (!rawMarkdown) return fact.text

  switch (fact.kind) {
    case 'heading':
      return rawMarkdown.replace(/^#{1,6}\s+/, '')
    case 'listItem':
      return rawMarkdown.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '').replace(/^\[[ xX]\]\s+/, '')
    case 'blockquote':
      return rawMarkdown
        .split('\n')
        .map((line) => line.replace(/^\s*>\s?/, ''))
        .join('\n')
    case 'paragraph':
      return rawMarkdown
    default:
      return fact.text
  }
}

function getTranslatorInputParts(
  fact: MarkdownFact,
  source: string
): Pick<TranslationSegment, 'translatorInput' | 'sourcePrefix'> {
  void fact
  return { translatorInput: source }
}

function toTranslationSegmentKind(kind: MarkdownFactKind): TranslationSegment['kind'] {
  switch (kind) {
    case 'heading':
      return 'heading'
    case 'listItem':
      return 'listItem'
    case 'blockquote':
      return 'blockquote'
    case 'paragraph':
      return 'paragraph'
    default:
      return 'text'
  }
}

function protectTranslatorInput(input: string): {
  text: string
  restore: (output: string) => string
} {
  const protectedValues = collectProtectedValues(input)
  if (protectedValues.length === 0) {
    return { text: input, restore: (output) => output }
  }

  let text = input
  protectedValues.forEach((value, index) => {
    text = replaceAllLiteral(text, value, createTranslationToken(index))
  })

  return {
    text,
    restore: (output) =>
      protectedValues.reduce(
        (current, value, index) =>
          current.replace(new RegExp(escapeRegExp(createTranslationToken(index)), 'gi'), value),
        output
      ),
  }
}

function collectProtectedValues(input: string): string[] {
  const values = new Set<string>()
  const patterns = [
    /<\/?[A-Za-z][A-Za-z0-9:-]*(?:\s+[^<>\n]*?)?\s*\/?>/g,
    /https?:\/\/[^\s)]+/g,
    /`[^`]+`/g,
    /(?:\.{0,2}|~)?\/(?:[\w.-]+\/)+[\w.-]+/g,
    /\b[\w.-]+\.(?:ts|tsx|js|jsx|mjs|mts|css|json|md|yaml|yml)\b/g,
  ]

  for (const pattern of patterns) {
    for (const match of input.matchAll(pattern)) {
      if (match[0].trim()) {
        values.add(match[0])
      }
    }
  }

  const sorted = [...values].sort((left, right) => right.length - left.length)
  return sorted.filter(
    (value, index) => !sorted.slice(0, index).some((longer) => longer.includes(value))
  )
}

function replaceAllLiteral(input: string, search: string, replacement: string): string {
  return input.split(search).join(replacement)
}

function createTranslationToken(index: number): string {
  return `OSUI${index}TOKEN`
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeAvailability(value: string): BrowserTranslationAvailability {
  if (
    value === 'available' ||
    value === 'downloadable' ||
    value === 'downloading' ||
    value === 'unavailable'
  ) {
    return value
  }
  return 'error'
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new DOMException('Translation cancelled.', 'AbortError')
  }
}

function raceAbort<T>(
  promise: Promise<T>,
  signal: AbortSignal,
  onLateResolve?: (value: T) => void
): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(new DOMException('Translation cancelled.', 'AbortError'))
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false
    const abort = () => {
      if (settled) return
      settled = true
      reject(new DOMException('Translation cancelled.', 'AbortError'))
    }

    signal.addEventListener('abort', abort, { once: true })

    promise.then(
      (value) => {
        signal.removeEventListener('abort', abort)
        if (settled) {
          onLateResolve?.(value)
          return
        }
        settled = true
        resolve(value)
      },
      (error: unknown) => {
        signal.removeEventListener('abort', abort)
        if (settled) return
        settled = true
        reject(error)
      }
    )
  })
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown translation error.'
}
