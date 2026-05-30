export interface GoogleFontsStylesheetOptions {
  families: readonly string[]
  display?: 'auto' | 'block' | 'swap' | 'fallback' | 'optional'
  lang?: string
  documentRef?: Document
}

function getPreferredGoogleFontsHosts(lang: string): { apiHost: string; staticHost: string } {
  const useCnCdn = /^zh\b/i.test(lang)
  return {
    apiHost: useCnCdn ? 'https://fonts.googleapis.cn' : 'https://fonts.googleapis.com',
    staticHost: useCnCdn ? 'https://fonts.gstatic.cn' : 'https://fonts.gstatic.com',
  }
}

function encodeGoogleFontFamily(family: string): string {
  return family.trim().replace(/ /g, '+')
}

export function buildGoogleFontsStylesheetHref(options: GoogleFontsStylesheetOptions): string {
  const families = options.families.map(encodeGoogleFontFamily).filter(Boolean)
  const { apiHost } = getPreferredGoogleFontsHosts(options.lang ?? '')
  const familyParams = families.map((family) => `family=${family}`)
  const displayParam = `display=${options.display ?? 'swap'}`

  return `${apiHost}/css2?${[...familyParams, displayParam].join('&')}`
}

/**
 * Legacy Google Fonts loader retained for optional large CJK/JCK font families.
 * The app shell uses local @fontsource assets by default.
 */
export function loadGoogleFontsStylesheet(
  options: GoogleFontsStylesheetOptions
): HTMLLinkElement | null {
  const documentRef = options.documentRef ?? (typeof document === 'undefined' ? null : document)
  if (!documentRef || options.families.length === 0) return null

  const lang =
    options.lang ??
    (typeof navigator === 'undefined'
      ? ''
      : (navigator.languages && navigator.languages[0]) ||
        navigator.language ||
        (navigator as typeof navigator & { userLanguage?: string }).userLanguage ||
        '')
  const hosts = getPreferredGoogleFontsHosts(lang)
  const href = buildGoogleFontsStylesheetHref({ ...options, lang })

  if (documentRef.head.querySelector(`link[href="${href}"]`)) {
    return null
  }

  const preconnectApi = documentRef.createElement('link')
  preconnectApi.rel = 'preconnect'
  preconnectApi.href = hosts.apiHost
  preconnectApi.dataset.openspecGoogleFonts = 'preconnect-api'

  const preconnectStatic = documentRef.createElement('link')
  preconnectStatic.rel = 'preconnect'
  preconnectStatic.href = hosts.staticHost
  preconnectStatic.crossOrigin = 'anonymous'
  preconnectStatic.dataset.openspecGoogleFonts = 'preconnect-static'

  const stylesheet = documentRef.createElement('link')
  stylesheet.rel = 'stylesheet'
  stylesheet.href = href
  stylesheet.dataset.openspecGoogleFonts = 'stylesheet'

  documentRef.head.append(preconnectApi, preconnectStatic, stylesheet)
  return stylesheet
}
