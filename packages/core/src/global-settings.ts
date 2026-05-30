import { mkdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { z } from 'zod'
import {
  DocumentTranslationDisplayModeSchema,
  TranslationCacheSettingsSchema,
  type TranslationCacheSettings,
} from './document-translation.js'
import {
  sanitizePersistedSettings,
  type PersistedSanitizeRule,
} from './persisted-settings-sanitize.js'
import { reactiveReadFile, updateReactiveFileCache } from './reactive-fs/index.js'
import {
  TranslationEngineGlobalSettingsSchema,
  TranslationEngineIdSchema,
  type TranslationEngineGlobalSettingsUpdate,
  type TranslationEngineId,
  type TranslationLocalCt2Settings,
  type TranslationLocalLlamaSettings,
  type TranslationLocalSettings,
  type TranslationOpenAISettings,
} from './translator.js'

export const DocumentTranslationGlobalSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  targetLanguage: z.string().min(1).default('zh'),
  displayMode: DocumentTranslationDisplayModeSchema.default('direct'),
  cacheEnabled: z.boolean().default(false),
})

export type DocumentTranslationGlobalSettings = z.infer<
  typeof DocumentTranslationGlobalSettingsSchema
>

export const OpenSpecUIGlobalSettingsSchema = z.object({
  translation: DocumentTranslationGlobalSettingsSchema.default(
    DocumentTranslationGlobalSettingsSchema.parse({})
  ),
  translationCache: TranslationCacheSettingsSchema.default(
    TranslationCacheSettingsSchema.parse({})
  ),
  translationEngines: TranslationEngineGlobalSettingsSchema.default(
    TranslationEngineGlobalSettingsSchema.parse({})
  ),
})

export type OpenSpecUIGlobalSettings = z.infer<typeof OpenSpecUIGlobalSettingsSchema>

export type OpenSpecUIGlobalSettingsUpdate = {
  translation?: Partial<DocumentTranslationGlobalSettings>
  translationCache?: Partial<TranslationCacheSettings>
  translationEngines?: TranslationEngineGlobalSettingsUpdate
}

export type PersistedOpenSpecUIGlobalSettings = {
  translation?: Partial<OpenSpecUIGlobalSettings['translation']>
  translationCache?: Partial<TranslationCacheSettings>
  translationEngines?: {
    engineId?: TranslationEngineId
    openai?: Partial<TranslationOpenAISettings>
    local?: Partial<TranslationLocalSettings>
    localCt2?: Partial<TranslationLocalCt2Settings>
    localLlama?: Partial<TranslationLocalLlamaSettings>
  }
}

export const DEFAULT_GLOBAL_SETTINGS: OpenSpecUIGlobalSettings =
  OpenSpecUIGlobalSettingsSchema.parse({})

const PERSISTED_GLOBAL_SETTINGS_SANITIZE_RULES = [
  { kind: 'object', path: ['translation'], fallback: {} },
  {
    kind: 'field',
    path: ['translation', 'enabled'],
    schema: DocumentTranslationGlobalSettingsSchema.shape.enabled,
    fallback: DEFAULT_GLOBAL_SETTINGS.translation.enabled,
  },
  {
    kind: 'field',
    path: ['translation', 'targetLanguage'],
    schema: DocumentTranslationGlobalSettingsSchema.shape.targetLanguage,
    fallback: DEFAULT_GLOBAL_SETTINGS.translation.targetLanguage,
  },
  {
    kind: 'field',
    path: ['translation', 'displayMode'],
    schema: DocumentTranslationGlobalSettingsSchema.shape.displayMode,
    fallback: DEFAULT_GLOBAL_SETTINGS.translation.displayMode,
  },
  {
    kind: 'field',
    path: ['translation', 'cacheEnabled'],
    schema: DocumentTranslationGlobalSettingsSchema.shape.cacheEnabled,
    fallback: DEFAULT_GLOBAL_SETTINGS.translation.cacheEnabled,
  },
  { kind: 'object', path: ['translationCache'], fallback: {} },
  { kind: 'object', path: ['translationEngines'], fallback: {} },
  {
    kind: 'field',
    path: ['translationEngines', 'engineId'],
    schema: TranslationEngineIdSchema,
    fallback: DEFAULT_GLOBAL_SETTINGS.translationEngines.engineId,
  },
  { kind: 'object', path: ['translationEngines', 'openai'], fallback: {} },
  { kind: 'object', path: ['translationEngines', 'local'], fallback: {} },
  { kind: 'object', path: ['translationEngines', 'localCt2'], fallback: {} },
  { kind: 'object', path: ['translationEngines', 'localLlama'], fallback: {} },
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

function mergeNullablePatch<TBase extends Record<string, unknown>>(
  current: TBase,
  patch: Record<string, unknown> | undefined
): TBase {
  const next: Record<string, unknown> = { ...current }
  if (!patch) return next as TBase
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete next[key]
    } else if (value !== undefined) {
      next[key] = value
    }
  }
  return next as TBase
}

export function toPersistedGlobalSettings(
  settings: OpenSpecUIGlobalSettings
): PersistedOpenSpecUIGlobalSettings {
  const persisted: PersistedOpenSpecUIGlobalSettings = {}
  const translation: NonNullable<PersistedOpenSpecUIGlobalSettings['translation']> = {}
  const translationCache: NonNullable<PersistedOpenSpecUIGlobalSettings['translationCache']> = {}

  if (settings.translation.enabled !== DEFAULT_GLOBAL_SETTINGS.translation.enabled) {
    translation.enabled = settings.translation.enabled
  }
  if (settings.translation.targetLanguage !== DEFAULT_GLOBAL_SETTINGS.translation.targetLanguage) {
    translation.targetLanguage = settings.translation.targetLanguage
  }
  if (settings.translation.displayMode !== DEFAULT_GLOBAL_SETTINGS.translation.displayMode) {
    translation.displayMode = settings.translation.displayMode
  }
  if (settings.translation.cacheEnabled !== DEFAULT_GLOBAL_SETTINGS.translation.cacheEnabled) {
    translation.cacheEnabled = settings.translation.cacheEnabled
  }

  if (
    settings.translationCache.entryLimit !== DEFAULT_GLOBAL_SETTINGS.translationCache.entryLimit
  ) {
    translationCache.entryLimit = settings.translationCache.entryLimit
  }

  if (hasOwnEntries(translation)) {
    persisted.translation = translation
  }
  if (hasOwnEntries(translationCache)) {
    persisted.translationCache = translationCache
  }

  const translationEngines: NonNullable<PersistedOpenSpecUIGlobalSettings['translationEngines']> =
    {}
  const defaultTranslationEngines = DEFAULT_GLOBAL_SETTINGS.translationEngines
  if (settings.translationEngines.engineId !== defaultTranslationEngines.engineId) {
    translationEngines.engineId = settings.translationEngines.engineId
  }

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
  if (
    settings.translationEngines.local.memoryBudgetPercent !==
    defaultTranslationEngines.local.memoryBudgetPercent
  ) {
    local.memoryBudgetPercent = settings.translationEngines.local.memoryBudgetPercent
  }
  if (hasOwnEntries(local)) {
    translationEngines.local = local
  }

  const localCt2: Partial<TranslationLocalCt2Settings> = {}
  if (settings.translationEngines.localCt2.model !== defaultTranslationEngines.localCt2.model) {
    localCt2.model = settings.translationEngines.localCt2.model
  }
  if (
    settings.translationEngines.localCt2.selectedGroupId !==
    defaultTranslationEngines.localCt2.selectedGroupId
  ) {
    localCt2.selectedGroupId = settings.translationEngines.localCt2.selectedGroupId
  }
  if (
    settings.translationEngines.localCt2.hfEndpoint !==
    defaultTranslationEngines.localCt2.hfEndpoint
  ) {
    localCt2.hfEndpoint = settings.translationEngines.localCt2.hfEndpoint
  }
  if (
    settings.translationEngines.localCt2.memoryBudgetPercent !==
    defaultTranslationEngines.localCt2.memoryBudgetPercent
  ) {
    localCt2.memoryBudgetPercent = settings.translationEngines.localCt2.memoryBudgetPercent
  }
  if (hasOwnEntries(localCt2)) {
    translationEngines.localCt2 = localCt2
  }

  const localLlama: Partial<TranslationLocalLlamaSettings> = {}
  if (settings.translationEngines.localLlama.model !== defaultTranslationEngines.localLlama.model) {
    localLlama.model = settings.translationEngines.localLlama.model
  }
  if (
    settings.translationEngines.localLlama.selectedGroupId !==
    defaultTranslationEngines.localLlama.selectedGroupId
  ) {
    localLlama.selectedGroupId = settings.translationEngines.localLlama.selectedGroupId
  }
  if (
    settings.translationEngines.localLlama.hfEndpoint !==
    defaultTranslationEngines.localLlama.hfEndpoint
  ) {
    localLlama.hfEndpoint = settings.translationEngines.localLlama.hfEndpoint
  }
  if (
    settings.translationEngines.localLlama.memoryBudgetPercent !==
    defaultTranslationEngines.localLlama.memoryBudgetPercent
  ) {
    localLlama.memoryBudgetPercent = settings.translationEngines.localLlama.memoryBudgetPercent
  }
  if (hasOwnEntries(localLlama)) {
    translationEngines.localLlama = localLlama
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
      translation: {
        ...current.translation,
        ...update.translation,
      },
      translationCache: {
        ...current.translationCache,
        ...update.translationCache,
      },
      translationEngines: {
        ...current.translationEngines,
        engineId: update.translationEngines?.engineId ?? current.translationEngines.engineId,
        openai: mergeNullablePatch(
          current.translationEngines.openai,
          update.translationEngines?.openai
        ),
        local: mergeNullablePatch(
          current.translationEngines.local,
          update.translationEngines?.local
        ),
        localCt2: mergeNullablePatch(
          current.translationEngines.localCt2,
          update.translationEngines?.localCt2
        ),
        localLlama: mergeNullablePatch(
          current.translationEngines.localLlama,
          update.translationEngines?.localLlama
        ),
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
