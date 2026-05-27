import type { DocumentTranslationConfig } from '@openspecui/core/document-translation'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
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
  const { activation } = useDocumentTranslationActivation()

  const cancel = useCallback(() => {
    generationRef.current += 1
    abortRef.current?.abort()
    abortRef.current = null
    setStatus('source')
    setResult(null)
    setError(null)
  }, [])

  const reset = useCallback(() => {
    generationRef.current += 1
    abortRef.current?.abort()
    abortRef.current = null
    setStatus('source')
    setResult(null)
    setError(null)
  }, [])

  useEffect(() => reset, [reset])

  useEffect(() => {
    generationRef.current += 1
    setCapability(null)
    setBrowserSupportTable(null)
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
    setError(null)
    setStatus('initializing')

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
          if (
            controller.signal.aborted ||
            abortRef.current !== controller ||
            generationRef.current !== generationId
          ) {
            return
          }
          setResult((current) =>
            applyDocumentTranslationPatch(current, patch, {
              displayMode: config.displayMode,
              targetLanguage: config.targetLanguage,
            })
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
      setResult(nextResult)
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

function getDocumentTranslationFailureMessage(result: DocumentTranslationResult): string | null {
  const segments = (Array.isArray(result.segments) ? result.segments : []).filter(
    (segment) => segment !== undefined
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
