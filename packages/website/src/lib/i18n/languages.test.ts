import {
  getLocaleContent,
  getPreferredWebsiteLanguage,
  isWebsiteLanguage,
  localizePath,
} from '$lib/i18n/languages'
import { describe, expect, it } from 'vitest'

describe('website language routing', () => {
  it('validates supported locales', () => {
    expect(isWebsiteLanguage('en')).toBe(true)
    expect(isWebsiteLanguage('zh')).toBe(true)
    expect(isWebsiteLanguage('fr')).toBe(false)
  })

  it('returns locale content for public pages', () => {
    expect(getLocaleContent('en').hero.title).toContain('Operate OpenSpec')
    expect(getLocaleContent('zh').hero.title).toContain('OpenSpec')
  })

  it('switches localized paths without changing the page tail', () => {
    expect(localizePath('/en/', 'zh')).toBe('/zh/')
    expect(localizePath('/en/hooks/', 'zh')).toBe('/zh/hooks/')
    expect(localizePath('/zh/hooks/', 'en')).toBe('/en/hooks/')
  })

  it('selects the root language from browser preferences', () => {
    expect(getPreferredWebsiteLanguage(['zh-CN', 'en-US'])).toBe('zh')
    expect(getPreferredWebsiteLanguage(['fr-FR', 'en-US'])).toBe('en')
    expect(getPreferredWebsiteLanguage(['fr-FR', 'ja-JP'])).toBe('en')
    expect(getPreferredWebsiteLanguage([])).toBe('en')
  })
})
