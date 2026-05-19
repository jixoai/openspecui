import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  DOCUMENT_TRANSLATION_SESSION_STORAGE_KEY,
  readDocumentTranslationActivation,
  useDocumentTranslationActivation,
  writeDocumentTranslationActivation,
} from './document-translation-session-state'

describe('document translation session state', () => {
  afterEach(() => {
    sessionStorage.clear()
  })

  it('defaults to source mode when sessionStorage has no activation state', () => {
    expect(readDocumentTranslationActivation()).toBe('source')
  })

  it('writes and reads session-scoped activation state', () => {
    writeDocumentTranslationActivation('translated')

    expect(sessionStorage.getItem(DOCUMENT_TRANSLATION_SESSION_STORAGE_KEY)).toBe('translated')
    expect(readDocumentTranslationActivation()).toBe('translated')
  })

  it('notifies hook consumers when activation changes', () => {
    const { result } = renderHook(() => useDocumentTranslationActivation())

    act(() => {
      result.current.setActivation('translated')
    })

    expect(result.current.activation).toBe('translated')
  })
})
