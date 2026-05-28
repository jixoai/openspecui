import { describe, expect, it, vi } from 'vitest'
import {
  createLocalLlamaTranslatorFactory,
  resolveGgufModelDownloadPlanFromRepositoryFiles,
} from './index.js'

describe('local-llama-translator package', () => {
  it('builds a GGUF download plan from repository files', () => {
    const plan = resolveGgufModelDownloadPlanFromRepositoryFiles({
      modelId: 'tencent/Hy-MT2-1.8B-1.25Bit-GGUF',
      files: [
        { path: 'README.md', sizeBytes: 128 },
        { path: 'Hy-MT2-1.8B-1.25Bit.gguf', sizeBytes: 461_860_736 },
      ],
    })

    expect(plan).toEqual({
      modelId: 'tencent/Hy-MT2-1.8B-1.25Bit-GGUF',
      estimatedTotalBytes: 461_860_736,
      files: [
        {
          path: 'Hy-MT2-1.8B-1.25Bit.gguf',
          required: true,
          sizeBytes: 461_860_736,
        },
      ],
      selectedGroupId: 'Hy-MT2-1.8B-1.25Bit.gguf',
      groups: [
        {
          id: 'Hy-MT2-1.8B-1.25Bit.gguf',
          baseGroupId: 'Hy-MT2-1.8B-1.25Bit',
          label: 'Hy-MT2-1.8B-1.25Bit',
          description: 'GGUF runtime file from Hy-MT2-1.8B-1.25Bit.gguf.',
          estimatedTotalBytes: 461_860_736,
          selectable: true,
          selected: true,
          files: [
            {
              path: 'Hy-MT2-1.8B-1.25Bit.gguf',
              required: true,
              sizeBytes: 461_860_736,
            },
          ],
        },
      ],
    })
  })

  it('translates text through the llama runtime adapter', async () => {
    const prompt = vi.fn(async () => '你好')
    const disposeSession = vi.fn()
    const createContext = vi.fn(async () => ({
      getSequence: () => ({ id: 'sequence' }),
      dispose: vi.fn(),
    }))
    const loadModel = vi.fn(async () => ({
      createContext,
      dispose: vi.fn(),
    }))
    const getLlama = vi.fn(async () => ({ loadModel }))
    const factory = createLocalLlamaTranslatorFactory({
      defaultModel: 'demo.gguf',
      loadModule: async () => ({
        getLlama,
        LlamaChatSession: class {
          prompt = prompt
          dispose = disposeSession
        },
      }),
    })

    const translator = await factory.create({
      sourceLanguage: 'en',
      targetLanguage: 'zh',
    })
    const outputs: string[] = []
    for await (const event of translator.batchTranslate(['Hello'])) {
      outputs.push(event.output)
    }

    expect(getLlama).toHaveBeenCalledTimes(1)
    expect(loadModel).toHaveBeenCalledWith({ modelPath: 'demo.gguf', gpuLayers: undefined })
    expect(createContext).toHaveBeenCalledTimes(1)
    expect(prompt).toHaveBeenCalledWith(
      expect.stringContaining('Translate the following text from en to zh.')
    )
    expect(outputs).toEqual(['你好'])
    expect(disposeSession).toHaveBeenCalledTimes(1)
  })
})
