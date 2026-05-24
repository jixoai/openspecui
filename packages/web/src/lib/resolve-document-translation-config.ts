import type { DocumentTranslationConfigInput, OpenSpecUIGlobalSettings } from '@openspecui/core'

export function resolveDocumentTranslationConfig(
  translationConfig: DocumentTranslationConfigInput | undefined,
  globalSettings: OpenSpecUIGlobalSettings | undefined
): DocumentTranslationConfigInput | undefined {
  if (!translationConfig) return undefined

  const local = translationConfig.engines?.local ?? {}
  const openai = translationConfig.engines?.openai ?? {}

  const resolvedLocalModel = local.model ?? globalSettings?.translationEngines.local.model
  const resolvedLocalSelectedGroupId =
    local.selectedGroupId ?? globalSettings?.translationEngines.local.selectedGroupId
  const resolvedOpenAIModel = openai.model ?? globalSettings?.translationEngines.openai.model

  return {
    ...translationConfig,
    engines: {
      local: {
        ...local,
        ...(resolvedLocalModel ? { model: resolvedLocalModel } : {}),
        ...(resolvedLocalSelectedGroupId ? { selectedGroupId: resolvedLocalSelectedGroupId } : {}),
      },
      openai: {
        ...openai,
        ...(resolvedOpenAIModel ? { model: resolvedOpenAIModel } : {}),
      },
    },
  }
}
