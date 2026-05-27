export interface TranslationLanguagePair {
  sourceLanguage: string
  targetLanguage: string
}

export interface LocalDirectionalModelLanguagePairCheck {
  supported: boolean
  expected?: TranslationLanguagePair
  message?: string
}

const OPUS_MT_DIRECTION_PATTERN = /^opus-mt-([a-z]{2,3})-([a-z]{2,3})$/i
const OPUS_MT_CT2_SUFFIX_PATTERN = /-(?:ct2|ctranslate2)(?:-[a-z0-9]+)*$/i

export function inferLocalDirectionalModelLanguagePair(
  model: string | undefined
): TranslationLanguagePair | null {
  const modelName = model?.trim().split('/').pop()?.replace(OPUS_MT_CT2_SUFFIX_PATTERN, '')
  if (!modelName) return null

  const match = OPUS_MT_DIRECTION_PATTERN.exec(modelName)
  if (!match) return null

  const [, sourceLanguage, targetLanguage] = match
  if (!sourceLanguage || !targetLanguage) return null
  return {
    sourceLanguage: normalizeLanguageCode(sourceLanguage),
    targetLanguage: normalizeLanguageCode(targetLanguage),
  }
}

export function checkLocalDirectionalModelLanguagePair(input: {
  model: string | undefined
  sourceLanguage?: string
  targetLanguage: string
}): LocalDirectionalModelLanguagePairCheck {
  const expected = inferLocalDirectionalModelLanguagePair(input.model)
  if (!expected) return { supported: true }

  const targetMatches = areCompatibleLanguageTags(expected.targetLanguage, input.targetLanguage)
  if (!targetMatches) {
    return {
      supported: false,
      expected,
      message: `Selected local model supports ${formatLanguagePair(expected)}, but document translation is configured for target ${input.targetLanguage}.`,
    }
  }

  if (
    input.sourceLanguage &&
    !areCompatibleLanguageTags(expected.sourceLanguage, input.sourceLanguage)
  ) {
    return {
      supported: false,
      expected,
      message: `Selected local model supports ${formatLanguagePair(expected)}, but document segment was detected as ${input.sourceLanguage} -> ${input.targetLanguage}.`,
    }
  }

  return { supported: true, expected }
}

function areCompatibleLanguageTags(expected: string, actual: string): boolean {
  const expectedNormalized = normalizeLanguageTag(expected)
  const actualNormalized = normalizeLanguageTag(actual)
  if (!expectedNormalized || !actualNormalized) return false
  if (expectedNormalized === actualNormalized) return true
  return expectedNormalized.split('-')[0] === actualNormalized.split('-')[0]
}

function normalizeLanguageCode(language: string): string {
  return language.trim().toLowerCase().replace(/_/g, '-')
}

function normalizeLanguageTag(language: string): string {
  return normalizeLanguageCode(language)
}

function formatLanguagePair(pair: TranslationLanguagePair): string {
  return `${pair.sourceLanguage} -> ${pair.targetLanguage}`
}
