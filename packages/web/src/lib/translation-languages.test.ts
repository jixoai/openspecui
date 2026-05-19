import { describe, expect, it } from 'vitest'
import {
  getTranslationLanguageOptions,
  searchTranslationLanguages,
  SUPPORTED_TRANSLATION_LANGUAGES,
} from './translation-languages'

const REQUESTED_CODES = [
  'ar',
  'bg',
  'bn',
  'cs',
  'da',
  'de',
  'el',
  'en',
  'es',
  'fi',
  'fr',
  'hi',
  'hr',
  'hu',
  'id',
  'it',
  'iw',
  'ja',
  'kn',
  'ko',
  'lt',
  'mr',
  'nl',
  'no',
  'pl',
  'pt',
  'ro',
  'ru',
  'sk',
  'sl',
  'sv',
  'ta',
  'te',
  'th',
  'tr',
  'uk',
  'vi',
  'zh',
  'zh-Hant',
]

describe('translation language catalog', () => {
  it('contains the requested language codes sorted by code', () => {
    const codes = getTranslationLanguageOptions().map((language) => language.code)

    expect(codes).toEqual([...REQUESTED_CODES].sort((left, right) => left.localeCompare(right)))
    expect(SUPPORTED_TRANSLATION_LANGUAGES).toHaveLength(REQUESTED_CODES.length)
  })

  it('uses bilingual labels while storing language codes', () => {
    expect(getTranslationLanguageOptions()).toContainEqual(
      expect.objectContaining({
        code: 'zh',
        englishName: 'Chinese',
        nativeName: '中文',
        label: 'Chinese 中文',
      })
    )
    expect(getTranslationLanguageOptions()).toContainEqual(
      expect.objectContaining({
        code: 'zh-Hant',
        englishName: 'Chinese (Traditional)',
        nativeName: '繁體中文',
        label: 'Chinese (Traditional) 繁體中文',
      })
    )
  })

  it('searches by code, English name, and native name through the shared search engine', () => {
    expect(searchTranslationLanguages('zh-Hant').map((language) => language.code)).toContain(
      'zh-Hant'
    )
    expect(searchTranslationLanguages('Traditional').map((language) => language.code)).toContain(
      'zh-Hant'
    )
    expect(searchTranslationLanguages('繁體').map((language) => language.code)).toContain('zh-Hant')
  })
})
