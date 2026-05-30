import {
  createBrowserTranslationExecution,
  getBrowserSupportTableState,
  patchBrowserSupportTableRow,
  scanBrowserTranslationPairs,
  type BrowserTranslationStatus,
  type BrowserTranslationSupportTableState,
  type TranslationEngineExecution,
} from '@/lib/browser-translation'
import { trpcClient } from '@/lib/trpc'
import type { DocumentTranslationConfig } from '@openspecui/core/document-translation'
import { checkLocalDirectionalModelLanguagePair } from '@openspecui/core/translation-language-pair'
import {
  DEFAULT_BATCH_TRANSLATION_TIMEOUT_MS,
  TRANSLATOR_CONTRACT_VERSION,
  isDirectionalManagedLocalTranslationEngineId,
  isManagedLocalTranslationEngineId,
  shouldShowTranslationEngineInstallGate,
  type BatchTranslationResult,
  type LocalModelAssetState,
  type TranslationEngineId,
  type TranslationEngineLifecycleStatus,
  type TranslationModelDownloadPlan,
  type Translator,
  type TranslatorFactory,
  type TranslatorFactoryCreateOptions,
} from '@openspecui/core/translator'
import { isStaticMode } from './static-mode'
import {
  projectTranslateServiceStatus,
  type TranslateServiceStatus,
} from './translate-service-status'

export interface TranslateServiceState {
  capability: BrowserTranslationStatus | null
  browserSupportTable: BrowserTranslationSupportTableState | null
  status: TranslateServiceStatus
}

export async function resolveTranslateServiceState(input: {
  config: DocumentTranslationConfig | undefined
  hasSource: boolean
  signal?: AbortSignal
  onUpdate?: (state: TranslateServiceState) => void
}): Promise<TranslateServiceState> {
  const config = input.config
  if (!config?.enabled || !input.hasSource) {
    return emitTranslateServiceState(input.onUpdate, {
      status: projectTranslateServiceStatus({
        enabled: config?.enabled ?? false,
        hasSource: input.hasSource,
        engineId: config?.engineId ?? 'browser',
      }),
    })
  }

  let engineLifecycle: TranslationEngineLifecycleStatus | null = null
  if (config.engineId !== 'browser') {
    input.onUpdate?.(
      createTranslateServiceState({
        status: projectTranslateServiceStatus({
          enabled: config.enabled,
          hasSource: input.hasSource,
          engineId: config.engineId,
          engineLifecycleLoading: true,
        }),
      })
    )
    try {
      engineLifecycle = await trpcClient.translationEngines.getLifecycle.query({
        engineId: config.engineId,
      })
    } catch (lifecycleError) {
      return createTranslateServiceState({
        status: {
          state: 'unavailable',
          engineId: config.engineId,
          message:
            lifecycleError instanceof Error
              ? lifecycleError.message
              : 'Unable to check translation engine runtime.',
        },
      })
    }
    if (shouldShowTranslationEngineInstallGate(engineLifecycle)) {
      return createTranslateServiceState({
        status: projectTranslateServiceStatus({
          enabled: config.enabled,
          hasSource: input.hasSource,
          engineId: config.engineId,
          engineLifecycle,
        }),
      })
    }
  }

  if (isManagedLocalTranslationEngineId(config.engineId)) {
    const localEngineConfig = getManagedLocalEngineConfig(config)
    const model = localEngineConfig.model?.trim()
    if (!model) {
      return emitTranslateServiceState(input.onUpdate, {
        status: projectTranslateServiceStatus({
          enabled: config.enabled,
          hasSource: input.hasSource,
          engineId: config.engineId,
          engineLifecycle,
          localModel: model,
          localSelectedGroupId: localEngineConfig.selectedGroupId,
        }),
      })
    }
    if (isDirectionalManagedLocalTranslationEngineId(config.engineId)) {
      const directionCheck = checkLocalDirectionalModelLanguagePair({
        model,
        targetLanguage: config.targetLanguage,
      })
      if (!directionCheck.supported) {
        return emitTranslateServiceState(input.onUpdate, {
          status: {
            state: 'unavailable',
            engineId: config.engineId,
            message:
              directionCheck.message ??
              'Selected local model does not support the configured target language.',
          },
        })
      }
    }

    input.onUpdate?.(
      createTranslateServiceState({
        status: projectTranslateServiceStatus({
          enabled: config.enabled,
          hasSource: input.hasSource,
          engineId: config.engineId,
          engineLifecycle,
          localModel: model,
          localSelectedGroupId: localEngineConfig.selectedGroupId,
          localAssetLoading: true,
        }),
      })
    )

    try {
      const panelState = await queryManagedLocalPanelState(config.engineId, {
        modelId: model,
        selectedGroupId: localEngineConfig.selectedGroupId,
      })
      const selectedGroupId = panelState.selectedGroupId ?? localEngineConfig.selectedGroupId
      return createTranslateServiceState({
        status: projectTranslateServiceStatus({
          enabled: config.enabled,
          hasSource: input.hasSource,
          engineId: config.engineId,
          engineLifecycle,
          localModel: model,
          localSelectedGroupId: selectedGroupId,
          localAsset: panelState.asset,
        }),
      })
    } catch (assetError) {
      return createTranslateServiceState({
        status: {
          state: 'unavailable',
          engineId: config.engineId,
          message:
            assetError instanceof Error ? assetError.message : 'Unable to check local model files.',
        },
      })
    }
  }

  if (config.engineId === 'openai') {
    return emitTranslateServiceState(input.onUpdate, {
      status: projectTranslateServiceStatus({
        enabled: config.enabled,
        hasSource: input.hasSource,
        engineId: 'openai',
        engineLifecycle,
      }),
    })
  }

  const cachedTable = getBrowserSupportTableState(config.targetLanguage)
  if (cachedTable) {
    return emitTranslateServiceState(input.onUpdate, {
      browserSupportTable: cachedTable,
      status: projectTranslateServiceStatus({
        enabled: config.enabled,
        hasSource: input.hasSource,
        engineId: 'browser',
        browserSupportTable: cachedTable,
      }),
    })
  }

  const checkingTable: BrowserTranslationSupportTableState = {
    state: 'checking',
    table: null,
    message: 'Checking browser translation pairs…',
  }
  input.onUpdate?.(
    createTranslateServiceState({
      browserSupportTable: checkingTable,
      status: projectTranslateServiceStatus({
        enabled: config.enabled,
        hasSource: input.hasSource,
        engineId: 'browser',
        browserSupportTable: checkingTable,
      }),
    })
  )

  try {
    const nextTable = await scanBrowserTranslationPairs(config.targetLanguage, {
      signal: input.signal ?? new AbortController().signal,
      onProgress: (progressState) => {
        input.onUpdate?.(
          createTranslateServiceState({
            browserSupportTable: progressState,
            status: projectTranslateServiceStatus({
              enabled: config.enabled,
              hasSource: input.hasSource,
              engineId: 'browser',
              browserSupportTable: progressState,
            }),
          })
        )
      },
    })
    return createTranslateServiceState({
      browserSupportTable: nextTable,
      status: projectTranslateServiceStatus({
        enabled: config.enabled,
        hasSource: input.hasSource,
        engineId: 'browser',
        browserSupportTable: nextTable,
      }),
    })
  } catch (probeError) {
    const nextCapability: BrowserTranslationStatus = {
      availability: 'error',
      message:
        probeError instanceof Error ? probeError.message : 'Unable to check translation support.',
    }
    return createTranslateServiceState({
      capability: nextCapability,
      status: projectTranslateServiceStatus({
        enabled: config.enabled,
        hasSource: input.hasSource,
        engineId: 'browser',
        browserCapability: nextCapability,
      }),
    })
  }
}

export function prepareTranslateServiceRun(input: {
  config: DocumentTranslationConfig
  hasSource: boolean
  browserSupportTable: BrowserTranslationSupportTableState | null
}): TranslateServiceState {
  if (input.config.engineId !== 'browser') {
    return createTranslateServiceState({
      status: projectTranslateServiceStatus({
        enabled: input.config.enabled,
        hasSource: input.hasSource,
        engineId: input.config.engineId,
      }),
    })
  }

  const preferredRow =
    input.browserSupportTable?.table?.rows.find((row) => row.availability === 'available') ??
    input.browserSupportTable?.table?.rows.find((row) => row.availability === 'downloading') ??
    input.browserSupportTable?.table?.rows.find((row) => row.availability === 'downloadable') ??
    null

  if (!preferredRow) {
    return createTranslateServiceState({
      browserSupportTable: input.browserSupportTable,
      status: projectTranslateServiceStatus({
        enabled: input.config.enabled,
        hasSource: input.hasSource,
        engineId: 'browser',
        browserSupportTable: input.browserSupportTable,
      }),
    })
  }

  const nextCapability: BrowserTranslationStatus = {
    availability: preferredRow.availability,
    progress: preferredRow.progress,
    message: preferredRow.message,
  }
  const nextTable = patchBrowserSupportTableRow(input.config.targetLanguage, preferredRow, {
    message: undefined,
  })
  return createTranslateServiceState({
    capability: nextCapability,
    browserSupportTable: nextTable,
    status: projectTranslateServiceStatus({
      enabled: input.config.enabled,
      hasSource: input.hasSource,
      engineId: 'browser',
      browserSupportTable: nextTable,
      browserCapability: nextCapability,
    }),
  })
}

export function createTranslationEngineExecution(
  config: DocumentTranslationConfig
): TranslationEngineExecution {
  if (config.engineId === 'browser' || isStaticMode()) {
    return createBrowserTranslationExecution()
  }

  const model =
    config.engineId === 'openai'
      ? config.engines.openai.model
      : getManagedLocalEngineConfig(config).model

  return {
    factory: new TrpcTranslatorFactory(
      config.engineId,
      model,
      isManagedLocalTranslationEngineId(config.engineId)
        ? getManagedLocalEngineConfig(config).selectedGroupId
        : undefined
    ),
    cacheIdentity: {
      engineId: config.engineId,
      model,
      selectedGroupId: isManagedLocalTranslationEngineId(config.engineId)
        ? getManagedLocalEngineConfig(config).selectedGroupId
        : undefined,
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
  timeoutMs?: number
}): Promise<string> {
  if (input.engineId === 'browser') {
    const translator = await createBrowserTranslationExecution().factory.create({
      sourceLanguage: input.sourceLanguage,
      targetLanguage: input.targetLanguage,
    })
    try {
      return await readSingleBatchOutput(
        translator.batchTranslate([input.text], {
          timeoutMs: input.timeoutMs ?? DEFAULT_BATCH_TRANSLATION_TIMEOUT_MS,
        })
      )
    } finally {
      translator.destroy?.()
    }
  }
  if (isDirectionalManagedLocalTranslationEngineId(input.engineId)) {
    const directionCheck = checkLocalDirectionalModelLanguagePair({
      model: input.model,
      sourceLanguage: input.sourceLanguage,
      targetLanguage: input.targetLanguage,
    })
    if (!directionCheck.supported) {
      throw new Error(
        directionCheck.message ??
          'Selected local model does not support the requested translation direction.'
      )
    }
  }

  const translator = new TrpcTranslator({
    engineId: input.engineId,
    sourceLanguage: input.sourceLanguage,
    targetLanguage: input.targetLanguage,
    model: input.model,
    selectedGroupId: isManagedLocalTranslationEngineId(input.engineId)
      ? input.selectedGroupId
      : undefined,
  })
  return readSingleBatchOutput(
    translator.batchTranslate([input.text], {
      timeoutMs: input.timeoutMs ?? DEFAULT_BATCH_TRANSLATION_TIMEOUT_MS,
    })
  )
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
      selectedGroupId: isManagedLocalTranslationEngineId(this.engineId)
        ? this.selectedGroupId
        : undefined,
    })
  }
}

function getManagedLocalEngineConfig(config: DocumentTranslationConfig): {
  model: string | undefined
  selectedGroupId: string | undefined
} {
  return config.engineId === 'local-ct2'
    ? {
        model: config.engines.localCt2.model,
        selectedGroupId: config.engines.localCt2.selectedGroupId,
      }
    : config.engineId === 'local-llama'
      ? {
          model: config.engines.localLlama.model,
          selectedGroupId: config.engines.localLlama.selectedGroupId,
        }
      : {
          model: config.engines.local.model,
          selectedGroupId: config.engines.local.selectedGroupId,
        }
}

async function queryManagedLocalPanelState(
  engineId: Extract<TranslationEngineId, 'local' | 'local-ct2' | 'local-llama'>,
  input: { modelId: string; selectedGroupId?: string }
): Promise<{
  modelId: string
  selectedGroupId?: string
  asset: LocalModelAssetState
  downloadPlan: TranslationModelDownloadPlan | null
}> {
  return engineId === 'local'
    ? trpcClient.localModels.panelState.query(input)
    : engineId === 'local-ct2'
      ? trpcClient.localCt2Models.panelState.query(input)
      : trpcClient.localLlamaModels.panelState.query(input)
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
    options?: {
      instructions?: string
      context?: string
      signal?: AbortSignal
      timeoutMs?: number
    }
  ): AsyncGenerator<BatchTranslationResult> {
    if (options?.signal?.aborted) {
      throw new DOMException('Translation cancelled.', 'AbortError')
    }

    const queue: BatchTranslationResult[] = []
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
        timeoutMs: options?.timeoutMs ?? DEFAULT_BATCH_TRANSLATION_TIMEOUT_MS,
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
  stream: AsyncGenerator<{
    index: number
    output?: string
    error?: { kind: string; message: string }
  }>
): Promise<string> {
  for await (const item of stream) {
    if (item.output !== undefined) return item.output
    throw new Error(item.error?.message ?? 'Translator returned an error.')
  }
  throw new Error('Translator returned no batch output.')
}

function createTranslateServiceState(input: {
  capability?: BrowserTranslationStatus | null
  browserSupportTable?: BrowserTranslationSupportTableState | null
  status: TranslateServiceStatus
}): TranslateServiceState {
  return {
    capability: input.capability ?? null,
    browserSupportTable: input.browserSupportTable ?? null,
    status: input.status,
  }
}

function emitTranslateServiceState(
  onUpdate: ((state: TranslateServiceState) => void) | undefined,
  input: {
    capability?: BrowserTranslationStatus | null
    browserSupportTable?: BrowserTranslationSupportTableState | null
    status: TranslateServiceStatus
  }
): TranslateServiceState {
  const state = createTranslateServiceState(input)
  onUpdate?.(state)
  return state
}
