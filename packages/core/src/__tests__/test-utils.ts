/**
 * 测试工具函数
 *
 * 提供临时文件/目录管理、防抖等待等测试辅助功能
 */

import { access, mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { vi } from 'vitest'

/** 创建临时测试目录 */
export async function createTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'openspecui-test-'))
}

/** 创建临时文件 */
export async function createTempFile(dir: string, name: string, content: string): Promise<string> {
  const filepath = join(dir, name)
  // 确保父目录存在
  const parentDir = filepath.substring(0, filepath.lastIndexOf('/'))
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

/** 清理临时目录 */
export async function cleanupTempDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true })
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
