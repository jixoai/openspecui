/**
 * Orthogonal intents (created 2026-07-28 Asia/Shanghai):
 * 1. Resolve the built SSG server entry from Vite's machine-readable manifest.
 * 2. Reject missing, malformed, non-entry, escaping, or absent build artifacts.
 *
 * Owner-reported defect (2026-07-27): clean Vite 8 SSG output hashes the server entry while the
 * exporter imports a handwritten `server/entry-server.js` path.
 */
import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'

export const SSG_SERVER_ENTRY_MANIFEST = 'ssr-entry-manifest.json'
export const SSG_SERVER_ENTRY_SOURCE = 'src/ssg/entry-server.tsx'

interface ViteManifestEntry {
  file?: unknown
  isEntry?: unknown
}

/** Resolve the exact Vite-owned SSG server entry without scanning or filename reconstruction. */
export function resolveSsgServerEntryPath(serverDir: string): string {
  const root = resolve(serverDir)
  const manifestPath = resolve(root, SSG_SERVER_ENTRY_MANIFEST)
  if (!existsSync(manifestPath)) {
    throw new Error(`SSG server manifest not found: ${manifestPath}`)
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>
  const entry = manifest[SSG_SERVER_ENTRY_SOURCE] as ViteManifestEntry | undefined
  if (!entry || entry.isEntry !== true || typeof entry.file !== 'string' || !entry.file) {
    throw new Error(`SSG server manifest has no entry for ${SSG_SERVER_ENTRY_SOURCE}`)
  }

  const entryPath = resolve(root, entry.file)
  const relativeEntry = relative(root, entryPath)
  if (relativeEntry.startsWith('..') || isAbsolute(relativeEntry)) {
    throw new Error(`SSG server entry escapes its build directory: ${entry.file}`)
  }
  if (!existsSync(entryPath)) {
    throw new Error(`SSG server entry not found: ${entryPath}`)
  }
  return entryPath
}
