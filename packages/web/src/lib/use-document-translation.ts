import type { DocumentTranslationConfig } from '@openspecui/core/document-translation'
import {
  TRANSLATOR_CONTRACT_VERSION,
  type RichTranslationInput,
  type TranslationEngineId,
  type Translator,
  type TranslatorFactory,
  type TranslatorFactoryCreateOptions,
  type TranslatorOptions,
} from '@openspecui/core/translator'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createBrowserTranslationExecution,
  probeBrowserTranslation,
  translateMarkdownDocumentProgressively,
  type BrowserTranslationStatus,
  type DocumentTranslationProgressPatch,
  type DocumentTranslationResult,
  type TranslationEngineExecution,
} from './browser-translation'
import { useDocumentTranslationActivation } from './document-translation-session-state'
import { isStaticMode } from './static-mode'
import { projectTranslateServiceStatus, type TranslateServiceStatus } from './translate-service'
import { trpcClient } from './trpc'

export type DocumentTranslationSessionStatus =
  | 'source'
  | 'initializing'
  | 'translating'
  | 'translated'
  | 'unavailable'
  | 'error'

export interface DocumentTranslationSession {
  status: DocumentTranslationSessionStatus
  capability: BrowserTranslationStatus | null
  serviceStatus: TranslateServiceStatus
  error: string | null
  result: DocumentTranslationResult | null
  start: () => Promise<void>
  cancel: () => void
  reset: () => void
}

function isUnavailableCapability(capability: BrowserTranslationStatus | null): boolean {
  return (
    capability?.availability === 'missing' ||
    capability?.availability === 'unavailable' ||
    capability?.availability === 'error'
  )
}

export function useDocumentTranslation(
  markdown: string,
  config: DocumentTranslationConfig | undefined
): DocumentTranslationSession {
  const [status, setStatus] = useState<DocumentTranslationSessionStatus>('source')
  const [capability, setCapability] = useState<BrowserTranslationStatus | null>(null)
  const [serviceStatus, setServiceStatus] = useState<TranslateServiceStatus>({
    state: 'disabled',
    message: 'Translation is disabled in settings.',
  })
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<DocumentTranslationResult | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const latestStartRef = useRef<(() => Promise<void>) | null>(null)
  const { activation } = useDocumentTranslationActivation()

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setStatus('source')
    setResult(null)
    setError(null)
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setStatus('source')
    setResult(null)
    setError(null)
  }, [])

  useEffect(() => reset, [reset])

  useEffect(() => {
    setCapability(null)
    setResult(null)
    setStatus('source')
    setError(null)
  }, [markdown, config?.displayMode, config?.enabled, config?.targetLanguage])

  useEffect(() => {
    let disposed = false

    if (!config?.enabled || markdown.length === 0) {
      setCapability(null)
      setServiceStatus(
        projectTranslateServiceStatus({
          enabled: config?.enabled ?? false,
          hasSource: markdown.length > 0,
          engineId: config?.engineId ?? 'browser',
        })
      )
      return () => {
        disposed = true
      }
    }

    if (config.engineId === 'nmt') {
      setCapability(null)
      setServiceStatus(
        projectTranslateServiceStatus({
          enabled: config.enabled,
          hasSource: markdown.length > 0,
          engineId: 'nmt',
          nmtModel: config.engines.nmt.model,
          nmtSelectedGroupId: config.engines.nmt.selectedGroupId,
          nmtAssetLoading: true,
        })
      )
      const model = config.engines.nmt.model?.trim()
      if (!model) {
        setServiceStatus(
          projectTranslateServiceStatus({
            enabled: config.enabled,
            hasSource: markdown.length > 0,
            engineId: 'nmt',
            nmtModel: model,
            nmtSelectedGroupId: config.engines.nmt.selectedGroupId,
          })
        )
        return () => {
          disposed = true
        }
      }
      void trpcClient.nmtModels.state
        .query({
          modelId: model,
          selectedGroupId: config.engines.nmt.selectedGroupId,
        })
        .then((nmtAsset) => {
          if (disposed) return
          setServiceStatus(
            projectTranslateServiceStatus({
              enabled: config.enabled,
              hasSource: markdown.length > 0,
              engineId: 'nmt',
              nmtModel: model,
              nmtSelectedGroupId: config.engines.nmt.selectedGroupId,
              nmtAsset,
            })
          )
        })
        .catch((assetError) => {
          if (disposed) return
          setServiceStatus({
            state: 'unavailable',
            engineId: 'nmt',
            message:
              assetError instanceof Error
                ? assetError.message
                : 'Unable to check local NMT model files.',
          })
        })
      return () => {
        disposed = true
      }
    }

    if (config.engineId === 'ai') {
      setCapability(null)
      setServiceStatus(
        projectTranslateServiceStatus({
          enabled: config.enabled,
          hasSource: markdown.length > 0,
          engineId: 'ai',
        })
      )
      return () => {
        disposed = true
      }
    }

    setServiceStatus(
      projectTranslateServiceStatus({
        enabled: config.enabled,
        hasSource: markdown.length > 0,
        engineId: 'browser',
        browserCapabilityLoading: true,
      })
    )
    void probeBrowserTranslation(config.targetLanguage)
      .then((nextCapability) => {
        if (disposed) return
        setCapability(nextCapability)
        setServiceStatus(
          projectTranslateServiceStatus({
            enabled: config.enabled,
            hasSource: markdown.length > 0,
            engineId: 'browser',
            browserCapability: nextCapability,
          })
        )
      })
      .catch((probeError) => {
        if (disposed) return
        const nextCapability: BrowserTranslationStatus = {
          availability: 'error',
          message:
            probeError instanceof Error
              ? probeError.message
              : 'Unable to check translation support.',
        }
        setCapability(nextCapability)
        setServiceStatus(
          projectTranslateServiceStatus({
            enabled: config.enabled,
            hasSource: markdown.length > 0,
            engineId: 'browser',
            browserCapability: nextCapability,
          })
        )
      })

    return () => {
      disposed = true
    }
  }, [
    config?.enabled,
    config?.engineId,
    config?.engines.nmt.model,
    config?.engines.nmt.selectedGroupId,
    config?.targetLanguage,
    markdown.length,
  ])

  const start = useCallback(async () => {
    if (!config?.enabled) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setError(null)
    setStatus('initializing')

    try {
      if (serviceStatus.state !== 'ready') {
        setError(serviceStatus.message)
        setStatus('unavailable')
        return
      }
      if (config.engineId === 'browser') {
        const nextCapability = capability ?? (await probeBrowserTranslation(config.targetLanguage))
        if (!capability) {
          setCapability(nextCapability)
        }
        if (isUnavailableCapability(nextCapability)) {
          setError(nextCapability.message ?? 'Translation is unavailable.')
          setStatus('unavailable')
          return
        }
      }

      setStatus('translating')
      setResult({
        segments: [],
        displayMode: config.displayMode,
        targetLanguage: config.targetLanguage,
      })
      const nextResult = await translateMarkdownDocumentProgressively(
        {
          markdown,
          targetLanguage: config.targetLanguage,
          displayMode: config.displayMode,
          signal: controller.signal,
          engine: createTranslationEngineExecution(config),
          cache:
            config.cacheEnabled && !isStaticMode()
              ? {
                  read: (keyHash) => trpcClient.translationCache.read.query({ keyHash }),
                  write: (input) => trpcClient.translationCache.write.mutate(input),
                }
              : undefined,
        },
        (patch) => {
          if (controller.signal.aborted || abortRef.current !== controller) return
          setResult((current) =>
            applyDocumentTranslationPatch(current, patch, {
              displayMode: config.displayMode,
              targetLanguage: config.targetLanguage,
            })
          )
        }
      )
      if (controller.signal.aborted) return
      setResult(nextResult)
      setStatus('translated')
    } catch (translationError) {
      if (controller.signal.aborted) return
      setError(translationError instanceof Error ? translationError.message : 'Translation failed.')
      setStatus('error')
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
      }
    }
  }, [
    capability,
    config?.displayMode,
    config?.enabled,
    config?.targetLanguage,
    config?.engineId,
    config?.engines.ai.model,
    config?.engines.nmt.model,
    config?.engines.nmt.selectedGroupId,
    markdown,
    serviceStatus,
  ])

  useEffect(() => {
    latestStartRef.current = start
  }, [start])

  useEffect(() => {
    if (activation !== 'translated' || !config?.enabled || markdown.length === 0) return
    if (status !== 'source') return
    if (serviceStatus.state !== 'ready') return
    void latestStartRef.current?.()
  }, [activation, config?.enabled, markdown.length, serviceStatus.state, status])

  return {
    status,
    capability,
    serviceStatus,
    error,
    result,
    start,
    cancel,
    reset,
  }
}

function createTranslationEngineExecution(
  config: DocumentTranslationConfig
): TranslationEngineExecution {
  if (config.engineId === 'browser' || isStaticMode()) {
    return createBrowserTranslationExecution()
  }
  const model = config.engineId === 'ai' ? config.engines.ai.model : config.engines.nmt.model
  return {
    factory: new TrpcTranslatorFactory(
      config.engineId,
      model,
      config.engineId === 'nmt' ? config.engines.nmt.selectedGroupId : undefined
    ),
    cacheIdentity: {
      engineId: config.engineId,
      model,
      selectedGroupId: config.engineId === 'nmt' ? config.engines.nmt.selectedGroupId : undefined,
      translatorContractVersion: TRANSLATOR_CONTRACT_VERSION,
    },
  }
}

class TrpcTranslatorFactory implements TranslatorFactory {
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
      selectedGroupId: this.engineId === 'nmt' ? this.selectedGroupId : undefined,
    })
  }
}

class TrpcTranslator implements Translator {
  constructor(
    private readonly options: {
      engineId: Exclude<TranslationEngineId, 'browser'>
      sourceLanguage: string
      targetLanguage: string
      model?: string
      selectedGroupId?: string
    }
  ) {}

  async translate(
    input: string | RichTranslationInput,
    options?: TranslatorOptions
  ): Promise<string> {
    if (options?.signal?.aborted) {
      throw new DOMException('Translation cancelled.', 'AbortError')
    }
    const result = await trpcClient.translationEngines.translate.mutate({
      engineId: this.options.engineId,
      sourceLanguage: this.options.sourceLanguage,
      targetLanguage: this.options.targetLanguage,
      model: this.options.model,
      selectedGroupId: this.options.selectedGroupId,
      ...(typeof input === 'string' ? { text: input } : { rich: input }),
    })
    if (options?.signal?.aborted) {
      throw new DOMException('Translation cancelled.', 'AbortError')
    }
    return result.text
  }
}

function applyDocumentTranslationPatch(
  current: DocumentTranslationResult | null,
  patch: DocumentTranslationProgressPatch,
  fallback: Pick<DocumentTranslationResult, 'displayMode' | 'targetLanguage'>
): DocumentTranslationResult {
  const segments = [...(current?.segments ?? [])]
  segments[patch.segmentIndex] = patch.segment
  return {
    displayMode: current?.displayMode ?? fallback.displayMode,
    sourceLanguage: current?.sourceLanguage,
    targetLanguage: current?.targetLanguage ?? fallback.targetLanguage,
    segments,
  }
}
