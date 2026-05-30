import { selectLocalDownloadGroup } from '@openspecui/core/local-download-profiles'
import type {
  LocalModelAssetState,
  TranslationEngineId,
  TranslationEngineLifecycleStatus,
} from '@openspecui/core/translator'
import {
  getTranslationEngineLifecycleMessage,
  isManagedLocalTranslationEngineId,
  shouldShowTranslationEngineInstallGate,
} from '@openspecui/core/translator'
import type {
  BrowserTranslationStatus,
  BrowserTranslationSupportTableState,
} from './browser-translation'

export type TranslateServiceStatus =
  | {
      state: 'disabled'
      message: string
    }
  | {
      state: 'checking'
      engineId: TranslationEngineId
      message: string
    }
  | {
      state: 'ready'
      engineId: TranslationEngineId
      message: string
    }
  | {
      state: 'unavailable'
      engineId: TranslationEngineId
      message: string
    }

export interface TranslateServiceProjectionInput {
  enabled: boolean
  hasSource: boolean
  engineId: TranslationEngineId
  browserCapability?: BrowserTranslationStatus | null
  browserCapabilityLoading?: boolean
  browserSupportTable?: BrowserTranslationSupportTableState | null
  engineLifecycle?: TranslationEngineLifecycleStatus | null
  engineLifecycleLoading?: boolean
  localModel?: string
  localSelectedGroupId?: string
  localAsset?: LocalModelAssetState | null
  localAssetLoading?: boolean
}

export function projectTranslateServiceStatus(
  input: TranslateServiceProjectionInput
): TranslateServiceStatus {
  if (!input.enabled) {
    return {
      state: 'disabled',
      message: 'Translation is disabled in settings.',
    }
  }
  if (!input.hasSource) {
    return {
      state: 'disabled',
      message: 'No document content is available to translate.',
    }
  }

  if (input.engineId === 'browser') {
    if (input.browserSupportTable) {
      switch (input.browserSupportTable.state) {
        case 'idle':
        case 'checking':
          return {
            state: 'checking',
            engineId: 'browser',
            message:
              input.browserSupportTable.message ?? 'Checking browser translation capability.',
          }
        case 'ready':
          return {
            state: 'ready',
            engineId: 'browser',
            message:
              input.browserSupportTable.message ?? 'Browser translation pairs are available.',
          }
        case 'unavailable':
        case 'missing':
        case 'error':
          return {
            state: 'unavailable',
            engineId: 'browser',
            message: input.browserSupportTable.message ?? 'Translation is unavailable.',
          }
      }
    }
    if (!input.browserCapability) {
      return {
        state: 'ready',
        engineId: 'browser',
        message: input.browserCapabilityLoading
          ? 'Browser translation capability is being checked.'
          : 'Browser translator will be checked before translation starts.',
      }
    }
    switch (input.browserCapability.availability) {
      case 'available':
        return {
          state: 'ready',
          engineId: 'browser',
          message: input.browserCapability.message ?? 'Browser translator is ready.',
        }
      case 'downloadable':
        return {
          state: 'ready',
          engineId: 'browser',
          message:
            input.browserCapability.message ??
            'Browser translation support will be downloaded when translation starts.',
        }
      case 'downloading':
        return {
          state: 'ready',
          engineId: 'browser',
          message:
            input.browserCapability.message ??
            'Browser translation support is downloading and will continue when ready.',
        }
      case 'missing':
      case 'unavailable':
      case 'error':
        return {
          state: 'unavailable',
          engineId: 'browser',
          message: input.browserCapability.message ?? 'Translation is unavailable.',
        }
    }
  }

  if (input.engineLifecycleLoading || input.engineLifecycle !== undefined) {
    if (input.engineLifecycleLoading || !input.engineLifecycle) {
      return {
        state: 'checking',
        engineId: input.engineId,
        message: 'Checking translation engine runtime.',
      }
    }
    if (shouldShowTranslationEngineInstallGate(input.engineLifecycle)) {
      return {
        state: 'unavailable',
        engineId: input.engineId,
        message:
          getTranslationEngineLifecycleMessage(input.engineLifecycle) ??
          'Translation engine runtime is not ready.',
      }
    }
    if (input.engineLifecycle.assets.state === 'error') {
      return {
        state: 'unavailable',
        engineId: input.engineId,
        message:
          input.engineLifecycle.assets.message ??
          input.engineLifecycle.assets.error ??
          'Selected local model is incompatible with the current translation runtime.',
      }
    }
  }

  if (isManagedLocalTranslationEngineId(input.engineId)) {
    const model = input.localModel?.trim()
    if (!model) {
      return {
        state: 'unavailable',
        engineId: input.engineId,
        message: 'Select a model before translating.',
      }
    }
    if (input.localAssetLoading || !input.localAsset) {
      return {
        state: 'checking',
        engineId: input.engineId,
        message: 'Checking local model files.',
      }
    }
    if (isLocalAssetReady(input.localAsset, input.localSelectedGroupId)) {
      return {
        state: 'ready',
        engineId: input.engineId,
        message: 'Selected local model files are ready.',
      }
    }
    return {
      state: 'unavailable',
      engineId: input.engineId,
      message: 'Selected local model files are not installed locally.',
    }
  }

  return {
    state: 'ready',
    engineId: 'openai',
    message: 'OpenAI completion configuration will be checked by the provider.',
  }
}

export function isLocalAssetReady(asset: LocalModelAssetState, selectedGroupId?: string): boolean {
  const selectedGroup = selectLocalDownloadGroup(
    asset.plan ?? null,
    selectedGroupId ?? asset.plan?.selectedGroupId
  )
  const requiredFiles = selectedGroup?.files ?? asset.plan?.files ?? []
  const localFileByPath = new Map(asset.files.map((file) => [file.path, file]))
  const allRequiredFilesReady =
    requiredFiles.length > 0 &&
    requiredFiles.every((file) => {
      const localFile = localFileByPath.get(file.path)
      return (
        file.sizeBytes !== undefined &&
        localFile?.downloadedBytes !== undefined &&
        localFile.downloadedBytes >= file.sizeBytes
      )
    })

  if (asset.status !== 'downloaded') return allRequiredFilesReady

  if (requiredFiles.length === 0) {
    return (
      asset.files.length > 0 &&
      asset.files.every(
        (file) =>
          file.sizeBytes !== undefined &&
          file.downloadedBytes !== undefined &&
          file.downloadedBytes >= file.sizeBytes
      )
    )
  }

  return allRequiredFilesReady
}
