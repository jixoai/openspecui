import { createTranslationEngineLifecycleStatus } from '@openspecui/core/translator'
import { describe, expect, it } from 'vitest'
import { isLocalAssetReady, projectTranslateServiceStatus } from './translate-service-status'

describe('translate service status', () => {
  it('blocks managed-local translation when runtime lifecycle is not ready', () => {
    expect(
      projectTranslateServiceStatus({
        enabled: true,
        hasSource: true,
        engineId: 'local',
        engineLifecycle: createTranslationEngineLifecycleStatus({
          dependency: {
            state: 'installed',
            message: 'Dependencies are installed.',
          },
          runtime: {
            state: 'failed',
            error: 'Native runtime failed to load.',
          },
        }),
        localModel: 'Xenova/opus-mt-en-zh',
      })
    ).toEqual({
      state: 'unavailable',
      engineId: 'local',
      message: 'Native runtime failed to load.',
    })
  })

  it('treats a versioned downloaded local group as ready when settings store the base group id', () => {
    expect(
      isLocalAssetReady(
        {
          modelId: 'Xenova/opus-mt-en-zh',
          version: 2,
          status: 'downloaded',
          selected: true,
          selectedGroupId: 'q4-abcdef',
          progress: 1,
          bytesDownloaded: 30,
          totalBytes: 30,
          resumable: false,
          groupsState: {},
          profileLoad: {
            status: 'ready',
          },
          plan: {
            modelId: 'Xenova/opus-mt-en-zh',
            estimatedTotalBytes: 30,
            selectedGroupId: 'q4-abcdef',
            files: [
              { path: 'config.json', sizeBytes: 10, required: true },
              { path: 'onnx/encoder_model_q4.onnx', sizeBytes: 20, required: true },
            ],
            groups: [
              {
                id: 'q4-abcdef',
                baseGroupId: 'q4',
                label: 'q4',
                dtype: 'q4',
                estimatedTotalBytes: 30,
                selectable: true,
                selected: true,
                files: [
                  { path: 'config.json', sizeBytes: 10, required: true },
                  { path: 'onnx/encoder_model_q4.onnx', sizeBytes: 20, required: true },
                ],
              },
            ],
          },
          files: [
            { path: 'config.json', sizeBytes: 10, downloadedBytes: 10 },
            { path: 'onnx/encoder_model_q4.onnx', sizeBytes: 20, downloadedBytes: 20 },
          ],
        },
        'q4'
      )
    ).toBe(true)
  })
})
