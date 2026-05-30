import type {
  DocumentTranslationConfigInput,
  OpenSpecUIConfigPresence,
  OpenSpecUIGlobalSettings,
} from '@openspecui/core'

export function resolveDocumentTranslationConfig(
  translationConfig: DocumentTranslationConfigInput | undefined,
  globalSettings: OpenSpecUIGlobalSettings | undefined,
  configPresence?: OpenSpecUIConfigPresence
): DocumentTranslationConfigInput | undefined {
  if (!translationConfig) return undefined

  const translationPresence = configPresence?.translation
  const projectOwnsEnabled = translationPresence?.enabled ?? false
  const projectOwnsTargetLanguage = translationPresence?.targetLanguage ?? false
  const projectOwnsDisplayMode = translationPresence?.displayMode ?? false
  const projectOwnsCacheEnabled = translationPresence?.cacheEnabled ?? false
  const projectOwnsEngineId = translationPresence?.engineId ?? false
  const local = translationConfig.engines?.local ?? {}
  const localCt2 = translationConfig.engines?.localCt2 ?? {}
  const localLlama = translationConfig.engines?.localLlama ?? {}
  const openai = translationConfig.engines?.openai ?? {}

  const resolvedLocalModel = local.model ?? globalSettings?.translationEngines.local?.model
  const resolvedLocalSelectedGroupId =
    local.selectedGroupId ?? globalSettings?.translationEngines.local?.selectedGroupId
  const resolvedLocalCt2Model = localCt2.model ?? globalSettings?.translationEngines.localCt2?.model
  const resolvedLocalCt2SelectedGroupId =
    localCt2.selectedGroupId ?? globalSettings?.translationEngines.localCt2?.selectedGroupId
  const resolvedLocalLlamaModel =
    localLlama.model ?? globalSettings?.translationEngines.localLlama?.model
  const resolvedLocalLlamaSelectedGroupId =
    localLlama.selectedGroupId ?? globalSettings?.translationEngines.localLlama?.selectedGroupId
  const resolvedOpenAIModel = openai.model ?? globalSettings?.translationEngines.openai?.model

  return {
    ...translationConfig,
    enabled: projectOwnsEnabled
      ? translationConfig.enabled
      : (globalSettings?.translation?.enabled ?? translationConfig.enabled),
    targetLanguage: projectOwnsTargetLanguage
      ? translationConfig.targetLanguage
      : (globalSettings?.translation?.targetLanguage ?? translationConfig.targetLanguage),
    displayMode: projectOwnsDisplayMode
      ? translationConfig.displayMode
      : (globalSettings?.translation?.displayMode ?? translationConfig.displayMode),
    cacheEnabled: projectOwnsCacheEnabled
      ? translationConfig.cacheEnabled
      : (globalSettings?.translation?.cacheEnabled ?? translationConfig.cacheEnabled),
    engineId: projectOwnsEngineId
      ? translationConfig.engineId
      : (globalSettings?.translationEngines.engineId ?? translationConfig.engineId),
    engines: {
      local: {
        ...local,
        ...(resolvedLocalModel ? { model: resolvedLocalModel } : {}),
        ...(resolvedLocalSelectedGroupId ? { selectedGroupId: resolvedLocalSelectedGroupId } : {}),
      },
      localCt2: {
        ...localCt2,
        ...(resolvedLocalCt2Model ? { model: resolvedLocalCt2Model } : {}),
        ...(resolvedLocalCt2SelectedGroupId
          ? { selectedGroupId: resolvedLocalCt2SelectedGroupId }
          : {}),
      },
      localLlama: {
        ...localLlama,
        ...(resolvedLocalLlamaModel ? { model: resolvedLocalLlamaModel } : {}),
        ...(resolvedLocalLlamaSelectedGroupId
          ? { selectedGroupId: resolvedLocalLlamaSelectedGroupId }
          : {}),
      },
      openai: {
        ...openai,
        ...(resolvedOpenAIModel ? { model: resolvedOpenAIModel } : {}),
      },
    },
  }
}
