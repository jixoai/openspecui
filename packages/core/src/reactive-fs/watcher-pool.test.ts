import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { acquireWatcher, getActiveWatcherCount, closeAllWatchers } from './watcher-pool.js'
import {
  createTempDir,
  createTempFile,
  cleanupTempDir,
  waitForDebounce,
} from '../__tests__/test-utils.js'
import { writeFile, rm, mkdir } from 'fs/promises'
import { join } from 'path'

describe('WatcherPool', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await createTempDir()
  })

  afterEach(async () => {
    closeAllWatchers()
    await cleanupTempDir(tempDir)
  })

  describe('acquireWatcher()', () => {
    it('should create watcher for file', async () => {
      const filepath = await createTempFile(tempDir, 'test.txt', 'initial')
      const onChange = vi.fn()

      const release = acquireWatcher(filepath, onChange)

      expect(getActiveWatcherCount()).toBe(1)

      release()
      expect(getActiveWatcherCount()).toBe(0)
    })

    it('should create watcher for directory', async () => {
      const onChange = vi.fn()

      const release = acquireWatcher(tempDir, onChange)

      expect(getActiveWatcherCount()).toBe(1)

      release()
      expect(getActiveWatcherCount()).toBe(0)
    })

    it('should call onChange when file changes', async () => {
      const filepath = await createTempFile(tempDir, 'test.txt', 'initial')
      const onChange = vi.fn()

      const release = acquireWatcher(filepath, onChange, { debounceMs: 50 })

      // 修改文件
      await writeFile(filepath, 'changed', 'utf-8')

      // 等待防抖
      await waitForDebounce(100)

      expect(onChange).toHaveBeenCalled()

      release()
    })

    it('should call onChange when new file is created in directory', async () => {
      const onChange = vi.fn()

      // 使用 recursive 选项以确保在 macOS 上能检测到变化
      const release = acquireWatcher(tempDir, onChange, { debounceMs: 50, recursive: true })

      // 创建新文件（目录监听会检测到新文件创建）
      await writeFile(join(tempDir, 'new.txt'), 'content', 'utf-8')

      // 增加等待时间，因为目录监听可能需要更长时间
      await waitForDebounce(200)

      expect(onChange).toHaveBeenCalled()

      release()
    })

    it('should debounce multiple rapid changes', async () => {
      const filepath = await createTempFile(tempDir, 'test.txt', 'initial')
      const onChange = vi.fn()

      const release = acquireWatcher(filepath, onChange, { debounceMs: 100 })

      // 快速连续修改
      await writeFile(filepath, 'change1', 'utf-8')
      await writeFile(filepath, 'change2', 'utf-8')
      await writeFile(filepath, 'change3', 'utf-8')

      // 等待防抖
      await waitForDebounce(200)

      // 应该只触发一次
      expect(onChange).toHaveBeenCalledTimes(1)

      release()
    })
  })

  describe('引用计数', () => {
    it('should share watcher for same path', async () => {
      const filepath = await createTempFile(tempDir, 'test.txt', 'content')
      const onChange1 = vi.fn()
      const onChange2 = vi.fn()

      const release1 = acquireWatcher(filepath, onChange1)
      const release2 = acquireWatcher(filepath, onChange2)

      // 应该只有一个监听器
      expect(getActiveWatcherCount()).toBe(1)

      release1()
      // 还有一个引用，监听器应该还在
      expect(getActiveWatcherCount()).toBe(1)

      release2()
      // 所有引用释放，监听器应该关闭
      expect(getActiveWatcherCount()).toBe(0)
    })

    it('should notify all callbacks on change', async () => {
      const filepath = await createTempFile(tempDir, 'test.txt', 'content')
      const onChange1 = vi.fn()
      const onChange2 = vi.fn()

      const release1 = acquireWatcher(filepath, onChange1, { debounceMs: 50 })
      const release2 = acquireWatcher(filepath, onChange2, { debounceMs: 50 })

      // 修改文件
      await writeFile(filepath, 'changed', 'utf-8')
      await waitForDebounce(100)

      // 两个回调都应该被调用
      expect(onChange1).toHaveBeenCalled()
      expect(onChange2).toHaveBeenCalled()

      release1()
      release2()
    })

    it('should not notify released callback', async () => {
      const filepath = await createTempFile(tempDir, 'test.txt', 'content')
      const onChange1 = vi.fn()
      const onChange2 = vi.fn()

      const release1 = acquireWatcher(filepath, onChange1, { debounceMs: 50 })
      const release2 = acquireWatcher(filepath, onChange2, { debounceMs: 50 })

      // 释放第一个
      release1()

      // 修改文件
      await writeFile(filepath, 'changed', 'utf-8')
      await waitForDebounce(100)

      // 只有第二个回调被调用
      expect(onChange1).not.toHaveBeenCalled()
      expect(onChange2).toHaveBeenCalled()

      release2()
    })
  })

  describe('路径规范化', () => {
    it('should normalize paths', async () => {
      const filepath = await createTempFile(tempDir, 'test.txt', 'content')
      const onChange1 = vi.fn()
      const onChange2 = vi.fn()

      // 使用不同形式的路径
      const release1 = acquireWatcher(filepath, onChange1)
      const release2 = acquireWatcher(join(tempDir, './test.txt'), onChange2)

      // 应该共享同一个监听器
      expect(getActiveWatcherCount()).toBe(1)

      release1()
      release2()
    })
  })

  describe('错误处理', () => {
    it('should handle callback errors gracefully', async () => {
      const filepath = await createTempFile(tempDir, 'test.txt', 'content')
      const errorCallback = vi.fn(() => {
        throw new Error('Callback error')
      })
      const normalCallback = vi.fn()

      // Mock console.error
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      const release1 = acquireWatcher(filepath, errorCallback, { debounceMs: 50 })
      const release2 = acquireWatcher(filepath, normalCallback, { debounceMs: 50 })

      // 修改文件
      await writeFile(filepath, 'changed', 'utf-8')
      await waitForDebounce(100)

      // 错误回调被调用
      expect(errorCallback).toHaveBeenCalled()
      // 正常回调也被调用（错误不影响其他回调）
      expect(normalCallback).toHaveBeenCalled()
      // 错误被记录
      expect(consoleError).toHaveBeenCalled()

      consoleError.mockRestore()
      release1()
      release2()
    })

    it('should handle release called multiple times', async () => {
      const filepath = await createTempFile(tempDir, 'test.txt', 'content')
      const onChange = vi.fn()

      const release = acquireWatcher(filepath, onChange)

      // 多次调用 release 不应该抛出错误
      release()
      expect(() => release()).not.toThrow()
      expect(() => release()).not.toThrow()

      expect(getActiveWatcherCount()).toBe(0)
    })
  })

  describe('getActiveWatcherCount()', () => {
    it('should return correct count', async () => {
      expect(getActiveWatcherCount()).toBe(0)

      const file1 = await createTempFile(tempDir, 'file1.txt', 'content')
      const file2 = await createTempFile(tempDir, 'file2.txt', 'content')

      const release1 = acquireWatcher(file1, vi.fn())
      expect(getActiveWatcherCount()).toBe(1)

      const release2 = acquireWatcher(file2, vi.fn())
      expect(getActiveWatcherCount()).toBe(2)

      release1()
      expect(getActiveWatcherCount()).toBe(1)

      release2()
      expect(getActiveWatcherCount()).toBe(0)
    })
  })

  describe('closeAllWatchers()', () => {
    it('should close all watchers', async () => {
      const file1 = await createTempFile(tempDir, 'file1.txt', 'content')
      const file2 = await createTempFile(tempDir, 'file2.txt', 'content')

      acquireWatcher(file1, vi.fn())
      acquireWatcher(file2, vi.fn())

      expect(getActiveWatcherCount()).toBe(2)

      closeAllWatchers()

      expect(getActiveWatcherCount()).toBe(0)
    })

    it('should clear pending debounce timers', async () => {
      const filepath = await createTempFile(tempDir, 'test.txt', 'content')
      const onChange = vi.fn()

      acquireWatcher(filepath, onChange, { debounceMs: 1000 })

      // 触发变更但不等待防抖
      await writeFile(filepath, 'changed', 'utf-8')

      // 立即关闭所有监听器
      closeAllWatchers()

      // 等待原本的防抖时间
      await waitForDebounce(1100)

      // 回调不应该被调用
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  describe('recursive option', () => {
    it('should watch subdirectories when recursive is true', async () => {
      const subdir = join(tempDir, 'subdir')
      await mkdir(subdir, { recursive: true })

      const onChange = vi.fn()

      const release = acquireWatcher(tempDir, onChange, { recursive: true, debounceMs: 50 })

      // 在子目录创建文件
      await writeFile(join(subdir, 'nested.txt'), 'content', 'utf-8')
      await waitForDebounce(100)

      expect(onChange).toHaveBeenCalled()

      release()
    })
  })
})
