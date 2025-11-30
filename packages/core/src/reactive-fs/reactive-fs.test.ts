import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  reactiveReadFile,
  reactiveReadDir,
  reactiveExists,
  reactiveStat,
  clearCache,
  getCacheSize,
} from './reactive-fs.js'
import { ReactiveContext } from './reactive-context.js'
import { initWatcherPool, closeAllWatchers } from './watcher-pool.js'
import {
  createTempDir,
  createTempFile,
  createTempSubDir,
  cleanupTempDir,
  waitForDebounce,
} from '../__tests__/test-utils.js'
import { writeFile, rm, mkdir, utimes } from 'fs/promises'
import { join } from 'path'

describe('ReactiveFS', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await createTempDir()
    // Initialize watcher pool with temp directory as project root
    await initWatcherPool(tempDir)
    clearCache()
  })

  afterEach(async () => {
    clearCache()
    await closeAllWatchers()
    await cleanupTempDir(tempDir)
  })

  describe('reactiveReadFile()', () => {
    it('should read file content', async () => {
      const filepath = await createTempFile(tempDir, 'test.txt', 'hello world')

      const content = await reactiveReadFile(filepath)

      expect(content).toBe('hello world')
    })

    it('should return null for non-existent file', async () => {
      const content = await reactiveReadFile(join(tempDir, 'nonexistent.txt'))

      expect(content).toBeNull()
    })

    it('should cache state for same path', async () => {
      const filepath = await createTempFile(tempDir, 'test.txt', 'content')

      await reactiveReadFile(filepath)
      await reactiveReadFile(filepath)

      // 应该只有一个缓存条目
      expect(getCacheSize()).toBe(1)
    })

    it('should update when file changes', async () => {
      const filepath = await createTempFile(tempDir, 'test.txt', 'initial')
      const context = new ReactiveContext()

      const generator = context.stream(async () => reactiveReadFile(filepath))

      // 获取初始值
      const first = await generator.next()
      expect(first.value).toBe('initial')

      // 修改文件
      await writeFile(filepath, 'updated', 'utf-8')
      await waitForDebounce(150)

      // 获取更新后的值
      const second = await generator.next()
      expect(second.value).toBe('updated')

      // 清理
      await generator.return(undefined)
    })

    it('should update when file is deleted', async () => {
      const filepath = await createTempFile(tempDir, 'test.txt', 'content')
      const context = new ReactiveContext()

      const generator = context.stream(async () => reactiveReadFile(filepath))

      // 获取初始值
      const first = await generator.next()
      expect(first.value).toBe('content')

      // 删除文件
      await rm(filepath)
      await waitForDebounce(150)

      // 获取更新后的值
      const second = await generator.next()
      expect(second.value).toBeNull()

      await generator.return(undefined)
    })

    it('should update when file is created', async () => {
      const filepath = join(tempDir, 'new.txt')
      const context = new ReactiveContext()

      const generator = context.stream(async () => reactiveReadFile(filepath))

      // 获取初始值（文件不存在）
      const first = await generator.next()
      expect(first.value).toBeNull()

      // 创建文件
      await writeFile(filepath, 'created', 'utf-8')
      // 增加等待时间，因为文件创建监听可能需要更长时间
      await waitForDebounce(300)

      // 获取更新后的值
      const second = await generator.next()
      expect(second.value).toBe('created')

      await generator.return(undefined)
    }, 10000)
  })

  describe('reactiveReadDir()', () => {
    it('should read directory entries', async () => {
      await createTempFile(tempDir, 'file1.txt', 'content')
      await createTempFile(tempDir, 'file2.txt', 'content')
      await createTempSubDir(tempDir, 'subdir')

      const entries = await reactiveReadDir(tempDir)

      expect(entries).toContain('file1.txt')
      expect(entries).toContain('file2.txt')
      expect(entries).toContain('subdir')
    })

    it('should return empty array for non-existent directory', async () => {
      // With @parcel/watcher, we can watch non-existent directories
      // and they will return empty arrays until created
      const entries = await reactiveReadDir(join(tempDir, 'nonexistent'))
      expect(entries).toEqual([])
    })

    it('should filter hidden files by default', async () => {
      await createTempFile(tempDir, '.hidden', 'content')
      await createTempFile(tempDir, 'visible.txt', 'content')

      const entries = await reactiveReadDir(tempDir)

      expect(entries).not.toContain('.hidden')
      expect(entries).toContain('visible.txt')
    })

    it('should include hidden files when option is set', async () => {
      await createTempFile(tempDir, '.hidden', 'content')
      await createTempFile(tempDir, 'visible.txt', 'content')

      const entries = await reactiveReadDir(tempDir, { includeHidden: true })

      expect(entries).toContain('.hidden')
      expect(entries).toContain('visible.txt')
    })

    it('should filter directories only', async () => {
      await createTempFile(tempDir, 'file.txt', 'content')
      await createTempSubDir(tempDir, 'subdir')

      const entries = await reactiveReadDir(tempDir, { directoriesOnly: true })

      expect(entries).not.toContain('file.txt')
      expect(entries).toContain('subdir')
    })

    it('should filter files only', async () => {
      await createTempFile(tempDir, 'file.txt', 'content')
      await createTempSubDir(tempDir, 'subdir')

      const entries = await reactiveReadDir(tempDir, { filesOnly: true })

      expect(entries).toContain('file.txt')
      expect(entries).not.toContain('subdir')
    })

    it('should exclude specified names', async () => {
      await createTempFile(tempDir, 'keep.txt', 'content')
      await createTempFile(tempDir, 'exclude.txt', 'content')

      const entries = await reactiveReadDir(tempDir, { exclude: ['exclude.txt'] })

      expect(entries).toContain('keep.txt')
      expect(entries).not.toContain('exclude.txt')
    })

    it('should update when directory changes', async () => {
      await createTempFile(tempDir, 'initial.txt', 'content')
      const context = new ReactiveContext()

      const generator = context.stream(async () => reactiveReadDir(tempDir))

      // 获取初始值
      const first = await generator.next()
      expect(first.value).toContain('initial.txt')

      // 添加新文件
      await createTempFile(tempDir, 'added.txt', 'content')
      // 增加等待时间，因为目录监听可能需要更长时间
      await waitForDebounce(300)

      // 获取更新后的值
      const second = await generator.next()
      expect(second.value).toContain('initial.txt')
      expect(second.value).toContain('added.txt')

      await generator.return(undefined)
    }, 10000)

    it('should cache different options separately', async () => {
      await createTempFile(tempDir, 'file.txt', 'content')
      await createTempSubDir(tempDir, 'subdir')

      await reactiveReadDir(tempDir)
      await reactiveReadDir(tempDir, { directoriesOnly: true })
      await reactiveReadDir(tempDir, { filesOnly: true })

      // 应该有三个不同的缓存条目
      expect(getCacheSize()).toBe(3)
    })
  })

  describe('reactiveExists()', () => {
    it('should return true for existing file', async () => {
      const filepath = await createTempFile(tempDir, 'test.txt', 'content')

      const exists = await reactiveExists(filepath)

      expect(exists).toBe(true)
    })

    it('should return true for existing directory', async () => {
      const subdir = await createTempSubDir(tempDir, 'subdir')

      const exists = await reactiveExists(subdir)

      expect(exists).toBe(true)
    })

    it('should return false for non-existent path', async () => {
      const exists = await reactiveExists(join(tempDir, 'nonexistent'))

      expect(exists).toBe(false)
    })

    it('should update when file is created', async () => {
      const filepath = join(tempDir, 'new.txt')
      const context = new ReactiveContext()

      const generator = context.stream(async () => reactiveExists(filepath))

      // 获取初始值
      const first = await generator.next()
      expect(first.value).toBe(false)

      // 创建文件
      await writeFile(filepath, 'content', 'utf-8')
      await waitForDebounce(150)

      // 获取更新后的值
      const second = await generator.next()
      expect(second.value).toBe(true)

      await generator.return(undefined)
    })

    it('should update when file is deleted', async () => {
      const filepath = await createTempFile(tempDir, 'test.txt', 'content')
      const context = new ReactiveContext()

      const generator = context.stream(async () => reactiveExists(filepath))

      // 获取初始值
      const first = await generator.next()
      expect(first.value).toBe(true)

      // 删除文件
      await rm(filepath)
      await waitForDebounce(150)

      // 获取更新后的值
      const second = await generator.next()
      expect(second.value).toBe(false)

      await generator.return(undefined)
    })
  })

  describe('reactiveStat()', () => {
    it('should return stat for file', async () => {
      const filepath = await createTempFile(tempDir, 'test.txt', 'content')

      const statResult = await reactiveStat(filepath)

      expect(statResult).not.toBeNull()
      expect(statResult!.isFile).toBe(true)
      expect(statResult!.isDirectory).toBe(false)
      expect(typeof statResult!.mtime).toBe('number')
      expect(typeof statResult!.birthtime).toBe('number')
    })

    it('should return stat for directory', async () => {
      const subdir = await createTempSubDir(tempDir, 'subdir')

      const statResult = await reactiveStat(subdir)

      expect(statResult).not.toBeNull()
      expect(statResult!.isFile).toBe(false)
      expect(statResult!.isDirectory).toBe(true)
    })

    it('should return null for non-existent path', async () => {
      const statResult = await reactiveStat(join(tempDir, 'nonexistent'))

      expect(statResult).toBeNull()
    })

    it('should update when file mtime changes', async () => {
      const filepath = await createTempFile(tempDir, 'test.txt', 'content')
      const context = new ReactiveContext()

      const generator = context.stream(async () => reactiveStat(filepath))

      // 获取初始值
      const first = await generator.next()
      const initialMtime = first.value!.mtime

      // 等待一小段时间确保 mtime 会不同
      await new Promise((r) => setTimeout(r, 100))

      // 修改文件（更新 mtime）
      await writeFile(filepath, 'updated', 'utf-8')
      await waitForDebounce(300)

      // 获取更新后的值
      const second = await generator.next()
      expect(second.value!.mtime).toBeGreaterThan(initialMtime)

      await generator.return(undefined)
    }, 10000)
  })

  describe('clearCache()', () => {
    it('should clear all cache', async () => {
      await createTempFile(tempDir, 'file1.txt', 'content')
      await createTempFile(tempDir, 'file2.txt', 'content')

      await reactiveReadFile(join(tempDir, 'file1.txt'))
      await reactiveReadFile(join(tempDir, 'file2.txt'))

      expect(getCacheSize()).toBe(2)

      clearCache()

      expect(getCacheSize()).toBe(0)
    })

    it('should clear cache for specific path', async () => {
      const file1 = await createTempFile(tempDir, 'file1.txt', 'content')
      const file2 = await createTempFile(tempDir, 'file2.txt', 'content')

      await reactiveReadFile(file1)
      await reactiveReadFile(file2)

      expect(getCacheSize()).toBe(2)

      clearCache(file1)

      expect(getCacheSize()).toBe(1)
    })
  })

  describe('getCacheSize()', () => {
    it('should return correct cache size', async () => {
      expect(getCacheSize()).toBe(0)

      await createTempFile(tempDir, 'file.txt', 'content')
      await reactiveReadFile(join(tempDir, 'file.txt'))

      expect(getCacheSize()).toBe(1)

      await reactiveReadDir(tempDir)

      expect(getCacheSize()).toBe(2)
    })
  })

  describe('integration with ReactiveContext', () => {
    it('should track multiple file dependencies', async () => {
      const file1 = await createTempFile(tempDir, 'file1.txt', 'content1')
      const file2 = await createTempFile(tempDir, 'file2.txt', 'content2')
      const context = new ReactiveContext()

      const generator = context.stream(async () => {
        const c1 = await reactiveReadFile(file1)
        const c2 = await reactiveReadFile(file2)
        return `${c1}-${c2}`
      })

      // 获取初始值
      const first = await generator.next()
      expect(first.value).toBe('content1-content2')

      // 修改 file1
      await writeFile(file1, 'updated1', 'utf-8')
      await waitForDebounce(150)

      const second = await generator.next()
      expect(second.value).toBe('updated1-content2')

      // 修改 file2
      await writeFile(file2, 'updated2', 'utf-8')
      await waitForDebounce(150)

      const third = await generator.next()
      expect(third.value).toBe('updated1-updated2')

      await generator.return(undefined)
    })

    it('should handle mixed file and directory dependencies', async () => {
      const file = await createTempFile(tempDir, 'file.txt', 'content')
      const context = new ReactiveContext()

      const generator = context.stream(async () => {
        const content = await reactiveReadFile(file)
        const entries = await reactiveReadDir(tempDir)
        return { content, count: entries.length }
      })

      // 获取初始值
      const first = await generator.next()
      expect(first.value.content).toBe('content')
      expect(first.value.count).toBe(1)

      // 添加新文件
      await createTempFile(tempDir, 'new.txt', 'new')
      await waitForDebounce(150)

      const second = await generator.next()
      expect(second.value.count).toBe(2)

      await generator.return(undefined)
    })
  })
})
