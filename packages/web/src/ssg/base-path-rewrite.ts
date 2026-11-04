/**
 * Orthogonal intents (created 2026-11-04 Asia/Shanghai):
 * 1. Make `--base-path` reach every emitted reference, not only the router (issue #319 #2).
 * 2. Keep the rewrite bounded to reference positions: markup attributes and Vite-emitted
 *    module asset literals, never snapshot content that merely mentions a path.
 * 3. Leave base "/" completely untouched, so root deployments keep their current bytes.
 *
 * Original request (2026-11-04): "同时，处理一下#319"
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Normalize a user-supplied base path to the `/${segment}/` form, or `null` for root. */
export function normalizeBasePath(basePath: string): string | null {
  const trimmed = basePath.trim()
  if (!trimmed || trimmed === '/' || trimmed === './') {
    return null
  }
  const withoutSlashes = trimmed.replace(/^\/+|\/+$/g, '')
  if (!withoutSlashes) {
    return null
  }
  return `/${withoutSlashes}/`
}

/**
 * Rewrite root-absolute `src`/`href` attribute values in one markup string.
 *
 * Only attribute positions are touched: a snapshot body that happens to contain the text
 * `/assets/x` inside a text node or an inline script is left byte-identical, because the
 * bootstrap JSON is injected after this runs.
 */
export function rewriteMarkupReferences(markup: string, basePath: string): string {
  const base = normalizeBasePath(basePath)
  if (base === null) {
    return markup
  }
  return markup
    .replace(/\b(src|href)="\/(?!\/)/g, (_match, attribute: string) => `${attribute}="${base}`)
    .replace(/\b(src|href)='\/(?!\/)/g, (_match, attribute: string) => `${attribute}='${base}`)
}

/**
 * Rewrite Vite-emitted module asset literals from `/assets/…` to `${base}assets/…`.
 *
 * Only the `assets` segment is rewritten, and only inside `.js`/`.css` text. Chunk `import()`
 * specifiers, `new URL(…, import.meta.url)` calls and font `url(…)` declarations all carry
 * that segment; snapshot content never reaches these files.
 */
export function rewriteAssetModule(text: string, basePath: string): string {
  const base = normalizeBasePath(basePath)
  if (base === null) {
    return text
  }
  return text.replace(/\/assets\//g, `${base}assets/`)
}

/** Rewrite the markup and module files of one generated output tree. Returns files written. */
export function applyBasePathToOutputTree(outputDir: string, basePath: string): number {
  const base = normalizeBasePath(basePath)
  if (base === null) {
    return 0
  }
  let written = 0
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      const stats = statSync(full)
      if (stats.isDirectory()) {
        walk(full)
        continue
      }
      if (entry.endsWith('.js') || entry.endsWith('.css')) {
        const original = readFileSync(full, 'utf-8')
        const updated = rewriteAssetModule(original, base)
        if (updated !== original) {
          writeFileSync(full, updated)
          written += 1
        }
      }
    }
  }
  walk(outputDir)
  return written
}
