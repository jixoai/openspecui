import { describe, expect, it, vi } from 'vitest'
import {
  createLocalCt2TranslatorFactory,
  resolveCt2ModelDownloadPlan,
  resolveCt2ModelDownloadPlanFromRepositoryFiles,
} from './index.js'

describe('local-ct2-translator package', () => {
  it('resolves a root-level CT2 download plan', () => {
    const plan = resolveCt2ModelDownloadPlan({
      modelId: 'ooeoeo/opus-mt-en-zh-ct2-float16',
      siblings: [
        { rfilename: 'config.json', size: 1_234 },
        { rfilename: 'model.bin', size: 120_000_000 },
        { rfilename: 'shared_vocabulary.json', size: 42_000 },
        { rfilename: 'source.spm', size: 810_000 },
        { rfilename: 'target.spm', size: 790_000 },
        { rfilename: 'tokenizer_config.json', size: 120 },
        { rfilename: 'vocab.json', size: 9_999 },
      ],
    })

    expect(plan).toMatchObject({
      modelId: 'ooeoeo/opus-mt-en-zh-ct2-float16',
      selectedGroupId: 'default',
    })
    expect(plan?.groups?.[0]).toMatchObject({
      id: 'default',
      label: 'default',
      selectable: true,
    })
    expect(plan?.files.map((file) => file.path)).toEqual([
      'config.json',
      'model.bin',
      'shared_vocabulary.json',
      'source.spm',
      'target.spm',
      'tokenizer_config.json',
      'vocab.json',
    ])
  })

  it('picks the smallest selectable CT2 variant when multiple roots exist', () => {
    const plan = resolveCt2ModelDownloadPlan({
      modelId: 'example/opus-mt-en-zh-ct2',
      siblings: [
        { rfilename: 'float16/config.json', size: 100 },
        { rfilename: 'float16/model.bin', size: 100_000 },
        { rfilename: 'float16/shared_vocabulary.json', size: 100 },
        { rfilename: 'float16/source.spm', size: 100 },
        { rfilename: 'float16/target.spm', size: 100 },
        { rfilename: 'int8/config.json', size: 100 },
        { rfilename: 'int8/model.bin', size: 50_000 },
        { rfilename: 'int8/shared_vocabulary.json', size: 100 },
        { rfilename: 'int8/source.spm', size: 100 },
        { rfilename: 'int8/target.spm', size: 100 },
      ],
    })

    expect(plan?.selectedGroupId).toBe('int8')
    expect(plan?.groups?.map((group) => group.id)).toEqual(['float16', 'int8'])
    expect(plan?.groups?.find((group) => group.id === 'int8')?.selected).toBe(true)
  })

  it('returns null when CT2 required files are incomplete', () => {
    const plan = resolveCt2ModelDownloadPlan({
      modelId: 'example/broken-ct2',
      siblings: [
        { rfilename: 'config.json', size: 100 },
        { rfilename: 'model.bin', size: 100_000 },
        { rfilename: 'shared_vocabulary.json', size: 100 },
        { rfilename: 'source.spm', size: 100 },
      ],
    })

    expect(plan).toBeNull()
  })

  it('marks a CT2 variant as non-selectable when required sizes are unknown', () => {
    const plan = resolveCt2ModelDownloadPlanFromRepositoryFiles({
      modelId: 'example/size-unknown',
      files: [
        { path: 'config.json', sizeBytes: 10 },
        { path: 'model.bin' },
        { path: 'shared_vocabulary.json', sizeBytes: 10 },
        { path: 'source.spm', sizeBytes: 10 },
        { path: 'target.spm', sizeBytes: 10 },
      ],
    })

    expect(plan?.groups?.[0]).toMatchObject({
      id: 'default',
      selectable: false,
    })
    expect(plan?.selectedGroupId).toBe('default')
  })

  it('prepares a CT2 model by constructing the native translator', async () => {
    const ctor = vi.fn()
    const factory = createLocalCt2TranslatorFactory({
      cacheDir: '/tmp/openspecui-ct2-cache',
      threads: 4,
      loadModule: async () => ({
        Ct2Translator: class {
          constructor(options: { modelPath: string; device?: string; threads?: number }) {
            ctor(options)
          }

          async translateBatch(): Promise<Array<{ text: string }>> {
            return []
          }
        },
      }),
    })
    const status = vi.fn()

    await factory.prepare({
      sourceLanguage: 'en',
      targetLanguage: 'zh',
      model: 'ooeoeo/opus-mt-en-zh-ct2-float16',
      monitor: { setStatus: status },
      runtimeConfig: { modelPath: '/tmp/models/custom-ct2-root' },
    })

    expect(ctor).toHaveBeenCalledWith({
      modelPath: '/tmp/models/custom-ct2-root',
      device: undefined,
      threads: 4,
    })
    expect(status).toHaveBeenLastCalledWith({
      message: 'CT2 model ooeoeo/opus-mt-en-zh-ct2-float16 is ready.',
      progress: 1,
    })
  })

  it('creates a translator and yields one output per input', async () => {
    const translateBatch = vi.fn(async (source: string[]) =>
      source.map((entry) => ({ text: `zh:${entry}` }))
    )
    const factory = createLocalCt2TranslatorFactory({
      beamSize: 3,
      maxBatchSize: 8,
      loadModule: async () => ({
        Ct2Translator: class {
          async translateBatch(
            source: string[],
            options?: { beamSize?: number; maxBatchSize?: number; returnScores?: boolean }
          ): Promise<Array<{ text: string }>> {
            return translateBatch(source, options)
          }
        },
      }),
    })

    const translator = await factory.create({
      sourceLanguage: 'en',
      targetLanguage: 'zh',
      model: '/tmp/models/ct2-root',
    })
    const result: Array<{ index: number; output: string }> = []
    for await (const item of translator.batchTranslate(['Hello', 'World'])) {
      result.push(item)
    }

    expect(result).toEqual([
      { index: 0, output: 'zh:Hello' },
      { index: 1, output: 'zh:World' },
    ])
    expect(translateBatch).toHaveBeenCalledWith(['Hello', 'World'], {
      beamSize: 3,
      maxBatchSize: 8,
      returnScores: false,
    })
  })
})
