/**
 * Orthogonal intents (created 2026-08-06 Asia/Shanghai):
 * 1. Remove App test-owned directories after transient Windows file locks settle.
 *
 * Original request (2026-08-06): "Windows compatibility and adaptation, including the core and peripheral scripts."
 */
import { rm } from 'node:fs/promises'

const WINDOWS_CLEANUP_RETRIES = 20
const WINDOWS_CLEANUP_RETRY_DELAY_MS = 50

/** Remove App test-owned directories with bounded native Windows lock retries. */
export async function removeAppTestDirectories(paths: readonly string[]): Promise<void> {
  await Promise.all(
    paths.map((path) =>
      rm(path, {
        recursive: true,
        force: true,
        maxRetries: process.platform === 'win32' ? WINDOWS_CLEANUP_RETRIES : 0,
        retryDelay: WINDOWS_CLEANUP_RETRY_DELAY_MS,
      })
    )
  )
}
