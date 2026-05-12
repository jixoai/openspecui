import { highlightHookExamples } from '$lib/highlight.server'
import { getLocaleContent, isWebsiteLanguage } from '$lib/i18n/languages'
import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params }) => {
  if (!isWebsiteLanguage(params.lang)) {
    error(404, 'Locale not found')
  }

  const content = getLocaleContent(params.lang)

  return {
    hooks: await highlightHookExamples(content.hooks),
  }
}
