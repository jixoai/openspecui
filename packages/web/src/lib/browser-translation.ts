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

export type BrowserTranslationAvailability =
  | 'available'
  | 'downloadable'
  | 'downloading'
  | 'unavailable'
  | 'missing'
  | 'error'

export interface BrowserTranslationStatus {
  availability: BrowserTranslationAvailability
  progress?: number
  message?: string
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

export interface BrowserTranslationCache {
  read(keyHash: string): Promise<TranslationCacheEntry | null>
  write(input: TranslationCacheWriteInput): Promise<{ accepted: boolean } | void>
}

interface BrowserTranslator {
  translate(input: string): Promise<string>
  destroy?: () => void
}

interface BrowserTranslatorFactory {
  availability(options: { sourceLanguage: string; targetLanguage: string }): Promise<string>
  create(options: {
    sourceLanguage: string
    targetLanguage: string
    monitor?: (monitor: EventTarget) => void
  }): Promise<BrowserTranslator>
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
  Translator?: BrowserTranslatorFactory
  LanguageDetector?: BrowserLanguageDetectorFactory
}

const DEFAULT_SOURCE_LANGUAGE = 'en'
const DOCUMENT_LANGUAGE_CONFIDENCE_THRESHOLD = 0.45
const SEGMENT_LANGUAGE_CONFIDENCE_THRESHOLD = 0.62
const TRANSLATION_DISPLAY_POLICY_VERSION = TRANSLATION_CACHE_POLICY_VERSION

export function isBrowserTranslationSupported(): boolean {
  return typeof window !== 'undefined' && !!(window as WindowWithChromeAi).Translator
}

export async function probeBrowserTranslation(
  targetLanguage: string
): Promise<BrowserTranslationStatus> {
  if (typeof window === 'undefined') {
    return { availability: 'missing', message: 'Browser translation is not available.' }
  }

  const translator = (window as WindowWithChromeAi).Translator
  if (!translator) {
    return { availability: 'missing', message: 'Chrome Translator API is not exposed.' }
  }

  try {
    const availability = await translator.availability({
      sourceLanguage: DEFAULT_SOURCE_LANGUAGE,
      targetLanguage,
    })
    return { availability: normalizeAvailability(availability) }
  } catch (error) {
    return { availability: 'error', message: getErrorMessage(error) }
  }
}

export async function prepareBrowserTranslation(
  targetLanguage: string,
  signal: AbortSignal
): Promise<BrowserTranslationStatus> {
  if (typeof window === 'undefined') {
    return { availability: 'missing', message: 'Browser translation is not available.' }
  }

  const translator = (window as WindowWithChromeAi).Translator
  if (!translator) {
    return { availability: 'missing', message: 'Chrome Translator API is not exposed.' }
  }

  try {
    const availability = normalizeAvailability(
      await translator.availability({
        sourceLanguage: DEFAULT_SOURCE_LANGUAGE,
        targetLanguage,
      })
    )

    if (availability === 'missing' || availability === 'unavailable' || availability === 'error') {
      return { availability }
    }

    if (availability === 'available') {
      return { availability: 'available' }
    }

    throwIfAborted(signal)
    const prepared = await raceAbort(
      translator.create({
        sourceLanguage: DEFAULT_SOURCE_LANGUAGE,
        targetLanguage,
        monitor(monitor) {
          monitorTranslationDownload(monitor, signal)
        },
      }),
      signal,
      (preparedTranslator) => preparedTranslator.destroy?.()
    )
    prepared.destroy?.()
    return { availability: 'available' }
  } catch (error) {
    if (signal.aborted) {
      return { availability: 'downloading', message: 'Translation initialization was cancelled.' }
    }
    return { availability: 'error', message: getErrorMessage(error) }
  }
}

export async function translateMarkdownDocument(args: {
  markdown: string
  targetLanguage: string
  displayMode: DocumentTranslationDisplayMode
  signal: AbortSignal
  cache?: BrowserTranslationCache
}): Promise<DocumentTranslationResult> {
  const translatedSegments: TranslationSegment[] = []
  return translateMarkdownDocumentProgressively(args, ({ segmentIndex, segment }) => {
    translatedSegments[segmentIndex] = segment
  }).then((result) => ({
    ...result,
    segments: translatedSegments.length > 0 ? translatedSegments : result.segments,
  }))
}

export async function translateMarkdownDocumentProgressively(
  args: {
    markdown: string
    targetLanguage: string
    displayMode: DocumentTranslationDisplayMode
    signal: AbortSignal
    cache?: BrowserTranslationCache
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

  const languageDetection = await createSourceLanguageDetectionSession(args.markdown, args.signal)
  const translatorBySourceLanguage = new Map<string, BrowserTranslator>()

  try {
    const translatedSegments: TranslationSegment[] = []
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
          translatedSegments.push(translatedSegment)
          onPatch({ segmentIndex, segment: translatedSegment })
          continue
        }

        const cacheKey = createSegmentCacheKey(segment, sourceLanguage, args.targetLanguage)
        const cachedSegment = cacheKey
          ? await readCachedTranslationSegment(args.cache, cacheKey, segment, {
              sourceLanguage,
              targetLanguage: args.targetLanguage,
            })
          : null
        if (cachedSegment) {
          translatedSegments.push(cachedSegment)
          onPatch({ segmentIndex, segment: cachedSegment })
          continue
        }

        const translator = await getPooledTranslator(
          translatorBySourceLanguage,
          sourceLanguage,
          args.targetLanguage,
          args.signal
        )
        const protectedInput = segment.placeholderProtocol
          ? { text: segment.translatorInput, restore: (output: string) => output }
          : protectTranslatorInput(segment.translatorInput)
        const target = await raceAbort(translator.translate(protectedInput.text), args.signal)
        const restoredTarget = segment.placeholderProtocol
          ? restoreTranslatedPlaceholderFragment(target, segment.placeholderProtocol)
          : { target: protectedInput.restore(target).trim() }
        const translatedSegment = {
          ...segment,
          ...restoredTarget,
          sourceLanguage,
          targetLanguage: args.targetLanguage,
          status: 'translated' as const,
        }
        if (cacheKey) {
          void writeCachedTranslationSegment(args.cache, cacheKey, translatedSegment)
        }
        translatedSegments.push(translatedSegment)
        onPatch({ segmentIndex, segment: translatedSegment })
      } catch (error) {
        if (args.signal.aborted) throw error
        const failedSegment = {
          ...segment,
          sourceLanguage,
          targetLanguage: args.targetLanguage,
          status: 'error' as const,
          error: getErrorMessage(error),
        }
        translatedSegments.push(failedSegment)
        onPatch({ segmentIndex, segment: failedSegment })
      }
    }

    return {
      segments: translatedSegments,
      displayMode: args.displayMode,
      sourceLanguage: languageDetection.documentLanguage,
      targetLanguage: args.targetLanguage,
    }
  } finally {
    translatorBySourceLanguage.forEach((translator) => translator.destroy?.())
    languageDetection.destroy()
  }
}

async function getPooledTranslator(
  translatorBySourceLanguage: Map<string, BrowserTranslator>,
  sourceLanguage: string,
  targetLanguage: string,
  signal: AbortSignal
): Promise<BrowserTranslator> {
  const existing = translatorBySourceLanguage.get(sourceLanguage)
  if (existing) return existing

  const translator = await createTranslator(sourceLanguage, targetLanguage, signal)
  translatorBySourceLanguage.set(sourceLanguage, translator)
  return translator
}

async function createTranslator(
  sourceLanguage: string,
  targetLanguage: string,
  signal: AbortSignal
): Promise<BrowserTranslator> {
  const translator = (window as WindowWithChromeAi).Translator
  if (!translator) {
    throw new Error('Chrome Translator API is not exposed.')
  }

  throwIfAborted(signal)
  const availability = normalizeAvailability(
    await translator.availability({ sourceLanguage, targetLanguage })
  )
  if (availability === 'missing' || availability === 'unavailable' || availability === 'error') {
    throw new Error(`Translation is ${availability}.`)
  }

  throwIfAborted(signal)
  return raceAbort(
    translator.create({
      sourceLanguage,
      targetLanguage,
      monitor(monitor) {
        monitorTranslationDownload(monitor, signal)
      },
    }),
    signal,
    (createdTranslator) => createdTranslator.destroy?.()
  )
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
}

function createSegmentCacheKey(
  segment: TranslationSegment,
  sourceLanguage: string,
  targetLanguage: string
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
  })

  return {
    key,
    keyHash: hashString(key),
    placeholderTopologyHash,
    attributeTopologyHash,
    displayPolicyVersion,
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
    entry.displayPolicyVersion === cacheKey.displayPolicyVersion
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

function monitorTranslationDownload(monitor: EventTarget, signal: AbortSignal): void {
  monitor.addEventListener('downloadprogress', () => {
    // Abort is handled by raceAbort. Throwing from this browser event listener
    // escapes as a global page error instead of rejecting the create() promise.
    if (signal.aborted) return
  })
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
