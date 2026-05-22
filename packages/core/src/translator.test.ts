import { describe, expect, it } from 'vitest'
import {
  TRANSLATOR_CONTRACT_VERSION,
  getTranslationEngineManifest,
  type TranslationModelCandidate,
} from './translator.js'

describe('translator platform contract', () => {
  it('exposes stable manifests for bundled engines', () => {
    const browser = getTranslationEngineManifest('browser')
    const local = getTranslationEngineManifest('local')
    const openai = getTranslationEngineManifest('openai')

    expect(browser.runtime).toBe('browser')
    expect(local.moduleName).toBe('@openspecui/local-translator')
    expect(local.factoryExport).toBe('createLocalTranslatorFactory')
    expect(openai.moduleName).toBe('@openspecui/openai-completion-translator')
    expect(openai.factoryExport).toBe('createOpenAICompletionTranslatorFactory')
  })

  it('locks the translator contract version to batch translate semantics', () => {
    expect(TRANSLATOR_CONTRACT_VERSION).toBe(2)
  })

  it('defines model candidates with ranking and size metadata for catalog UIs', () => {
    const candidate: TranslationModelCandidate = {
      id: 'Xenova/opus-mt-en-de',
      label: 'Xenova/opus-mt-en-de',
      summary: 'Small Transformers.js translation model.',
      downloads: 502,
      likes: 0,
      tags: ['transformers.js', 'onnx', 'translation'],
      compatibility: {
        transformersJs: true,
        onnx: true,
        localRuntimeVerified: true,
      },
      size: {
        estimatedTotalBytes: 1234,
        primaryBytes: 1200,
      },
      languageMatch: {
        sourceMatched: true,
        targetMatched: true,
        directionalScore: 1,
      },
    }

    expect(candidate.compatibility.localRuntimeVerified).toBe(true)
    expect(candidate.size.estimatedTotalBytes).toBeGreaterThan(0)
  })
})
