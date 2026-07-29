/**
 * Orthogonal intents (created 2026-07-29 Asia/Shanghai):
 * 1. Read the CLI package version from source and packed runtime layouts.
 *
 * Original request (2026-07-29): daemon readiness must prove the same CLI release version.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Return the current CLI package version or a deterministic unknown fallback. */
export function readCliPackageVersion(runtimeDir: string): string {
  try {
    const parsed: unknown = JSON.parse(readFileSync(join(runtimeDir, '..', 'package.json'), 'utf8'))
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'version' in parsed &&
      typeof parsed.version === 'string'
    ) {
      return parsed.version
    }
  } catch {
    // Source runners may resolve through a layout without a readable package manifest.
  }
  return '0.0.0'
}
