import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanupTempDir, createTempDir } from './__tests__/test-utils.js'
import {
  DEFAULT_GLOBAL_SETTINGS,
  GlobalSettingsManager,
  toPersistedGlobalSettings,
} from './global-settings.js'
import { clearCache } from './reactive-fs/index.js'
import { closeAllWatchers, initWatcherPool } from './reactive-fs/watcher-pool.js'

describe('GlobalSettingsManager', () => {
  let tempDir: string
  let settingsPath: string
  let settingsManager: GlobalSettingsManager

  beforeEach(async () => {
    tempDir = await createTempDir()
    settingsPath = join(tempDir, '.openspecui', 'settings.json')
    settingsManager = new GlobalSettingsManager(settingsPath)
    await initWatcherPool(tempDir)
    clearCache()
  })

  afterEach(async () => {
    clearCache()
    closeAllWatchers()
    await cleanupTempDir(tempDir)
  })

  it('reads defaults when global settings do not exist', async () => {
    await expect(settingsManager.readSettings()).resolves.toEqual(DEFAULT_GLOBAL_SETTINGS)
  })

  it('reads partial global settings with defaults', async () => {
    await mkdir(join(tempDir, '.openspecui'), { recursive: true })
    await writeFile(
      settingsPath,
      JSON.stringify({ translationCache: { entryLimit: 2000 } }),
      'utf-8'
    )
    clearCache()

    await expect(settingsManager.readSettings()).resolves.toEqual({
      ...DEFAULT_GLOBAL_SETTINGS,
      translationCache: { entryLimit: 2000 },
    })
  })

  it('writes global settings outside the project config shape and prunes defaults', async () => {
    await settingsManager.writeSettings({ translationCache: { entryLimit: 2500 } })
    clearCache()

    await expect(settingsManager.readSettings()).resolves.toEqual({
      ...DEFAULT_GLOBAL_SETTINGS,
      translationCache: { entryLimit: 2500 },
    })
    await expect(readFile(settingsPath, 'utf-8')).resolves.toBe(
      '{\n  "translationCache": {\n    "entryLimit": 2500\n  }\n}'
    )

    await settingsManager.writeSettings({
      translationCache: { entryLimit: DEFAULT_GLOBAL_SETTINGS.translationCache.entryLimit },
    })
    clearCache()

    await expect(settingsManager.readSettings()).resolves.toEqual(DEFAULT_GLOBAL_SETTINGS)
    await expect(readFile(settingsPath, 'utf-8')).resolves.toBe('{}')
  })

  it('falls back to defaults for invalid global settings', async () => {
    await mkdir(join(tempDir, '.openspecui'), { recursive: true })
    await writeFile(settingsPath, '{"translationCache":{"entryLimit":1}}', 'utf-8')
    clearCache()

    await expect(settingsManager.readSettings()).resolves.toEqual(DEFAULT_GLOBAL_SETTINGS)
  })

  it('serializes only non-default global values', () => {
    expect(toPersistedGlobalSettings(DEFAULT_GLOBAL_SETTINGS)).toEqual({})
    expect(
      toPersistedGlobalSettings({
        ...DEFAULT_GLOBAL_SETTINGS,
        translationCache: { entryLimit: 12000 },
      })
    ).toEqual({ translationCache: { entryLimit: 12000 } })
  })

  it('merges translator engine settings and prunes default siblings', async () => {
    await settingsManager.writeSettings({
      translationEngines: {
        openai: {
          baseUrl: 'https://api.example.com/v1',
          token: 'secret-token',
          model: 'gpt-4.1-mini',
        },
      },
    })
    clearCache()

    const settings = await settingsManager.readSettings()
    expect(settings.translationEngines.openai).toMatchObject({
      baseUrl: 'https://api.example.com/v1',
      token: 'secret-token',
      model: 'gpt-4.1-mini',
    })
    await expect(readFile(settingsPath, 'utf-8')).resolves.toBe(
      '{\n  "translationEngines": {\n    "openai": {\n      "baseUrl": "https://api.example.com/v1",\n      "token": "secret-token"\n    }\n  }\n}'
    )
  })

  it('persists non-default local Hugging Face endpoint settings', async () => {
    await settingsManager.writeSettings({
      translationEngines: {
        local: {
          hfEndpoint: 'https://hf-mirror.com',
        },
      },
    })
    clearCache()

    const settings = await settingsManager.readSettings()
    expect(settings.translationEngines.local.hfEndpoint).toBe('https://hf-mirror.com')
    await expect(readFile(settingsPath, 'utf-8')).resolves.toBe(
      '{\n  "translationEngines": {\n    "local": {\n      "hfEndpoint": "https://hf-mirror.com"\n    }\n  }\n}'
    )

    await settingsManager.writeSettings({
      translationEngines: {
        local: {
          hfEndpoint: '',
        },
      },
    })
    clearCache()

    await expect(settingsManager.readSettings()).resolves.toEqual(DEFAULT_GLOBAL_SETTINGS)
  })
})
