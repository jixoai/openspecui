import { z } from 'zod'
import { DEFAULT_TRANSLATION_ENGINE_ID, TranslationEngineIdSchema } from './translator.js'

export const DOCUMENT_TRANSLATION_DISPLAY_MODES = ['direct', 'bilingual'] as const

export const DocumentTranslationDisplayModeSchema = z.enum(DOCUMENT_TRANSLATION_DISPLAY_MODES)

export type DocumentTranslationDisplayMode = z.infer<typeof DocumentTranslationDisplayModeSchema>

export const TranslationEngineProjectSettingsSchema = z
  .object({
    nmt: z
      .object({
        model: z.string().min(1).optional(),
        selectedGroupId: z.string().min(1).optional(),
      })
      .default({}),
    ai: z
      .object({
        model: z.string().min(1).optional(),
      })
      .default({}),
  })
  .default({})

export const DocumentTranslationConfigSchema = z.object({
  enabled: z.boolean().default(false),
  targetLanguage: z.string().min(1).default('zh'),
  displayMode: DocumentTranslationDisplayModeSchema.default('direct'),
  cacheEnabled: z.boolean().default(false),
  engineId: TranslationEngineIdSchema.default(DEFAULT_TRANSLATION_ENGINE_ID),
  engines: TranslationEngineProjectSettingsSchema,
})

export type DocumentTranslationConfig = z.infer<typeof DocumentTranslationConfigSchema>
export type DocumentTranslationConfigInput = z.input<typeof DocumentTranslationConfigSchema>
export type TranslationEngineProjectSettings = z.infer<
  typeof TranslationEngineProjectSettingsSchema
>
export type DocumentTranslationConfigUpdate = Partial<
  Omit<DocumentTranslationConfig, 'engines'>
> & {
  engines?: {
    nmt?: Partial<TranslationEngineProjectSettings['nmt']>
    ai?: Partial<TranslationEngineProjectSettings['ai']>
  }
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
