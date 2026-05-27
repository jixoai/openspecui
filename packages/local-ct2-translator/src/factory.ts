import type {
  Translator,
  TranslatorFactory,
  TranslatorFactoryCreateOptions,
  TranslatorFactoryPrepareOptions,
} from '@openspecui/core/translator'
import type { TranslateBatchOptions, TranslationResult } from 'ctranslate2'
import { join } from 'node:path'

interface Ct2RuntimeTranslator {
  translateBatch(
    source: string[],
    options?: TranslateBatchOptions | undefined | null
  ): Promise<TranslationResult[]>
}

interface Ct2RuntimeModule {
  Ct2Translator: new (options: {
    modelPath: string
    device?: string
    threads?: number
  }) => Ct2RuntimeTranslator
}

export interface LocalCt2TranslatorFactoryOptions {
  defaultModel?: string
  cacheDir?: string
  device?: string
  threads?: number
  beamSize?: number
  maxBatchSize?: number
  loadModule?: () => Promise<Ct2RuntimeModule>
}

interface ResolvedCt2RuntimeConfig {
  modelPath?: string
  device?: string
  threads?: number
  beamSize?: number
  maxBatchSize?: number
}

export class LocalCt2TranslatorFactory implements TranslatorFactory {
  constructor(private readonly options: LocalCt2TranslatorFactoryOptions = {}) {}

  async prepare(options: TranslatorFactoryPrepareOptions): Promise<void> {
    const model = options.model || this.options.defaultModel
    if (!model) {
      throw new Error('A CT2 model id or runtime model path is required.')
    }
    const resolvedConfig = readRuntimeConfig(options.runtimeConfig)
    const modelPath = resolveModelPath({
      model,
      cacheDir: this.options.cacheDir,
      runtimeConfig: resolvedConfig,
    })
    options.monitor?.setStatus({ message: `Loading CT2 model ${model}.` })
    await createRuntimeTranslator(this.options, modelPath, resolvedConfig)
    options.monitor?.setStatus({ message: `CT2 model ${model} is ready.`, progress: 1 })
  }

  async create(options: TranslatorFactoryCreateOptions): Promise<Translator> {
    const model = options.model || this.options.defaultModel
    if (!model) {
      throw new Error('A CT2 model id or runtime model path is required.')
    }
    const resolvedConfig = readRuntimeConfig(options.runtimeConfig)
    const modelPath = resolveModelPath({
      model,
      cacheDir: this.options.cacheDir,
      runtimeConfig: resolvedConfig,
    })
    options.monitor?.setStatus({ message: `Loading CT2 model ${model}.` })
    const translator = await createRuntimeTranslator(this.options, modelPath, resolvedConfig)
    options.monitor?.setStatus({ message: `CT2 model ${model} is ready.`, progress: 1 })
    return new LocalCt2Translator(translator, resolvedConfig, this.options)
  }
}

export function createLocalCt2TranslatorFactory(
  options: LocalCt2TranslatorFactoryOptions = {}
): LocalCt2TranslatorFactory {
  return new LocalCt2TranslatorFactory(options)
}

class LocalCt2Translator implements Translator {
  constructor(
    private readonly translator: Ct2RuntimeTranslator,
    private readonly runtimeConfig: ResolvedCt2RuntimeConfig,
    private readonly factoryOptions: LocalCt2TranslatorFactoryOptions
  ) {}

  async *batchTranslate(
    inputs: string[],
    options?: { signal?: AbortSignal }
  ): AsyncGenerator<{ index: number; output: string }> {
    throwIfAborted(options?.signal)
    const result = await this.translator.translateBatch(inputs, {
      beamSize: this.runtimeConfig.beamSize ?? this.factoryOptions.beamSize,
      maxBatchSize: this.runtimeConfig.maxBatchSize ?? this.factoryOptions.maxBatchSize,
      returnScores: false,
    })
    throwIfAborted(options?.signal)
    if (result.length !== inputs.length) {
      throw new Error(
        `CT2 translator returned ${result.length} outputs for ${inputs.length} inputs.`
      )
    }
    for (const [index, entry] of result.entries()) {
      yield { index, output: entry.text }
    }
  }
}

async function createRuntimeTranslator(
  options: LocalCt2TranslatorFactoryOptions,
  modelPath: string,
  runtimeConfig: ResolvedCt2RuntimeConfig
): Promise<Ct2RuntimeTranslator> {
  const module = await (options.loadModule ?? loadCt2RuntimeModule)()
  return new module.Ct2Translator({
    modelPath,
    device: runtimeConfig.device ?? options.device,
    threads: runtimeConfig.threads ?? options.threads,
  })
}

async function loadCt2RuntimeModule(): Promise<Ct2RuntimeModule> {
  return (await import('ctranslate2')) as Ct2RuntimeModule
}

function resolveModelPath(input: {
  model: string
  cacheDir?: string
  runtimeConfig: ResolvedCt2RuntimeConfig
}): string {
  if (input.runtimeConfig.modelPath) return input.runtimeConfig.modelPath
  if (input.cacheDir) return join(input.cacheDir, 'models', input.model)
  return input.model
}

function readRuntimeConfig(
  runtimeConfig: Record<string, unknown> | undefined
): ResolvedCt2RuntimeConfig {
  return {
    modelPath: readString(runtimeConfig, 'modelPath'),
    device: readString(runtimeConfig, 'device'),
    threads: readNumber(runtimeConfig, 'threads'),
    beamSize: readNumber(runtimeConfig, 'beamSize'),
    maxBatchSize: readNumber(runtimeConfig, 'maxBatchSize'),
  }
}

function readString(record: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = record?.[key]
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

function readNumber(record: Record<string, unknown> | undefined, key: string): number | undefined {
  const value = record?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError')
  }
}
