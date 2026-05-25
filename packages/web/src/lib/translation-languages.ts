import { buildSearchIndex, searchIndex, type SearchDocument } from '@openspecui/search'

export interface TranslationLanguage {
  code: string
  englishName: string
  nativeName: string
}

export interface TranslationLanguageOption extends TranslationLanguage {
  label: string
}

export const SUPPORTED_TRANSLATION_LANGUAGES = [
  { code: 'ar', englishName: 'Arabic', nativeName: 'العربية' },
  { code: 'bg', englishName: 'Bulgarian', nativeName: 'Български' },
  { code: 'bn', englishName: 'Bengali', nativeName: 'বাংলা' },
  { code: 'cs', englishName: 'Czech', nativeName: 'Čeština' },
  { code: 'da', englishName: 'Danish', nativeName: 'Dansk' },
  { code: 'de', englishName: 'German', nativeName: 'Deutsch' },
  { code: 'el', englishName: 'Greek', nativeName: 'Ελληνικά' },
  { code: 'en', englishName: 'English', nativeName: 'English' },
  { code: 'es', englishName: 'Spanish', nativeName: 'Español' },
  { code: 'fi', englishName: 'Finnish', nativeName: 'Suomi' },
  { code: 'fr', englishName: 'French', nativeName: 'Français' },
  { code: 'hi', englishName: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'hr', englishName: 'Croatian', nativeName: 'Hrvatski' },
  { code: 'hu', englishName: 'Hungarian', nativeName: 'Magyar' },
  { code: 'id', englishName: 'Indonesian', nativeName: 'Bahasa Indonesia' },
  { code: 'it', englishName: 'Italian', nativeName: 'Italiano' },
  { code: 'iw', englishName: 'Hebrew', nativeName: 'עברית' },
  { code: 'ja', englishName: 'Japanese', nativeName: '日本語' },
  { code: 'kn', englishName: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'ko', englishName: 'Korean', nativeName: '한국어' },
  { code: 'lt', englishName: 'Lithuanian', nativeName: 'Lietuvių' },
  { code: 'mr', englishName: 'Marathi', nativeName: 'मराठी' },
  { code: 'nl', englishName: 'Dutch', nativeName: 'Nederlands' },
  { code: 'no', englishName: 'Norwegian', nativeName: 'Norsk' },
  { code: 'pl', englishName: 'Polish', nativeName: 'Polski' },
  { code: 'pt', englishName: 'Portuguese', nativeName: 'Português' },
  { code: 'ro', englishName: 'Romanian', nativeName: 'Română' },
  { code: 'ru', englishName: 'Russian', nativeName: 'Русский' },
  { code: 'sk', englishName: 'Slovak', nativeName: 'Slovenčina' },
  { code: 'sl', englishName: 'Slovenian', nativeName: 'Slovenščina' },
  { code: 'sv', englishName: 'Swedish', nativeName: 'Svenska' },
  { code: 'ta', englishName: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'te', englishName: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'th', englishName: 'Thai', nativeName: 'ไทย' },
  { code: 'tr', englishName: 'Turkish', nativeName: 'Türkçe' },
  { code: 'uk', englishName: 'Ukrainian', nativeName: 'Українська' },
  { code: 'vi', englishName: 'Vietnamese', nativeName: 'Tiếng Việt' },
  { code: 'zh', englishName: 'Chinese', nativeName: '中文' },
  { code: 'zh-Hant', englishName: 'Chinese (Traditional)', nativeName: '繁體中文' },
] as const satisfies readonly TranslationLanguage[]

export type TranslationLanguageCode = (typeof SUPPORTED_TRANSLATION_LANGUAGES)[number]['code']

const LANGUAGE_SEARCH_DOCUMENTS = SUPPORTED_TRANSLATION_LANGUAGES.map(
  (language): SearchDocument => ({
    id: language.code,
    kind: 'language',
    title: language.englishName,
    href: '',
    path: language.code,
    content: `${language.code} ${language.englishName} ${language.nativeName}`,
    updatedAt: 0,
  })
)

const LANGUAGE_SEARCH_INDEX = buildSearchIndex(LANGUAGE_SEARCH_DOCUMENTS)

export function formatTranslationLanguageLabel(language: TranslationLanguage): string {
  if (language.englishName === language.nativeName) return language.englishName
  return `${language.englishName} ${language.nativeName}`
}

export function getTranslationLanguageOptions(): TranslationLanguageOption[] {
  return SUPPORTED_TRANSLATION_LANGUAGES.map((language) => ({
    ...language,
    label: formatTranslationLanguageLabel(language),
  })).sort((left, right) => left.code.localeCompare(right.code))
}

export function findTranslationLanguage(code: string): TranslationLanguageOption | undefined {
  return getTranslationLanguageOptions().find((language) => language.code === code)
}

export function searchTranslationLanguages(query: string): TranslationLanguageOption[] {
  const options = getTranslationLanguageOptions()
  const trimmed = query.trim()
  if (!trimmed) return options

  const optionByCode = new Map(options.map((option) => [option.code, option]))
  return searchIndex(LANGUAGE_SEARCH_INDEX, { query: trimmed, limit: options.length })
    .map((hit) => optionByCode.get(hit.documentId))
    .filter((option): option is TranslationLanguageOption => option !== undefined)
}
