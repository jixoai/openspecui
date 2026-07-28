/**
 * Orthogonal intents (created 2026-07-28 Asia/Shanghai):
 * 1. Own dynamic-value serialization for generated static HTML documents.
 * 2. Keep snapshot and base-path bootstrap values round-trippable through an inline script.
 * 3. Keep generated document titles confined to title text.
 *
 * Owner-reported defect (2026-07-28): "导出的数据好像逃逸到 html 去了。"
 */

function serializeInlineScriptValue(value: unknown): string {
  const serialized = JSON.stringify(value)
  if (serialized === undefined) {
    throw new TypeError('Static document bootstrap values must be JSON-serializable')
  }
  return serialized
    .replaceAll('<', '\\u003c')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029')
}

function escapeHtmlText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

/** Build the static bootstrap script inserted into every generated HTML document. */
export function createStaticHeadTags(snapshot: unknown, basePath: string): string {
  return `
    <script>
      window.__OPENSPEC_BASE_PATH__ = ${serializeInlineScriptValue(basePath)};
      window.__OPENSPEC_STATIC_MODE__ = true;
      window.__INITIAL_DATA__ = ${serializeInlineScriptValue(snapshot)};
    </script>`
}

/** Build the text inserted into the generated document's title element. */
export function createStaticDocumentTitle(title: string): string {
  return escapeHtmlText(`${title} - OpenSpec UI`)
}
