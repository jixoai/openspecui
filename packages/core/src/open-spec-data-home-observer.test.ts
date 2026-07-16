/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Verify external data-home changes invalidate Store, Workset, schema, and Context facets.
 * 2. Verify the observer owns and releases its data-home root lease.
 * 3. Verify observer teardown stops filesystem-driven invalidation.
 *
 * Original request (2026-07-15): "有效 OpenSpec data home 的变化要让所有端拉取最新投影。"
 */
import { realpathSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanupTempDir, createTempDir, waitFor } from './__tests__/test-utils.js'
import {
  OPEN_SPEC_DATA_HOME_INVALIDATION_FACETS,
  OpenSpecDataHomeObserver,
} from './open-spec-data-home-observer.js'
import { ReactiveObservationEnvironment } from './reactive-fs/observation-environment.js'
import { closeAllWatchers } from './reactive-fs/watcher-pool.js'
import { RuntimeInvalidationIndex } from './runtime-invalidation.js'

const tempDirs: string[] = []

afterEach(async () => {
  await closeAllWatchers()
  await Promise.all(tempDirs.splice(0).map((dir) => cleanupTempDir(dir)))
})

describe('OpenSpecDataHomeObserver', () => {
  it('invalidates all data-home facets and releases observation on teardown', async () => {
    const dataHome = await createTempDir()
    tempDirs.push(dataHome)
    const environment = new ReactiveObservationEnvironment()
    const invalidation = new RuntimeInvalidationIndex()
    const observer = new OpenSpecDataHomeObserver({
      dataHomePath: dataHome,
      environment,
      invalidation,
    })
    const listener = vi.fn()
    const releaseListener = invalidation.subscribe(
      OPEN_SPEC_DATA_HOME_INVALIDATION_FACETS,
      listener
    )

    await observer.start()
    expect(observer.getState()).toBe('active')
    expect(environment.getRoots()).toEqual([
      expect.objectContaining({ rootPath: realpathSync(dataHome), referenceCount: 1 }),
    ])

    await mkdir(join(dataHome, 'stores'), { recursive: true })
    await writeFile(join(dataHome, 'stores', 'registry.yaml'), 'version: 1\nstores: {}\n', 'utf8')

    await waitFor(() => listener.mock.calls.length > 0, { timeout: 2500, interval: 50 })
    expect(listener).toHaveBeenLastCalledWith(
      OPEN_SPEC_DATA_HOME_INVALIDATION_FACETS.map((facet) => ({ facet, generation: 1 }))
    )

    await observer.dispose()
    expect(observer.getState()).toBe('disposed')
    expect(environment.getRoots()).toEqual([])

    listener.mockClear()
    await writeFile(join(dataHome, 'worksets.yaml'), 'version: 1\nworksets: {}\n', 'utf8')
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(listener).not.toHaveBeenCalled()

    releaseListener()
    await environment.dispose()
  })

  it('allows bounded fallback to retry a failed root acquisition', async () => {
    const dataHome = await createTempDir()
    tempDirs.push(dataHome)
    const releaseRoot = vi.fn(async () => {})
    const environment = {
      acquireRoot: vi
        .fn()
        .mockRejectedValueOnce(new Error('watcher unavailable'))
        .mockResolvedValueOnce(releaseRoot),
    }
    const observer = new OpenSpecDataHomeObserver({
      dataHomePath: dataHome,
      environment,
      invalidation: new RuntimeInvalidationIndex(),
    })

    await expect(observer.start()).rejects.toThrow('watcher unavailable')
    expect(observer.getState()).toBe('failed')
    await expect(observer.start()).resolves.toBeUndefined()
    expect(observer.getState()).toBe('active')

    await observer.dispose()
    expect(releaseRoot).toHaveBeenCalledTimes(1)
  })
})
