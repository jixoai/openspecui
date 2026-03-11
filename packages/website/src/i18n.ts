import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import { en } from './locales/en'
import { zh } from './locales/zh'

export const websiteResources = {
  en: { translation: en },
  zh: { translation: zh },
} as const

function syncDocumentLanguage(language?: string): void {
  if (typeof document === 'undefined') return
  const normalized = language === 'zh' ? 'zh-CN' : 'en'
  document.documentElement.lang = normalized
  document.documentElement.dir = i18n.dir(language)
}

export const websiteI18nReady = i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: websiteResources,
    fallbackLng: 'en',
    supportedLngs: ['en', 'zh'],
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    detection: {
      order: ['querystring', 'localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupQuerystring: 'lang',
    },
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  })
  .then(() => {
    syncDocumentLanguage(i18n.resolvedLanguage ?? i18n.language)
  })

if (typeof window !== 'undefined') {
  i18n.on('languageChanged', (language) => {
    syncDocumentLanguage(language)
  })
}

export default i18n
