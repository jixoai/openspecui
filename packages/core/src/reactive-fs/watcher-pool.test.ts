/**
 * Orthogonal intents (updated 2026-07-16 Asia/Shanghai):
 * 1. Verify path subscriptions share callbacks and release deterministically.
 * 2. Verify multiple observation roots coexist and use reference-counted leases.
 * 3. Verify runtime status reports the complete dynamic root set.
 *
 * Original request (2026-07-15): "响应式内核要观察 data home、Store roots 和 connected project roots。"
 */
import { realpathSync } from 'fs'
import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanupTempDir,
  createTempDir,
  createTempFile,
  waitFor,
  waitForDebounce,
} from '../__tests__/test-utils.js'
import {
  acquireWatcher,
  acquireWatcherRoot,
  closeAllWatchers,
  getActiveWatcherCount,
  getWatcherRuntimeStatus,
  isWatcherPoolInitialized,
  subscribeWatcherRuntimeStatus,
} from './watcher-pool.js'

describe('WatcherPool', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await createTempDir()
    await acquireWatcherRoot(tempDir)
  })

  afterEach(async () => {
    await closeAllWatchers()
    await cleanupTempDir(tempDir)
  })

  describe('acquireWatcherRoot()', () => {
    it('should initialize watcher pool', async () => {
      expect(isWatcherPoolInitialized()).toBe(true)
    })

    it('keeps a shared root alive until its final lease is released', async () => {
      const release = await acquireWatcherRoot(tempDir)

      expect(getWatcherRuntimeStatus()?.roots).toEqual([
        expect.objectContaining({
          rootPath: realpathSync(tempDir),
          referenceCount: 2,
        }),
      ])

      await release()
      expect(isWatcherPoolInitialized()).toBe(true)
      expect(getWatcherRuntimeStatus()?.roots[0]?.referenceCount).toBe(1)
    })

    it('observes multiple roots without replacing the existing root', async () => {
      const secondRoot = await createTempDir()
      try {
        const releaseSecondRoot = await acquireWatcherRoot(secondRoot)
        const onChange = vi.fn()
        const releasePath = acquireWatcher(secondRoot, onChange, {
          recursive: true,
          debounceMs: 50,
        })

        expect(
          getWatcherRuntimeStatus()
            ?.roots.map((root) => root.rootPath)
            .sort()
        ).toEqual([realpathSync(tempDir), realpathSync(secondRoot)].sort())

        await writeFile(join(secondRoot, 'outside-launch.txt'), 'content', 'utf8')
        await waitFor(() => onChange.mock.calls.length > 0, { timeout: 2000, interval: 50 })

        releasePath()
        await releaseSecondRoot()
        expect(getWatcherRuntimeStatus()?.roots).toEqual([
          expect.objectContaining({ rootPath: realpathSync(tempDir) }),
        ])
      } finally {
        await cleanupTempDir(secondRoot)
      }
    })

    it('emits watcher runtime state to subscribers', async () => {
      const listener = vi.fn()
      const unsubscribe = subscribeWatcherRuntimeStatus(listener)

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          initialized: true,
          rootCount: 1,
          roots: [
            expect.objectContaining({
              rootPath: realpathSync(tempDir),
              projectResidency: { state: 'active' },
            }),
          ],
        })
      )

      unsubscribe()
    })
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

      // Wait for subscription to be set up
      await waitForDebounce(50)

      // Modify file
      await writeFile(filepath, 'changed', 'utf-8')

      await waitFor(() => onChange.mock.calls.length > 0, { timeout: 2000, interval: 50 })

      expect(onChange).toHaveBeenCalled()

      release()
    })

    it('should call onChange when new file is created in directory', async () => {
      const onChange = vi.fn()

      // Use recursive option to detect changes in directory
      const release = acquireWatcher(tempDir, onChange, { debounceMs: 50, recursive: true })

      // Wait for subscription to be set up
      await waitForDebounce(50)

      // Create new file
      await writeFile(join(tempDir, 'new.txt'), 'content', 'utf-8')

      // Wait for debounce
      await waitForDebounce(500)

      expect(onChange).toHaveBeenCalled()

      release()
    })

    it('should debounce multiple rapid changes', async () => {
      const filepath = await createTempFile(tempDir, 'test.txt', 'initial')
      const onChange = vi.fn()

      const release = acquireWatcher(filepath, onChange, { debounceMs: 100 })

      // Wait for subscription to be set up
      await waitForDebounce(100)

      // Rapid changes
      await writeFile(filepath, 'change1', 'utf-8')
      await writeFile(filepath, 'change2', 'utf-8')
      await writeFile(filepath, 'change3', 'utf-8')

      // Wait for debounce (ProjectWatcher debounce 50ms + watcher-pool debounce 100ms + buffer)
      await waitForDebounce(300)

      // Should only trigger once (or a few times due to internal batching, but not 3 times)
      expect(onChange.mock.calls.length).toBeGreaterThanOrEqual(1)
      expect(onChange.mock.calls.length).toBeLessThanOrEqual(2)

      release()
    })
  })

  describe('Reference counting', () => {
    it('should share watcher for same path', async () => {
      const filepath = await createTempFile(tempDir, 'test.txt', 'content')
      const onChange1 = vi.fn()
      const onChange2 = vi.fn()

      const release1 = acquireWatcher(filepath, onChange1)
      const release2 = acquireWatcher(filepath, onChange2)

      // Should only have one subscription
      expect(getActiveWatcherCount()).toBe(1)

      release1()
      // Still has one reference, subscription should remain
      expect(getActiveWatcherCount()).toBe(1)

      release2()
      // All references released, subscription should close
      expect(getActiveWatcherCount()).toBe(0)
    })

    it('should notify all callbacks on change', async () => {
      const filepath = await createTempFile(tempDir, 'test.txt', 'content')
      const onChange1 = vi.fn()
      const onChange2 = vi.fn()

      const release1 = acquireWatcher(filepath, onChange1, { debounceMs: 50 })
      const release2 = acquireWatcher(filepath, onChange2, { debounceMs: 50 })

      // Wait for subscription to be set up
      await waitForDebounce(50)

      // Modify file
      await writeFile(filepath, 'changed', 'utf-8')
      await waitForDebounce(500)

      // Both callbacks should be called
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

      // Wait for subscription to be set up
      await waitForDebounce(50)

      // Release first callback
      release1()

      // Modify file
      await writeFile(filepath, 'changed', 'utf-8')
      await waitFor(() => onChange2.mock.calls.length > 0, { timeout: 2000, interval: 50 })

      // Only second callback should be called
      expect(onChange1).not.toHaveBeenCalled()
      expect(onChange2).toHaveBeenCalled()

      release2()
    })
  })

  describe('Path normalization', () => {
    it('should normalize paths', async () => {
      const filepath = await createTempFile(tempDir, 'test.txt', 'content')
      const onChange1 = vi.fn()
      const onChange2 = vi.fn()

      // Use different path forms
      const release1 = acquireWatcher(filepath, onChange1)
      const release2 = acquireWatcher(join(tempDir, './test.txt'), onChange2)

      // Should share same subscription
      expect(getActiveWatcherCount()).toBe(1)

      release1()
      release2()
    })
  })

  describe('Error handling', () => {
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

      // Wait for subscription to be set up
      await waitForDebounce(100)

      // Modify file
      await writeFile(filepath, 'changed', 'utf-8')
      // Wait for ProjectWatcher debounce (50ms) + watcher-pool debounce (50ms) + buffer
      await waitForDebounce(200)

      // Error callback was called
      expect(errorCallback).toHaveBeenCalled()
      // Normal callback also called (error doesn't affect others)
      expect(normalCallback).toHaveBeenCalled()
      // Error was logged
      expect(consoleError).toHaveBeenCalled()

      consoleError.mockRestore()
      release1()
      release2()
    })

    it('should handle release called multiple times', async () => {
      const filepath = await createTempFile(tempDir, 'test.txt', 'content')
      const onChange = vi.fn()

      const release = acquireWatcher(filepath, onChange)

      // Multiple release calls should not throw
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

      await closeAllWatchers()

      expect(getActiveWatcherCount()).toBe(0)
    })

    it('should clear pending debounce timers', async () => {
      const filepath = await createTempFile(tempDir, 'test.txt', 'content')
      const onChange = vi.fn()

      acquireWatcher(filepath, onChange, { debounceMs: 1000 })

      // Wait for subscription to be set up
      await waitForDebounce(50)

      // Trigger change but don't wait for debounce
      await writeFile(filepath, 'changed', 'utf-8')

      // Immediately close all watchers
      await closeAllWatchers()

      // Wait for original debounce time
      await waitForDebounce(1100)

      // Callback should not be called
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  describe('recursive option', () => {
    it('should watch subdirectories when recursive is true', async () => {
      const subdir = join(tempDir, 'subdir')
      await mkdir(subdir, { recursive: true })

      const onChange = vi.fn()

      const release = acquireWatcher(tempDir, onChange, { recursive: true, debounceMs: 50 })

      // Wait for subscription to be set up
      await waitForDebounce(50)

      // Create file in subdirectory
      await writeFile(join(subdir, 'nested.txt'), 'content', 'utf-8')
      await waitForDebounce(150)

      expect(onChange).toHaveBeenCalled()

      release()
    })
  })

  describe('Non-existent directory support', () => {
    it('should detect newly created directories', async () => {
      const newDir = join(tempDir, 'new-dir')
      const onChange = vi.fn()

      // Watch non-existent directory
      const release = acquireWatcher(tempDir, onChange, { recursive: true, debounceMs: 50 })

      // Wait for subscription to be set up
      await waitForDebounce(50)

      // Create the directory
      await mkdir(newDir, { recursive: true })
      await writeFile(join(newDir, 'file.txt'), 'content', 'utf-8')

      // Wait for detection
      await waitForDebounce(200)

      expect(onChange).toHaveBeenCalled()

      release()
    })
  })
})
