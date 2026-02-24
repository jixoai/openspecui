import { existsSync } from 'node:fs'
import { join } from 'node:path'

const INDEX_SSG_HTML = 'index.ssg.html'
const INDEX_HTML = 'index.html'

/**
 * Resolve SSG HTML template path from copied client assets.
 * Prefer `index.ssg.html` (current build output), fall back to `index.html`.
 */
export function resolveSsgTemplatePath(clientDir: string): string {
  const ssgTemplatePath = join(clientDir, INDEX_SSG_HTML)
  if (existsSync(ssgTemplatePath)) {
    return ssgTemplatePath
  }

  const legacyTemplatePath = join(clientDir, INDEX_HTML)
  if (existsSync(legacyTemplatePath)) {
    return legacyTemplatePath
  }

  throw new Error(
    `No SSG template found in ${clientDir}. Expected ${INDEX_SSG_HTML} or ${INDEX_HTML}.`
  )
}
