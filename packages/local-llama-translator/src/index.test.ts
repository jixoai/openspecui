import { describe, expect, it, vi } from 'vitest'
import {
  createLocalLlamaTranslatorFactory,
  resolveGgufModelDownloadPlanFromRepositoryFiles,
} from './index.js'

describe('local-llama-translator package', () => {
  it('builds a GGUF download plan from repository files', () => {
    const plan = resolveGgufModelDownloadPlanFromRepositoryFiles({
      modelId: 'bartowski/Qwen2.5-0.5B-Instruct-GGUF',
      files: [
        { path: 'README.md', sizeBytes: 128 },
        { path: 'Qwen2.5-0.5B-Instruct-Q4_K_M.gguf', sizeBytes: 397_942_432 },
        { path: 'Qwen2.5-0.5B-Instruct-IQ2_M.gguf', sizeBytes: 328_597_408 },
      ],
    })

    expect(plan).toMatchObject({
      modelId: 'bartowski/Qwen2.5-0.5B-Instruct-GGUF',
      estimatedTotalBytes: 397_942_432,
      selectedGroupId: 'Qwen2.5-0.5B-Instruct-Q4_K_M.gguf',
    })
    expect(plan?.files).toEqual([
      expect.objectContaining({
        path: 'Qwen2.5-0.5B-Instruct-Q4_K_M.gguf',
        required: true,
        sizeBytes: 397_942_432,
      }),
    ])
    expect(plan?.groups).toEqual([
      expect.objectContaining({
        id: 'Qwen2.5-0.5B-Instruct-Q4_K_M.gguf',
        baseGroupId: 'Qwen2.5-0.5B-Instruct-Q4_K_M',
        selectable: true,
        selected: true,
      }),
      expect.objectContaining({
        id: 'Qwen2.5-0.5B-Instruct-IQ2_M.gguf',
        baseGroupId: 'Qwen2.5-0.5B-Instruct-IQ2_M',
        selectable: true,
        selected: false,
      }),
    ])
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
