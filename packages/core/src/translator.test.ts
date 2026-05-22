import { describe, expect, it } from 'vitest'
import {
  TRANSLATOR_CONTRACT_VERSION,
  createTranslationPackageAliasSpec,
  getTranslationEngineManifest,
  isRichTranslationInput,
  type TranslationModelCandidate,
} from './translator.js'

describe('translator platform contract', () => {
  it('exposes stable manifests and npm alias specs for installable engines', () => {
    const ai = getTranslationEngineManifest('ai')
    const nmt = getTranslationEngineManifest('nmt')

    expect(ai.runtime).toBe('server')
    expect(ai.installable).toBe(true)
    expect(ai.aliasName).toBe('@openspecui-runtime/ai-translator')
    expect(nmt.aliasName).toBe('@openspecui-runtime/nmt-translator')
    expect(
      createTranslationPackageAliasSpec({
        aliasName: ai.aliasName!,
        packageName: ai.packageName!,
        versionRange: ai.versionRange!,
      })
    ).toBe('@openspecui-runtime/ai-translator@npm:@openspecui/ai-translator@^3.7.2')
  })

  it('keeps rich translation input as a first-class contract shape', () => {
    expect(TRANSLATOR_CONTRACT_VERSION).toBe(1)
    expect(isRichTranslationInput('hello')).toBe(false)
    expect(
      isRichTranslationInput({
        instructions: 'Keep tags.',
        context: '# Proposal',
        source: '<x1>Hello</x1>',
      })
    ).toBe(true)
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
