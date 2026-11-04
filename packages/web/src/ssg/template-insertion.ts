/**
 * Orthogonal intents (created 2026-11-04 Asia/Shanghai):
 * 1. Own the one step that inserts rendered markup and bootstrap data into the static template.
 * 2. Never let `String.prototype.replace` interpret `$'`, `$&`, `` $` `` or `$$` inside the
 *    inserted values — `headTags` carries the whole snapshot (issue #319 #1).
 * 3. Keep the placeholder set explicit so a template change fails loudly instead of silently
 *    producing a document with an unreplaced marker.
 *
 * Original request (2026-11-04): "同时，处理一下#319"
 */
import { createStaticDocumentTitle } from './static-document'

export interface StaticDocumentValues {
  appHtml: string
  headTags: string
  title: string
}

const APP_HTML_PLACEHOLDER = '<!--app-html-->'
const HEAD_TAGS_PLACEHOLDER = '<!--head-tags-->'
const TITLE_PLACEHOLDER = '<title>OpenSpec UI</title>'

/**
 * Insert the rendered document values into one template.
 *
 * Every replacement passes a **function**, never a string: a string replacement would expand
 * `$'`, `` $` ``, `$&` and `$$` found in the inserted value. Because `headTags` embeds the full
 * snapshot, a spec, design note or code block containing such a sequence used to paste the
 * rest of the template into the bootstrap JSON — invalid JavaScript, and a page that boots
 * with the template's default base path.
 */
export function insertDocumentValues(template: string, values: StaticDocumentValues): string {
  for (const [marker, placeholder] of [
    ['app-html', APP_HTML_PLACEHOLDER],
    ['head-tags', HEAD_TAGS_PLACEHOLDER],
  ] as const) {
    if (!template.includes(placeholder)) {
      throw new Error(`Static document template is missing the ${marker} placeholder`)
    }
  }

  return template
    .replace(APP_HTML_PLACEHOLDER, () => values.appHtml)
    .replace(HEAD_TAGS_PLACEHOLDER, () => values.headTags)
    .replace(TITLE_PLACEHOLDER, () => `<title>${createStaticDocumentTitle(values.title)}</title>`)
}
