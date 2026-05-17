import type { TranslationCacheEntry, TranslationCacheWriteInput } from '@openspecui/core'
import { createHash } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

export interface TranslationCacheAdapter {
  readonly databasePath?: string
  init(): Promise<void>
  read(keyHash: string, now: number): Promise<TranslationCacheEntry | null>
  write(input: TranslationCacheWriteInput, now: number): Promise<void>
  count(): Promise<number>
  deleteLeastRecentlyUsed(targetEntryCount: number): Promise<number>
  clean(entryLimit: number): Promise<{ before: number; after: number; deleted: number }>
  clear(): Promise<number>
  close?(): void
}

interface SqliteStatement {
  run(...params: unknown[]): unknown
  get(...params: unknown[]): unknown
  all(...params: unknown[]): unknown[]
}

interface SqliteDatabase {
  exec(sql: string): unknown
  prepare(sql: string): SqliteStatement
  close?(): void
}

type SqliteDatabaseFactory = (databasePath: string) => SqliteDatabase

export class SqliteTranslationCacheAdapter implements TranslationCacheAdapter {
  private database: SqliteDatabase | null = null

  constructor(
    public readonly databasePath: string,
    private readonly createDatabase: SqliteDatabaseFactory
  ) {}

  async init(): Promise<void> {
    if (this.database) return
    await mkdir(dirname(this.databasePath), { recursive: true })
    const database = this.createDatabase(this.databasePath)
    database.exec(`
      CREATE TABLE IF NOT EXISTS translation_cache_entries (
        key_hash TEXT PRIMARY KEY,
        cache_key TEXT NOT NULL,
        source_text TEXT NOT NULL,
        translated_text TEXT NOT NULL,
        target_nodes_json TEXT,
        source_language TEXT NOT NULL,
        target_language TEXT NOT NULL,
        placeholder_topology_hash TEXT NOT NULL,
        attribute_topology_hash TEXT NOT NULL,
        display_policy_version INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        last_accessed_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS translation_cache_entries_lru_idx
        ON translation_cache_entries(last_accessed_at ASC);
    `)
    ensureTargetNodesJsonColumn(database)
    this.database = database
  }

  async read(keyHash: string, now: number): Promise<TranslationCacheEntry | null> {
    const database = await this.requireDatabase()
    const row = database
      .prepare(
        `SELECT key_hash, cache_key, source_text, translated_text, target_nodes_json, source_language,
          target_language, placeholder_topology_hash, attribute_topology_hash,
          display_policy_version, created_at, last_accessed_at
        FROM translation_cache_entries
        WHERE key_hash = ?`
      )
      .get(keyHash)
    if (!isSqliteTranslationCacheRow(row)) return null

    database
      .prepare('UPDATE translation_cache_entries SET last_accessed_at = ? WHERE key_hash = ?')
      .run(now, keyHash)

    return {
      keyHash: row.key_hash,
      key: row.cache_key,
      sourceText: row.source_text,
      translatedText: row.translated_text,
      ...(row.target_nodes_json ? { targetNodesJson: row.target_nodes_json } : {}),
      sourceLanguage: row.source_language,
      targetLanguage: row.target_language,
      placeholderTopologyHash: row.placeholder_topology_hash,
      attributeTopologyHash: row.attribute_topology_hash,
      displayPolicyVersion: row.display_policy_version,
      createdAt: row.created_at,
      lastAccessedAt: now,
    }
  }

  async write(input: TranslationCacheWriteInput, now: number): Promise<void> {
    const database = await this.requireDatabase()
    database
      .prepare(
        `INSERT INTO translation_cache_entries (
          key_hash, cache_key, source_text, translated_text, target_nodes_json, source_language,
          target_language, placeholder_topology_hash, attribute_topology_hash,
          display_policy_version, created_at, last_accessed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(key_hash) DO UPDATE SET
          cache_key = excluded.cache_key,
          source_text = excluded.source_text,
          translated_text = excluded.translated_text,
          target_nodes_json = excluded.target_nodes_json,
          source_language = excluded.source_language,
          target_language = excluded.target_language,
          placeholder_topology_hash = excluded.placeholder_topology_hash,
          attribute_topology_hash = excluded.attribute_topology_hash,
          display_policy_version = excluded.display_policy_version,
          last_accessed_at = excluded.last_accessed_at`
      )
      .run(
        input.keyHash,
        input.key,
        input.sourceText,
        input.translatedText,
        input.targetNodesJson ?? null,
        input.sourceLanguage,
        input.targetLanguage,
        input.placeholderTopologyHash,
        input.attributeTopologyHash,
        input.displayPolicyVersion,
        now,
        now
      )
  }

  async count(): Promise<number> {
    const database = await this.requireDatabase()
    const row = database.prepare('SELECT COUNT(*) AS count FROM translation_cache_entries').get()
    return readSqliteCount(row)
  }

  async deleteLeastRecentlyUsed(targetEntryCount: number): Promise<number> {
    const database = await this.requireDatabase()
    const currentCount = await this.count()
    const deleteCount = Math.max(0, currentCount - targetEntryCount)
    if (deleteCount === 0) return 0

    database
      .prepare(
        `DELETE FROM translation_cache_entries
        WHERE key_hash IN (
          SELECT key_hash FROM translation_cache_entries
          ORDER BY last_accessed_at ASC, key_hash ASC
          LIMIT ?
        )`
      )
      .run(deleteCount)
    return deleteCount
  }

  async clean(entryLimit: number): Promise<{ before: number; after: number; deleted: number }> {
    const before = await this.count()
    const target = Math.floor(entryLimit * 0.6)
    const deleted = await this.deleteLeastRecentlyUsed(target)
    const after = await this.count()
    return { before, after, deleted }
  }

  async clear(): Promise<number> {
    const database = await this.requireDatabase()
    const before = await this.count()
    database.prepare('DELETE FROM translation_cache_entries').run()
    return before
  }

  close(): void {
    this.database?.close?.()
    this.database = null
  }

  private async requireDatabase(): Promise<SqliteDatabase> {
    await this.init()
    if (!this.database) throw new Error('Translation cache database is not initialized.')
    return this.database
  }
}

export function createTranslationCacheKeyHash(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

export async function createRuntimeSqliteTranslationCacheAdapter(
  databasePath: string
): Promise<SqliteTranslationCacheAdapter> {
  const createDatabase = await resolveRuntimeSqliteDatabaseFactory()
  return new SqliteTranslationCacheAdapter(databasePath, createDatabase)
}

async function resolveRuntimeSqliteDatabaseFactory(): Promise<SqliteDatabaseFactory> {
  if (isBunRuntime()) {
    const bunSqlite = (await dynamicImport('bun:sqlite')) as {
      Database: new (databasePath: string) => SqliteDatabase
    }
    const Database = bunSqlite.Database
    return (databasePath) => new Database(databasePath) as SqliteDatabase
  }

  const betterSqlite = await import('better-sqlite3')
  const Database = betterSqlite.default
  return (databasePath) => new Database(databasePath) as SqliteDatabase
}

const dynamicImport = new Function('specifier', 'return import(specifier)') as (
  specifier: string
) => Promise<unknown>

function isBunRuntime(): boolean {
  return typeof process.versions.bun === 'string'
}

function ensureTargetNodesJsonColumn(database: SqliteDatabase): void {
  const rows = database.prepare('PRAGMA table_info(translation_cache_entries)').all()
  const hasColumn = rows.some((row) => {
    if (!row || typeof row !== 'object') return false
    return (row as { name?: unknown }).name === 'target_nodes_json'
  })
  if (!hasColumn) {
    database.exec('ALTER TABLE translation_cache_entries ADD COLUMN target_nodes_json TEXT')
  }
}

interface SqliteTranslationCacheRow {
  key_hash: string
  cache_key: string
  source_text: string
  translated_text: string
  target_nodes_json: string | null
  source_language: string
  target_language: string
  placeholder_topology_hash: string
  attribute_topology_hash: string
  display_policy_version: number
  created_at: number
  last_accessed_at: number
}

function isSqliteTranslationCacheRow(value: unknown): value is SqliteTranslationCacheRow {
  if (!value || typeof value !== 'object') return false
  const row = value as Partial<SqliteTranslationCacheRow>
  return (
    typeof row.key_hash === 'string' &&
    typeof row.cache_key === 'string' &&
    typeof row.source_text === 'string' &&
    typeof row.translated_text === 'string' &&
    (typeof row.target_nodes_json === 'string' || row.target_nodes_json === null) &&
    typeof row.source_language === 'string' &&
    typeof row.target_language === 'string' &&
    typeof row.placeholder_topology_hash === 'string' &&
    typeof row.attribute_topology_hash === 'string' &&
    typeof row.display_policy_version === 'number' &&
    typeof row.created_at === 'number' &&
    typeof row.last_accessed_at === 'number'
  )
}

function readSqliteCount(value: unknown): number {
  if (!value || typeof value !== 'object') return 0
  const count = (value as { count?: unknown }).count
  return typeof count === 'number' ? count : 0
}
