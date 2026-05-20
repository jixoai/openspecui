import type { DocumentTranslationConfig } from '@openspecui/core/document-translation'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  probeBrowserTranslation,
  translateMarkdownDocumentProgressively,
  type BrowserTranslationStatus,
  type DocumentTranslationProgressPatch,
  type DocumentTranslationResult,
} from './browser-translation'
import { useDocumentTranslationActivation } from './document-translation-session-state'
import { isStaticMode } from './static-mode'
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
      return () => {
        disposed = true
      }
    }

    void probeBrowserTranslation(config.targetLanguage)
      .then((nextCapability) => {
        if (disposed) return
        setCapability(nextCapability)
      })
      .catch((probeError) => {
        if (disposed) return
        setCapability({
          availability: 'error',
          message:
            probeError instanceof Error
              ? probeError.message
              : 'Unable to check translation support.',
        })
      })

    return () => {
      disposed = true
    }
  }, [config?.enabled, config?.targetLanguage, markdown.length])

  const start = useCallback(async () => {
    if (!config?.enabled) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setError(null)
    setStatus('initializing')

    try {
      const nextCapability = capability ?? (await probeBrowserTranslation(config.targetLanguage))
      if (!capability) {
        setCapability(nextCapability)
      }
      if (isUnavailableCapability(nextCapability)) {
        setError(nextCapability.message ?? 'Translation is unavailable.')
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
  }, [capability, config?.displayMode, config?.enabled, config?.targetLanguage, markdown])

  useEffect(() => {
    latestStartRef.current = start
  }, [start])

  useEffect(() => {
    if (activation !== 'translated' || !config?.enabled || markdown.length === 0) return
    if (status !== 'source') return
    if (capability === null) return
    if (isUnavailableCapability(capability)) return
    void latestStartRef.current?.()
  }, [activation, capability, config?.enabled, markdown.length, status])

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
