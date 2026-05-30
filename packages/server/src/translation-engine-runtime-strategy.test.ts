import { describe, expect, it } from 'vitest'
import {
  resolveLocalLlamaRuntimePlan,
  resolveManagedLocalRuntimeStrategy,
} from './translation-engine-runtime-strategy.js'

const baseGlobalSettings = {
  engineId: 'local-llama' as const,
  openai: { baseUrl: '', token: '', model: 'gpt-4.1-mini' },
  local: {
    model: 'Xenova/nllb-200-distilled-600M',
    hfEndpoint: '',
    memoryBudgetPercent: 25,
  },
  localCt2: {
    model: 'ooeoeo/opus-mt-en-zh-ct2-float16',
    hfEndpoint: '',
    memoryBudgetPercent: 25,
  },
  localLlama: {
    model: 'tencent/Hy-MT2-1.8B-1.25Bit-GGUF',
    hfEndpoint: '',
    memoryBudgetPercent: 25,
  },
}

describe('translation engine runtime strategy', () => {
  it('uses a conservative Apple Silicon local-llama plan for the default budget', () => {
    const strategy = resolveManagedLocalRuntimeStrategy({
      engineId: 'local-llama',
      globalSettings: baseGlobalSettings,
      totalMemoryMb: 16 * 1024,
      availableMemoryMb: 10 * 1024,
      platform: 'darwin',
      arch: 'arm64',
      modelSizeBytes: 1024 * 1024 * 1024,
    })

    expect(strategy.profile).toBe('power-saver')
    expect(strategy.rejection).toBeUndefined()
    expect(strategy.runtimeConfig).toMatchObject({
      gpuLayers: 0,
      contextSize: 1024,
      batchSize: 128,
      flashAttention: false,
      useMmap: true,
      useMlock: false,
    })
  })

  it('rejects local-llama before loading when the estimated memory exceeds the safe budget', () => {
    const plan = resolveLocalLlamaRuntimePlan({
      profile: 'power-saver',
      memoryBudgetPercent: 25,
      totalMemoryMb: 8 * 1024,
      availableMemoryMb: 4 * 1024,
      platform: 'darwin',
      arch: 'arm64',
      modelSizeBytes: 3 * 1024 * 1024 * 1024,
    })

    expect(plan.rejection?.reason).toContain('Selected GGUF model is estimated to need')
    expect(plan.rejection?.budgetMemoryMb).toBe(2048)
    expect(plan.rejection?.requiredMemoryMb).toBeGreaterThan(2048)
  })

  it('does not collapse Apple Silicon local-llama budget to transient free memory', () => {
    const plan = resolveLocalLlamaRuntimePlan({
      profile: 'balanced',
      memoryBudgetPercent: 50,
      totalMemoryMb: 16 * 1024,
      availableMemoryMb: 128,
      platform: 'darwin',
      arch: 'arm64',
      modelSizeBytes: 1024 * 1024 * 1024,
    })

    expect(plan.rejection).toBeUndefined()
  })
})
