import type { TranslationEngineId } from '@openspecui/core/translator'

export interface TranslationAdaptiveConcurrencyLogEntry {
  scopeKey: string
  recordedAt: number
  engineId: TranslationEngineId
  engineVersion?: string
  model?: string
  selectedGroupId?: string
  sourceLanguage: string
  targetLanguage: string
  batchIndex: number
  batchSize: number
  estimatedTokens: number
  elapsedMs: number
  throughputTokensPerMs: number
  desiredConcurrency: number
  activeWorkers: number
  maxConcurrency: number
}

interface TranslationAdaptiveConcurrencyLogStore {
  entries: TranslationAdaptiveConcurrencyLogEntry[]
}

const GLOBAL_STORAGE_KEY = '__OPENSPECUI_TRANSLATION_ADAPTIVE_CONCURRENCY_LOGS__'
const MAX_LOG_AGE_MS = 30 * 60 * 1000
const MAX_LOG_ENTRIES = 256
const DEFAULT_SAMPLE_SIZE = 8

type GlobalWithTranslationAdaptiveConcurrencyLogs = typeof globalThis & {
  __OPENSPECUI_TRANSLATION_ADAPTIVE_CONCURRENCY_LOGS__?: TranslationAdaptiveConcurrencyLogStore
}

export function createTranslationAdaptiveConcurrencyScopeKey(input: {
  engineId: TranslationEngineId
  engineVersion?: string
  model?: string
  selectedGroupId?: string
  sourceLanguage: string
  targetLanguage: string
  translatorContractVersion: number
}): string {
  return JSON.stringify({
    engineId: input.engineId,
    engineVersion: input.engineVersion ?? null,
    model: input.model ?? null,
    selectedGroupId: input.selectedGroupId ?? null,
    sourceLanguage: input.sourceLanguage.trim().toLowerCase(),
    targetLanguage: input.targetLanguage.trim().toLowerCase(),
    translatorContractVersion: input.translatorContractVersion,
  })
}

export function appendTranslationAdaptiveConcurrencyLog(
  entry: TranslationAdaptiveConcurrencyLogEntry
): void {
  const store = getTranslationAdaptiveConcurrencyLogStore()
  store.entries.push(entry)
  cleanupTranslationAdaptiveConcurrencyLogs(store)
}

export function readRecentTranslationAdaptiveConcurrencyLogs(
  input: {
    scopeKey?: string
    limit?: number
  } = {}
): TranslationAdaptiveConcurrencyLogEntry[] {
  const store = getTranslationAdaptiveConcurrencyLogStore()
  cleanupTranslationAdaptiveConcurrencyLogs(store)
  const entries = input.scopeKey
    ? store.entries.filter((entry) => entry.scopeKey === input.scopeKey)
    : store.entries
  return entries.slice(-Math.max(1, input.limit ?? DEFAULT_SAMPLE_SIZE))
}

export function clearTranslationAdaptiveConcurrencyLogs(): void {
  getTranslationAdaptiveConcurrencyLogStore().entries = []
}

function getTranslationAdaptiveConcurrencyLogStore(): TranslationAdaptiveConcurrencyLogStore {
  const globalScope = globalThis as GlobalWithTranslationAdaptiveConcurrencyLogs
  if (!globalScope[GLOBAL_STORAGE_KEY]) {
    globalScope[GLOBAL_STORAGE_KEY] = {
      entries: [],
    }
  }
  return globalScope[GLOBAL_STORAGE_KEY]
}

function cleanupTranslationAdaptiveConcurrencyLogs(
  store: TranslationAdaptiveConcurrencyLogStore
): void {
  const cutoff = Date.now() - MAX_LOG_AGE_MS
  if (store.entries.length === 0) return
  store.entries = store.entries
    .filter((entry) => entry.recordedAt >= cutoff)
    .slice(-MAX_LOG_ENTRIES)
}
