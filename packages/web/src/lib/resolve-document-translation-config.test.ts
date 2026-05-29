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
          translation: {
            enabled: false,
            targetLanguage: 'de',
            displayMode: 'bilingual',
            cacheEnabled: true,
          },
          translationCache: { entryLimit: 10000 },
          translationEngines: {
            engineId: 'local-llama',
            local: {
              model: 'onnx-community/opus-mt-en-zh',
              selectedGroupId: 'q8',
              hfEndpoint: 'https://huggingface.co',
              memoryBudgetPercent: 25,
            },
            localCt2: {
              model: 'ooeoeo/opus-mt-en-zh-ct2-float16',
              selectedGroupId: 'float16',
              hfEndpoint: 'https://hf-mirror.com',
              memoryBudgetPercent: 25,
            },
            localLlama: {
              model: 'tencent/Hy-MT2-1.8B-1.25Bit-GGUF',
              selectedGroupId: 'Hy-MT2-1.8B-1.25Bit.gguf',
              hfEndpoint: 'https://hf-mirror.com',
              memoryBudgetPercent: 25,
            },
            openai: {
              baseUrl: '',
              token: '',
              model: 'gpt-4.1-mini',
            },
          },
        },
        {
          translation: {
            enabled: true,
            targetLanguage: true,
            displayMode: true,
            cacheEnabled: true,
            engineId: true,
            engines: {
              local: false,
              localCt2: false,
              localLlama: false,
              openai: false,
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

  it('uses the global engine when the project config has no engine override', () => {
    expect(
      resolveDocumentTranslationConfig(
        {
          enabled: true,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'browser',
          engines: {
            local: {},
            localCt2: {},
            localLlama: {},
            openai: {},
          },
        },
        {
          translation: {
            enabled: false,
            targetLanguage: 'de',
            displayMode: 'bilingual',
            cacheEnabled: true,
          },
          translationCache: { entryLimit: 10000 },
          translationEngines: {
            engineId: 'local-llama',
            local: {
              model: 'onnx-community/opus-mt-en-zh',
              selectedGroupId: 'q8',
              hfEndpoint: '',
              memoryBudgetPercent: 25,
            },
            localCt2: {
              model: 'ooeoeo/opus-mt-en-zh-ct2-float16',
              selectedGroupId: 'float16',
              hfEndpoint: '',
              memoryBudgetPercent: 25,
            },
            localLlama: {
              model: 'tencent/Hy-MT2-1.8B-1.25Bit-GGUF',
              selectedGroupId: 'Hy-MT2-1.8B-1.25Bit.gguf',
              hfEndpoint: '',
              memoryBudgetPercent: 25,
            },
            openai: {
              baseUrl: '',
              token: '',
              model: 'gpt-4.1-mini',
            },
          },
        },
        {
          translation: {
            enabled: true,
            targetLanguage: true,
            displayMode: true,
            cacheEnabled: true,
            engineId: false,
            engines: {
              local: false,
              localCt2: false,
              localLlama: false,
              openai: false,
            },
          },
        }
      )?.engineId
    ).toBe('local-llama')
  })

  it('uses global scalar translation fields when project config has no overrides', () => {
    expect(
      resolveDocumentTranslationConfig(
        {
          enabled: false,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'browser',
          engines: {
            local: {},
            localCt2: {},
            localLlama: {},
            openai: {},
          },
        },
        {
          translation: {
            enabled: true,
            targetLanguage: 'de',
            displayMode: 'bilingual',
            cacheEnabled: true,
          },
          translationCache: { entryLimit: 10000 },
          translationEngines: {
            engineId: 'browser',
            local: {
              model: 'onnx-community/opus-mt-en-zh',
              hfEndpoint: '',
              memoryBudgetPercent: 25,
            },
            localCt2: {
              model: 'ooeoeo/opus-mt-en-zh-ct2-float16',
              hfEndpoint: '',
              memoryBudgetPercent: 25,
            },
            localLlama: {
              model: 'tencent/Hy-MT2-1.8B-1.25Bit-GGUF',
              hfEndpoint: '',
              memoryBudgetPercent: 25,
            },
            openai: {
              baseUrl: '',
              token: '',
              model: 'gpt-4.1-mini',
            },
          },
        },
        {
          translation: {
            enabled: false,
            targetLanguage: false,
            displayMode: false,
            cacheEnabled: false,
            engineId: false,
            engines: {
              local: false,
              localCt2: false,
              localLlama: false,
              openai: false,
            },
          },
        }
      )
    ).toMatchObject({
      enabled: true,
      targetLanguage: 'de',
      displayMode: 'bilingual',
      cacheEnabled: true,
    })
  })
})
