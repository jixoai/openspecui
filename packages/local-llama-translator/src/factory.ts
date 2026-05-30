import type {
  BatchTranslationResult,
  Translator,
  TranslatorFactory,
  TranslatorFactoryCreateOptions,
  TranslatorFactoryPrepareOptions,
} from '@openspecui/core/translator'
import { runControlledTranslationTask } from '@openspecui/core/translator'
import { join } from 'node:path'

interface LlamaRuntimeModule {
  getLlama(): Promise<LlamaRuntime>
  LlamaChatSession: new (options: { contextSequence: unknown; systemPrompt?: string }) => {
    prompt(prompt: string): Promise<string>
    dispose?: () => Promise<void> | void
  }
}

interface LlamaRuntime {
  loadModel(options: {
    modelPath: string
    gpuLayers?: number | 'auto' | 'max'
    useMmap?: boolean
    useMlock?: boolean
    defaultContextFlashAttention?: boolean
  }): Promise<LlamaRuntimeModel>
}

interface LlamaRuntimeModel {
  createContext(options?: {
    contextSize?: number
    batchSize?: number
    flashAttention?: boolean
  }): Promise<LlamaRuntimeContext>
  dispose?: () => Promise<void> | void
}

interface LlamaRuntimeContext {
  getSequence(): unknown
  dispose?: () => Promise<void> | void
}

export interface LocalLlamaTranslatorFactoryOptions {
  defaultModel?: string
  cacheDir?: string
  loadModule?: () => Promise<LlamaRuntimeModule>
  contextSize?: number
  gpuLayers?: number
  systemPrompt?: string
  batchSize?: number
  flashAttention?: boolean
  useMmap?: boolean
  useMlock?: boolean
}

interface ResolvedLlamaRuntimeConfig {
  modelPath?: string
  contextSize?: number
  gpuLayers?: number | 'auto' | 'max'
  systemPrompt?: string
  batchSize?: number
  flashAttention?: boolean
  useMmap?: boolean
  useMlock?: boolean
}

export interface LocalLlamaRuntimeProbeOptions {
  model: string
  cacheDir?: string
  runtimeConfig?: Record<string, unknown>
  loadModule?: () => Promise<LlamaRuntimeModule>
  contextSize?: number
  gpuLayers?: number
  monitor?: TranslatorFactoryPrepareOptions['monitor']
}

const DEFAULT_SYSTEM_PROMPT =
  'You are a translation engine. Return only the translated text, preserve Markdown structure, inline code, URLs, and file paths.'

export class LocalLlamaTranslatorFactory implements TranslatorFactory {
  constructor(private readonly options: LocalLlamaTranslatorFactoryOptions = {}) {}

  async prepare(options: TranslatorFactoryPrepareOptions): Promise<void> {
    const model = options.model || this.options.defaultModel
    if (!model) {
      throw new Error('A GGUF model id or runtime model path is required.')
    }
    await probeLocalLlamaRuntimeModel({
      model,
      cacheDir: this.options.cacheDir,
      runtimeConfig: options.runtimeConfig,
      loadModule: this.options.loadModule,
      contextSize: this.options.contextSize,
      gpuLayers: this.options.gpuLayers,
      monitor: options.monitor,
    })
  }

  async create(options: TranslatorFactoryCreateOptions): Promise<Translator> {
    const model = options.model || this.options.defaultModel
    if (!model) {
      throw new Error('A GGUF model id or runtime model path is required.')
    }
    const module = await (this.options.loadModule ?? loadLlamaRuntimeModule)()
    const resolvedConfig = readRuntimeConfig(options.runtimeConfig)
    const runtimeModel = await loadRuntimeModel({
      module,
      model,
      cacheDir: this.options.cacheDir,
      runtimeConfig: resolvedConfig,
      defaultGpuLayers: this.options.gpuLayers,
      monitor: options.monitor,
    })
    options.monitor?.setStatus({ message: `Llama model ${model} is ready.`, progress: 1 })
    return new LocalLlamaTranslator(module, runtimeModel, {
      sourceLanguage: options.sourceLanguage,
      targetLanguage: options.targetLanguage,
      runtimeConfig: resolvedConfig,
      factoryOptions: this.options,
      model,
    })
  }
}

export function createLocalLlamaTranslatorFactory(
  options: LocalLlamaTranslatorFactoryOptions = {}
): LocalLlamaTranslatorFactory {
  return new LocalLlamaTranslatorFactory(options)
}

export async function probeLocalLlamaRuntimeModel(
  input: LocalLlamaRuntimeProbeOptions
): Promise<void> {
  const module = await (input.loadModule ?? loadLlamaRuntimeModule)()
  const resolvedConfig = readRuntimeConfig(input.runtimeConfig)
  const runtimeModel = await loadRuntimeModel({
    module,
    model: input.model,
    cacheDir: input.cacheDir,
    runtimeConfig: resolvedConfig,
    defaultGpuLayers: input.gpuLayers,
    monitor: input.monitor,
  })
  try {
    const context = await runtimeModel.createContext({
      contextSize: resolvedConfig.contextSize ?? input.contextSize,
    })
    try {
      input.monitor?.setStatus({ message: `Llama model ${input.model} is ready.`, progress: 1 })
    } finally {
      await disposeRuntimeNode(context)
    }
  } finally {
    await disposeRuntimeNode(runtimeModel)
  }
}

class LocalLlamaTranslator implements Translator {
  constructor(
    private readonly module: LlamaRuntimeModule,
    private readonly model: LlamaRuntimeModel,
    private readonly options: {
      sourceLanguage: string
      targetLanguage: string
      runtimeConfig: ResolvedLlamaRuntimeConfig
      factoryOptions: LocalLlamaTranslatorFactoryOptions
      model: string
    }
  ) {}

  async *batchTranslate(
    inputs: string[],
    options?: { instructions?: string; context?: string; signal?: AbortSignal; timeoutMs?: number }
  ): AsyncGenerator<BatchTranslationResult> {
    for (const [index, input] of inputs.entries()) {
      const controlled = await runControlledTranslationTask(async (signal) => {
        throwIfAborted(signal)
        const context = await this.model.createContext({
          contextSize:
            this.options.runtimeConfig.contextSize ?? this.options.factoryOptions.contextSize,
          batchSize: this.options.runtimeConfig.batchSize ?? this.options.factoryOptions.batchSize,
          flashAttention:
            this.options.runtimeConfig.flashAttention ?? this.options.factoryOptions.flashAttention,
        })
        try {
          const session = new this.module.LlamaChatSession({
            contextSequence: context.getSequence(),
            systemPrompt:
              this.options.runtimeConfig.systemPrompt ??
              this.options.factoryOptions.systemPrompt ??
              DEFAULT_SYSTEM_PROMPT,
          })
          try {
            const output = await session.prompt(
              buildTranslationPrompt({
                sourceLanguage: this.options.sourceLanguage,
                targetLanguage: this.options.targetLanguage,
                text: input,
                instructions: options?.instructions,
                context: options?.context,
              })
            )
            throwIfAborted(signal)
            return output.trim()
          } finally {
            await disposeRuntimeNode(session)
          }
        } finally {
          await disposeRuntimeNode(context)
        }
      }, options)

      if (controlled.ok) {
        yield { index, output: controlled.value }
        continue
      }
      yield { index, error: controlled.error }
    }
  }

  destroy(): void {
    void disposeRuntimeNode(this.model)
  }
}

async function loadRuntimeModel(input: {
  module: LlamaRuntimeModule
  model: string
  cacheDir?: string
  runtimeConfig: ResolvedLlamaRuntimeConfig
  defaultGpuLayers?: number
  monitor?: { setStatus(input: { message: string; progress?: number }): void }
}): Promise<LlamaRuntimeModel> {
  input.monitor?.setStatus({ message: `Loading llama model ${input.model}.` })
  const llama = await input.module.getLlama()
  return llama.loadModel({
    modelPath: resolveModelPath({
      model: input.model,
      cacheDir: input.cacheDir,
      runtimeConfig: input.runtimeConfig,
    }),
    gpuLayers: input.runtimeConfig.gpuLayers ?? input.defaultGpuLayers,
    useMmap: input.runtimeConfig.useMmap,
    useMlock: input.runtimeConfig.useMlock,
    defaultContextFlashAttention: input.runtimeConfig.flashAttention,
  })
}

function buildTranslationPrompt(input: {
  sourceLanguage: string
  targetLanguage: string
  text: string
  instructions?: string
  context?: string
}): string {
  const sections = [
    `Translate the following text from ${input.sourceLanguage} to ${input.targetLanguage}.`,
    'Return only the translated text.',
  ]
  if (input.instructions?.trim()) {
    sections.push(`Additional instructions:\n${input.instructions.trim()}`)
  }
  if (input.context?.trim()) {
    sections.push(`Translation context:\n${input.context.trim()}`)
  }
  sections.push(`Text:\n${input.text}`)
  return sections.join('\n\n')
}

async function loadLlamaRuntimeModule(): Promise<LlamaRuntimeModule> {
  return (await import('node-llama-cpp')) as LlamaRuntimeModule
}

function resolveModelPath(input: {
  model: string
  cacheDir?: string
  runtimeConfig: ResolvedLlamaRuntimeConfig
}): string {
  if (input.runtimeConfig.modelPath) return input.runtimeConfig.modelPath
  if (input.cacheDir) return join(input.cacheDir, 'models', input.model)
  return input.model
}

function readRuntimeConfig(
  runtimeConfig: Record<string, unknown> | undefined
): ResolvedLlamaRuntimeConfig {
  return {
    modelPath: readString(runtimeConfig, 'modelPath'),
    contextSize: readNumber(runtimeConfig, 'contextSize'),
    gpuLayers: readGpuLayers(runtimeConfig?.gpuLayers),
    systemPrompt: readString(runtimeConfig, 'systemPrompt'),
    batchSize: readNumber(runtimeConfig, 'batchSize'),
    flashAttention: readBoolean(runtimeConfig, 'flashAttention'),
    useMmap: readBoolean(runtimeConfig, 'useMmap'),
    useMlock: readBoolean(runtimeConfig, 'useMlock'),
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

function readBoolean(
  record: Record<string, unknown> | undefined,
  key: string
): boolean | undefined {
  const value = record?.[key]
  return typeof value === 'boolean' ? value : undefined
}

function readGpuLayers(value: unknown): ResolvedLlamaRuntimeConfig['gpuLayers'] {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (value === 'auto' || value === 'max') return value
  return undefined
}

async function disposeRuntimeNode(
  value: { dispose?: () => Promise<void> | void } | null | undefined
): Promise<void> {
  await value?.dispose?.()
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError')
  }
}
