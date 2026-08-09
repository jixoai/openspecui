/**
 * Orthogonal intents (created 2026-08-09 Asia/Shanghai):
 * 1. Commit prepared asset directories through a bounded swap with rollback.
 * 2. Retry transient Windows directory locks and remove transaction-owned residue.
 *
 * Original request (2026-08-09): "Continue the Windows adaptation and handle similar issues together."
 */
import { randomUUID } from 'node:crypto'
import { cp, rename, rm } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'

const WINDOWS_DIRECTORY_RETRY_LIMIT = 80
const WINDOWS_DIRECTORY_RETRY_DELAY_MS = 25

function errorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null
  return typeof error.code === 'string' ? error.code : null
}

function isMissingPath(error: unknown): boolean {
  return errorCode(error) === 'ENOENT'
}

function isTransientWindowsLock(error: unknown): boolean {
  const code = errorCode(error)
  return code === 'EACCES' || code === 'EBUSY' || code === 'EPERM'
}

async function renameDirectory(from: string, to: string): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await rename(from, to)
      return
    } catch (error) {
      if (
        process.platform !== 'win32' ||
        !isTransientWindowsLock(error) ||
        attempt >= WINDOWS_DIRECTORY_RETRY_LIMIT
      ) {
        throw error
      }
      await delay(WINDOWS_DIRECTORY_RETRY_DELAY_MS)
    }
  }
}

async function removeDirectory(path: string): Promise<void> {
  await rm(path, {
    force: true,
    recursive: true,
    maxRetries: process.platform === 'win32' ? WINDOWS_DIRECTORY_RETRY_LIMIT : 0,
    retryDelay: WINDOWS_DIRECTORY_RETRY_DELAY_MS,
  })
}

/** Replace one complete asset tree without exposing a partially copied target. */
export async function projectDirectoryAtomically(
  sourceDir: string,
  targetDir: string
): Promise<void> {
  const transaction = `${process.pid}-${randomUUID()}`
  const nextDir = `${targetDir}.next-${transaction}`
  const previousDir = `${targetDir}.previous-${transaction}`
  let previousMoved = false

  await removeDirectory(nextDir)
  await cp(sourceDir, nextDir, { force: true, recursive: true })
  try {
    try {
      await renameDirectory(targetDir, previousDir)
      previousMoved = true
    } catch (error) {
      if (!isMissingPath(error)) throw error
    }
    await renameDirectory(nextDir, targetDir)
  } catch (error) {
    const rollbackFailures: unknown[] = []
    await removeDirectory(nextDir).catch((failure: unknown) => rollbackFailures.push(failure))
    if (previousMoved) {
      await renameDirectory(previousDir, targetDir).catch((failure: unknown) =>
        rollbackFailures.push(failure)
      )
    }
    if (rollbackFailures.length > 0) {
      throw new AggregateError(
        [error, ...rollbackFailures],
        'Directory projection failed and rollback did not settle cleanly.'
      )
    }
    throw error
  }

  if (previousMoved) await removeDirectory(previousDir)
}
