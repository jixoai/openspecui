import { useCallback, useEffect, useState } from 'react'

export type DocumentTranslationActivation = 'source' | 'translated'

export const DOCUMENT_TRANSLATION_SESSION_STORAGE_KEY = 'openspecui:document-translation:mode'

const DEFAULT_ACTIVATION: DocumentTranslationActivation = 'source'
const ACTIVATION_STORAGE_EVENT = 'openspecui:document-translation-session-change'

function isDocumentTranslationActivation(
  value: string | null
): value is DocumentTranslationActivation {
  return value === 'source' || value === 'translated'
}

export function readDocumentTranslationActivation(): DocumentTranslationActivation {
  if (typeof window === 'undefined') return DEFAULT_ACTIVATION
  try {
    const value = window.sessionStorage.getItem(DOCUMENT_TRANSLATION_SESSION_STORAGE_KEY)
    return isDocumentTranslationActivation(value) ? value : DEFAULT_ACTIVATION
  } catch {
    return DEFAULT_ACTIVATION
  }
}

export function writeDocumentTranslationActivation(value: DocumentTranslationActivation): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(DOCUMENT_TRANSLATION_SESSION_STORAGE_KEY, value)
  } catch {
    return
  }
  window.dispatchEvent(new CustomEvent(ACTIVATION_STORAGE_EVENT, { detail: value }))
}

export function useDocumentTranslationActivation(): {
  activation: DocumentTranslationActivation
  setActivation: (value: DocumentTranslationActivation) => void
} {
  const [activation, setActivationState] = useState(readDocumentTranslationActivation)

  useEffect(() => {
    const handleActivationChange = () => {
      setActivationState(readDocumentTranslationActivation())
    }
    window.addEventListener(ACTIVATION_STORAGE_EVENT, handleActivationChange)
    window.addEventListener('storage', handleActivationChange)
    return () => {
      window.removeEventListener(ACTIVATION_STORAGE_EVENT, handleActivationChange)
      window.removeEventListener('storage', handleActivationChange)
    }
  }, [])

  const setActivation = useCallback((value: DocumentTranslationActivation) => {
    writeDocumentTranslationActivation(value)
    setActivationState(value)
  }, [])

  return { activation, setActivation }
}
