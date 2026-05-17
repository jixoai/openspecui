import type {
  ConfigManager,
  GlobalSettingsManager,
  TranslationCacheEntry,
  TranslationCacheStats,
  TranslationCacheWriteInput,
} from '@openspecui/core'
import type { TranslationCacheAdapter } from './translation-cache-adapter.js'

export interface TranslationCacheServiceOptions {
  configManager: ConfigManager
  globalSettingsManager: GlobalSettingsManager
  adapter: TranslationCacheAdapter
  now?: () => number
  onWriteError?: (error: unknown) => void
}

export class TranslationCacheService {
  private readonly configManager: ConfigManager
  private readonly globalSettingsManager: GlobalSettingsManager
  private readonly adapter: TranslationCacheAdapter
  private readonly now: () => number
  private readonly onWriteError: (error: unknown) => void

  constructor(options: TranslationCacheServiceOptions) {
    this.configManager = options.configManager
    this.globalSettingsManager = options.globalSettingsManager
    this.adapter = options.adapter
    this.now = options.now ?? Date.now
    this.onWriteError = options.onWriteError ?? (() => undefined)
  }

  async getStats(): Promise<TranslationCacheStats> {
    const [{ translation }, globalSettings] = await Promise.all([
      this.configManager.readConfig(),
      this.globalSettingsManager.readSettings(),
    ])
    const entryLimit = globalSettings.translationCache.entryLimit
    const enabled = translation.cacheEnabled
    return {
      enabled,
      entryLimit,
      entries: enabled ? await this.adapter.count() : 0,
      ...(this.adapter.databasePath ? { databasePath: this.adapter.databasePath } : {}),
    }
  }

  async read(keyHash: string): Promise<TranslationCacheEntry | null> {
    const config = await this.configManager.readConfig()
    if (!config.translation.cacheEnabled) return null

    try {
      return await this.adapter.read(keyHash, this.now())
    } catch {
      return null
    }
  }

  async write(input: TranslationCacheWriteInput): Promise<{ accepted: boolean }> {
    const [{ translation }, globalSettings] = await Promise.all([
      this.configManager.readConfig(),
      this.globalSettingsManager.readSettings(),
    ])
    if (!translation.cacheEnabled) return { accepted: false }

    void this.writeAndClean(input, globalSettings.translationCache.entryLimit)
    return { accepted: true }
  }

  async clean(): Promise<{ before: number; after: number; deleted: number }> {
    const globalSettings = await this.globalSettingsManager.readSettings()
    return this.adapter.clean(globalSettings.translationCache.entryLimit)
  }

  async clear(): Promise<{ deleted: number }> {
    return { deleted: await this.adapter.clear() }
  }

  close(): void {
    this.adapter.close?.()
  }

  private async writeAndClean(
    input: TranslationCacheWriteInput,
    entryLimit: number
  ): Promise<void> {
    try {
      await this.adapter.write(input, this.now())
      const count = await this.adapter.count()
      if (count >= Math.floor(entryLimit * 0.9)) {
        await this.adapter.clean(entryLimit)
      }
    } catch (error) {
      this.onWriteError(error)
    }
  }
}
