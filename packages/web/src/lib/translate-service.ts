import { selectNmtDownloadGroup } from '@openspecui/core/nmt-download-profiles'
import type {
  NmtModelAssetState,
  TranslationEngineId,
} from '@openspecui/core/translator'
import type { BrowserTranslationStatus } from './browser-translation'

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
  nmtModel?: string
  nmtSelectedGroupId?: string
  nmtAsset?: NmtModelAssetState | null
  nmtAssetLoading?: boolean
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
      case 'downloadable':
      case 'downloading':
        return {
          state: 'ready',
          engineId: 'browser',
          message: 'Browser translator is ready.',
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

  if (input.engineId === 'nmt') {
    const model = input.nmtModel?.trim()
    if (!model) {
      return {
        state: 'unavailable',
        engineId: 'nmt',
        message: 'Select a local NMT model before translating.',
      }
    }
    if (input.nmtAssetLoading || !input.nmtAsset) {
      return {
        state: 'checking',
        engineId: 'nmt',
        message: 'Checking local NMT model files.',
      }
    }
    if (isNmtAssetReady(input.nmtAsset, input.nmtSelectedGroupId)) {
      return {
        state: 'ready',
        engineId: 'nmt',
        message: 'Selected NMT model files are ready.',
      }
    }
    return {
      state: 'unavailable',
      engineId: 'nmt',
      message: 'Selected NMT model files are not installed locally.',
    }
  }

  return {
    state: 'ready',
    engineId: 'ai',
    message: 'AI translator configuration will be checked by the provider.',
  }
}

export function isNmtAssetReady(
  asset: NmtModelAssetState,
  selectedGroupId?: string
): boolean {
  const selectedGroup = selectNmtDownloadGroup(
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
