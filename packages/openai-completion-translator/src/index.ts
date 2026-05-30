import type {
  BatchTranslationResult,
  Translator,
  TranslatorFactory,
  TranslatorFactoryCreateOptions,
  TranslatorOptions,
} from '@openspecui/core/translator'
import { runControlledTranslationTask } from '@openspecui/core/translator'
import { chat, createModel, extendAdapter } from '@tanstack/ai'
import {
  createOpenaiChatCompletions,
  type OpenAIChatCompletionsConfig,
  type OpenAIChatModel,
} from '@tanstack/ai-openai'

export interface OpenAICompletionTranslatorFactoryOptions {
  baseUrl: string
  token: string
  model: string
}

export class OpenAICompletionTranslatorFactory implements TranslatorFactory {
  constructor(private readonly options: OpenAICompletionTranslatorFactoryOptions) {}

  async create(options: TranslatorFactoryCreateOptions): Promise<Translator> {
    if (!this.options.token.trim()) {
      throw new Error('OpenAI completion translator token is required.')
    }
    options.monitor?.setStatus({ message: 'Preparing OpenAI completion translator.', progress: 1 })
    return new OpenAICompletionTranslator({
      ...this.options,
      sourceLanguage: options.sourceLanguage,
      targetLanguage: options.targetLanguage,
      model: options.model || this.options.model,
    })
  }
}

export function createOpenAICompletionTranslatorFactory(
  options: OpenAICompletionTranslatorFactoryOptions
): OpenAICompletionTranslatorFactory {
  return new OpenAICompletionTranslatorFactory(options)
}

class OpenAICompletionTranslator implements Translator {
  constructor(
    private readonly options: OpenAICompletionTranslatorFactoryOptions & {
      sourceLanguage: string
      targetLanguage: string
    }
  ) {}

  async *batchTranslate(
    inputs: string[],
    options?: TranslatorOptions
  ): AsyncGenerator<BatchTranslationResult> {
    for (const [index, source] of inputs.entries()) {
      const controlled = await runControlledTranslationTask(async (signal) => {
        const abortController = createAbortController(signal)
        const adapter = createConfiguredOpenAiAdapter({
          model: this.options.model,
          token: this.options.token,
          baseUrl: this.options.baseUrl,
        })
        const text = await chat({
          adapter,
          stream: false,
          temperature: 0,
          abortController,
          systemPrompts: [
            [
              'You are a translation engine.',
              `Translate from ${this.options.sourceLanguage} to ${this.options.targetLanguage}.`,
              options?.instructions ?? 'Translate the source accurately.',
              'Return only the translated source without commentary.',
            ]
              .filter(Boolean)
              .join('\n'),
          ],
          messages: [
            {
              role: 'user',
              content: [
                options?.context ? `<context>\n${options.context}\n</context>` : '',
                `<source>\n${source}\n</source>`,
              ]
                .filter(Boolean)
                .join('\n\n'),
            },
          ],
        })
        return text.trim()
      }, options)

      if (controlled.ok) {
        yield { index, output: controlled.value }
        continue
      }
      yield { index, error: controlled.error }
    }
  }
}

function createAbortController(signal: AbortSignal | undefined): AbortController | undefined {
  if (!signal) return undefined
  const controller = new AbortController()
  if (signal.aborted) {
    controller.abort(signal.reason)
    return controller
  }
  signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true })
  return controller
}

interface ConfiguredOpenAiAdapterInput {
  model: string
  token: string
  baseUrl: string
}

type RuntimeOpenAiConfig = Omit<OpenAIChatCompletionsConfig, 'apiKey'> & {
  apiKey: string
}

function createConfiguredOpenAiAdapter(input: ConfiguredOpenAiAdapterInput) {
  const createRuntimeAdapter = (model: OpenAIChatModel, config?: RuntimeOpenAiConfig) => {
    if (!config) {
      throw new Error('OpenAI completion runtime config is required.')
    }
    return createOpenaiChatCompletions(model, config.apiKey, config)
  }
  const openAi = extendAdapter(createRuntimeAdapter, [
    createModel(input.model, ['text'] as const),
  ] as const)
  return openAi(input.model, {
    apiKey: input.token,
    baseURL: normalizeBaseUrl(input.baseUrl),
  })
}

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '')
  if (!trimmed) return 'https://api.openai.com/v1'
  return trimmed
}
