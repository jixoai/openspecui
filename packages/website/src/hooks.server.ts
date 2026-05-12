import { getLocaleContent, isWebsiteLanguage } from '$lib/i18n/languages'
import { websiteThemeBootstrapScript } from '$lib/theme/theme-bootstrap.server'
import type { Handle } from '@sveltejs/kit'

export const handle: Handle = async ({ event, resolve }) => {
  const locale = event.params.lang
  const htmlLang = locale && isWebsiteLanguage(locale) ? getLocaleContent(locale).htmlLang : 'en'

  return resolve(event, {
    transformPageChunk: ({ html }) =>
      html
        .replace('%lang%', htmlLang)
        .replace('%openspecui.theme_bootstrap%', websiteThemeBootstrapScript),
  })
}
