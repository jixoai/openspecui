import { getLocaleContent, isWebsiteLanguage } from '$lib/i18n/languages'
import { error } from '@sveltejs/kit'
import type { LayoutLoad } from './$types'

export const load: LayoutLoad = ({ params, url }) => {
  if (!isWebsiteLanguage(params.lang)) {
    error(404, 'Locale not found')
  }

  return {
    content: getLocaleContent(params.lang),
    lang: params.lang,
    pathname: url.pathname,
  }
}
