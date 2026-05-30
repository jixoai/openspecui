import { buildLocalDownloadPlanFromRepositoryFiles } from '@openspecui/core/local-download-profiles'
import type {
  BatchTranslationResult,
  TranslationModelDownloadPlan,
  Translator,
  TranslatorFactory,
  TranslatorFactoryCreateOptions,
  TranslatorFactoryPrepareOptions,
} from '@openspecui/core/translator'
import { runControlledTranslationTask } from '@openspecui/core/translator'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

type TranslationPipeline = (
  input: string | string[],
  options?: Record<string, unknown>
) => Promise<unknown>

interface TransformersModule {
  env?: {
    cacheDir?: string | null
    allowRemoteModels?: boolean
    allowLocalModels?: boolean
    localModelPath?: string
  }
  pipeline(
    task: 'translation',
    model: string,
    options?: {
      config?: Record<string, unknown>
      dtype?: string
      local_files_only?: boolean
      progress_callback?: (event: unknown) => void
    }
  ): Promise<TranslationPipeline>
}

export interface LocalTranslatorFactoryOptions {
  defaultModel?: string
  cacheDir?: string
  dtype?: string
  localOnly?: boolean
}

const DEFAULT_MODEL = 'Xenova/nllb-200-distilled-600M'

export class LocalTranslatorFactory implements TranslatorFactory {
  constructor(private readonly options: LocalTranslatorFactoryOptions = {}) {}

  async prepare(options: TranslatorFactoryPrepareOptions): Promise<void> {
    const model = options.model || this.options.defaultModel || DEFAULT_MODEL
    const pipeline = await loadTranslationPipeline(
      model,
      options.monitor,
      this.options.cacheDir,
      options.dtype ?? this.options.dtype,
      this.options.localOnly,
      options.runtimeConfig
    )
    await pipeline.dispose?.()
  }

  async create(options: TranslatorFactoryCreateOptions): Promise<Translator> {
    const model = options.model || this.options.defaultModel || DEFAULT_MODEL
    const pipeline = await loadTranslationPipeline(
      model,
      options.monitor,
      this.options.cacheDir,
      options.dtype ?? this.options.dtype,
      this.options.localOnly,
      options.runtimeConfig
    )

    return new LocalTranslator(pipeline, {
      sourceLanguage: options.sourceLanguage,
      targetLanguage: options.targetLanguage,
    })
  }
}

export function resolveLocalModelDownloadPlan(input: {
  modelId: string
  siblings: ReadonlyArray<{ rfilename: string; size?: number }>
  isEncoderDecoder?: boolean
}): TranslationModelDownloadPlan | null {
  return buildLocalDownloadPlanFromRepositoryFiles({
    modelId: input.modelId,
    isEncoderDecoder: input.isEncoderDecoder,
    files: input.siblings.map((entry) => ({
      path: entry.rfilename,
      sizeBytes: entry.size,
    })),
  })
}

export function createLocalTranslatorFactory(
  options: LocalTranslatorFactoryOptions = {}
): LocalTranslatorFactory {
  return new LocalTranslatorFactory(options)
}

class LocalTranslator implements Translator {
  constructor(
    private readonly pipeline: TranslationPipeline & { dispose?: () => Promise<void> },
    private readonly languages: { sourceLanguage: string; targetLanguage: string }
  ) {}

  async *batchTranslate(
    inputs: string[],
    options?: { signal?: AbortSignal; timeoutMs?: number }
  ): AsyncGenerator<BatchTranslationResult> {
    for (const [index, input] of inputs.entries()) {
      const controlled = await runControlledTranslationTask(async (signal) => {
        const result = await this.pipeline(input, {
          src_lang: this.languages.sourceLanguage,
          tgt_lang: this.languages.targetLanguage,
          signal,
        })
        throwIfAborted(signal)
        return readTranslatedOutputs(result, 1)[0] ?? ''
      }, options)

      if (controlled.ok) {
        yield { index, output: controlled.value }
        continue
      }
      yield { index, error: controlled.error }
    }
  }

  destroy(): void {
    void this.pipeline.dispose?.()
  }
}

async function loadTranslationPipeline(
  model: string,
  monitor?: { setStatus(input: { message: string; progress?: number }): void },
  cacheDir?: string,
  dtype?: string,
  localOnly = false,
  runtimeConfig?: Record<string, unknown>
): Promise<TranslationPipeline & { dispose?: () => Promise<void> }> {
  monitor?.setStatus({ message: `Loading local model ${model}.` })
  const transformers = (await import('@huggingface/transformers')) as TransformersModule
  if (cacheDir && transformers.env) {
    transformers.env.cacheDir = cacheDir
    transformers.env.localModelPath = join(cacheDir, 'models')
  }
  if (transformers.env) {
    transformers.env.allowLocalModels = true
    transformers.env.allowRemoteModels = !localOnly
  }
  const runtimeModel = localOnly && cacheDir ? join(cacheDir, 'models', model) : model
  const progressCallback = monitor
    ? (event: unknown) => {
        const progress = readProgress(event)
        monitor.setStatus({
          message:
            progress === undefined
              ? `Downloading local model ${model}.`
              : `Downloading local model ${model} ${Math.round(progress * 100)}%.`,
          ...(progress === undefined ? {} : { progress }),
        })
      }
    : undefined
  const pipeline = (await transformers.pipeline('translation', runtimeModel, {
    config: runtimeConfig ?? (await readLocalRuntimeConfig({ cacheDir, model, localOnly })),
    ...(dtype ? { dtype } : {}),
    ...(localOnly ? { local_files_only: true } : {}),
    ...(progressCallback ? { progress_callback: progressCallback } : {}),
  })) as TranslationPipeline & { dispose?: () => Promise<void> }
  monitor?.setStatus({ message: `Local model ${model} is ready.`, progress: 1 })
  return pipeline
}

async function readLocalRuntimeConfig(input: {
  cacheDir?: string
  model: string
  localOnly: boolean
}): Promise<Record<string, unknown> | undefined> {
  if (!input.localOnly || !input.cacheDir) return undefined
  const configPath = join(input.cacheDir, 'models', input.model, 'config.json')
  try {
    return JSON.parse(await readFile(configPath, 'utf8')) as Record<string, unknown>
  } catch {
    return undefined
  }
}

function readTranslatedText(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    const first = value[0]
    if (first && typeof first === 'object') {
      const text = (first as { translation_text?: unknown; generated_text?: unknown })
        .translation_text
      if (typeof text === 'string') return text
      const generated = (first as { generated_text?: unknown }).generated_text
      if (typeof generated === 'string') return generated
    }
  }
  if (value && typeof value === 'object') {
    const text = (value as { translation_text?: unknown; generated_text?: unknown })
      .translation_text
    if (typeof text === 'string') return text
    const generated = (value as { generated_text?: unknown }).generated_text
    if (typeof generated === 'string') return generated
  }
  return String(value)
}

function readTranslatedOutputs(value: unknown, expectedCount: number): string[] {
  const entries = Array.isArray(value) ? value : [value]
  const outputs = entries.map((entry) => readTranslatedText(entry))

  if (outputs.length === expectedCount) return outputs
  if (expectedCount === 1 && outputs.length > 0) return [outputs[0]]
  if (outputs.length === 1 && expectedCount > 1) {
    return Array.from({ length: expectedCount }, () => outputs[0])
  }

  throw new Error(`Translator returned ${outputs.length} outputs for ${expectedCount} inputs.`)
}

function readProgress(event: unknown): number | undefined {
  if (!event || typeof event !== 'object') return undefined
  const record = event as { progress?: unknown; loaded?: unknown; total?: unknown }
  if (typeof record.progress === 'number') {
    return Math.max(0, Math.min(1, record.progress / (record.progress > 1 ? 100 : 1)))
  }
  if (typeof record.loaded === 'number' && typeof record.total === 'number' && record.total > 0) {
    return Math.max(0, Math.min(1, record.loaded / record.total))
  }
  return undefined
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError')
  }
}
