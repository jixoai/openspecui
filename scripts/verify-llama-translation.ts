import { ConfigManager, GlobalSettingsManager } from '@openspecui/core'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LlamaModelAssetService } from '../packages/server/src/llama-model-asset-service.js'
import { TranslationEngineService } from '../packages/server/src/translation-engine-service.js'

const modelId = process.env.OPENSPECUI_VERIFY_LLAMA_MODEL ?? 'bartowski/Qwen2.5-0.5B-Instruct-GGUF'
const hfEndpoint = process.env.OPENSPECUI_VERIFY_LLAMA_HF_ENDPOINT ?? ''
const sourceLanguage = process.env.OPENSPECUI_VERIFY_LLAMA_SOURCE_LANGUAGE ?? 'en'
const targetLanguage = process.env.OPENSPECUI_VERIFY_LLAMA_TARGET_LANGUAGE ?? 'zh'
const sourceText =
  process.env.OPENSPECUI_VERIFY_LLAMA_SOURCE_TEXT ?? 'This is a local llama verification run.'
const expectedRecommendedModelId =
  process.env.OPENSPECUI_VERIFY_LLAMA_EXPECT_RECOMMENDED_MODEL ?? modelId
const requestedGroupId =
  process.env.OPENSPECUI_VERIFY_LLAMA_SELECTED_GROUP_ID ?? 'Qwen2.5-0.5B-Instruct-Q4_K_M.gguf'

async function main() {
  const tempRoot = await mkdtemp(join(tmpdir(), 'openspecui-llama-translation-'))
  const projectDir = join(tempRoot, 'project')
  const settingsPath = join(tempRoot, 'settings.json')
  const cacheDir = join(tempRoot, 'hf-cache')
  const indexPath = join(tempRoot, 'models.json')
  const profileManifestPath = join(tempRoot, 'profile-manifests.json')
  const fetchCachePath = join(tempRoot, 'provider-fetch-cache.json')

  await mkdir(join(projectDir, 'openspec'), { recursive: true })

  const globalSettingsManager = new GlobalSettingsManager(settingsPath)
  const configManager = new ConfigManager(projectDir)
  const translationEngineService = new TranslationEngineService({
    projectDir,
    configManager,
    globalSettingsManager,
    localLlamaCacheDir: cacheDir,
    localLlamaAssetIndexPath: indexPath,
    localLlamaFetchCachePath: fetchCachePath,
  })
  const llamaModelAssetService = new LlamaModelAssetService({
    projectDir,
    globalSettingsManager,
    cacheDir,
    indexPath,
    profileManifestPath,
    fetchCachePath,
  })

  let lastLogKey = ''
  const translationLogSubscription = llamaModelAssetService.subscribeLogs().subscribe({
    next(log) {
      const nextProgress = log.progress === undefined ? '' : `${Math.round(log.progress * 100)}%`
      const nextKey = [log.engineId, log.modelId, log.status, log.message, nextProgress].join('|')
      if (nextKey === lastLogKey) return
      lastLogKey = nextKey
      const line = [
        new Date(log.updatedAt).toISOString(),
        log.engineId,
        log.modelId,
        log.status,
        log.message,
        nextProgress,
      ]
        .filter(Boolean)
        .join(' | ')
      console.log(line)
    },
  })

  try {
    await globalSettingsManager.writeSettings({
      translationEngines: {
        localLlama: {
          model: modelId,
          selectedGroupId: requestedGroupId || undefined,
          hfEndpoint,
        },
      },
    })
    await configManager.writeConfig({
      translation: {
        engineId: 'local-llama',
        targetLanguage,
        engines: {
          localLlama: {
            model: modelId,
            selectedGroupId: requestedGroupId || undefined,
          },
        },
      },
    })

    const recommended = await llamaModelAssetService.searchRemoteCatalog({
      engineId: 'local-llama',
      query: '',
      targetLanguage,
      limit: 3,
    })
    console.log(`Recommended llama models: ${recommended.items.map((item) => item.id).join(', ')}`)
    if (!recommended.items.some((item) => item.id === expectedRecommendedModelId)) {
      throw new Error(
        `Expected recommended llama results to include ${expectedRecommendedModelId}.`
      )
    }

    await llamaModelAssetService.markSelectedModel(modelId)
    const initialState = await llamaModelAssetService.refreshArtifacts(modelId)
    const selectedGroupId =
      resolveRequestedGroupId(initialState, requestedGroupId) ?? initialState.selectedGroupId
    if (!selectedGroupId) {
      throw new Error('Unable to resolve a concrete GGUF artifact group.')
    }

    console.log(
      `Resolved llama plan: ${initialState.modelId} | group=${selectedGroupId} | files=${initialState.files.length}`
    )

    const download = await llamaModelAssetService.startDownload(modelId, selectedGroupId)
    let state = await llamaModelAssetService.readSelectedModelState(modelId, selectedGroupId)
    while (state.status === 'queued' || state.status === 'downloading') {
      await delay(250)
      state = await llamaModelAssetService.readSelectedModelState(modelId, selectedGroupId)
    }

    console.log(`Download session: ${download.sessionId}`)
    console.log(
      `Model status: ${state.status} | progress=${Math.round((state.progress ?? 0) * 100)}%`
    )
    if (state.status !== 'downloaded') {
      throw new Error(`Llama model did not finish downloading. Final status: ${state.status}`)
    }

    const events = await collectBatchTranslation(
      translationEngineService.batchTranslate({
        engineId: 'local-llama',
        sourceLanguage,
        targetLanguage,
        model: modelId,
        selectedGroupId,
        inputs: [sourceText],
      })
    )
    const result = events.find((event) => event.index === 0)?.output ?? ''
    const finalState = await llamaModelAssetService.readSelectedModelState(modelId, selectedGroupId)

    console.log(`Source: ${sourceText}`)
    console.log(`Translation: ${result}`)

    if (finalState.status !== 'downloaded') {
      throw new Error(`Llama model lost downloaded state after translation: ${finalState.status}`)
    }
    if (!result.trim()) {
      throw new Error('Llama translation result is empty.')
    }
    if (result.trim() === sourceText.trim()) {
      throw new Error('Llama translation result matched the source text.')
    }
  } finally {
    translationLogSubscription.unsubscribe()
    await llamaModelAssetService.close()
    await rm(tempRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 })
  }
}

function resolveRequestedGroupId(
  state: Awaited<ReturnType<LlamaModelAssetService['refreshArtifacts']>>,
  requestedGroupId: string
): string | undefined {
  const normalized = requestedGroupId.trim()
  if (!normalized) return undefined
  const matchingGroup = state.plan?.groups?.find(
    (group) => group.id === normalized || group.baseGroupId === normalized
  )
  return matchingGroup?.id
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function collectBatchTranslation(
  stream: ReturnType<TranslationEngineService['batchTranslate']>
): Promise<Array<{ index: number; output: string }>> {
  return await new Promise((resolve, reject) => {
    const events: Array<{ index: number; output: string }> = []
    const subscription = stream.subscribe({
      next(event) {
        events.push(event)
      },
      error(error) {
        subscription.unsubscribe()
        reject(error)
      },
      complete() {
        subscription.unsubscribe()
        resolve(events)
      },
    })
  })
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
