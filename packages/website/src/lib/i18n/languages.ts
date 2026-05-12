import { en } from '$lib/i18n/locales/en'
import { zh } from '$lib/i18n/locales/zh'
import type { WebsiteContent, WebsiteLanguage } from '$lib/i18n/schema'

export const websiteLanguages = ['en', 'zh'] as const satisfies readonly WebsiteLanguage[]

export function isWebsiteLanguage(value: string): value is WebsiteLanguage {
  return (websiteLanguages as readonly string[]).includes(value)
}

export function getLocaleContent(language: WebsiteLanguage): WebsiteContent {
  return language === 'zh' ? zh : en
}

export function getAlternateLocale(language: WebsiteLanguage): WebsiteLanguage {
  return language === 'zh' ? 'en' : 'zh'
}

export function getPreferredWebsiteLanguage(languages: readonly string[]): WebsiteLanguage {
  for (const language of languages) {
    const normalized = language.toLowerCase()
    const baseLanguage = normalized.split('-')[0]

    if (isWebsiteLanguage(baseLanguage)) {
      return baseLanguage
    }
  }

  return 'en'
}

export function localizePath(pathname: string, nextLanguage: WebsiteLanguage): string {
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length === 0) return `/${nextLanguage}/`
  const [, ...rest] = parts
  return `/${[nextLanguage, ...rest].join('/')}/`
}
