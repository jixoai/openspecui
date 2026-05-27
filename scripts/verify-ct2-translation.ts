import { ConfigManager, GlobalSettingsManager } from '@openspecui/core'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Ct2ModelAssetService } from '../packages/server/src/ct2-model-asset-service.js'
import { TranslationEngineService } from '../packages/server/src/translation-engine-service.js'

const modelId = process.env.OPENSPECUI_VERIFY_CT2_MODEL ?? 'ooeoeo/opus-mt-en-zh-ct2-float16'
const sourceLanguage = process.env.OPENSPECUI_VERIFY_CT2_SOURCE_LANGUAGE ?? 'en'
const targetLanguage = process.env.OPENSPECUI_VERIFY_CT2_TARGET_LANGUAGE ?? 'zh'
const sourceText =
  process.env.OPENSPECUI_VERIFY_CT2_SOURCE_TEXT ?? 'This is a CT2 verification run.'
const hfEndpoint = process.env.OPENSPECUI_VERIFY_CT2_HF_ENDPOINT ?? ''

async function main() {
  const tempRoot = await mkdtemp(join(tmpdir(), 'openspecui-ct2-translation-'))
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
    localCt2CacheDir: cacheDir,
    localCt2AssetIndexPath: indexPath,
    localCt2FetchCachePath: fetchCachePath,
  })
  const ct2ModelAssetService = new Ct2ModelAssetService({
    projectDir,
    globalSettingsManager,
    cacheDir,
    indexPath,
    profileManifestPath,
    fetchCachePath,
  })

  let lastLogKey = ''
  const translationLogSubscription = ct2ModelAssetService.subscribeLogs().subscribe({
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
        localCt2: {
          model: modelId,
          hfEndpoint,
        },
      },
    })
    await configManager.writeConfig({
      translation: {
        engineId: 'local-ct2',
        targetLanguage,
        engines: {
          localCt2: {
            model: modelId,
          },
        },
      },
    })

    await ct2ModelAssetService.markSelectedModel(modelId)
    const initialState = await ct2ModelAssetService.refreshArtifacts(modelId)
    const selectedGroupId = initialState.selectedGroupId
    if (!selectedGroupId) {
      throw new Error('Unable to resolve a concrete CT2 artifact group.')
    }

    console.log(
      `Resolved CT2 plan: ${initialState.modelId} | group=${selectedGroupId} | files=${initialState.files.length}`
    )

    const download = await ct2ModelAssetService.startDownload(modelId, selectedGroupId)
    let state = await ct2ModelAssetService.readSelectedModelState(modelId, selectedGroupId)
    while (state.status === 'queued' || state.status === 'downloading') {
      await delay(250)
      state = await ct2ModelAssetService.readSelectedModelState(modelId, selectedGroupId)
    }

    console.log(`Download session: ${download.sessionId}`)
    console.log(
      `Model status: ${state.status} | progress=${Math.round((state.progress ?? 0) * 100)}%`
    )
    if (state.status !== 'downloaded') {
      throw new Error(`CT2 model did not finish downloading. Final status: ${state.status}`)
    }

    const events = await collectBatchTranslation(
      translationEngineService.batchTranslate({
        engineId: 'local-ct2',
        sourceLanguage,
        targetLanguage,
        model: modelId,
        selectedGroupId,
        inputs: [sourceText],
      })
    )
    const result = events.find((event) => event.index === 0)?.output ?? ''
    const finalState = await ct2ModelAssetService.readSelectedModelState(modelId, selectedGroupId)

    console.log(`Source: ${sourceText}`)
    console.log(`Translation: ${result}`)

    if (finalState.status !== 'downloaded') {
      throw new Error(`CT2 model lost downloaded state after translation: ${finalState.status}`)
    }
    if (!result.trim()) {
      throw new Error('CT2 translation result is empty.')
    }
  } finally {
    translationLogSubscription.unsubscribe()
    await ct2ModelAssetService.close()
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
