import {
  createBrowserTranslationExecution,
  type TranslationEngineExecution,
} from '@/lib/browser-translation'
import { trpcClient } from '@/lib/trpc'
import type { DocumentTranslationConfig } from '@openspecui/core/document-translation'
import {
  TRANSLATOR_CONTRACT_VERSION,
  type TranslationEngineId,
  type Translator,
  type TranslatorFactory,
  type TranslatorFactoryCreateOptions,
} from '@openspecui/core/translator'
import { isStaticMode } from './static-mode'

export function createTranslationEngineExecution(
  config: DocumentTranslationConfig
): TranslationEngineExecution {
  if (config.engineId === 'browser' || isStaticMode()) {
    return createBrowserTranslationExecution()
  }

  const model =
    config.engineId === 'openai' ? config.engines.openai.model : config.engines.local.model

  return {
    factory: new TrpcTranslatorFactory(
      config.engineId,
      model,
      config.engineId === 'local' ? config.engines.local.selectedGroupId : undefined
    ),
    cacheIdentity: {
      engineId: config.engineId,
      model,
      selectedGroupId:
        config.engineId === 'local' ? config.engines.local.selectedGroupId : undefined,
      translatorContractVersion: TRANSLATOR_CONTRACT_VERSION,
    },
  }
}

export async function runSingleTranslation(input: {
  engineId: TranslationEngineId
  sourceLanguage: string
  targetLanguage: string
  text: string
  model?: string
  selectedGroupId?: string
}): Promise<string> {
  if (input.engineId === 'browser') {
    const translator = await createBrowserTranslationExecution().factory.create({
      sourceLanguage: input.sourceLanguage,
      targetLanguage: input.targetLanguage,
    })
    try {
      return await readSingleBatchOutput(translator.batchTranslate([input.text]))
    } finally {
      translator.destroy?.()
    }
  }

  const translator = new TrpcTranslator({
    engineId: input.engineId,
    sourceLanguage: input.sourceLanguage,
    targetLanguage: input.targetLanguage,
    model: input.model,
    selectedGroupId: input.engineId === 'local' ? input.selectedGroupId : undefined,
  })
  return readSingleBatchOutput(translator.batchTranslate([input.text]))
}

export class TrpcTranslatorFactory implements TranslatorFactory {
  constructor(
    private readonly engineId: Exclude<TranslationEngineId, 'browser'>,
    private readonly model: string | undefined,
    private readonly selectedGroupId: string | undefined
  ) {}

  async create(options: TranslatorFactoryCreateOptions): Promise<Translator> {
    return new TrpcTranslator({
      engineId: this.engineId,
      sourceLanguage: options.sourceLanguage,
      targetLanguage: options.targetLanguage,
      model: options.model ?? this.model,
      selectedGroupId: this.engineId === 'local' ? this.selectedGroupId : undefined,
    })
  }
}

export class TrpcTranslator implements Translator {
  constructor(
    private readonly options: {
      engineId: Exclude<TranslationEngineId, 'browser'>
      sourceLanguage: string
      targetLanguage: string
      model?: string
      selectedGroupId?: string
    }
  ) {}

  async *batchTranslate(
    inputs: string[],
    options?: { instructions?: string; context?: string; signal?: AbortSignal }
  ): AsyncGenerator<{ index: number; output: string }> {
    if (options?.signal?.aborted) {
      throw new DOMException('Translation cancelled.', 'AbortError')
    }

    const queue: Array<{ index: number; output: string }> = []
    let completed = false
    let thrown: Error | null = null

    const subscription = trpcClient.translationEngines.batchTranslate.subscribe(
      {
        engineId: this.options.engineId,
        sourceLanguage: this.options.sourceLanguage,
        targetLanguage: this.options.targetLanguage,
        model: this.options.model,
        selectedGroupId: this.options.selectedGroupId,
        inputs,
        instructions: options?.instructions,
        context: options?.context,
      },
      {
        onData(event) {
          queue.push(event)
        },
        onError(error) {
          thrown = error instanceof Error ? error : new Error(String(error))
          completed = true
        },
        onComplete() {
          completed = true
        },
      }
    )

    try {
      while (!completed || queue.length > 0) {
        if (options?.signal?.aborted) {
          throw new DOMException('Translation cancelled.', 'AbortError')
        }
        const item = queue.shift()
        if (item) {
          yield item
          continue
        }
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
      if (thrown) throw thrown
    } finally {
      subscription.unsubscribe()
    }
  }
}

export async function readSingleBatchOutput(
  stream: AsyncGenerator<{ index: number; output: string }>
): Promise<string> {
  for await (const item of stream) {
    return item.output
  }
  throw new Error('Translator returned no batch output.')
}
