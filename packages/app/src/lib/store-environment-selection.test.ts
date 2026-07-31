/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Prove selected Environment reload persistence is versioned and credential-free.
 * 2. Prove malformed or future storage falls back without migration glue.
 *
 * Original request (2026-07-30): "Stores 完全可以融入 `Environment Center` 这个东西。"
 */
import { describe, expect, it } from 'vitest'
import {
  loadStoreEnvironmentSelection,
  saveStoreEnvironmentSelection,
} from './store-environment-selection'

function memoryStorage(initial: string | null = null) {
  let value = initial
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => {
      value = next
    },
    value: () => value,
  }
}

describe('Store Environment selection persistence', () => {
  it('round-trips only the opaque selected envUri across reload', () => {
    const storage = memoryStorage()
    saveStoreEnvironmentSelection(storage, { selectedEnvUri: 'openspecui-env://host/data' })
    expect(loadStoreEnvironmentSelection(storage)).toEqual({
      selectedEnvUri: 'openspecui-env://host/data',
    })
    expect(storage.value()).not.toMatch(/apiBaseUrl|authorization|credential|generation|port/)
  })

  it('rejects malformed and future-version state', () => {
    expect(loadStoreEnvironmentSelection(memoryStorage('{broken'))).toEqual({
      selectedEnvUri: null,
    })
    expect(
      loadStoreEnvironmentSelection(
        memoryStorage(JSON.stringify({ version: 2, selectedEnvUri: 'env://future' }))
      )
    ).toEqual({ selectedEnvUri: null })
    expect(
      loadStoreEnvironmentSelection(
        memoryStorage(JSON.stringify({ version: 1, selectedEnvUri: 42 }))
      )
    ).toEqual({ selectedEnvUri: null })
  })
})
