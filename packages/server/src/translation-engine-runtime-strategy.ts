import type {
  ManagedLocalTranslationEngineId,
  TranslationEngineGlobalSettings,
} from '@openspecui/core'

export interface TranslationWorkerResourceLimits {
  maxOldGenerationSizeMb?: number
  maxYoungGenerationSizeMb?: number
  codeRangeSizeMb?: number
  maxRssMb?: number
}

export interface TranslationEngineWorkerPolicy {
  enabled: boolean
  resourceLimits?: TranslationWorkerResourceLimits
}

export interface TranslationEngineRuntimeStrategy {
  engineId: ManagedLocalTranslationEngineId
  memoryBudgetPercent: number
  profile: 'power-saver' | 'balanced' | 'performance'
  runtimeConfig: Record<string, unknown>
  worker: TranslationEngineWorkerPolicy
  rejection?: {
    reason: string
    requiredMemoryMb: number
    budgetMemoryMb: number
  }
}

const DEFAULT_MEMORY_BUDGET_PERCENT = 25
const DEFAULT_TOTAL_MEMORY_MB = 8192
const MIN_WORKER_OLD_SPACE_MB = 256
const MIN_WORKER_YOUNG_SPACE_MB = 64
const DEFAULT_CODE_RANGE_MB = 128
const MB = 1024 * 1024

export function resolveManagedLocalRuntimeStrategy(input: {
  engineId: ManagedLocalTranslationEngineId
  globalSettings: TranslationEngineGlobalSettings
  totalMemoryMb?: number
  availableMemoryMb?: number
  platform?: NodeJS.Platform
  arch?: string
  modelSizeBytes?: number
}): TranslationEngineRuntimeStrategy {
  const memoryBudgetPercent = readMemoryBudgetPercent(input.engineId, input.globalSettings)
  const profile = resolveMemoryProfile(memoryBudgetPercent)
  const totalMemoryMb = normalizeTotalMemoryMb(input.totalMemoryMb)
  const workerBudgetMb = Math.max(256, Math.round((totalMemoryMb * memoryBudgetPercent) / 100))
  const worker = createWorkerPolicy(workerBudgetMb)
  const llamaPlan =
    input.engineId === 'local-llama'
      ? resolveLocalLlamaRuntimePlan({
          profile,
          memoryBudgetPercent,
          totalMemoryMb,
          availableMemoryMb: input.availableMemoryMb,
          platform: input.platform,
          arch: input.arch,
          modelSizeBytes: input.modelSizeBytes,
        })
      : undefined

  return {
    engineId: input.engineId,
    memoryBudgetPercent,
    profile,
    runtimeConfig: llamaPlan?.runtimeConfig ?? buildRuntimeConfig(input.engineId, profile),
    worker,
    rejection: llamaPlan?.rejection,
  }
}

export function resolveLocalLlamaRuntimePlan(input: {
  profile: TranslationEngineRuntimeStrategy['profile']
  memoryBudgetPercent: number
  totalMemoryMb: number
  availableMemoryMb?: number
  platform?: NodeJS.Platform
  arch?: string
  modelSizeBytes?: number
}): Pick<TranslationEngineRuntimeStrategy, 'runtimeConfig' | 'rejection'> {
  const isUnifiedMemory = input.platform === 'darwin' && input.arch === 'arm64'
  const contextSize =
    input.profile === 'performance' ? 4096 : input.profile === 'balanced' ? 2048 : 1024
  const batchSize = input.profile === 'performance' ? 512 : input.profile === 'balanced' ? 256 : 128
  const modelSizeMb = normalizeModelSizeMb(input.modelSizeBytes)
  const budgetMemoryMb = resolveSafeRuntimeBudgetMb({
    totalMemoryMb: input.totalMemoryMb,
    availableMemoryMb: input.availableMemoryMb,
    memoryBudgetPercent: input.memoryBudgetPercent,
    isUnifiedMemory,
  })
  const requiredMemoryMb =
    modelSizeMb === undefined
      ? undefined
      : estimateLocalLlamaRequiredMemoryMb({
          modelSizeMb,
          contextSize,
          batchSize,
          isUnifiedMemory,
        })

  const rejection =
    requiredMemoryMb !== undefined && requiredMemoryMb > budgetMemoryMb
      ? {
          requiredMemoryMb,
          budgetMemoryMb,
          reason: `Selected GGUF model is estimated to need ${formatMemoryGb(
            requiredMemoryMb
          )}, but the ${input.memoryBudgetPercent}% memory budget only allows ${formatMemoryGb(
            budgetMemoryMb
          )}. Choose a smaller model, lower the memory budget risk by closing other apps, or raise the engine memory budget intentionally.`,
        }
      : undefined

  return {
    runtimeConfig: {
      gpuLayers: resolveLocalLlamaGpuLayers({
        profile: input.profile,
        isUnifiedMemory,
      }),
      contextSize,
      batchSize,
      flashAttention: input.profile !== 'power-saver',
      useMmap: input.profile !== 'performance',
      useMlock: false,
    },
    ...(rejection ? { rejection } : {}),
  }
}

function readMemoryBudgetPercent(
  engineId: ManagedLocalTranslationEngineId,
  globalSettings: TranslationEngineGlobalSettings
): number {
  const value =
    engineId === 'local-ct2'
      ? globalSettings.localCt2.memoryBudgetPercent
      : engineId === 'local-llama'
        ? globalSettings.localLlama.memoryBudgetPercent
        : globalSettings.local.memoryBudgetPercent
  return normalizeMemoryBudgetPercent(value)
}

function normalizeMemoryBudgetPercent(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_MEMORY_BUDGET_PERCENT
  return Math.max(0, Math.min(100, Math.round(value)))
}

function normalizeTotalMemoryMb(totalMemoryMb: number | undefined): number {
  if (typeof totalMemoryMb !== 'number' || !Number.isFinite(totalMemoryMb) || totalMemoryMb <= 0) {
    return DEFAULT_TOTAL_MEMORY_MB
  }
  return Math.max(1024, Math.round(totalMemoryMb))
}

function resolveMemoryProfile(
  memoryBudgetPercent: number
): TranslationEngineRuntimeStrategy['profile'] {
  if (memoryBudgetPercent >= 70) return 'performance'
  if (memoryBudgetPercent >= 30) return 'balanced'
  return 'power-saver'
}

function createWorkerPolicy(workerBudgetMb: number): TranslationEngineWorkerPolicy {
  const oldSpace = Math.max(MIN_WORKER_OLD_SPACE_MB, Math.round(workerBudgetMb * 0.75))
  const youngSpace = Math.max(
    MIN_WORKER_YOUNG_SPACE_MB,
    Math.min(256, Math.round(workerBudgetMb * 0.2))
  )
  return {
    enabled: true,
    resourceLimits: {
      maxOldGenerationSizeMb: oldSpace,
      maxYoungGenerationSizeMb: youngSpace,
      codeRangeSizeMb: DEFAULT_CODE_RANGE_MB,
      maxRssMb: workerBudgetMb,
    },
  }
}

function normalizeModelSizeMb(modelSizeBytes: number | undefined): number | undefined {
  return typeof modelSizeBytes === 'number' && Number.isFinite(modelSizeBytes) && modelSizeBytes > 0
    ? Math.ceil(modelSizeBytes / MB)
    : undefined
}

function resolveSafeRuntimeBudgetMb(input: {
  totalMemoryMb: number
  availableMemoryMb?: number
  memoryBudgetPercent: number
  isUnifiedMemory: boolean
}): number {
  const quotaFromTotal = Math.round((input.totalMemoryMb * input.memoryBudgetPercent) / 100)
  const osReservedMb = input.isUnifiedMemory ? 3072 : 1536
  const quotaWithOsReserve = Math.max(
    0,
    Math.min(quotaFromTotal, input.totalMemoryMb - osReservedMb)
  )
  // On unified-memory Macs, os.freemem() is transient and can exclude reclaimable memory.
  // The RSS watchdog enforces the selected budget at runtime, so preflight uses intent budget.
  if (input.isUnifiedMemory) {
    return quotaWithOsReserve
  }
  const quotaFromAvailable =
    typeof input.availableMemoryMb === 'number' &&
    Number.isFinite(input.availableMemoryMb) &&
    input.availableMemoryMb > 0
      ? Math.max(0, input.availableMemoryMb - osReservedMb)
      : quotaWithOsReserve
  return Math.max(0, Math.min(quotaWithOsReserve, quotaFromAvailable))
}

function estimateLocalLlamaRequiredMemoryMb(input: {
  modelSizeMb: number
  contextSize: number
  batchSize: number
  isUnifiedMemory: boolean
}): number {
  const contextMb = Math.ceil((input.contextSize / 1024) * 192)
  const batchScratchMb = Math.ceil((input.batchSize / 128) * 64)
  const nativeOverheadMb = Math.max(input.isUnifiedMemory ? 768 : 512, input.modelSizeMb * 0.25)
  return Math.ceil(input.modelSizeMb + contextMb + batchScratchMb + nativeOverheadMb)
}

function resolveLocalLlamaGpuLayers(input: {
  profile: TranslationEngineRuntimeStrategy['profile']
  isUnifiedMemory: boolean
}): number | 'auto' | 'max' {
  if (input.isUnifiedMemory) {
    if (input.profile === 'power-saver') return 0
    return 'max'
  }
  if (input.profile === 'performance') return 'auto'
  if (input.profile === 'balanced') return 16
  return 0
}

function formatMemoryGb(memoryMb: number): string {
  return `${Math.max(0.01, memoryMb / 1024).toFixed(2)}GB`
}

function buildRuntimeConfig(
  engineId: ManagedLocalTranslationEngineId,
  profile: TranslationEngineRuntimeStrategy['profile']
): Record<string, unknown> {
  if (engineId === 'local') {
    return profile === 'performance'
      ? {
          device: 'gpu',
          session_options: {
            enableCpuMemArena: true,
            enableMemPattern: true,
          },
        }
      : profile === 'balanced'
        ? {
            device: 'gpu',
            session_options: {
              enableCpuMemArena: true,
              enableMemPattern: false,
            },
          }
        : {
            device: 'cpu',
            session_options: {
              enableCpuMemArena: false,
              enableMemPattern: false,
            },
          }
  }

  if (engineId === 'local-ct2') {
    return profile === 'performance'
      ? { device: 'auto', threads: 6, beamSize: 4, maxBatchSize: 16 }
      : profile === 'balanced'
        ? { device: 'auto', threads: 4, beamSize: 3, maxBatchSize: 8 }
        : { device: 'cpu', threads: 2, beamSize: 2, maxBatchSize: 4 }
  }

  return profile === 'performance'
    ? {
        gpuLayers: 'max',
        contextSize: 4096,
        batchSize: 512,
        flashAttention: true,
        useMmap: false,
        useMlock: false,
      }
    : profile === 'balanced'
      ? {
          gpuLayers: 'auto',
          contextSize: 2048,
          batchSize: 256,
          flashAttention: true,
          useMmap: true,
          useMlock: false,
        }
      : {
          gpuLayers: 8,
          contextSize: 1024,
          batchSize: 128,
          flashAttention: false,
          useMmap: true,
          useMlock: false,
        }
}
