import { beforeEach, describe, expect, it, vi } from 'vitest'

const transformersMock = vi.hoisted(() => ({
  env: {
    cacheDir: null as string | null,
    allowLocalModels: false,
    allowRemoteModels: true,
    localModelPath: '',
  },
  pipeline: vi.fn(),
}))

vi.mock('@huggingface/transformers', () => ({
  env: transformersMock.env,
  pipeline: transformersMock.pipeline,
}))

describe('NMT translator package', () => {
  beforeEach(() => {
    transformersMock.pipeline.mockReset()
    transformersMock.env.cacheDir = null
    transformersMock.env.allowLocalModels = false
    transformersMock.env.allowRemoteModels = true
    transformersMock.env.localModelPath = ''
  })

  it('prepares a model without creating a translator session', async () => {
    const dispose = vi.fn(async () => undefined)
    transformersMock.pipeline.mockImplementationOnce(
      async (_task: string, _model: string, options) => {
        options.progress_callback({ loaded: 10, total: 100 })
        return Object.assign(vi.fn(), { dispose })
      }
    )
    const status = vi.fn()

    const { createNmtTranslatorFactory } = await import('./index.js')
    await createNmtTranslatorFactory({
      defaultModel: 'Xenova/default-model',
    }).prepare({
      sourceLanguage: 'en',
      targetLanguage: 'zh',
      model: 'Xenova/custom-model',
      monitor: { setStatus: status },
    })

    expect(dispose).toHaveBeenCalledTimes(1)
    expect(status).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Downloading NMT model Xenova/custom-model 10%.',
        progress: 0.1,
      })
    )
  })

  it('loads the configured translation model and translates rich source text', async () => {
    const pipeline = vi.fn(async () => [{ translation_text: '你好' }])
    const status = vi.fn()
    transformersMock.pipeline.mockImplementationOnce(
      async (_task: string, _model: string, options) => {
        options.progress_callback({ loaded: 50, total: 100 })
        return pipeline
      }
    )

    const { createNmtTranslatorFactory } = await import('./index.js')
    const translator = await createNmtTranslatorFactory({
      defaultModel: 'Xenova/default-model',
    }).create({
      sourceLanguage: 'en',
      targetLanguage: 'zh',
      model: 'Xenova/custom-model',
      monitor: { setStatus: status },
    })

    await expect(
      translator.translate({
        instructions: 'Use document context.',
        context: '# Proposal',
        source: 'Hello',
      })
    ).resolves.toBe('你好')
    expect(transformersMock.pipeline).toHaveBeenCalledWith(
      'translation',
      'Xenova/custom-model',
      expect.any(Object)
    )
    expect(pipeline).toHaveBeenCalledWith('Hello', {
      src_lang: 'en',
      tgt_lang: 'zh',
    })
    expect(status).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Downloading NMT model Xenova/custom-model 50%.',
        progress: 0.5,
      })
    )
  })

  it('passes dtype to Transformers.js when a download profile is selected', async () => {
    const pipeline = vi.fn(async () => [{ translation_text: 'Hallo' }])
    transformersMock.pipeline.mockImplementationOnce(async () => pipeline)

    const { createNmtTranslatorFactory } = await import('./index.js')
    await createNmtTranslatorFactory({
      defaultModel: 'Xenova/default-model',
      dtype: 'q4',
    }).prepare({
      sourceLanguage: 'en',
      targetLanguage: 'de',
      model: 'Xenova/custom-model',
    })

    expect(transformersMock.pipeline).toHaveBeenCalledWith(
      'translation',
      'Xenova/custom-model',
      expect.objectContaining({ dtype: 'q4' })
    )
  })

  it('uses the configured Transformers cache directory when loading a profile', async () => {
    transformersMock.pipeline.mockImplementationOnce(async () =>
      vi.fn(async () => [{ translation_text: 'Hallo' }])
    )

    const { createNmtTranslatorFactory } = await import('./index.js')
    await createNmtTranslatorFactory({
      defaultModel: 'Xenova/default-model',
      cacheDir: '/tmp/openspecui-nmt-cache',
    }).create({
      sourceLanguage: 'en',
      targetLanguage: 'de',
      model: 'Xenova/custom-model',
      dtype: 'int8',
    })

    expect(transformersMock.pipeline).toHaveBeenCalledWith(
      'translation',
      'Xenova/custom-model',
      expect.objectContaining({ dtype: 'int8' })
    )
    expect(transformersMock.env).toMatchObject({
      cacheDir: '/tmp/openspecui-nmt-cache',
      allowLocalModels: true,
      localModelPath: '/tmp/openspecui-nmt-cache/models',
    })
  })

  it('does not pass a progress callback during local translation tests', async () => {
    transformersMock.pipeline.mockImplementationOnce(async () =>
      vi.fn(async () => [{ translation_text: 'Hallo' }])
    )

    const { createNmtTranslatorFactory } = await import('./index.js')
    await createNmtTranslatorFactory({
      defaultModel: 'Xenova/default-model',
      cacheDir: '/tmp/openspecui-nmt-cache',
      localOnly: true,
    }).create({
      sourceLanguage: 'en',
      targetLanguage: 'de',
      model: 'Xenova/custom-model',
      dtype: 'q4',
    })

    expect(transformersMock.pipeline).toHaveBeenCalledWith(
      'translation',
      '/tmp/openspecui-nmt-cache/models/Xenova/custom-model',
      expect.objectContaining({
        config: undefined,
        dtype: 'q4',
        local_files_only: true,
      })
    )
    expect(transformersMock.pipeline.mock.calls[0]?.[2]).not.toHaveProperty('progress_callback')
    expect(transformersMock.env.allowRemoteModels).toBe(false)
  })

  it('passes caller-provided runtime config so local-only pipeline setup avoids remote config probes', async () => {
    transformersMock.pipeline.mockImplementationOnce(async () =>
      vi.fn(async () => [{ translation_text: 'Hallo' }])
    )

    const { createNmtTranslatorFactory } = await import('./index.js')
    await createNmtTranslatorFactory({
      defaultModel: 'Xenova/default-model',
      cacheDir: '/tmp/openspecui-nmt-cache',
      localOnly: true,
    }).create({
      sourceLanguage: 'en',
      targetLanguage: 'de',
      model: 'Xenova/custom-model',
      dtype: 'q4',
      runtimeConfig: { model_type: 'marian' },
    })

    expect(transformersMock.pipeline).toHaveBeenCalledWith(
      'translation',
      '/tmp/openspecui-nmt-cache/models/Xenova/custom-model',
      expect.objectContaining({
        config: { model_type: 'marian' },
        dtype: 'q4',
        local_files_only: true,
      })
    )
  })

  it('resolves a download plan from Hugging Face ONNX siblings', async () => {
    const { resolveNmtModelDownloadPlan } = await import('./index.js')
    const plan = resolveNmtModelDownloadPlan({
      modelId: 'Xenova/opus-mt-en-de',
      isEncoderDecoder: true,
      siblings: [
        { rfilename: 'onnx/encoder_model_quantized.onnx', size: 35 },
        { rfilename: 'onnx/decoder_model_merged_quantized.onnx', size: 42 },
      ],
    })

    expect(plan).toMatchObject({
      modelId: 'Xenova/opus-mt-en-de',
      estimatedTotalBytes: 77,
      selectedGroupId: 'q8',
      files: [
        { path: 'onnx/encoder_model_quantized.onnx', sizeBytes: 35, required: true },
        { path: 'onnx/decoder_model_merged_quantized.onnx', sizeBytes: 42, required: true },
      ],
    })
    expect(plan?.groups?.map((group) => group.id)).toEqual(['q8'])
  })
})
