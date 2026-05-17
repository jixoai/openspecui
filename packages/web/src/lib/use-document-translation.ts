import type { DocumentTranslationConfig } from '@openspecui/core/document-translation'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  probeBrowserTranslation,
  translateMarkdownDocumentProgressively,
  type BrowserTranslationStatus,
  type DocumentTranslationProgressPatch,
  type DocumentTranslationResult,
} from './browser-translation'

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
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<DocumentTranslationResult | null>(null)
  const abortRef = useRef<AbortController | null>(null)

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
    setResult(null)
    setStatus('source')
    setError(null)
  }, [markdown, config?.targetLanguage, config?.displayMode])

  const start = useCallback(async () => {
    if (!config?.enabled) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setError(null)
    setStatus('initializing')

    try {
      const nextCapability = await probeBrowserTranslation(config.targetLanguage)
      setCapability(nextCapability)
      if (
        nextCapability.availability === 'missing' ||
        nextCapability.availability === 'unavailable' ||
        nextCapability.availability === 'error'
      ) {
        setStatus('unavailable')
        return
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
  }, [config?.displayMode, config?.enabled, config?.targetLanguage, markdown])

  return {
    status,
    capability,
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
