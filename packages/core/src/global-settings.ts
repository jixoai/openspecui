import { mkdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { z } from 'zod'
import {
  TranslationCacheSettingsSchema,
  type TranslationCacheSettings,
} from './document-translation.js'
import { reactiveReadFile, updateReactiveFileCache } from './reactive-fs/index.js'
import {
  TranslationEngineGlobalSettingsSchema,
  type ServiceTranslationEngineId,
  type TranslationAiSettings,
  type TranslationEngineGlobalSettingsUpdate,
  type TranslationEngineInstallState,
  type TranslationNmtSettings,
} from './translator.js'

export const OpenSpecUIGlobalSettingsSchema = z.object({
  translationCache: TranslationCacheSettingsSchema.default(
    TranslationCacheSettingsSchema.parse({})
  ),
  translationEngines: TranslationEngineGlobalSettingsSchema.default(
    TranslationEngineGlobalSettingsSchema.parse({})
  ),
})

export type OpenSpecUIGlobalSettings = z.infer<typeof OpenSpecUIGlobalSettingsSchema>

export type OpenSpecUIGlobalSettingsUpdate = {
  translationCache?: Partial<TranslationCacheSettings>
  translationEngines?: TranslationEngineGlobalSettingsUpdate
}

export type PersistedOpenSpecUIGlobalSettings = {
  translationCache?: Partial<TranslationCacheSettings>
  translationEngines?: {
    extensions?: {
      installRoot?: string
      engines?: Partial<Record<ServiceTranslationEngineId, TranslationEngineInstallState>>
    }
    ai?: Partial<TranslationAiSettings>
    nmt?: Partial<TranslationNmtSettings>
  }
}

export const DEFAULT_GLOBAL_SETTINGS: OpenSpecUIGlobalSettings =
  OpenSpecUIGlobalSettingsSchema.parse({})

export function getDefaultGlobalSettingsPath(): string {
  return join(homedir(), '.openspecui', 'settings.json')
}

function pruneNullish(value: unknown): unknown {
  if (value === null || value === undefined) return undefined
  if (Array.isArray(value)) {
    return value.map((entry) => pruneNullish(entry)).filter((entry) => entry !== undefined)
  }
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).flatMap(([key, entryValue]) => {
        const nextValue = pruneNullish(entryValue)
        return nextValue === undefined ? [] : [[key, nextValue] as const]
      })
    )
  }
  return value
}

function hasOwnEntries(value: object): boolean {
  return Object.keys(value).length > 0
}

export function toPersistedGlobalSettings(
  settings: OpenSpecUIGlobalSettings
): PersistedOpenSpecUIGlobalSettings {
  const persisted: PersistedOpenSpecUIGlobalSettings = {}
  const translationCache: NonNullable<PersistedOpenSpecUIGlobalSettings['translationCache']> = {}

  if (
    settings.translationCache.entryLimit !== DEFAULT_GLOBAL_SETTINGS.translationCache.entryLimit
  ) {
    translationCache.entryLimit = settings.translationCache.entryLimit
  }

  if (hasOwnEntries(translationCache)) {
    persisted.translationCache = translationCache
  }

  const translationEngines: NonNullable<PersistedOpenSpecUIGlobalSettings['translationEngines']> =
    {}
  const defaultTranslationEngines = DEFAULT_GLOBAL_SETTINGS.translationEngines
  const extensions: NonNullable<
    NonNullable<PersistedOpenSpecUIGlobalSettings['translationEngines']>['extensions']
  > = {}
  if (settings.translationEngines.extensions.installRoot) {
    extensions.installRoot = settings.translationEngines.extensions.installRoot
  }
  const extensionEngines: Record<'nmt' | 'ai', TranslationEngineInstallState> = {
    nmt: settings.translationEngines.extensions.engines.nmt,
    ai: settings.translationEngines.extensions.engines.ai,
  }
  const persistedExtensionEngines: Partial<Record<'nmt' | 'ai', TranslationEngineInstallState>> = {}
  if (
    JSON.stringify(extensionEngines.nmt) !==
    JSON.stringify(defaultTranslationEngines.extensions.engines.nmt)
  ) {
    persistedExtensionEngines.nmt = extensionEngines.nmt
  }
  if (
    JSON.stringify(extensionEngines.ai) !==
    JSON.stringify(defaultTranslationEngines.extensions.engines.ai)
  ) {
    persistedExtensionEngines.ai = extensionEngines.ai
  }
  if (hasOwnEntries(persistedExtensionEngines)) {
    extensions.engines = persistedExtensionEngines
  }
  if (hasOwnEntries(extensions)) {
    translationEngines.extensions = extensions
  }
  const ai: Partial<TranslationAiSettings> = {}
  if (settings.translationEngines.ai.baseUrl !== defaultTranslationEngines.ai.baseUrl) {
    ai.baseUrl = settings.translationEngines.ai.baseUrl
  }
  if (settings.translationEngines.ai.token !== defaultTranslationEngines.ai.token) {
    ai.token = settings.translationEngines.ai.token
  }
  if (settings.translationEngines.ai.model !== defaultTranslationEngines.ai.model) {
    ai.model = settings.translationEngines.ai.model
  }
  if (hasOwnEntries(ai)) {
    translationEngines.ai = ai
  }
  const nmt: Partial<TranslationNmtSettings> = {}
  if (settings.translationEngines.nmt.model !== defaultTranslationEngines.nmt.model) {
    nmt.model = settings.translationEngines.nmt.model
  }
  if (
    settings.translationEngines.nmt.selectedGroupId !==
    defaultTranslationEngines.nmt.selectedGroupId
  ) {
    nmt.selectedGroupId = settings.translationEngines.nmt.selectedGroupId
  }
  if (settings.translationEngines.nmt.hfEndpoint !== defaultTranslationEngines.nmt.hfEndpoint) {
    nmt.hfEndpoint = settings.translationEngines.nmt.hfEndpoint
  }
  if (hasOwnEntries(nmt)) {
    translationEngines.nmt = nmt
  }
  if (hasOwnEntries(translationEngines)) {
    persisted.translationEngines = translationEngines
  }

  return persisted
}

function isPersistedGlobalSettingsEmpty(settings: PersistedOpenSpecUIGlobalSettings): boolean {
  return !hasOwnEntries(settings)
}

/**
 * User-level OpenSpecUI settings stored outside project worktrees.
 *
 * This manager owns cross-project policy only; project opt-in remains in
 * `openspec/.openspecui.json`.
 */
export class GlobalSettingsManager {
  private readonly settingsPath: string

  constructor(settingsPath: string = getDefaultGlobalSettingsPath()) {
    this.settingsPath = settingsPath
  }

  getSettingsPath(): string {
    return this.settingsPath
  }

  private parseSettingsContent(content: string | null): OpenSpecUIGlobalSettings {
    if (!content) return DEFAULT_GLOBAL_SETTINGS

    try {
      const parsed = JSON.parse(content)
      const normalized = pruneNullish(parsed) ?? {}
      const result = OpenSpecUIGlobalSettingsSchema.safeParse(normalized)
      if (result.success) return result.data

      console.warn('Invalid global settings format, using defaults:', result.error.message)
      return DEFAULT_GLOBAL_SETTINGS
    } catch (error) {
      console.warn('Failed to parse global settings, using defaults:', error)
      return DEFAULT_GLOBAL_SETTINGS
    }
  }

  async readSettings(): Promise<OpenSpecUIGlobalSettings> {
    const content = await reactiveReadFile(this.settingsPath)
    return this.parseSettingsContent(content)
  }

  async writeSettings(update: OpenSpecUIGlobalSettingsUpdate): Promise<void> {
    const currentContent = await reactiveReadFile(this.settingsPath)
    const fileExists = currentContent !== null
    const current = this.parseSettingsContent(currentContent)
    const merged = OpenSpecUIGlobalSettingsSchema.parse({
      ...current,
      translationCache: {
        ...current.translationCache,
        ...update.translationCache,
      },
      translationEngines: {
        ...current.translationEngines,
        extensions: {
          ...current.translationEngines.extensions,
          ...update.translationEngines?.extensions,
          engines: {
            nmt: {
              ...current.translationEngines.extensions.engines.nmt,
              ...update.translationEngines?.extensions?.engines?.nmt,
            },
            ai: {
              ...current.translationEngines.extensions.engines.ai,
              ...update.translationEngines?.extensions?.engines?.ai,
            },
          },
        },
        ai: {
          ...current.translationEngines.ai,
          ...update.translationEngines?.ai,
        },
        nmt: {
          ...current.translationEngines.nmt,
          ...update.translationEngines?.nmt,
        },
      },
    })
    const persisted = toPersistedGlobalSettings(merged)

    if (isPersistedGlobalSettingsEmpty(persisted) && !fileExists) {
      return
    }

    const serialized = isPersistedGlobalSettingsEmpty(persisted)
      ? '{}'
      : JSON.stringify(persisted, null, 2)

    if (currentContent === serialized) {
      return
    }

    await mkdir(dirname(this.settingsPath), { recursive: true })
    await writeFile(this.settingsPath, serialized, 'utf-8')
    updateReactiveFileCache(this.settingsPath, serialized)
  }
}
