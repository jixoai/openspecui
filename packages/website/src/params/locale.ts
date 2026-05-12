import { isWebsiteLanguage } from '$lib/i18n/languages'

export function match(param: string): boolean {
  return isWebsiteLanguage(param)
}
