import { z } from 'zod'

export const TRANSLATOR_CONTRACT_VERSION = 3

export const TRANSLATION_ENGINE_IDS = [
  'browser',
  'local',
  'local-ct2',
  'local-llama',
  'openai',
] as const

export const TranslationEngineIdSchema = z.enum(TRANSLATION_ENGINE_IDS)

export type TranslationEngineId = z.infer<typeof TranslationEngineIdSchema>

export const DEFAULT_TRANSLATION_ENGINE_ID: TranslationEngineId = 'browser'

export function isManagedLocalTranslationEngineId(
  engineId: TranslationEngineId | null | undefined
): engineId is Extract<TranslationEngineId, 'local' | 'local-ct2' | 'local-llama'> {
  return engineId === 'local' || engineId === 'local-ct2' || engineId === 'local-llama'
}

export function isDirectionalManagedLocalTranslationEngineId(
  engineId: TranslationEngineId | null | undefined
): engineId is Extract<TranslationEngineId, 'local' | 'local-ct2'> {
  return engineId === 'local' || engineId === 'local-ct2'
}

export type ManagedLocalTranslationEngineId = Extract<
  TranslationEngineId,
  'local' | 'local-ct2' | 'local-llama'
>

export const SERVICE_TRANSLATION_ENGINE_IDS = [
  'local',
  'local-ct2',
  'local-llama',
  'openai',
] as const

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
  etag?: string
  revision?: string
  sourceUrl?: string
  raw?: unknown
}

export interface TranslationDownloadGroupPlan {
  id: string
  label: string
  description?: string
  profile?: string
  dtype?: string
  estimatedTotalBytes?: number
  baseGroupId?: string
  commitHash?: string
  shortCommitHash?: string
  rootDir?: string
  status?: LocalModelDownloadStatus
  progress?: number
  bytesDownloaded?: number
  totalBytes?: number
  resumable?: boolean
  error?: string
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
  etag: z.string().min(1).optional(),
  revision: z.string().min(1).optional(),
  sourceUrl: z.string().min(1).optional(),
  raw: z.unknown().optional(),
})

export const TranslationDownloadGroupPlanSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  profile: z.string().min(1).optional(),
  dtype: z.string().min(1).optional(),
  estimatedTotalBytes: z.number().int().nonnegative().optional(),
  baseGroupId: z.string().min(1).optional(),
  commitHash: z.string().min(1).optional(),
  shortCommitHash: z.string().min(1).optional(),
  rootDir: z.string().min(1).optional(),
  status: LocalModelDownloadStatusSchema.optional(),
  progress: z.number().min(0).max(1).optional(),
  bytesDownloaded: z.number().int().nonnegative().optional(),
  totalBytes: z.number().int().nonnegative().optional(),
  resumable: z.boolean().optional(),
  error: z.string().optional(),
  selectable: z.boolean(),
  selected: z.boolean(),
  files: z.array(TranslationDownloadFilePlanSchema),
})

export const LocalModelProfileStatusSchema = z.enum(['idle', 'loading', 'ready', 'error'])

export type LocalModelProfileStatus = z.infer<typeof LocalModelProfileStatusSchema>

export const LocalModelProfileManifestFileSchema = z.object({
  path: z.string().min(1),
  sizeBytes: z.number().int().nonnegative().optional(),
  required: z.boolean(),
  etag: z.string().min(1).optional(),
  revision: z.string().min(1).optional(),
  sourceUrl: z.string().min(1).optional(),
  raw: z.unknown().optional(),
})

export type LocalModelProfileManifestFile = z.infer<typeof LocalModelProfileManifestFileSchema>

export const LocalModelProfileManifestGroupSchema = z.object({
  id: z.string().min(1),
  baseGroupId: z.string().min(1),
  label: z.string().min(1),
  displayLabel: z.string().min(1),
  description: z.string().optional(),
  profile: z.string().min(1).optional(),
  dtype: z.string().min(1).optional(),
  commitHash: z.string().min(1),
  shortCommitHash: z.string().min(1),
  rootDir: z.string().min(1),
  estimatedTotalBytes: z.number().int().nonnegative().optional(),
  selectable: z.boolean(),
  files: z.array(LocalModelProfileManifestFileSchema),
})

export type LocalModelProfileManifestGroup = z.infer<typeof LocalModelProfileManifestGroupSchema>

export const LocalModelProfileManifestSchema = z.object({
  modelId: z.string().min(1),
  source: z.literal('huggingface'),
  endpoint: z.string().default(''),
  revision: z.string().min(1),
  commitHash: z.string().min(1),
  shortCommitHash: z.string().min(1),
  fetchedAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  raw: z.unknown().optional(),
  groups: z.record(z.string(), LocalModelProfileManifestGroupSchema).default({}),
  groupOrder: z.array(z.string().min(1)).default([]),
})

export type LocalModelProfileManifest = z.infer<typeof LocalModelProfileManifestSchema>

export const LocalModelLifecycleFileStateSchema = z.object({
  path: z.string().min(1),
  sizeBytes: z.number().int().nonnegative().optional(),
  downloadedBytes: z.number().int().nonnegative().optional(),
  required: z.boolean().default(true),
  status: LocalModelDownloadStatusSchema.default('not-downloaded'),
  updatedAt: z.number().int().nonnegative().optional(),
  error: z.string().optional(),
})

export type LocalModelLifecycleFileState = z.infer<typeof LocalModelLifecycleFileStateSchema>

export const LocalModelLifecycleGroupStateSchema = z.object({
  groupId: z.string().min(1),
  baseGroupId: z.string().min(1).optional(),
  status: LocalModelDownloadStatusSchema.default('not-downloaded'),
  rootDir: z.string().min(1).optional(),
  bytesDownloaded: z.number().int().nonnegative().optional(),
  totalBytes: z.number().int().nonnegative().optional(),
  progress: z.number().min(0).max(1).optional(),
  resumable: z.boolean().default(false),
  error: z.string().optional(),
  installedAt: z.number().int().nonnegative().optional(),
  updatedAt: z.number().int().nonnegative().optional(),
  files: z.array(LocalModelLifecycleFileStateSchema).default([]),
})

export type LocalModelLifecycleGroupState = z.infer<typeof LocalModelLifecycleGroupStateSchema>

export const LocalModelProfileLoadStateSchema = z.object({
  status: LocalModelProfileStatusSchema.default('idle'),
  message: z.string().optional(),
  error: z.string().optional(),
  updatedAt: z.number().int().nonnegative().optional(),
})

export type LocalModelProfileLoadState = z.infer<typeof LocalModelProfileLoadStateSchema>

export const LocalModelAssetLogSchema = z.object({
  engineId: z.enum(['local', 'local-ct2', 'local-llama']),
  modelId: z.string().min(1),
  selectedGroupId: z.string().min(1).optional(),
  groupId: z.string().min(1).optional(),
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
  version: z.literal(2).default(2),
  status: LocalModelDownloadStatusSchema.default('not-downloaded'),
  selected: z.boolean().default(false),
  selectedGroupId: z.string().min(1).optional(),
  installedAt: z.number().int().nonnegative().optional(),
  updatedAt: z.number().int().nonnegative().optional(),
  bytesDownloaded: z.number().int().nonnegative().optional(),
  totalBytes: z.number().int().nonnegative().optional(),
  progress: z.number().min(0).max(1).optional(),
  resumable: z.boolean().default(false),
  error: z.string().optional(),
  profileLoad: LocalModelProfileLoadStateSchema.default(LocalModelProfileLoadStateSchema.parse({})),
  profileManifest: LocalModelProfileManifestSchema.optional(),
  groupsState: z.record(z.string(), LocalModelLifecycleGroupStateSchema).default({}),
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

export const ManagedLocalCatalogSourceSchema = z.enum(['local', 'network', 'recommended'])

export type ManagedLocalCatalogSource = z.infer<typeof ManagedLocalCatalogSourceSchema>

export interface LocalModelCatalogItem extends TranslationModelCandidate {
  asset: LocalModelAssetState
  selectable: boolean
  local: boolean
  primarySource: ManagedLocalCatalogSource
  sources: ManagedLocalCatalogSource[]
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

export type TranslationEngineDependencyState =
  | 'installed'
  | 'installing'
  | 'missing'
  | 'error'
  | 'not-applicable'

export const TranslationEngineDependencyStateSchema = z.enum([
  'installed',
  'installing',
  'missing',
  'error',
  'not-applicable',
])

export type TranslationEngineRuntimeState =
  | 'ready'
  | 'probing'
  | 'failed'
  | 'error'
  | 'not-applicable'

export const TranslationEngineRuntimeStateSchema = z.enum([
  'ready',
  'probing',
  'failed',
  'error',
  'not-applicable',
])

export type TranslationEngineAssetState =
  | 'ready'
  | 'missing'
  | 'downloading'
  | 'error'
  | 'not-applicable'

export const TranslationEngineAssetStateSchema = z.enum([
  'ready',
  'missing',
  'downloading',
  'error',
  'not-applicable',
])

const TranslationEngineLifecyclePhaseMetaSchema = z.object({
  message: z.string().optional(),
  progress: z.number().min(0).max(1).optional(),
  error: z.string().optional(),
})

export interface TranslationEngineDependencyStatus {
  state: TranslationEngineDependencyState
  message?: string
  progress?: number
  error?: string
}

export const TranslationEngineDependencyStatusSchema =
  TranslationEngineLifecyclePhaseMetaSchema.extend({
    state: TranslationEngineDependencyStateSchema,
  })

export interface TranslationEngineRuntimeStatus {
  state: TranslationEngineRuntimeState
  message?: string
  progress?: number
  error?: string
}

export const TranslationEngineRuntimeStatusSchema =
  TranslationEngineLifecyclePhaseMetaSchema.extend({
    state: TranslationEngineRuntimeStateSchema,
  })

export interface TranslationEngineAssetStatus {
  state: TranslationEngineAssetState
  message?: string
  progress?: number
  error?: string
}

export const TranslationEngineAssetStatusSchema = TranslationEngineLifecyclePhaseMetaSchema.extend({
  state: TranslationEngineAssetStateSchema,
})

export interface TranslationEngineLifecycleStatus {
  dependency: TranslationEngineDependencyStatus
  runtime: TranslationEngineRuntimeStatus
  assets: TranslationEngineAssetStatus
  summary?: string
}

export const TranslationEngineLifecycleStatusSchema = z.object({
  dependency: TranslationEngineDependencyStatusSchema,
  runtime: TranslationEngineRuntimeStatusSchema,
  assets: TranslationEngineAssetStatusSchema,
  summary: z.string().optional(),
})

export function createTranslationEngineLifecycleStatus(
  input: Partial<TranslationEngineLifecycleStatus> & {
    dependency?: Partial<TranslationEngineDependencyStatus>
    runtime?: Partial<TranslationEngineRuntimeStatus>
    assets?: Partial<TranslationEngineAssetStatus>
  } = {}
): TranslationEngineLifecycleStatus {
  return {
    dependency: {
      state: 'not-applicable',
      ...input.dependency,
    },
    runtime: {
      state: 'not-applicable',
      ...input.runtime,
    },
    assets: {
      state: 'not-applicable',
      ...input.assets,
    },
    ...(input.summary ? { summary: input.summary } : {}),
  }
}

export function isTranslationEngineDependencyReady(
  status: TranslationEngineLifecycleStatus
): boolean {
  return status.dependency.state === 'installed' || status.dependency.state === 'not-applicable'
}

export function isTranslationEngineRuntimeReady(status: TranslationEngineLifecycleStatus): boolean {
  return status.runtime.state === 'ready' || status.runtime.state === 'not-applicable'
}

export function shouldShowTranslationEngineInstallGate(
  status: TranslationEngineLifecycleStatus | null | undefined
): boolean {
  if (!status) return false
  return !isTranslationEngineDependencyReady(status) || !isTranslationEngineRuntimeReady(status)
}

export function getTranslationEngineLifecycleMessage(
  status: TranslationEngineLifecycleStatus | null | undefined
): string | undefined {
  if (!status) return undefined
  return (
    status.summary ??
    status.runtime.error ??
    status.runtime.message ??
    status.dependency.error ??
    status.dependency.message ??
    status.assets.error ??
    status.assets.message
  )
}

export const TranslationEngineInstallLogStreamSchema = z.enum(['stdout', 'stderr'])

export type TranslationEngineInstallLogStream = z.infer<
  typeof TranslationEngineInstallLogStreamSchema
>

export interface TranslationEngineInstallLogEvent {
  stream: TranslationEngineInstallLogStream
  text: string
}

export const TranslationEngineInstallLogEventSchema = z.object({
  stream: TranslationEngineInstallLogStreamSchema,
  text: z.string(),
})

export interface TranslationEngineLifecycleStatusEvent {
  type: 'status'
  lifecycle: TranslationEngineLifecycleStatus
}

export interface TranslationEngineLifecycleLogEvent {
  type: 'log'
  stream: TranslationEngineInstallLogStream
  text: string
}

export interface TranslationEngineLifecycleExitEvent {
  type: 'exit'
  lifecycle: TranslationEngineLifecycleStatus
}

export type TranslationEngineLifecycleEvent =
  | TranslationEngineLifecycleStatusEvent
  | TranslationEngineLifecycleLogEvent
  | TranslationEngineLifecycleExitEvent

export const TranslationEngineLifecycleEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('status'),
    lifecycle: TranslationEngineLifecycleStatusSchema,
  }),
  z.object({
    type: z.literal('log'),
    stream: TranslationEngineInstallLogStreamSchema,
    text: z.string(),
  }),
  z.object({
    type: z.literal('exit'),
    lifecycle: TranslationEngineLifecycleStatusSchema,
  }),
])

export interface TranslationEngineLifecycleContext {
  projectDir: string
  globalSettings: TranslationEngineGlobalSettings
  signal?: AbortSignal
  onLifecycle?: (status: TranslationEngineLifecycleStatus) => void
  onLog?: (event: TranslationEngineInstallLogEvent) => void
}

export interface TranslationEngineLifecycleController {
  detectLifecycle(
    input: TranslationEngineLifecycleContext
  ): Promise<TranslationEngineLifecycleStatus>
  install(input: TranslationEngineLifecycleContext): Promise<TranslationEngineLifecycleStatus>
}

export type TranslationEngineRuntime = 'browser' | 'server'
export type TranslationEngineKind = 'browser' | 'managed-local' | 'remote-provider'
export type TranslationEngineSettingsKey = 'local' | 'localCt2' | 'localLlama' | 'openai'

export interface TranslationEngineManifest {
  id: TranslationEngineId
  label: string
  description: string
  technicalSummary: string
  runtime: TranslationEngineRuntime
  kind: TranslationEngineKind
  settingsKey?: TranslationEngineSettingsKey
  defaultModel?: string
  runtimePackageName?: string
  installDescription?: string
  modelLabel?: string
  downloadGroupsLabel?: string
  refreshTooltip?: string
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
    kind: 'browser',
    installDescription: 'Browser translation support is built into the browser runtime.',
    moduleName: '@openspecui/browser-translator',
    factoryExport: 'createBrowserTranslatorFactory',
  },
  {
    id: 'local',
    label: 'Local-Transformers',
    description:
      'Runs an ONNX Runtime-backed local translation adapter through Transformers.js with managed ONNX model files.',
    technicalSummary:
      'Server-side ONNX Runtime adapter via Transformers.js. Runtime package is installed on demand; selected ONNX model groups are downloaded separately and can range from tens to hundreds of MB.',
    runtime: 'server',
    kind: 'managed-local',
    settingsKey: 'local',
    defaultModel: 'Xenova/nllb-200-distilled-600M',
    runtimePackageName: '@huggingface/transformers',
    installDescription:
      'Install the Local-Transformers runtime package to enable server-side translation.',
    modelLabel: 'Local Model',
    downloadGroupsLabel: 'Local download profiles',
    refreshTooltip: 'Refresh local model profiles',
    moduleName: '@openspecui/local-translator',
    factoryExport: 'createLocalTranslatorFactory',
  },
  {
    id: 'local-ct2',
    label: 'Local-CT2',
    description: 'Runs a bundled local CTranslate2 translation runtime with managed model files.',
    technicalSummary:
      'Server-side native CTranslate2 adapter. Runtime package is installed on demand; selected model artifacts are downloaded separately and can range from tens to hundreds of MB.',
    runtime: 'server',
    kind: 'managed-local',
    settingsKey: 'localCt2',
    defaultModel: 'ooeoeo/opus-mt-en-zh-ct2-float16',
    runtimePackageName: 'ctranslate2',
    installDescription: 'Install the Local-CT2 runtime package to enable server-side translation.',
    modelLabel: 'CT2 Model',
    downloadGroupsLabel: 'Local CT2 download groups',
    refreshTooltip: 'Refresh local model artifacts',
    moduleName: '@openspecui/local-ct2-translator',
    factoryExport: 'createLocalCt2TranslatorFactory',
  },
  {
    id: 'local-llama',
    label: 'Local-Llama',
    description:
      'Runs a local GGUF translation-capable LLM through node-llama-cpp with managed GGUF model files.',
    technicalSummary:
      'Server-side llama.cpp adapter via node-llama-cpp. Runtime package is installed on demand; selected GGUF model files are downloaded separately and can range from hundreds of MB to multiple GB.',
    runtime: 'server',
    kind: 'managed-local',
    settingsKey: 'localLlama',
    defaultModel: 'tencent/Hy-MT2-1.8B-1.25Bit-GGUF',
    runtimePackageName: 'node-llama-cpp',
    installDescription:
      'Install the Local-Llama runtime package to enable server-side GGUF translation.',
    modelLabel: 'Llama Model',
    downloadGroupsLabel: 'Local GGUF files',
    refreshTooltip: 'Refresh local GGUF artifacts',
    moduleName: '@openspecui/local-llama-translator',
    factoryExport: 'createLocalLlamaTranslatorFactory',
  },
  {
    id: 'openai',
    label: 'OpenAI-Completion',
    description:
      'Uses an OpenAI-compatible TanStack AI completion provider for context-aware translation.',
    technicalSummary:
      'Server-side TanStack AI adapter for OpenAI-compatible APIs. Package payload is about 5 KB; model size stays with the remote provider.',
    runtime: 'server',
    kind: 'remote-provider',
    settingsKey: 'openai',
    defaultModel: 'gpt-4.1-mini',
    installDescription: 'OpenAI completion translation is bundled with the server runtime.',
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

export function getManagedLocalTranslationEngineManifest(
  engineId: ManagedLocalTranslationEngineId
): TranslationEngineManifest & {
  kind: 'managed-local'
  settingsKey: Extract<TranslationEngineSettingsKey, 'local' | 'localCt2' | 'localLlama'>
  defaultModel: string
  runtimePackageName: string
  installDescription: string
  modelLabel: string
  downloadGroupsLabel: string
  refreshTooltip: string
} {
  const manifest = getTranslationEngineManifest(engineId)
  if (manifest.kind !== 'managed-local') {
    throw new Error(`Translation engine ${engineId} is not a managed-local engine.`)
  }
  return manifest as TranslationEngineManifest & {
    kind: 'managed-local'
    settingsKey: Extract<TranslationEngineSettingsKey, 'local' | 'localCt2' | 'localLlama'>
    defaultModel: string
    runtimePackageName: string
    installDescription: string
    modelLabel: string
    downloadGroupsLabel: string
    refreshTooltip: string
  }
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

export const TranslationLocalCt2SettingsSchema = z.object({
  model: z.string().default('ooeoeo/opus-mt-en-zh-ct2-float16'),
  selectedGroupId: z.string().optional(),
  hfEndpoint: z.string().default(''),
})

export type TranslationLocalCt2Settings = z.infer<typeof TranslationLocalCt2SettingsSchema>

export const TranslationLocalLlamaSettingsSchema = z.object({
  model: z.string().default('tencent/Hy-MT2-1.8B-1.25Bit-GGUF'),
  selectedGroupId: z.string().optional(),
  hfEndpoint: z.string().default(''),
})

export type TranslationLocalLlamaSettings = z.infer<typeof TranslationLocalLlamaSettingsSchema>

export const TranslationEngineGlobalSettingsSchema = z.object({
  openai: TranslationOpenAISettingsSchema.default(TranslationOpenAISettingsSchema.parse({})),
  local: TranslationLocalSettingsSchema.default(TranslationLocalSettingsSchema.parse({})),
  localCt2: TranslationLocalCt2SettingsSchema.default(TranslationLocalCt2SettingsSchema.parse({})),
  localLlama: TranslationLocalLlamaSettingsSchema.default(
    TranslationLocalLlamaSettingsSchema.parse({})
  ),
})

export type TranslationEngineGlobalSettings = z.infer<typeof TranslationEngineGlobalSettingsSchema>

export type TranslationEngineGlobalSettingsUpdate = {
  openai?: Partial<TranslationOpenAISettings>
  local?: Partial<Omit<TranslationLocalSettings, 'selectedGroupId'>> & {
    selectedGroupId?: TranslationLocalSettings['selectedGroupId'] | null
  }
  localCt2?: Partial<Omit<TranslationLocalCt2Settings, 'selectedGroupId'>> & {
    selectedGroupId?: TranslationLocalCt2Settings['selectedGroupId'] | null
  }
  localLlama?: Partial<Omit<TranslationLocalLlamaSettings, 'selectedGroupId'>> & {
    selectedGroupId?: TranslationLocalLlamaSettings['selectedGroupId'] | null
  }
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
