import { codeToHtml } from 'shiki'

export const websiteCodeThemes = {
  light: 'rose-pine-dawn',
  dark: 'red',
}

/**
 * Keep code fences renderable even when authors omit or typo the language.
 *
 * @param {string | null | undefined} language
 * @returns {string}
 */
export function normalizeCodeLanguage(language) {
  const trimmed = language?.trim()
  return trimmed ? trimmed : 'text'
}

/**
 * Render static, dual-theme Shiki HTML for website documentation code blocks.
 *
 * @param {string} code
 * @param {{ language?: string | null | undefined }} [options]
 * @returns {Promise<string>}
 */
export function highlightCodeToHtml(code, options = {}) {
  return codeToHtml(code, {
    lang: normalizeCodeLanguage(options.language),
    themes: websiteCodeThemes,
    defaultColor: false,
    cssVariablePrefix: '--shiki-',
  })
}
