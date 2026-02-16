import { isStaticMode } from './static-mode'
import { trpcClient } from './trpc'

export interface TerminalInputHistoryItem {
  text: string
  time: number
}

const SETTINGS_KEY = 'xtermInputPanelSettings'
const KV_KEY = 'terminal-input-history'
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 1000
const MIN_LIMIT = 1

const DB_NAME = 'openspecui-terminal'
const DB_VERSION = 1
const STORE_NAME = 'terminal-meta'
const STORE_KEY = 'input-history'
const FALLBACK_KEY = 'terminal-input-history-fallback'

function clampLimit(value: number): number {
  return Math.max(MIN_LIMIT, Math.min(MAX_LIMIT, Math.round(value)))
}

function parseHistoryItems(value: unknown): TerminalInputHistoryItem[] {
  if (!Array.isArray(value)) return []

  const items: TerminalInputHistoryItem[] = []
  for (const item of value) {
    if (typeof item !== 'object' || item == null) continue
    const record = item as Record<string, unknown>
    if (typeof record.text !== 'string') continue
    if (typeof record.time !== 'number' || !Number.isFinite(record.time)) continue
    const text = record.text.trim()
    if (!text) continue
    items.push({ text, time: record.time })
  }
  return items
}

function mergeAndTrim(
  records: readonly TerminalInputHistoryItem[],
  limit: number,
): TerminalInputHistoryItem[] {
  const dedup = new Map<string, TerminalInputHistoryItem>()
  for (const record of records) {
    const key = `${record.time}::${record.text}`
    if (!dedup.has(key)) {
      dedup.set(key, record)
    }
  }

  return [...dedup.values()]
    .sort((a, b) => b.time - a.time)
    .slice(0, clampLimit(limit))
}

function itemsEqual(
  a: readonly TerminalInputHistoryItem[],
  b: readonly TerminalInputHistoryItem[],
): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (a[i]?.text !== b[i]?.text) return false
    if (a[i]?.time !== b[i]?.time) return false
  }
  return true
}

function readSettings(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== 'object' || parsed == null) return {}
    return parsed as Record<string, unknown>
  } catch {
    return {}
  }
}

function writeSettings(updates: Record<string, unknown>): void {
  const current = readSettings()
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...updates }))
  } catch {
    // ignore
  }
}

async function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return null
  }

  return await new Promise((resolve) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
  })
}

async function readLocalHistoryFromIdb(): Promise<TerminalInputHistoryItem[] | null> {
  const db = await openDatabase()
  if (!db) return null

  return await new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.get(STORE_KEY)

    request.onsuccess = () => {
      resolve(parseHistoryItems(request.result))
    }
    request.onerror = () => resolve([])
    tx.oncomplete = () => db.close()
    tx.onerror = () => db.close()
    tx.onabort = () => db.close()
  })
}

async function writeLocalHistoryToIdb(records: readonly TerminalInputHistoryItem[]): Promise<boolean> {
  const db = await openDatabase()
  if (!db) return false

  return await new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.put(records, STORE_KEY)
    tx.oncomplete = () => {
      db.close()
      resolve(true)
    }
    tx.onerror = () => {
      db.close()
      resolve(false)
    }
    tx.onabort = () => {
      db.close()
      resolve(false)
    }
  })
}

function readLocalHistoryFallback(): TerminalInputHistoryItem[] {
  try {
    const raw = localStorage.getItem(FALLBACK_KEY)
    if (!raw) return []
    return parseHistoryItems(JSON.parse(raw))
  } catch {
    return []
  }
}

function writeLocalHistoryFallback(records: readonly TerminalInputHistoryItem[]): void {
  try {
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(records))
  } catch {
    // ignore
  }
}

async function readLocalHistory(): Promise<TerminalInputHistoryItem[]> {
  const idbValue = await readLocalHistoryFromIdb()
  if (idbValue) return idbValue
  return readLocalHistoryFallback()
}

async function writeLocalHistory(records: readonly TerminalInputHistoryItem[]): Promise<void> {
  const saved = await writeLocalHistoryToIdb(records)
  if (!saved) {
    writeLocalHistoryFallback(records)
  }
}

export class TerminalInputHistoryStore {
  private records: TerminalInputHistoryItem[] = []
  private listeners = new Set<(records: readonly TerminalInputHistoryItem[]) => void>()
  private kvUnsubscribe: (() => void) | null = null
  private initPromise: Promise<void> | null = null

  subscribe(listener: (records: readonly TerminalInputHistoryItem[]) => void): () => void {
    this.listeners.add(listener)
    void this.ensureInitialized()
    listener(this.records)
    return () => {
      this.listeners.delete(listener)
    }
  }

  async list(): Promise<readonly TerminalInputHistoryItem[]> {
    await this.ensureInitialized()
    return [...this.records]
  }

  getLimit(): number {
    const settings = readSettings()
    const value = settings.historyLimit
    if (typeof value === 'number' && Number.isFinite(value)) {
      return clampLimit(value)
    }
    return DEFAULT_LIMIT
  }

  async setLimit(limit: number): Promise<void> {
    const normalizedLimit = clampLimit(limit)
    writeSettings({ historyLimit: normalizedLimit })
    await this.ensureInitialized()
    const next = mergeAndTrim(this.records, normalizedLimit)
    await this.commit(next, { persistRemote: true })
  }

  async add(text: string): Promise<void> {
    const normalizedText = text.trim()
    if (!normalizedText) return
    await this.ensureInitialized()
    const next = mergeAndTrim(
      [{ text: normalizedText, time: Date.now() }, ...this.records],
      this.getLimit(),
    )
    await this.commit(next, { persistRemote: true })
  }

  destroy(): void {
    if (this.kvUnsubscribe) {
      this.kvUnsubscribe()
      this.kvUnsubscribe = null
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise
      return
    }
    this.initPromise = this.initialize()
    await this.initPromise
  }

  private async initialize(): Promise<void> {
    const local = await readLocalHistory()
    const mergedLocal = mergeAndTrim(local, this.getLimit())
    this.records = mergedLocal
    this.emit()

    if (isStaticMode()) return

    try {
      const remoteValue = await trpcClient.kv.get.query({ key: KV_KEY })
      const remoteRecords = parseHistoryItems(remoteValue)
      const merged = mergeAndTrim([...this.records, ...remoteRecords], this.getLimit())
      const changed = !itemsEqual(this.records, merged)
      if (changed) {
        this.records = merged
        await writeLocalHistory(this.records)
        this.emit()
      }

      if (!itemsEqual(remoteRecords, this.records)) {
        void this.persistRemote(this.records)
      }

      const subscription = trpcClient.kv.subscribe.subscribe(
        { key: KV_KEY },
        {
          onData: (value: unknown) => {
            void this.onRemoteData(value)
          },
        },
      )

      this.kvUnsubscribe = () => subscription.unsubscribe()
    } catch {
      // Keep local-only behavior when network/subscription is unavailable.
    }
  }

  private async onRemoteData(value: unknown): Promise<void> {
    const remoteRecords = parseHistoryItems(value)
    const next = mergeAndTrim([...this.records, ...remoteRecords], this.getLimit())
    await this.commit(next, { persistRemote: false })
  }

  private async commit(
    next: TerminalInputHistoryItem[],
    options: { persistRemote: boolean },
  ): Promise<void> {
    if (itemsEqual(this.records, next)) return
    this.records = next
    await writeLocalHistory(this.records)
    this.emit()

    if (options.persistRemote && !isStaticMode()) {
      void this.persistRemote(this.records)
    }
  }

  private async persistRemote(records: readonly TerminalInputHistoryItem[]): Promise<void> {
    try {
      await trpcClient.kv.set.mutate({ key: KV_KEY, value: records })
    } catch {
      // local-first: keep IndexedDB data even when remote sync fails
    }
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.records)
    }
  }
}
