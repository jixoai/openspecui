import type { DocumentTranslationConfig } from '@openspecui/core/document-translation'
import { DEFAULT_BATCH_TRANSLATION_TIMEOUT_MS } from '@openspecui/core/translator'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  isRenderableTranslationSegment,
  retryTranslationSegment,
  translateMarkdownDocumentProgressively,
  type BrowserTranslationStatus,
  type BrowserTranslationSupportTableState,
  type DocumentTranslationProgressPatch,
  type DocumentTranslationResult,
} from './browser-translation'
import { useDocumentTranslationActivation } from './document-translation-session-state'
import { isStaticMode } from './static-mode'
import {
  createTranslationEngineExecution,
  ensureBrowserTranslationReady,
  prepareTranslateServiceRun,
  resolveTranslateServiceState,
} from './translate-service'
import type { TranslateServiceStatus } from './translate-service-status'
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
  retrySegment: (segmentId: string) => Promise<void>
  cancel: () => void
  reset: () => void
}

export function useDocumentTranslation(
  markdown: string,
  config: DocumentTranslationConfig | undefined
): DocumentTranslationSession {
  const [status, setStatus] = useState<DocumentTranslationSessionStatus>('source')
  const [capability, setCapability] = useState<BrowserTranslationStatus | null>(null)
  const [browserSupportTable, setBrowserSupportTable] =
    useState<BrowserTranslationSupportTableState | null>(null)
  const [serviceStatus, setServiceStatus] = useState<TranslateServiceStatus>({
    state: 'disabled',
    message: 'Translation is disabled in settings.',
  })
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<DocumentTranslationResult | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const generationRef = useRef(0)
  const latestStartRef = useRef<(() => Promise<void>) | null>(null)
  const segmentPatchMapRef = useRef(new Map<number, DocumentTranslationProgressPatch['segment']>())
  const { activation } = useDocumentTranslationActivation()

  const cancel = useCallback(() => {
    generationRef.current += 1
    abortRef.current?.abort()
    abortRef.current = null
    segmentPatchMapRef.current.clear()
    setStatus('source')
    setResult(null)
    setError(null)
  }, [])

  const reset = useCallback(() => {
    generationRef.current += 1
    abortRef.current?.abort()
    abortRef.current = null
    segmentPatchMapRef.current.clear()
    setStatus('source')
    setResult(null)
    setError(null)
  }, [])

  useEffect(() => reset, [reset])

  useEffect(() => {
    generationRef.current += 1
    segmentPatchMapRef.current.clear()
    setResult(null)
    setStatus('source')
    setError(null)
  }, [
    markdown,
    config?.displayMode,
    config?.enabled,
    config?.engineId,
    config?.engines.local.model,
    config?.engines.local.selectedGroupId,
    config?.engines.localCt2.model,
    config?.engines.localCt2.selectedGroupId,
    config?.engines.localLlama.model,
    config?.engines.localLlama.selectedGroupId,
    config?.engines.openai.model,
    config?.targetLanguage,
  ])

  useEffect(() => {
    setCapability(null)
    setBrowserSupportTable(null)
  }, [
    config?.enabled,
    config?.engineId,
    config?.engines.local.model,
    config?.engines.local.selectedGroupId,
    config?.engines.localCt2.model,
    config?.engines.localCt2.selectedGroupId,
    config?.engines.localLlama.model,
    config?.engines.localLlama.selectedGroupId,
    config?.engines.openai.model,
    config?.targetLanguage,
  ])

  useEffect(() => {
    let disposed = false
    const controller = new AbortController()

    void resolveTranslateServiceState({
      config,
      hasSource: markdown.length > 0,
      signal: controller.signal,
      onUpdate: (nextState) => {
        if (disposed) return
        setCapability(nextState.capability)
        setBrowserSupportTable(nextState.browserSupportTable)
        setServiceStatus(nextState.status)
      },
    })
      .then((nextState) => {
        if (disposed) return
        setCapability(nextState.capability)
        setBrowserSupportTable(nextState.browserSupportTable)
        setServiceStatus(nextState.status)
      })
      .catch((stateError) => {
        if (disposed) return
        setCapability(null)
        setBrowserSupportTable(null)
        setServiceStatus({
          state: 'unavailable',
          engineId: config?.engineId ?? 'browser',
          message:
            stateError instanceof Error
              ? stateError.message
              : 'Unable to check translation service.',
        })
      })

    return () => {
      disposed = true
      controller.abort()
    }
  }, [
    config?.enabled,
    config?.engineId,
    config?.engines.local.model,
    config?.engines.local.selectedGroupId,
    config?.engines.localCt2.model,
    config?.engines.localCt2.selectedGroupId,
    config?.engines.localLlama.model,
    config?.engines.localLlama.selectedGroupId,
    config?.targetLanguage,
    markdown.length,
  ])

  const start = useCallback(async () => {
    if (!config?.enabled) return

    abortRef.current?.abort()
    const controller = new AbortController()
    const generationId = generationRef.current + 1
    generationRef.current = generationId
    abortRef.current = controller
    segmentPatchMapRef.current.clear()
    setError(null)
    setStatus('initializing')
    let restoreServiceStatus: TranslateServiceStatus | null = null

    try {
      if (serviceStatus.state !== 'ready') {
        setError(serviceStatus.message)
        setStatus('unavailable')
        return
      }
      if (config.engineId === 'browser') {
        const nextState = prepareTranslateServiceRun({
          config,
          hasSource: markdown.length > 0,
          browserSupportTable,
        })
        setCapability(nextState.capability)
        setBrowserSupportTable(nextState.browserSupportTable)
        setServiceStatus(nextState.status)
        if (nextState.status.state !== 'ready') {
          setError(nextState.status.message)
          setStatus('unavailable')
          return
        }
        restoreServiceStatus = nextState.status

        const preparedState = await ensureBrowserTranslationReady({
          targetLanguage: config.targetLanguage,
          browserSupportTable: nextState.browserSupportTable,
          signal: controller.signal,
          onUpdate: (browserState) => {
            if (
              controller.signal.aborted ||
              abortRef.current !== controller ||
              generationRef.current !== generationId
            ) {
              return
            }
            setCapability(browserState.capability)
            setBrowserSupportTable(browserState.browserSupportTable)
            setServiceStatus(
              browserState.capability.availability === 'available'
                ? nextState.status
                : {
                    state: 'checking',
                    engineId: 'browser',
                    message:
                      browserState.capability.message ?? 'Preparing browser translation support.',
                  }
            )
          },
        })
        if (
          controller.signal.aborted ||
          abortRef.current !== controller ||
          generationRef.current !== generationId
        ) {
          return
        }
        setCapability(preparedState.capability)
        setBrowserSupportTable(preparedState.browserSupportTable)
        setServiceStatus({
          state: 'ready',
          engineId: 'browser',
          message: preparedState.capability.message ?? 'Browser translator is ready.',
        })
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
          timeoutMs: DEFAULT_BATCH_TRANSLATION_TIMEOUT_MS,
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
          if (
            controller.signal.aborted ||
            abortRef.current !== controller ||
            generationRef.current !== generationId
          ) {
            return
          }
          setResult((current) =>
            applyDocumentTranslationPatch(
              current,
              patch,
              {
                displayMode: config.displayMode,
                targetLanguage: config.targetLanguage,
              },
              segmentPatchMapRef.current
            )
          )
        }
      )
      if (
        controller.signal.aborted ||
        abortRef.current !== controller ||
        generationRef.current !== generationId
      ) {
        return
      }
      const documentFailure = getDocumentTranslationFailureMessage(nextResult)
      setResult(normalizeDocumentTranslationResult(nextResult))
      if (documentFailure) {
        setError(documentFailure)
        setStatus('error')
        return
      }
      setStatus('translated')
    } catch (translationError) {
      if (
        controller.signal.aborted ||
        abortRef.current !== controller ||
        generationRef.current !== generationId
      ) {
        return
      }
      if (restoreServiceStatus?.engineId === 'browser') {
        const fallbackServiceStatus = restoreServiceStatus
        setServiceStatus((current) =>
          current.state === 'checking' ? fallbackServiceStatus : current
        )
      }
      setError(translationError instanceof Error ? translationError.message : 'Translation failed.')
      setStatus('error')
    } finally {
      if (abortRef.current === controller && generationRef.current === generationId) {
        abortRef.current = null
      }
    }
  }, [
    browserSupportTable,
    capability,
    config?.displayMode,
    config?.enabled,
    config?.targetLanguage,
    config?.engineId,
    config?.engines.openai.model,
    config?.engines.local.model,
    config?.engines.local.selectedGroupId,
    config?.engines.localCt2.model,
    config?.engines.localCt2.selectedGroupId,
    config?.engines.localLlama.model,
    config?.engines.localLlama.selectedGroupId,
    markdown,
    serviceStatus,
  ])

  const retrySegment = useCallback(
    async (segmentId: string) => {
      if (!config?.enabled || !result) return
      const segmentIndex = result.segments.findIndex((segment) => segment.id === segmentId)
      const segment = result.segments[segmentIndex]
      if (segmentIndex < 0 || !segment || segment.status !== 'error') return

      const controller = new AbortController()
      let restoreServiceStatus: TranslateServiceStatus | null = null
      const retryingSegment = {
        ...segment,
        error: undefined,
        status: 'pending' as const,
      }
      setResult((current) =>
        current
          ? {
              ...current,
              segments: current.segments.map((entry, index) =>
                index === segmentIndex ? retryingSegment : entry
              ),
            }
          : current
      )

      try {
        if (config.engineId === 'browser') {
          restoreServiceStatus = {
            state: 'ready',
            engineId: 'browser',
            message: capability?.message ?? 'Browser translator is ready.',
          }
          const preparedState = await ensureBrowserTranslationReady({
            targetLanguage: config.targetLanguage,
            sourceLanguage: segment.sourceLanguage,
            browserSupportTable,
            signal: controller.signal,
            onUpdate: (browserState) => {
              setCapability(browserState.capability)
              setBrowserSupportTable(browserState.browserSupportTable)
              setServiceStatus(
                browserState.capability.availability === 'available'
                  ? {
                      state: 'ready',
                      engineId: 'browser',
                      message: browserState.capability.message ?? 'Browser translator is ready.',
                    }
                  : {
                      state: 'checking',
                      engineId: 'browser',
                      message:
                        browserState.capability.message ?? 'Preparing browser translation support.',
                    }
              )
            },
          })
          setCapability(preparedState.capability)
          setBrowserSupportTable(preparedState.browserSupportTable)
          setServiceStatus({
            state: 'ready',
            engineId: 'browser',
            message: preparedState.capability.message ?? 'Browser translator is ready.',
          })
        }

        const nextSegment = await retryTranslationSegment({
          segment,
          sourceLanguage: segment.sourceLanguage,
          targetLanguage: config.targetLanguage,
          signal: controller.signal,
          timeoutMs: DEFAULT_BATCH_TRANSLATION_TIMEOUT_MS,
          engine: createTranslationEngineExecution(config),
          cache:
            config.cacheEnabled && !isStaticMode()
              ? {
                  read: (keyHash) => trpcClient.translationCache.read.query({ keyHash }),
                  write: (input) => trpcClient.translationCache.write.mutate(input),
                }
              : undefined,
        })

        setResult((current) =>
          current
            ? {
                ...current,
                segments: current.segments.map((entry, index) =>
                  index === segmentIndex ? nextSegment : entry
                ),
              }
            : current
        )
        setError((current) => {
          if (nextSegment.status === 'error') return nextSegment.error ?? current
          const nextResult = buildRetriedDocumentResult(result, segmentIndex, nextSegment)
          return getDocumentTranslationFailureMessage(nextResult)
        })
        setStatus((current) => {
          if (nextSegment.status === 'error')
            return current === 'translated' ? 'translated' : 'error'
          const nextResult = buildRetriedDocumentResult(result, segmentIndex, nextSegment)
          return getDocumentTranslationFailureMessage(nextResult) ? 'error' : 'translated'
        })
      } catch (retryError) {
        if (restoreServiceStatus?.engineId === 'browser') {
          const fallbackServiceStatus = restoreServiceStatus
          setServiceStatus((current) =>
            current.state === 'checking' ? fallbackServiceStatus : current
          )
        }
        setResult((current) =>
          current
            ? {
                ...current,
                segments: current.segments.map((entry, index) =>
                  index === segmentIndex
                    ? {
                        ...segment,
                        status: 'error',
                        error:
                          retryError instanceof Error
                            ? retryError.message
                            : 'Translation retry failed.',
                      }
                    : entry
                ),
              }
            : current
        )
      }
    },
    [browserSupportTable, capability?.message, config, result]
  )

  useEffect(() => {
    latestStartRef.current = start
  }, [start])

  useEffect(() => {
    if (activation !== 'translated' || !config?.enabled || markdown.length === 0) return
    if (status !== 'source') return
    if (serviceStatus.state !== 'ready') return
    if (
      config.engineId === 'browser' &&
      !canAutoStartBrowserTranslation(capability, browserSupportTable)
    ) {
      return
    }
    void latestStartRef.current?.()
  }, [
    activation,
    browserSupportTable,
    capability,
    config?.enabled,
    config?.engineId,
    markdown.length,
    serviceStatus.state,
    status,
  ])

  return {
    status,
    capability,
    serviceStatus,
    error,
    result,
    start,
    retrySegment,
    cancel,
    reset,
  }
}

function isDocumentTranslationSegment(
  segment: unknown
): segment is NonNullable<DocumentTranslationResult['segments'][number]> {
  return isRenderableTranslationSegment(segment)
}

function getDocumentTranslationFailureMessage(result: DocumentTranslationResult): string | null {
  const segments = (Array.isArray(result.segments) ? result.segments : []).filter(
    isDocumentTranslationSegment
  )
  if (segments.length === 0) return null

  const hasTranslatedTarget = segments.some(
    (segment) => segment.status !== 'error' && typeof segment.target === 'string'
  )
  if (hasTranslatedTarget) return null

  const errors = segments
    .map((segment) => (segment.status === 'error' ? segment.error : undefined))
    .filter((message): message is string => typeof message === 'string' && message.length > 0)
  if (errors.length === 0) return null

  return errors[0] ?? 'Translation failed.'
}

function applyDocumentTranslationPatch(
  current: DocumentTranslationResult | null,
  patch: DocumentTranslationProgressPatch,
  fallback: Pick<DocumentTranslationResult, 'displayMode' | 'targetLanguage'>,
  patchMap: Map<number, DocumentTranslationProgressPatch['segment']>
): DocumentTranslationResult {
  patchMap.set(patch.segmentIndex, patch.segment)
  return buildPatchedDocumentTranslationResult(current, fallback, patchMap)
}

function buildPatchedDocumentTranslationResult(
  current: DocumentTranslationResult | null,
  fallback: Pick<DocumentTranslationResult, 'displayMode' | 'targetLanguage'>,
  patchMap: Map<number, DocumentTranslationProgressPatch['segment']>
): DocumentTranslationResult {
  return normalizeDocumentTranslationResult({
    displayMode: current?.displayMode ?? fallback.displayMode,
    sourceLanguage: current?.sourceLanguage,
    targetLanguage: current?.targetLanguage ?? fallback.targetLanguage,
    segments: [...patchMap.entries()]
      .sort((left, right) => left[0] - right[0])
      .map(([, segment]) => segment),
  })
}

function normalizeDocumentTranslationResult(
  result: DocumentTranslationResult
): DocumentTranslationResult {
  return {
    ...result,
    segments: (Array.isArray(result.segments) ? result.segments : []).filter(
      isDocumentTranslationSegment
    ),
  }
}

function buildRetriedDocumentResult(
  current: DocumentTranslationResult,
  segmentIndex: number,
  nextSegment: NonNullable<DocumentTranslationResult['segments'][number]>
): DocumentTranslationResult {
  return normalizeDocumentTranslationResult({
    ...current,
    segments: current.segments.map((entry, index) =>
      index === segmentIndex ? nextSegment : entry
    ),
  })
}

function canAutoStartBrowserTranslation(
  capability: BrowserTranslationStatus | null,
  browserSupportTable: BrowserTranslationSupportTableState | null
): boolean {
  if (capability?.availability === 'available') return true
  return (browserSupportTable?.table?.rows ?? []).some((row) => row.availability === 'available')
}
