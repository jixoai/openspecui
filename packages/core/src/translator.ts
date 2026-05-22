import { z } from 'zod'

export const TRANSLATOR_CONTRACT_VERSION = 2

export const TRANSLATION_ENGINE_IDS = ['browser', 'local', 'openai'] as const

export const TranslationEngineIdSchema = z.enum(TRANSLATION_ENGINE_IDS)

export type TranslationEngineId = z.infer<typeof TranslationEngineIdSchema>

export const DEFAULT_TRANSLATION_ENGINE_ID: TranslationEngineId = 'browser'

export const SERVICE_TRANSLATION_ENGINE_IDS = ['local', 'openai'] as const

export const ServiceTranslationEngineIdSchema = z.enum(SERVICE_TRANSLATION_ENGINE_IDS)

export type ServiceTranslationEngineId = z.infer<typeof ServiceTranslationEngineIdSchema>

export interface TranslatorOptions {
  instructions?: string
  context?: string
  signal?: AbortSignal
}

export interface BatchTranslationResult {
  index: number
  output: string
}

export interface Translator {
  batchTranslate(
    inputs: string[],
    options?: TranslatorOptions
  ): AsyncGenerator<BatchTranslationResult>
  destroy?(): void
}

export interface TranslatorCreateMonitor {
  setStatus(input: { message: string; progress?: number }): void
}

export interface TranslatorPrepareMonitor {
  setStatus(input: { message: string; progress?: number }): void
}

export interface TranslationModelSearchInput {
  engineId: ServiceTranslationEngineId
  requestId?: string
  query?: string
  sourceLanguage?: string
  targetLanguage?: string
  limit?: number
  cursor?: string
}

export type TranslationModelSearchPhase = 'candidates' | 'enriched' | 'complete' | 'error'

export interface TranslationDownloadFilePlan {
  path: string
  sizeBytes?: number
  required: boolean
}

export interface TranslationDownloadGroupPlan {
  id: string
  label: string
  description?: string
  profile?: string
  dtype?: string
  estimatedTotalBytes?: number
  selectable: boolean
  selected: boolean
  files: TranslationDownloadFilePlan[]
}

export interface TranslationModelDownloadPlan {
  modelId: string
  estimatedTotalBytes?: number
  files: TranslationDownloadFilePlan[]
  selectedGroupId?: string
  groups?: TranslationDownloadGroupPlan[]
}

export interface TranslationModelCandidate {
  id: string
  label: string
  summary: string
  downloads: number
  likes: number
  trendingScore?: number
  lastModified?: string
  pipelineTag?: string
  tags: string[]
  compatibility: {
    transformersJs: boolean
    onnx: boolean
    localRuntimeVerified: boolean
  }
  size: {
    estimatedTotalBytes?: number
    primaryBytes?: number
  }
  downloadGroups?: TranslationDownloadGroupPlan[]
  languageMatch: {
    sourceMatched: boolean
    targetMatched: boolean
    directionalScore: number
  }
}

export interface TranslationModelSearchResult {
  items: TranslationModelCandidate[]
  nextCursor?: string
}

export interface TranslationModelSearchEvent {
  requestId: string
  phase: TranslationModelSearchPhase
  items?: TranslationModelCandidate[]
  nextCursor?: string
  message?: string
}

export const LocalModelDownloadStatusSchema = z.enum([
  'not-downloaded',
  'queued',
  'downloading',
  'paused',
  'downloaded',
  'error',
  'deleting',
])

export type LocalModelDownloadStatus = z.infer<typeof LocalModelDownloadStatusSchema>

export const TranslationDownloadFilePlanSchema = z.object({
  path: z.string().min(1),
  sizeBytes: z.number().int().nonnegative().optional(),
  required: z.boolean(),
})

export const TranslationDownloadGroupPlanSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  profile: z.string().min(1).optional(),
  dtype: z.string().min(1).optional(),
  estimatedTotalBytes: z.number().int().nonnegative().optional(),
  selectable: z.boolean(),
  selected: z.boolean(),
  files: z.array(TranslationDownloadFilePlanSchema),
})

export const LocalModelAssetLogSchema = z.object({
  engineId: z.literal('local'),
  modelId: z.string().min(1),
  selectedGroupId: z.string().min(1).optional(),
  status: LocalModelDownloadStatusSchema,
  message: z.string(),
  progress: z.number().min(0).max(1).optional(),
  bytesDownloaded: z.number().int().nonnegative().optional(),
  totalBytes: z.number().int().nonnegative().optional(),
  sessionId: z.string().optional(),
  resumable: z.boolean().optional(),
  files: z
    .array(
      z.object({
        path: z.string().min(1),
        sizeBytes: z.number().int().nonnegative().optional(),
        downloadedBytes: z.number().int().nonnegative().optional(),
      })
    )
    .optional(),
  updatedAt: z.number().int().nonnegative(),
})

export type LocalModelAssetLog = z.infer<typeof LocalModelAssetLogSchema>

export const LocalModelAssetPlanSnapshotSchema = z.object({
  modelId: z.string().min(1),
  estimatedTotalBytes: z.number().int().nonnegative().optional(),
  files: z.array(TranslationDownloadFilePlanSchema),
  profile: z.string().min(1).optional(),
  selectedGroupId: z.string().min(1).optional(),
  groups: z.array(TranslationDownloadGroupPlanSchema).optional(),
})

export type LocalModelAssetPlanSnapshot = z.infer<typeof LocalModelAssetPlanSnapshotSchema>

export const LocalModelAssetStateSchema = z.object({
  modelId: z.string().min(1),
  status: LocalModelDownloadStatusSchema.default('not-downloaded'),
  selected: z.boolean().default(false),
  installedAt: z.number().int().nonnegative().optional(),
  updatedAt: z.number().int().nonnegative().optional(),
  bytesDownloaded: z.number().int().nonnegative().optional(),
  totalBytes: z.number().int().nonnegative().optional(),
  progress: z.number().min(0).max(1).optional(),
  resumable: z.boolean().default(false),
  error: z.string().optional(),
  plan: LocalModelAssetPlanSnapshotSchema.optional(),
  files: z
    .array(
      z.object({
        path: z.string().min(1),
        sizeBytes: z.number().int().nonnegative().optional(),
        downloadedBytes: z.number().int().nonnegative().optional(),
      })
    )
    .default([]),
})

export type LocalModelAssetState = z.infer<typeof LocalModelAssetStateSchema>

export interface LocalModelCatalogItem extends TranslationModelCandidate {
  asset: LocalModelAssetState
  selectable: boolean
  local: boolean
}

export interface LocalModelCatalogResult {
  items: LocalModelCatalogItem[]
  nextCursor?: string
}

export interface LocalModelCatalogSearchEvent {
  requestId: string
  phase: TranslationModelSearchPhase
  items?: LocalModelCatalogItem[]
  nextCursor?: string
  message?: string
}

export interface LocalModelCatalogLocalResult {
  items: LocalModelCatalogItem[]
}

export interface TranslatorFactoryPrepareOptions extends TranslatorFactoryCreateOptions {
  monitor?: TranslatorPrepareMonitor
}

export interface TranslatorFactoryCreateOptions {
  sourceLanguage: string
  targetLanguage: string
  model?: string
  dtype?: string
  runtimeConfig?: Record<string, unknown>
  signal?: AbortSignal
  monitor?: TranslatorCreateMonitor
}

export interface TranslatorFactory {
  prepare?(options: TranslatorFactoryPrepareOptions): Promise<void>
  create(options: TranslatorFactoryCreateOptions): Promise<Translator>
}

export type TranslationEngineRuntime = 'browser' | 'server'

export interface TranslationEngineManifest {
  id: TranslationEngineId
  label: string
  description: string
  technicalSummary: string
  runtime: TranslationEngineRuntime
  moduleName?: string
  factoryExport?: string
}

export const TRANSLATION_ENGINE_MANIFESTS = [
  {
    id: 'browser',
    label: 'Browser',
    description: 'Uses the browser Translator API and future browser-side providers.',
    technicalSummary:
      'Browser-native Web Translator adapter. Package payload is about 5 KB; browser language packs are managed by the browser.',
    runtime: 'browser',
    moduleName: '@openspecui/browser-translator',
    factoryExport: 'createBrowserTranslatorFactory',
  },
  {
    id: 'local',
    label: 'Local-Transformers',
    description: 'Runs a bundled local Transformers.js translation runtime with managed model files.',
    technicalSummary:
      'Server-side Transformers.js local adapter. Package payload is about 5 KB; selected model groups are downloaded separately and can range from tens to hundreds of MB.',
    runtime: 'server',
    moduleName: '@openspecui/local-translator',
    factoryExport: 'createLocalTranslatorFactory',
  },
  {
    id: 'openai',
    label: 'OpenAI-Completion',
    description: 'Uses an OpenAI-compatible TanStack AI completion provider for context-aware translation.',
    technicalSummary:
      'Server-side TanStack AI adapter for OpenAI-compatible APIs. Package payload is about 5 KB; model size stays with the remote provider.',
    runtime: 'server',
    moduleName: '@openspecui/openai-completion-translator',
    factoryExport: 'createOpenAICompletionTranslatorFactory',
  },
] as const satisfies readonly TranslationEngineManifest[]

export function getTranslationEngineManifest(
  engineId: TranslationEngineId
): TranslationEngineManifest {
  const manifest = TRANSLATION_ENGINE_MANIFESTS.find((engine) => engine.id === engineId)
  if (!manifest) {
    throw new Error(`Unknown translation engine: ${engineId}`)
  }
  return manifest
}

export const TranslationOpenAISettingsSchema = z.object({
  baseUrl: z.string().default(''),
  token: z.string().default(''),
  model: z.string().default('gpt-4.1-mini'),
})

export type TranslationOpenAISettings = z.infer<typeof TranslationOpenAISettingsSchema>

export const TranslationLocalSettingsSchema = z.object({
  model: z.string().default('Xenova/nllb-200-distilled-600M'),
  selectedGroupId: z.string().optional(),
  hfEndpoint: z.string().default(''),
})

export type TranslationLocalSettings = z.infer<typeof TranslationLocalSettingsSchema>

export const TranslationEngineGlobalSettingsSchema = z.object({
  openai: TranslationOpenAISettingsSchema.default(TranslationOpenAISettingsSchema.parse({})),
  local: TranslationLocalSettingsSchema.default(TranslationLocalSettingsSchema.parse({})),
})

export type TranslationEngineGlobalSettings = z.infer<typeof TranslationEngineGlobalSettingsSchema>

export type TranslationEngineGlobalSettingsUpdate = {
  openai?: Partial<TranslationOpenAISettings>
  local?: Partial<TranslationLocalSettings>
}

export const BatchTranslateInputSchema = z.object({
  engineId: TranslationEngineIdSchema,
  sourceLanguage: z.string().min(1),
  targetLanguage: z.string().min(1),
  model: z.string().min(1).optional(),
  selectedGroupId: z.string().min(1).optional(),
  inputs: z.array(z.string()).min(1),
  instructions: z.string().optional(),
  context: z.string().optional(),
})

export type BatchTranslateInput = z.infer<typeof BatchTranslateInputSchema>

export const BatchTranslateEventSchema = z.object({
  index: z.number().int().nonnegative(),
  output: z.string(),
})

export type BatchTranslateEvent = z.infer<typeof BatchTranslateEventSchema>
