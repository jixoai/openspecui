import { z } from 'zod'

export const DOCUMENT_TRANSLATION_DISPLAY_MODES = ['direct', 'bilingual'] as const

export const DocumentTranslationDisplayModeSchema = z.enum(DOCUMENT_TRANSLATION_DISPLAY_MODES)

export type DocumentTranslationDisplayMode = z.infer<typeof DocumentTranslationDisplayModeSchema>

export const DocumentTranslationConfigSchema = z.object({
  enabled: z.boolean().default(false),
  targetLanguage: z.string().min(1).default('zh'),
  displayMode: DocumentTranslationDisplayModeSchema.default('direct'),
})

export type DocumentTranslationConfig = z.infer<typeof DocumentTranslationConfigSchema>
