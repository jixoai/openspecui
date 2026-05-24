import { describe, expect, it } from 'vitest'
import { resolveDocumentTranslationConfig } from './resolve-document-translation-config'

describe('resolveDocumentTranslationConfig', () => {
  it('fills local translation engine fields from global settings when project config omits them', () => {
    expect(
      resolveDocumentTranslationConfig(
        {
          enabled: true,
          targetLanguage: 'zh',
          displayMode: 'direct',
          cacheEnabled: false,
          engineId: 'local',
          engines: {
            local: {},
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
      engineId: 'local',
      engines: {
        local: {
          model: 'onnx-community/opus-mt-en-zh',
          selectedGroupId: 'q8',
        },
        openai: {
          model: 'gpt-4.1-mini',
        },
      },
    })
  })
})
