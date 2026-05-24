import type { DocumentTranslationConfig } from '@openspecui/core/document-translation'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getBrowserSupportTableState,
  patchBrowserSupportTableRow,
  scanBrowserTranslationPairs,
  translateMarkdownDocumentProgressively,
  type BrowserTranslationStatus,
  type BrowserTranslationSupportTableState,
  type DocumentTranslationProgressPatch,
  type DocumentTranslationResult,
} from './browser-translation'
import { useDocumentTranslationActivation } from './document-translation-session-state'
import { isStaticMode } from './static-mode'
import { createTranslationEngineExecution } from './translate-service'
import {
  projectTranslateServiceStatus,
  type TranslateServiceStatus,
} from './translate-service-status'
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
    config?.engines.openai.model,
    config?.targetLanguage,
  ])

  useEffect(() => {
    let disposed = false

    if (!config?.enabled || markdown.length === 0) {
      setCapability(null)
      setBrowserSupportTable(null)
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

    if (config.engineId === 'local') {
      setCapability(null)
      setBrowserSupportTable(null)
      setServiceStatus(
        projectTranslateServiceStatus({
          enabled: config.enabled,
          hasSource: markdown.length > 0,
          engineId: 'local',
          localModel: config.engines.local.model,
          localSelectedGroupId: config.engines.local.selectedGroupId,
          localAssetLoading: true,
        })
      )
      const model = config.engines.local.model?.trim()
      if (!model) {
        setServiceStatus(
          projectTranslateServiceStatus({
            enabled: config.enabled,
            hasSource: markdown.length > 0,
            engineId: 'local',
            localModel: model,
            localSelectedGroupId: config.engines.local.selectedGroupId,
          })
        )
        return () => {
          disposed = true
        }
      }
      void trpcClient.localModels.panelState
        .query({
          modelId: model,
          selectedGroupId: config.engines.local.selectedGroupId,
        })
        .then((panelState) => {
          if (disposed) return
          const selectedGroupId = panelState.selectedGroupId ?? config.engines.local.selectedGroupId
          setServiceStatus(
            projectTranslateServiceStatus({
              enabled: config.enabled,
              hasSource: markdown.length > 0,
              engineId: 'local',
              localModel: model,
              localSelectedGroupId: selectedGroupId,
              localAsset: panelState.asset,
            })
          )
        })
        .catch((assetError) => {
          if (disposed) return
          setServiceStatus({
            state: 'unavailable',
            engineId: 'local',
            message:
              assetError instanceof Error
                ? assetError.message
                : 'Unable to check local model files.',
          })
        })
      return () => {
        disposed = true
      }
    }

    if (config.engineId === 'openai') {
      setCapability(null)
      setBrowserSupportTable(null)
      setServiceStatus(
        projectTranslateServiceStatus({
          enabled: config.enabled,
          hasSource: markdown.length > 0,
          engineId: 'openai',
        })
      )
      return () => {
        disposed = true
      }
    }

    const cachedTable = getBrowserSupportTableState(config.targetLanguage)
    if (cachedTable) {
      setBrowserSupportTable(cachedTable)
      setServiceStatus(
        projectTranslateServiceStatus({
          enabled: config.enabled,
          hasSource: markdown.length > 0,
          engineId: 'browser',
          browserSupportTable: cachedTable,
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
        browserSupportTable: {
          state: 'checking',
          table: null,
          message: 'Checking browser translation pairs…',
        },
      })
    )
    const controller = new AbortController()
    void scanBrowserTranslationPairs(config.targetLanguage, {
      signal: controller.signal,
      onProgress: (nextState) => {
        if (disposed) return
        setBrowserSupportTable(nextState)
        setServiceStatus(
          projectTranslateServiceStatus({
            enabled: config.enabled,
            hasSource: markdown.length > 0,
            engineId: 'browser',
            browserSupportTable: nextState,
          })
        )
      },
    })
      .then((nextState) => {
        if (disposed) return
        setBrowserSupportTable(nextState)
        setServiceStatus(
          projectTranslateServiceStatus({
            enabled: config.enabled,
            hasSource: markdown.length > 0,
            engineId: 'browser',
            browserSupportTable: nextState,
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
      controller.abort()
    }
  }, [
    config?.enabled,
    config?.engineId,
    config?.engines.local.model,
    config?.engines.local.selectedGroupId,
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
        const preferredRow =
          browserSupportTable?.table?.rows.find((row) => row.availability === 'available') ??
          browserSupportTable?.table?.rows.find((row) => row.availability === 'downloading') ??
          browserSupportTable?.table?.rows.find((row) => row.availability === 'downloadable') ??
          null
        if (!preferredRow) {
          setError(serviceStatus.message)
          setStatus('unavailable')
          return
        }
        const nextCapability: BrowserTranslationStatus = {
          availability: preferredRow.availability,
          progress: preferredRow.progress,
          message: preferredRow.message,
        }
        setCapability(nextCapability)
        const nextTable = patchBrowserSupportTableRow(config.targetLanguage, preferredRow, {
          message: undefined,
        })
        setBrowserSupportTable(nextTable)
        setServiceStatus(
          projectTranslateServiceStatus({
            enabled: config.enabled,
            hasSource: markdown.length > 0,
            engineId: 'browser',
            browserSupportTable: nextTable,
            browserCapability: nextCapability,
          })
        )
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
    browserSupportTable,
    capability,
    config?.displayMode,
    config?.enabled,
    config?.targetLanguage,
    config?.engineId,
    config?.engines.openai.model,
    config?.engines.local.model,
    config?.engines.local.selectedGroupId,
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
