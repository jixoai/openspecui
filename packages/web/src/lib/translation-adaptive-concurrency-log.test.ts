import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  appendTranslationAdaptiveConcurrencyLog,
  clearTranslationAdaptiveConcurrencyLogs,
  createTranslationAdaptiveConcurrencyScopeKey,
  readRecentTranslationAdaptiveConcurrencyLogs,
} from './translation-adaptive-concurrency-log'

describe('translation adaptive concurrency log store', () => {
  afterEach(() => {
    clearTranslationAdaptiveConcurrencyLogs()
    vi.restoreAllMocks()
  })

  it('keeps only recent entries for the same scope', () => {
    const now = 1_000_000
    vi.spyOn(Date, 'now').mockReturnValue(now)
    const scopeKey = createTranslationAdaptiveConcurrencyScopeKey({
      engineId: 'browser',
      engineVersion: 'test',
      model: 'model-a',
      selectedGroupId: 'q8',
      sourceLanguage: 'en',
      targetLanguage: 'zh',
      translatorContractVersion: 2,
    })

    appendTranslationAdaptiveConcurrencyLog({
      scopeKey,
      recordedAt: now - 31 * 60 * 1000,
      engineId: 'browser',
      engineVersion: 'test',
      model: 'model-a',
      selectedGroupId: 'q8',
      sourceLanguage: 'en',
      targetLanguage: 'zh',
      batchIndex: 0,
      batchSize: 1,
      estimatedTokens: 12,
      elapsedMs: 20,
      throughputTokensPerMs: 0.6,
      desiredConcurrency: 1,
      activeWorkers: 1,
      maxConcurrency: 4,
    })
    appendTranslationAdaptiveConcurrencyLog({
      scopeKey,
      recordedAt: now,
      engineId: 'browser',
      engineVersion: 'test',
      model: 'model-a',
      selectedGroupId: 'q8',
      sourceLanguage: 'en',
      targetLanguage: 'zh',
      batchIndex: 1,
      batchSize: 1,
      estimatedTokens: 20,
      elapsedMs: 10,
      throughputTokensPerMs: 2,
      desiredConcurrency: 2,
      activeWorkers: 2,
      maxConcurrency: 4,
    })

    expect(readRecentTranslationAdaptiveConcurrencyLogs({ scopeKey, limit: 10 })).toHaveLength(1)
  })

  it('returns the tail slice after global cleanup', () => {
    const now = 1_000_000
    vi.spyOn(Date, 'now').mockReturnValue(now)
    const scopeKey = createTranslationAdaptiveConcurrencyScopeKey({
      engineId: 'browser',
      model: 'model-b',
      sourceLanguage: 'en',
      targetLanguage: 'zh',
      translatorContractVersion: 2,
    })

    for (let index = 0; index < 300; index += 1) {
      appendTranslationAdaptiveConcurrencyLog({
        scopeKey,
        recordedAt: now,
        engineId: 'browser',
        model: 'model-b',
        sourceLanguage: 'en',
        targetLanguage: 'zh',
        batchIndex: index,
        batchSize: 1,
        estimatedTokens: 10,
        elapsedMs: 5,
        throughputTokensPerMs: 2,
        desiredConcurrency: 1,
        activeWorkers: 1,
        maxConcurrency: 4,
      })
    }

    const tail = readRecentTranslationAdaptiveConcurrencyLogs({ scopeKey, limit: 3 })
    expect(readRecentTranslationAdaptiveConcurrencyLogs({ scopeKey, limit: 999 })).toHaveLength(256)
    expect(tail.map((entry) => entry.batchIndex)).toEqual([297, 298, 299])
  })
})
