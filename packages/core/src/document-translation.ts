import { z } from 'zod'
import { DEFAULT_TRANSLATION_ENGINE_ID, TranslationEngineIdSchema } from './translator.js'

export const DOCUMENT_TRANSLATION_DISPLAY_MODES = ['direct', 'bilingual'] as const

export const DocumentTranslationDisplayModeSchema = z.enum(DOCUMENT_TRANSLATION_DISPLAY_MODES)

export type DocumentTranslationDisplayMode = z.infer<typeof DocumentTranslationDisplayModeSchema>

export const TranslationEngineProjectSettingsSchema = z
  .object({
    local: z
      .object({
        model: z.string().min(1).optional(),
        selectedGroupId: z.string().min(1).optional(),
      })
      .default({}),
    localCt2: z
      .object({
        model: z.string().min(1).optional(),
        selectedGroupId: z.string().min(1).optional(),
      })
      .default({}),
    localLlama: z
      .object({
        model: z.string().min(1).optional(),
        selectedGroupId: z.string().min(1).optional(),
      })
      .default({}),
    openai: z
      .object({
        model: z.string().min(1).optional(),
      })
      .default({}),
  })
  .default({})

export const TranslationEngineProjectSettingsUpdateSchema = z.object({
  local: z
    .object({
      model: z.string().min(1).optional(),
      selectedGroupId: z.string().min(1).nullable().optional(),
    })
    .optional(),
  localCt2: z
    .object({
      model: z.string().min(1).optional(),
      selectedGroupId: z.string().min(1).nullable().optional(),
    })
    .optional(),
  localLlama: z
    .object({
      model: z.string().min(1).optional(),
      selectedGroupId: z.string().min(1).nullable().optional(),
    })
    .optional(),
  openai: z
    .object({
      model: z.string().min(1).optional(),
    })
    .optional(),
})

export const DocumentTranslationConfigSchema = z.object({
  enabled: z.boolean().default(false),
  targetLanguage: z.string().min(1).default('zh'),
  displayMode: DocumentTranslationDisplayModeSchema.default('direct'),
  cacheEnabled: z.boolean().default(false),
  engineId: TranslationEngineIdSchema.default(DEFAULT_TRANSLATION_ENGINE_ID),
  engines: TranslationEngineProjectSettingsSchema,
})

export const DocumentTranslationConfigUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  targetLanguage: z.string().min(1).optional(),
  displayMode: DocumentTranslationDisplayModeSchema.optional(),
  cacheEnabled: z.boolean().optional(),
  engineId: TranslationEngineIdSchema.optional(),
  engines: TranslationEngineProjectSettingsUpdateSchema.optional(),
})

export type DocumentTranslationConfig = z.infer<typeof DocumentTranslationConfigSchema>
export type DocumentTranslationConfigInput = z.input<typeof DocumentTranslationConfigSchema>
export type TranslationEngineProjectSettings = z.infer<
  typeof TranslationEngineProjectSettingsSchema
>
export type TranslationEngineProjectSettingsUpdate = {
  local?: Partial<Omit<TranslationEngineProjectSettings['local'], 'selectedGroupId'>> & {
    selectedGroupId?: TranslationEngineProjectSettings['local']['selectedGroupId'] | null
  }
  localCt2?: Partial<Omit<TranslationEngineProjectSettings['localCt2'], 'selectedGroupId'>> & {
    selectedGroupId?: TranslationEngineProjectSettings['localCt2']['selectedGroupId'] | null
  }
  localLlama?: Partial<Omit<TranslationEngineProjectSettings['localLlama'], 'selectedGroupId'>> & {
    selectedGroupId?: TranslationEngineProjectSettings['localLlama']['selectedGroupId'] | null
  }
  openai?: Partial<TranslationEngineProjectSettings['openai']>
}
export type DocumentTranslationConfigUpdate = Partial<
  Omit<DocumentTranslationConfig, 'engines'>
> & {
  engines?: TranslationEngineProjectSettingsUpdate
}

export const DEFAULT_TRANSLATION_CACHE_ENTRY_LIMIT = 10000
export const MIN_TRANSLATION_CACHE_ENTRY_LIMIT = 100
export const MAX_TRANSLATION_CACHE_ENTRY_LIMIT = 200000
export const TRANSLATION_CACHE_POLICY_VERSION = 2

export const TranslationCacheSettingsSchema = z.object({
  entryLimit: z
    .number()
    .int()
    .min(MIN_TRANSLATION_CACHE_ENTRY_LIMIT)
    .max(MAX_TRANSLATION_CACHE_ENTRY_LIMIT)
    .default(DEFAULT_TRANSLATION_CACHE_ENTRY_LIMIT),
})

export const TranslationCacheSettingsUpdateSchema = z.object({
  entryLimit: z
    .number()
    .int()
    .min(MIN_TRANSLATION_CACHE_ENTRY_LIMIT)
    .max(MAX_TRANSLATION_CACHE_ENTRY_LIMIT)
    .optional(),
})

export type TranslationCacheSettings = z.infer<typeof TranslationCacheSettingsSchema>

export const TranslationCacheEntrySchema = z.object({
  key: z.string().min(1),
  keyHash: z.string().min(1),
  sourceText: z.string(),
  translatedText: z.string(),
  targetNodesJson: z.string().optional(),
  sourceLanguage: z.string().min(1),
  targetLanguage: z.string().min(1),
  placeholderTopologyHash: z.string().min(1),
  attributeTopologyHash: z.string().min(1),
  displayPolicyVersion: z.number().int().positive(),
  engineId: TranslationEngineIdSchema.default(DEFAULT_TRANSLATION_ENGINE_ID),
  engineVersion: z.string().optional(),
  model: z.string().optional(),
  translatorContractVersion: z.number().int().positive().default(1),
  createdAt: z.number().int().nonnegative(),
  lastAccessedAt: z.number().int().nonnegative(),
})

export type TranslationCacheEntry = z.infer<typeof TranslationCacheEntrySchema>

export const TranslationCacheWriteInputSchema = TranslationCacheEntrySchema.omit({
  createdAt: true,
  lastAccessedAt: true,
})

export type TranslationCacheWriteInput = z.infer<typeof TranslationCacheWriteInputSchema>

export const TranslationCacheReadInputSchema = z.object({
  keyHash: z.string().min(1),
})

export type TranslationCacheReadInput = z.infer<typeof TranslationCacheReadInputSchema>

export const TranslationCacheStatsSchema = z.object({
  enabled: z.boolean(),
  entryLimit: z.number().int().positive(),
  entries: z.number().int().nonnegative(),
  databasePath: z.string().optional(),
})

export type TranslationCacheStats = z.infer<typeof TranslationCacheStatsSchema>
