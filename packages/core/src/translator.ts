import { z } from 'zod'

export const TRANSLATOR_CONTRACT_VERSION = 1

export const TRANSLATION_ENGINE_IDS = ['browser', 'nmt', 'ai'] as const

export const TranslationEngineIdSchema = z.enum(TRANSLATION_ENGINE_IDS)

export type TranslationEngineId = z.infer<typeof TranslationEngineIdSchema>

export const DEFAULT_TRANSLATION_ENGINE_ID: TranslationEngineId = 'browser'

export const SERVICE_TRANSLATION_ENGINE_IDS = ['nmt', 'ai'] as const

export const ServiceTranslationEngineIdSchema = z.enum(SERVICE_TRANSLATION_ENGINE_IDS)

export type ServiceTranslationEngineId = z.infer<typeof ServiceTranslationEngineIdSchema>

export const TRANSLATION_ENGINE_ALIAS_PREFIX = '@openspecui-runtime'

export interface RichTranslationInput {
  instructions: string
  context: string
  source: string
}

export type TranslatorInput = string | RichTranslationInput

export interface TranslatorOptions {
  signal?: AbortSignal
}

export interface Translator {
  translate(input: string, options?: TranslatorOptions): Promise<string>
  translate(input: RichTranslationInput, options?: TranslatorOptions): Promise<string>
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

export const NmtModelDownloadStatusSchema = z.enum([
  'not-downloaded',
  'queued',
  'downloading',
  'paused',
  'downloaded',
  'error',
  'deleting',
])

export type NmtModelDownloadStatus = z.infer<typeof NmtModelDownloadStatusSchema>

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

export const NmtModelAssetLogSchema = z.object({
  engineId: z.literal('nmt'),
  modelId: z.string().min(1),
  selectedGroupId: z.string().min(1).optional(),
  status: NmtModelDownloadStatusSchema,
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

export type NmtModelAssetLog = z.infer<typeof NmtModelAssetLogSchema>

export const NmtModelAssetPlanSnapshotSchema = z.object({
  modelId: z.string().min(1),
  estimatedTotalBytes: z.number().int().nonnegative().optional(),
  files: z.array(TranslationDownloadFilePlanSchema),
  profile: z.string().min(1).optional(),
  selectedGroupId: z.string().min(1).optional(),
  groups: z.array(TranslationDownloadGroupPlanSchema).optional(),
})

export type NmtModelAssetPlanSnapshot = z.infer<typeof NmtModelAssetPlanSnapshotSchema>

export const NmtModelAssetStateSchema = z.object({
  modelId: z.string().min(1),
  status: NmtModelDownloadStatusSchema.default('not-downloaded'),
  selected: z.boolean().default(false),
  installedAt: z.number().int().nonnegative().optional(),
  updatedAt: z.number().int().nonnegative().optional(),
  bytesDownloaded: z.number().int().nonnegative().optional(),
  totalBytes: z.number().int().nonnegative().optional(),
  progress: z.number().min(0).max(1).optional(),
  resumable: z.boolean().default(false),
  error: z.string().optional(),
  plan: NmtModelAssetPlanSnapshotSchema.optional(),
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

export type NmtModelAssetState = z.infer<typeof NmtModelAssetStateSchema>

export interface NmtModelCatalogItem extends TranslationModelCandidate {
  asset: NmtModelAssetState
  selectable: boolean
  local: boolean
}

export interface NmtModelCatalogResult {
  items: NmtModelCatalogItem[]
  nextCursor?: string
}

export interface NmtModelCatalogSearchEvent {
  requestId: string
  phase: TranslationModelSearchPhase
  items?: NmtModelCatalogItem[]
  nextCursor?: string
  message?: string
}

export interface NmtLocalModelCatalogResult {
  items: NmtModelCatalogItem[]
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
  builtin: boolean
  installable: boolean
  packageName?: string
  aliasName?: string
  versionRange?: string
}

export const TRANSLATION_ENGINE_MANIFESTS = [
  {
    id: 'browser',
    label: 'Browser',
    description: 'Uses the browser Translator API and future browser-side providers.',
    technicalSummary:
      'Browser-native Web Translator adapter. Package payload is about 5 KB; browser language packs are managed by the browser.',
    runtime: 'browser',
    builtin: true,
    installable: false,
  },
  {
    id: 'nmt',
    label: 'NMT',
    description: 'Runs a local server-side neural machine translation model.',
    technicalSummary:
      'Server-side Transformers.js NMT adapter. Package payload is about 5 KB; the selected model is downloaded separately and can be hundreds of MB.',
    runtime: 'server',
    builtin: false,
    installable: true,
    packageName: '@openspecui/nmt-translator',
    aliasName: `${TRANSLATION_ENGINE_ALIAS_PREFIX}/nmt-translator`,
    versionRange: '^3.7.2',
  },
  {
    id: 'ai',
    label: 'AI',
    description: 'Uses an OpenAI-compatible TanStack AI provider for context-aware translation.',
    technicalSummary:
      'Server-side TanStack AI adapter for OpenAI-compatible APIs. Package payload is about 5 KB; model size stays with the remote provider.',
    runtime: 'server',
    builtin: false,
    installable: true,
    packageName: '@openspecui/ai-translator',
    aliasName: `${TRANSLATION_ENGINE_ALIAS_PREFIX}/ai-translator`,
    versionRange: '^3.7.2',
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

export const TranslationInstallStatusSchema = z.enum([
  'not-installed',
  'installed',
  'installing',
  'error',
])

export type TranslationInstallStatus = z.infer<typeof TranslationInstallStatusSchema>

export const TranslationInstallLogSchema = z.object({
  engineId: ServiceTranslationEngineIdSchema,
  status: TranslationInstallStatusSchema,
  message: z.string(),
  progress: z.number().min(0).max(1).optional(),
  sessionId: z.string().optional(),
  updatedAt: z.number().int().nonnegative(),
})

export type TranslationInstallLog = z.infer<typeof TranslationInstallLogSchema>

export const TranslationEngineInstallStateSchema = z.object({
  status: TranslationInstallStatusSchema.default('not-installed'),
  version: z.string().optional(),
  message: z.string().optional(),
  installedAt: z.number().int().nonnegative().optional(),
  updatedAt: z.number().int().nonnegative().optional(),
})

export type TranslationEngineInstallState = z.infer<typeof TranslationEngineInstallStateSchema>

export const TranslationExtensionSettingsSchema = z.object({
  installRoot: z.string().optional(),
  engines: z
    .object({
      nmt: TranslationEngineInstallStateSchema.default(
        TranslationEngineInstallStateSchema.parse({})
      ),
      ai: TranslationEngineInstallStateSchema.default(
        TranslationEngineInstallStateSchema.parse({})
      ),
    })
    .default({
      nmt: TranslationEngineInstallStateSchema.parse({}),
      ai: TranslationEngineInstallStateSchema.parse({}),
    }),
})

export type TranslationExtensionSettings = z.infer<typeof TranslationExtensionSettingsSchema>

export const TranslationAiSettingsSchema = z.object({
  baseUrl: z.string().default(''),
  token: z.string().default(''),
  model: z.string().default('gpt-4.1-mini'),
})

export type TranslationAiSettings = z.infer<typeof TranslationAiSettingsSchema>

export const TranslationNmtSettingsSchema = z.object({
  model: z.string().default('Xenova/nllb-200-distilled-600M'),
  selectedGroupId: z.string().optional(),
  hfEndpoint: z.string().default(''),
})

export type TranslationNmtSettings = z.infer<typeof TranslationNmtSettingsSchema>

export const TranslationEngineGlobalSettingsSchema = z.object({
  extensions: TranslationExtensionSettingsSchema.default(
    TranslationExtensionSettingsSchema.parse({})
  ),
  ai: TranslationAiSettingsSchema.default(TranslationAiSettingsSchema.parse({})),
  nmt: TranslationNmtSettingsSchema.default(TranslationNmtSettingsSchema.parse({})),
})

export type TranslationEngineGlobalSettings = z.infer<typeof TranslationEngineGlobalSettingsSchema>

export type TranslationEngineGlobalSettingsUpdate = {
  extensions?: {
    installRoot?: string
    engines?: Partial<Record<ServiceTranslationEngineId, Partial<TranslationEngineInstallState>>>
  }
  ai?: Partial<TranslationAiSettings>
  nmt?: Partial<TranslationNmtSettings>
}

export function createTranslationPackageAliasSpec(input: {
  aliasName: string
  packageName: string
  versionRange: string
}): string {
  return `${input.aliasName}@npm:${input.packageName}@${input.versionRange}`
}

export function isRichTranslationInput(input: TranslatorInput): input is RichTranslationInput {
  return typeof input !== 'string'
}
