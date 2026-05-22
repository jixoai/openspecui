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
  type TranslationEngineGlobalSettingsUpdate,
  type TranslationLocalSettings,
  type TranslationOpenAISettings,
} from './translator.js'
import { sanitizePersistedSettings, type PersistedSanitizeRule } from './persisted-settings-sanitize.js'

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
    openai?: Partial<TranslationOpenAISettings>
    local?: Partial<TranslationLocalSettings>
  }
}

export const DEFAULT_GLOBAL_SETTINGS: OpenSpecUIGlobalSettings =
  OpenSpecUIGlobalSettingsSchema.parse({})

const PERSISTED_GLOBAL_SETTINGS_SANITIZE_RULES = [
  { kind: 'object', path: ['translationCache'], fallback: {} },
  { kind: 'object', path: ['translationEngines'], fallback: {} },
  { kind: 'object', path: ['translationEngines', 'openai'], fallback: {} },
  { kind: 'object', path: ['translationEngines', 'local'], fallback: {} },
] as const satisfies readonly PersistedSanitizeRule[]

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

  const openai: Partial<TranslationOpenAISettings> = {}
  if (settings.translationEngines.openai.baseUrl !== defaultTranslationEngines.openai.baseUrl) {
    openai.baseUrl = settings.translationEngines.openai.baseUrl
  }
  if (settings.translationEngines.openai.token !== defaultTranslationEngines.openai.token) {
    openai.token = settings.translationEngines.openai.token
  }
  if (settings.translationEngines.openai.model !== defaultTranslationEngines.openai.model) {
    openai.model = settings.translationEngines.openai.model
  }
  if (hasOwnEntries(openai)) {
    translationEngines.openai = openai
  }

  const local: Partial<TranslationLocalSettings> = {}
  if (settings.translationEngines.local.model !== defaultTranslationEngines.local.model) {
    local.model = settings.translationEngines.local.model
  }
  if (
    settings.translationEngines.local.selectedGroupId !==
    defaultTranslationEngines.local.selectedGroupId
  ) {
    local.selectedGroupId = settings.translationEngines.local.selectedGroupId
  }
  if (settings.translationEngines.local.hfEndpoint !== defaultTranslationEngines.local.hfEndpoint) {
    local.hfEndpoint = settings.translationEngines.local.hfEndpoint
  }
  if (hasOwnEntries(local)) {
    translationEngines.local = local
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
      const sanitized = sanitizePersistedSettings(
        normalized,
        PERSISTED_GLOBAL_SETTINGS_SANITIZE_RULES
      )
      const result = OpenSpecUIGlobalSettingsSchema.safeParse(sanitized)
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
        openai: {
          ...current.translationEngines.openai,
          ...update.translationEngines?.openai,
        },
        local: {
          ...current.translationEngines.local,
          ...update.translationEngines?.local,
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
