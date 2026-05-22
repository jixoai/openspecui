import type {
  RichTranslationInput,
  Translator,
  TranslatorFactory,
  TranslatorFactoryCreateOptions,
  TranslatorOptions,
} from '@openspecui/core/translator'
import { chat, createModel, extendAdapter } from '@tanstack/ai'
import {
  createOpenaiChatCompletions,
  type OpenAIChatCompletionsConfig,
  type OpenAIChatModel,
} from '@tanstack/ai-openai'

export interface AiTranslatorFactoryOptions {
  baseUrl: string
  token: string
  model: string
}

export class AiTranslatorFactory implements TranslatorFactory {
  constructor(private readonly options: AiTranslatorFactoryOptions) {}

  async create(options: TranslatorFactoryCreateOptions): Promise<Translator> {
    if (!this.options.token.trim()) {
      throw new Error('AI translator token is required.')
    }
    options.monitor?.setStatus({ message: 'Preparing AI translator.', progress: 1 })
    return new AiTranslator({
      ...this.options,
      sourceLanguage: options.sourceLanguage,
      targetLanguage: options.targetLanguage,
      model: options.model || this.options.model,
    })
  }
}

export function createAiTranslatorFactory(
  options: AiTranslatorFactoryOptions
): AiTranslatorFactory {
  return new AiTranslatorFactory(options)
}

class AiTranslator implements Translator {
  constructor(
    private readonly options: AiTranslatorFactoryOptions & {
      sourceLanguage: string
      targetLanguage: string
    }
  ) {}

  async translate(
    input: string | RichTranslationInput,
    options?: TranslatorOptions
  ): Promise<string> {
    const abortController = createAbortController(options?.signal)
    const richInput =
      typeof input === 'string'
        ? {
            instructions: 'Translate the source accurately. Return only the translated text.',
            context: '',
            source: input,
          }
        : input
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
          richInput.instructions,
          'Return only the translated source without commentary.',
        ]
          .filter(Boolean)
          .join('\n'),
      ],
      messages: [
        {
          role: 'user',
          content: [
            richInput.context ? `<context>\n${richInput.context}\n</context>` : '',
            `<source>\n${richInput.source}\n</source>`,
          ]
            .filter(Boolean)
            .join('\n\n'),
        },
      ],
    })
    return text.trim()
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
      throw new Error('AI translator OpenAI runtime config is required.')
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
