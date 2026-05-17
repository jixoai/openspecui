import type { TranslationCacheEntry, TranslationCacheWriteInput } from '@openspecui/core'
import { describe, expect, it, vi } from 'vitest'
import type { TranslationCacheAdapter } from './translation-cache-adapter.js'
import { TranslationCacheService } from './translation-cache-service.js'

class MemoryTranslationCacheAdapter implements TranslationCacheAdapter {
  readonly entries = new Map<string, TranslationCacheEntry>()

  async init(): Promise<void> {}

  async read(keyHash: string, now: number): Promise<TranslationCacheEntry | null> {
    const entry = this.entries.get(keyHash)
    if (!entry) return null
    const next = { ...entry, lastAccessedAt: now }
    this.entries.set(keyHash, next)
    return next
  }

  async write(input: TranslationCacheWriteInput, now: number): Promise<void> {
    this.entries.set(input.keyHash, {
      ...input,
      createdAt: this.entries.get(input.keyHash)?.createdAt ?? now,
      lastAccessedAt: now,
    })
  }

  async count(): Promise<number> {
    return this.entries.size
  }

  async deleteLeastRecentlyUsed(targetEntryCount: number): Promise<number> {
    const sorted = [...this.entries.values()].sort(
      (left, right) =>
        left.lastAccessedAt - right.lastAccessedAt || left.keyHash.localeCompare(right.keyHash)
    )
    const deleteCount = Math.max(0, sorted.length - targetEntryCount)
    sorted.slice(0, deleteCount).forEach((entry) => this.entries.delete(entry.keyHash))
    return deleteCount
  }

  async clean(entryLimit: number): Promise<{ before: number; after: number; deleted: number }> {
    const before = this.entries.size
    const deleted = await this.deleteLeastRecentlyUsed(Math.floor(entryLimit * 0.6))
    return { before, after: this.entries.size, deleted }
  }

  async clear(): Promise<number> {
    const before = this.entries.size
    this.entries.clear()
    return before
  }
}

function createService(options: {
  cacheEnabled: boolean
  entryLimit?: number
  adapter?: TranslationCacheAdapter
  onWriteError?: (error: unknown) => void
}) {
  const adapter = options.adapter ?? new MemoryTranslationCacheAdapter()
  const configManager = {
    readConfig: vi.fn(async () => ({
      translation: { cacheEnabled: options.cacheEnabled },
    })),
  }
  const globalSettingsManager = {
    readSettings: vi.fn(async () => ({
      translationCache: { entryLimit: options.entryLimit ?? 10 },
    })),
  }
  let now = 1
  const service = new TranslationCacheService({
    configManager: configManager as never,
    globalSettingsManager: globalSettingsManager as never,
    adapter,
    now: () => now++,
    onWriteError: options.onWriteError,
  })
  return { service, adapter, configManager, globalSettingsManager }
}

function createWriteInput(index: number): TranslationCacheWriteInput {
  return {
    key: `source-${index}|topology|zh`,
    keyHash: `hash-${index}`,
    sourceText: `source ${index}`,
    translatedText: `target ${index}`,
    sourceLanguage: 'en',
    targetLanguage: 'zh',
    placeholderTopologyHash: `placeholder-${index % 2}`,
    attributeTopologyHash: `attributes-${index % 3}`,
    displayPolicyVersion: 1,
  }
}

describe('TranslationCacheService', () => {
  it('keeps disabled cache reads and writes out of the adapter', async () => {
    const adapter = new MemoryTranslationCacheAdapter()
    const write = vi.spyOn(adapter, 'write')
    const read = vi.spyOn(adapter, 'read')
    const { service } = createService({ cacheEnabled: false, adapter })

    await expect(service.read('hash-1')).resolves.toBeNull()
    await expect(service.write(createWriteInput(1))).resolves.toEqual({ accepted: false })

    expect(read).not.toHaveBeenCalled()
    expect(write).not.toHaveBeenCalled()
  })

  it('accepts writes asynchronously and reads stored entries when cache is enabled', async () => {
    const adapter = new MemoryTranslationCacheAdapter()
    const { service } = createService({ cacheEnabled: true, adapter })

    await expect(service.write(createWriteInput(1))).resolves.toEqual({ accepted: true })
    await vi.waitFor(() => expect(adapter.entries.has('hash-1')).toBe(true))

    await expect(service.read('hash-1')).resolves.toMatchObject({
      keyHash: 'hash-1',
      translatedText: 'target 1',
    })
  })

  it('cleans from 90 percent down to 60 percent after non-critical writes', async () => {
    const adapter = new MemoryTranslationCacheAdapter()
    const { service } = createService({ cacheEnabled: true, entryLimit: 10, adapter })

    for (let index = 0; index < 9; index++) {
      await service.write(createWriteInput(index))
    }

    await vi.waitFor(() => expect(adapter.entries.size).toBe(6))
    expect([...adapter.entries.keys()]).toEqual([
      'hash-3',
      'hash-4',
      'hash-5',
      'hash-6',
      'hash-7',
      'hash-8',
    ])
  })

  it('supports clean and clear actions', async () => {
    const adapter = new MemoryTranslationCacheAdapter()
    const { service } = createService({ cacheEnabled: true, entryLimit: 5, adapter })

    for (let index = 0; index < 4; index++) {
      await adapter.write(createWriteInput(index), index + 1)
    }
    await vi.waitFor(() => expect(adapter.entries.size).toBe(4))

    await expect(service.clean()).resolves.toEqual({ before: 4, after: 3, deleted: 1 })
    await expect(service.clear()).resolves.toEqual({ deleted: 3 })
    expect(adapter.entries.size).toBe(0)
  })

  it('swallows async write failures through the configured error hook', async () => {
    const error = new Error('disk full')
    const onWriteError = vi.fn()
    const adapter: TranslationCacheAdapter = {
      init: vi.fn(),
      read: vi.fn(),
      write: vi.fn(async () => {
        throw error
      }),
      count: vi.fn(),
      deleteLeastRecentlyUsed: vi.fn(),
      clean: vi.fn(),
      clear: vi.fn(),
    }
    const { service } = createService({ cacheEnabled: true, adapter, onWriteError })

    await expect(service.write(createWriteInput(1))).resolves.toEqual({ accepted: true })
    await vi.waitFor(() => expect(onWriteError).toHaveBeenCalledWith(error))
  })
})
