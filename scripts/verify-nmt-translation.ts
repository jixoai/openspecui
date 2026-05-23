import { ConfigManager, GlobalSettingsManager } from '@openspecui/core'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LocalModelAssetService } from '../packages/server/src/local-model-asset-service.js'
import { TranslationEngineService } from '../packages/server/src/translation-engine-service.js'

const projectDir = join(import.meta.dirname, '..')
const modelId = process.env.OPENSPECUI_VERIFY_LOCAL_MODEL ?? 'Xenova/opus-mt-no-de'
const selectedGroupId = process.env.OPENSPECUI_VERIFY_LOCAL_GROUP ?? 'q4'
const hfEndpoint = process.env.OPENSPECUI_VERIFY_HF_ENDPOINT ?? ''
const sourceLanguage = process.env.OPENSPECUI_VERIFY_SOURCE_LANGUAGE ?? 'no'
const targetLanguage = process.env.OPENSPECUI_VERIFY_TARGET_LANGUAGE ?? 'de'
const sourceText =
  process.env.OPENSPECUI_VERIFY_SOURCE_TEXT ??
  'Dette er en liten oversettelsestest fra norsk til tysk.'

async function main() {
  const tempRoot = await mkdtemp(join(tmpdir(), 'openspecui-local-translation-'))
  const settingsPath = join(tempRoot, 'settings.json')
  const cacheDir = join(tempRoot, 'hf-cache')
  const indexPath = join(tempRoot, 'models.json')
  const fetchCachePath = join(tempRoot, 'provider-fetch-cache.json')
  const globalSettingsManager = new GlobalSettingsManager(settingsPath)
  const configManager = new ConfigManager(projectDir)
  const translationEngineService = new TranslationEngineService({
    projectDir,
    configManager,
    globalSettingsManager,
    localCacheDir: cacheDir,
    localAssetIndexPath: indexPath,
    localFetchCachePath: fetchCachePath,
  })
  const localModelAssetService = new LocalModelAssetService({
    projectDir,
    configManager,
    globalSettingsManager,
    cacheDir,
    indexPath,
    fetchCachePath,
  })

  const translationLogSubscription = localModelAssetService.subscribeLogs().subscribe({
    next(log) {
      const line = [
        new Date(log.updatedAt).toISOString(),
        log.engineId,
        log.modelId,
        log.status,
        log.message,
        log.progress === undefined ? '' : `${Math.round(log.progress * 100)}%`,
      ]
        .filter(Boolean)
        .join(' | ')
      console.log(line)
    },
  })

  try {
    await globalSettingsManager.writeSettings({
      translationEngines: {
        local: {
          model: modelId,
          selectedGroupId,
          hfEndpoint,
        },
      },
    })
    await configManager.writeConfig({
      translation: {
        engineId: 'local',
        targetLanguage,
        engines: {
          local: {
            model: modelId,
            selectedGroupId,
          },
        },
      },
    })

    const plan = await translationEngineService.getModelDownloadPlan({
      engineId: 'local',
      model: modelId,
      selectedGroupId,
    })
    console.log(
      `Resolved local plan: ${plan?.modelId ?? 'none'} | files=${plan?.files.length ?? 0} | total=${plan?.estimatedTotalBytes ?? 0}`
    )
    if (!plan || !plan.files.length || plan.estimatedTotalBytes === undefined) {
      throw new Error('Unable to resolve a concrete local runtime plan.')
    }

    await localModelAssetService.markSelectedModel(modelId)
    const download = await localModelAssetService.startDownload(modelId, selectedGroupId)
    let state = await localModelAssetService.readSelectedModelState(modelId, selectedGroupId)
    while (state.status === 'queued' || state.status === 'downloading') {
      await delay(250)
      state = await localModelAssetService.readSelectedModelState(modelId, selectedGroupId)
    }

    console.log(`Download session: ${download.sessionId}`)
    console.log(
      `Model status: ${state.status} | progress=${Math.round((state.progress ?? 0) * 100)}%`
    )
    if (state.status !== 'downloaded') {
      throw new Error(`Local model did not finish downloading. Final status: ${state.status}`)
    }

    const events = await collectBatchTranslation(
      translationEngineService.batchTranslate({
        engineId: 'local',
        sourceLanguage,
        targetLanguage,
        model: modelId,
        selectedGroupId,
        inputs: [sourceText],
      })
    )
    const result = events.find((event) => event.index === 0)?.output ?? ''
    const finalState = await localModelAssetService.readSelectedModelState(modelId, selectedGroupId)

    console.log(`Source: ${sourceText}`)
    console.log(`Translation: ${result}`)

    if (finalState.status !== 'downloaded') {
      throw new Error(`Local model lost downloaded state after translation: ${finalState.status}`)
    }
    if (!result.trim()) {
      throw new Error('Local translation result is empty.')
    }
  } finally {
    translationLogSubscription.unsubscribe()
    await rm(tempRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 })
  }
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
        reject(error)
      },
      complete() {
        resolve(events)
      },
    })
    void subscription
  })
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
