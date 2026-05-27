import { describe, expect, it } from 'vitest'
import {
  checkLocalDirectionalModelLanguagePair,
  inferLocalDirectionalModelLanguagePair,
} from './translation-language-pair.js'

describe('local translation language-pair laws', () => {
  it('infers opus-mt language direction from local model ids', () => {
    expect(inferLocalDirectionalModelLanguagePair('onnx-community/opus-mt-en-zh')).toEqual({
      sourceLanguage: 'en',
      targetLanguage: 'zh',
    })
    expect(inferLocalDirectionalModelLanguagePair('Xenova/opus-mt-no-de')).toEqual({
      sourceLanguage: 'no',
      targetLanguage: 'de',
    })
    expect(inferLocalDirectionalModelLanguagePair('ooeoeo/opus-mt-en-zh-ct2-float16')).toEqual({
      sourceLanguage: 'en',
      targetLanguage: 'zh',
    })
  })

  it('leaves multilingual or unknown model ids unrestricted', () => {
    expect(inferLocalDirectionalModelLanguagePair('Xenova/nllb-200-distilled-600M')).toBeNull()
    expect(inferLocalDirectionalModelLanguagePair('custom/local-model')).toBeNull()
  })

  it('rejects target languages that conflict with a directional local model', () => {
    expect(
      checkLocalDirectionalModelLanguagePair({
        model: 'onnx-community/opus-mt-en-zh',
        targetLanguage: 'de',
      })
    ).toEqual({
      supported: false,
      expected: {
        sourceLanguage: 'en',
        targetLanguage: 'zh',
      },
      message:
        'Selected local model supports en -> zh, but document translation is configured for target de.',
    })
  })

  it('rejects detected source languages that conflict with a directional local model', () => {
    expect(
      checkLocalDirectionalModelLanguagePair({
        model: 'onnx-community/opus-mt-en-zh',
        sourceLanguage: 'de',
        targetLanguage: 'zh-CN',
      })
    ).toEqual({
      supported: false,
      expected: {
        sourceLanguage: 'en',
        targetLanguage: 'zh',
      },
      message:
        'Selected local model supports en -> zh, but document segment was detected as de -> zh-CN.',
    })
  })

  it('applies the same direction law to ct2 opus-mt model ids', () => {
    expect(
      checkLocalDirectionalModelLanguagePair({
        model: 'ooeoeo/opus-mt-en-zh-ct2-float16',
        sourceLanguage: 'ja',
        targetLanguage: 'zh',
      })
    ).toEqual({
      supported: false,
      expected: {
        sourceLanguage: 'en',
        targetLanguage: 'zh',
      },
      message:
        'Selected local model supports en -> zh, but document segment was detected as ja -> zh.',
    })
  })
})
