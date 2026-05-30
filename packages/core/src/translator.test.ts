import { describe, expect, it } from 'vitest'
import {
  TRANSLATOR_CONTRACT_VERSION,
  createTranslationEngineLifecycleStatus,
  getManagedLocalTranslationEngineManifest,
  getTranslationEngineLifecycleMessage,
  getTranslationEngineManifest,
  isBatchTranslationAbort,
  isDirectionalManagedLocalTranslationEngineId,
  isManagedLocalTranslationEngineId,
  normalizeBatchTranslationError,
  runControlledTranslationTask,
  shouldShowTranslationEngineInstallGate,
  type TranslationModelCandidate,
} from './translator.js'

describe('translator platform contract', () => {
  it('exposes stable manifests for bundled engines', () => {
    const browser = getTranslationEngineManifest('browser')
    const local = getTranslationEngineManifest('local')
    const localCt2 = getTranslationEngineManifest('local-ct2')
    const localLlama = getTranslationEngineManifest('local-llama')
    const openai = getTranslationEngineManifest('openai')

    expect(browser.runtime).toBe('browser')
    expect(local.moduleName).toBe('@openspecui/local-translator')
    expect(local.factoryExport).toBe('createLocalTranslatorFactory')
    expect(localCt2.moduleName).toBe('@openspecui/local-ct2-translator')
    expect(localCt2.factoryExport).toBe('createLocalCt2TranslatorFactory')
    expect(localLlama.moduleName).toBe('@openspecui/local-llama-translator')
    expect(localLlama.factoryExport).toBe('createLocalLlamaTranslatorFactory')
    expect(openai.moduleName).toBe('@openspecui/openai-completion-translator')
    expect(openai.factoryExport).toBe('createOpenAICompletionTranslatorFactory')
  })

  it('locks the translator contract version to batch translate semantics', () => {
    expect(TRANSLATOR_CONTRACT_VERSION).toBe(3)
  })

  it('distinguishes managed local engines from browser and remote providers', () => {
    expect(isManagedLocalTranslationEngineId('local')).toBe(true)
    expect(isManagedLocalTranslationEngineId('local-ct2')).toBe(true)
    expect(isManagedLocalTranslationEngineId('local-llama')).toBe(true)
    expect(isManagedLocalTranslationEngineId('browser')).toBe(false)
    expect(isManagedLocalTranslationEngineId('openai')).toBe(false)
    expect(isDirectionalManagedLocalTranslationEngineId('local')).toBe(true)
    expect(isDirectionalManagedLocalTranslationEngineId('local-ct2')).toBe(true)
    expect(isDirectionalManagedLocalTranslationEngineId('local-llama')).toBe(false)
  })

  it('defines model candidates with ranking and size metadata for catalog UIs', () => {
    const candidate: TranslationModelCandidate = {
      id: 'Xenova/opus-mt-en-de',
      label: 'Xenova/opus-mt-en-de',
      summary: 'Small Transformers.js translation model.',
      downloads: 502,
      likes: 0,
      tags: ['transformers.js', 'onnx', 'translation'],
      compatibility: {
        transformersJs: true,
        onnx: true,
        localRuntimeVerified: true,
      },
      size: {
        estimatedTotalBytes: 1234,
        primaryBytes: 1200,
      },
      languageMatch: {
        sourceMatched: true,
        targetMatched: true,
        directionalScore: 1,
      },
    }

    expect(candidate.compatibility.localRuntimeVerified).toBe(true)
    expect(candidate.size.estimatedTotalBytes).toBeGreaterThan(0)
  })

  it('exposes managed-local manifest metadata for shared install gate UI', () => {
    const local = getManagedLocalTranslationEngineManifest('local')
    const localCt2 = getManagedLocalTranslationEngineManifest('local-ct2')
    const localLlama = getManagedLocalTranslationEngineManifest('local-llama')

    expect(local.runtimePackageName).toBe('@huggingface/transformers')
    expect(local.modelLabel).toBe('Local Model')
    expect(localCt2.runtimePackageName).toBe('ctranslate2')
    expect(localCt2.downloadGroupsLabel).toBe('Local CT2 download groups')
    expect(localLlama.runtimePackageName).toBe('node-llama-cpp')
    expect(localLlama.downloadGroupsLabel).toBe('Local GGUF files')
  })

  it('shows the install gate until dependency and runtime lifecycle are both ready', () => {
    expect(
      shouldShowTranslationEngineInstallGate(
        createTranslationEngineLifecycleStatus({
          dependency: {
            state: 'missing',
            message: 'Install the Local-Transformers runtime package.',
          },
        })
      )
    ).toBe(true)

    expect(
      shouldShowTranslationEngineInstallGate(
        createTranslationEngineLifecycleStatus({
          dependency: {
            state: 'installed',
          },
          runtime: {
            state: 'failed',
            error: 'Native runtime failed to load.',
          },
        })
      )
    ).toBe(true)

    const readyLifecycle = createTranslationEngineLifecycleStatus({
      dependency: {
        state: 'installed',
        message: 'Dependencies are installed.',
      },
      runtime: {
        state: 'ready',
        message: 'Runtime is ready.',
      },
      assets: {
        state: 'missing',
        message: 'Model files are not installed locally.',
      },
    })

    expect(shouldShowTranslationEngineInstallGate(readyLifecycle)).toBe(false)
    expect(getTranslationEngineLifecycleMessage(readyLifecycle)).toBe('Runtime is ready.')
  })

  it('normalizes timeout and memory-limit translation task failures', () => {
    expect(
      normalizeBatchTranslationError(new Error('Translation task timed out after 15000ms.'))
    ).toEqual({
      kind: 'timeout',
      message: 'Translation task timed out after 15000ms.',
    })
    expect(normalizeBatchTranslationError(new Error('ERR_WORKER_OUT_OF_MEMORY'))).toEqual({
      kind: 'memory-limit',
      message: 'ERR_WORKER_OUT_OF_MEMORY',
    })
  })

  it('runs controlled translation tasks with per-task timeout truth', async () => {
    const result = await runControlledTranslationTask(
      () =>
        new Promise<string>((resolve) => {
          setTimeout(() => resolve('late'), 25)
        }),
      { timeoutMs: 1 }
    )

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'timeout',
        message: 'Translation task timed out after 1ms.',
      },
    })
  })

  it('treats caller cancellation as a batch abort instead of a runtime error', async () => {
    const controller = new AbortController()
    controller.abort(new Error('Translation cancelled by user.'))
    const result = await runControlledTranslationTask(async () => 'unused', {
      signal: controller.signal,
    })

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'abort',
        message: 'Translation cancelled by user.',
      },
    })
    if (result.ok) throw new Error('Expected abort result.')
    expect(isBatchTranslationAbort(result.error, controller.signal)).toBe(true)
  })
})
