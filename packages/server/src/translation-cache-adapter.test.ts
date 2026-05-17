import Database from 'better-sqlite3'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SqliteTranslationCacheAdapter } from './translation-cache-adapter.js'

describe('SqliteTranslationCacheAdapter', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'openspecui-translation-cache-'))
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('stores and reads validated translated HAST payloads', async () => {
    const adapter = createAdapter(join(tempDir, 'cache.sqlite'))
    const targetNodesJson = JSON.stringify([{ type: 'text', value: '目标' }])

    await adapter.write(
      {
        key: 'cache-key',
        keyHash: 'cache-key-hash',
        sourceText: 'source',
        translatedText: 'target',
        targetNodesJson,
        sourceLanguage: 'en',
        targetLanguage: 'zh',
        placeholderTopologyHash: 'placeholder',
        attributeTopologyHash: 'attribute',
        displayPolicyVersion: 1,
      },
      10
    )

    await expect(adapter.read('cache-key-hash', 20)).resolves.toMatchObject({
      key: 'cache-key',
      keyHash: 'cache-key-hash',
      targetNodesJson,
      createdAt: 10,
      lastAccessedAt: 20,
    })

    adapter.close()
  })

  it('migrates existing cache tables without target node storage', async () => {
    const databasePath = join(tempDir, 'legacy-cache.sqlite')
    const database = new Database(databasePath)
    database.exec(`
      CREATE TABLE translation_cache_entries (
        key_hash TEXT PRIMARY KEY,
        cache_key TEXT NOT NULL,
        source_text TEXT NOT NULL,
        translated_text TEXT NOT NULL,
        source_language TEXT NOT NULL,
        target_language TEXT NOT NULL,
        placeholder_topology_hash TEXT NOT NULL,
        attribute_topology_hash TEXT NOT NULL,
        display_policy_version INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        last_accessed_at INTEGER NOT NULL
      );
    `)
    database.close()

    const adapter = createAdapter(databasePath)
    await adapter.init()

    await adapter.write(
      {
        key: 'migrated-key',
        keyHash: 'migrated-hash',
        sourceText: 'source',
        translatedText: 'target',
        targetNodesJson: JSON.stringify([{ type: 'text', value: 'target' }]),
        sourceLanguage: 'en',
        targetLanguage: 'zh',
        placeholderTopologyHash: 'placeholder',
        attributeTopologyHash: 'attribute',
        displayPolicyVersion: 1,
      },
      30
    )

    await expect(adapter.read('migrated-hash', 31)).resolves.toMatchObject({
      key: 'migrated-key',
      targetNodesJson: JSON.stringify([{ type: 'text', value: 'target' }]),
    })

    adapter.close()
  })
})

function createAdapter(databasePath: string): SqliteTranslationCacheAdapter {
  return new SqliteTranslationCacheAdapter(databasePath, (path) => new Database(path))
}
