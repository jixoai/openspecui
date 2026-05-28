import { describe, expect, it } from 'vitest'
import { resolveDocumentTranslationConfig } from './resolve-document-translation-config'

describe('resolveDocumentTranslationConfig', () => {
  it('fills managed local translation engine fields from global settings when project config omits them', () => {
    expect(
      resolveDocumentTranslationConfig(
        {
          enabled: true,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'local-ct2',
          engines: {
            local: {},
            localCt2: {},
            localLlama: {},
            openai: {},
          },
        },
        {
          translationCache: { entryLimit: 10000 },
          translationEngines: {
            local: {
              model: 'onnx-community/opus-mt-en-zh',
              selectedGroupId: 'q8',
              hfEndpoint: 'https://huggingface.co',
            },
            localCt2: {
              model: 'ooeoeo/opus-mt-en-zh-ct2-float16',
              selectedGroupId: 'float16',
              hfEndpoint: 'https://hf-mirror.com',
            },
            localLlama: {
              model: 'tencent/Hy-MT2-1.8B-1.25Bit-GGUF',
              selectedGroupId: 'Hy-MT2-1.8B-1.25Bit.gguf',
              hfEndpoint: 'https://hf-mirror.com',
            },
            openai: {
              baseUrl: '',
              token: '',
              model: 'gpt-4.1-mini',
            },
          },
        }
      )
    ).toEqual({
      enabled: true,
      targetLanguage: 'zh',
      displayMode: 'direct',
      cacheEnabled: false,
      engineId: 'local-ct2',
      engines: {
        local: {
          model: 'onnx-community/opus-mt-en-zh',
          selectedGroupId: 'q8',
        },
        localCt2: {
          model: 'ooeoeo/opus-mt-en-zh-ct2-float16',
          selectedGroupId: 'float16',
        },
        localLlama: {
          model: 'tencent/Hy-MT2-1.8B-1.25Bit-GGUF',
          selectedGroupId: 'Hy-MT2-1.8B-1.25Bit.gguf',
        },
        openai: {
          model: 'gpt-4.1-mini',
        },
      },
    })
  })
})
