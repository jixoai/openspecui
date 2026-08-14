/**
 * Orthogonal intents (updated 2026-08-07 Asia/Shanghai):
 * 1. Create and remove host-native temporary files and directories for Core tests.
 * 2. Keep nested-file setup independent from POSIX path separators.
 * 3. Provide only test-local timing and existence helpers.
 * 4. Retry only transient Windows file locks while removing test-owned directories.
 * 5. Clear test-owned directory contents without replacing a native watcher root.
 *
 * Original request (2026-08-05): Continue the Windows adaptation and fix equivalent failures together.
 */
/**
 * 测试工具函数
 *
 * 提供临时文件/目录管理、防抖等待等测试辅助功能
 */

import { access, mkdir, mkdtemp, readdir, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { vi } from 'vitest'

const WINDOWS_CLEANUP_RETRY_ATTEMPTS = 80
const WINDOWS_CLEANUP_RETRY_DELAY_MS = 25
const WINDOWS_CLEANUP_RETRYABLE_CODES = new Set(['EACCES', 'EBUSY', 'EPERM'])
const WINDOWS_NATIVE_WATCHER_SETTLEMENT_MS = 100

function isRetryableWindowsCleanupError(error: unknown): boolean {
  if (process.platform !== 'win32' || typeof error !== 'object' || error === null) return false
  if (!('code' in error)) return false
  const { code } = error as { code?: unknown }
  return typeof code === 'string' && WINDOWS_CLEANUP_RETRYABLE_CODES.has(code)
}

/** 创建临时测试目录 */
export async function createTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'openspecui-test-'))
}

/** 创建临时文件 */
export async function createTempFile(dir: string, name: string, content: string): Promise<string> {
  const filepath = join(dir, name)
  // 确保父目录存在
  const parentDir = dirname(filepath)
  if (parentDir !== dir) {
    await mkdir(parentDir, { recursive: true })
  }
  await writeFile(filepath, content, 'utf-8')
  return filepath
}

/** 创建临时目录 */
export async function createTempSubDir(dir: string, name: string): Promise<string> {
  const subdir = join(dir, name)
  await mkdir(subdir, { recursive: true })
  return subdir
}

/** 等待防抖完成 */
export async function waitForDebounce(ms = 150): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Let Windows native watcher fixture events settle before the next mutation. */
export async function waitForWatcherSettlement(): Promise<void> {
  if (process.platform !== 'win32') return
  await waitForDebounce(WINDOWS_NATIVE_WATCHER_SETTLEMENT_MS)
}

/** 清理临时目录 */
async function removeTempPath(path: string): Promise<void> {
  for (let attempt = 0; attempt < WINDOWS_CLEANUP_RETRY_ATTEMPTS; attempt += 1) {
    try {
      await rm(path, { recursive: true, force: true })
      return
    } catch (error) {
      if (
        !isRetryableWindowsCleanupError(error) ||
        attempt === WINDOWS_CLEANUP_RETRY_ATTEMPTS - 1
      ) {
        throw error
      }
      await new Promise<void>((resolve) => setTimeout(resolve, WINDOWS_CLEANUP_RETRY_DELAY_MS))
    }
  }
}

export async function cleanupTempDir(dir: string): Promise<void> {
  await removeTempPath(dir)
}

/** Clear test-owned directory contents while preserving the watcher root. */
export async function cleanupTempDirContents(dir: string): Promise<void> {
  const entries = await readdir(dir)
  for (const entry of entries) {
    await removeTempPath(join(dir, entry))
  }
}

/** 检查路径是否存在 */
export async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

/** 创建 Mock FSWatcher */
export function createMockWatcher() {
  return {
    close: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    ref: vi.fn(),
    unref: vi.fn(),
  }
}

/** 等待条件满足 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 5000, interval = 50 } = options
  const start = Date.now()

  while (Date.now() - start < timeout) {
    if (await condition()) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, interval))
  }

  throw new Error(`waitFor timeout after ${timeout}ms`)
}

/** 收集 AsyncGenerator 的所有值 */
export async function collectAsyncGenerator<T>(
  generator: AsyncGenerator<T>,
  maxItems = 10
): Promise<T[]> {
  const results: T[] = []
  for await (const item of generator) {
    results.push(item)
    if (results.length >= maxItems) break
  }
  return results
}

/** 收集 AsyncGenerator 的前 N 个值 */
export async function takeFromGenerator<T>(
  generator: AsyncGenerator<T>,
  count: number
): Promise<T[]> {
  const results: T[] = []
  for await (const item of generator) {
    results.push(item)
    if (results.length >= count) break
  }
  return results
}
