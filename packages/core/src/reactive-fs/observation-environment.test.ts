/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Verify each runtime environment owns a reference-counted dynamic root set.
 * 2. Verify physical root watchers are shared across runtime environments.
 * 3. Verify environment teardown releases every owned root lease.
 *
 * Original request (2026-07-15): "Reactive observation supports a reference-counted dynamic set of roots per runtime environment."
 */
import { realpathSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanupTempDir, createTempDir } from '../__tests__/test-utils.js'
import { ReactiveObservationEnvironment } from './observation-environment.js'
import { closeAllWatchers, getWatcherRuntimeStatus } from './watcher-pool.js'

const tempDirs: string[] = []

afterEach(async () => {
  await closeAllWatchers()
  await Promise.all(tempDirs.splice(0).map((dir) => cleanupTempDir(dir)))
})

async function createRoot(): Promise<string> {
  const root = await createTempDir()
  tempDirs.push(root)
  return root
}

describe('ReactiveObservationEnvironment', () => {
  it('reference-counts repeated root acquisition inside one environment', async () => {
    const root = await createRoot()
    const environment = new ReactiveObservationEnvironment()
    const releaseFirst = await environment.acquireRoot(root)
    const releaseSecond = await environment.acquireRoot(root)

    expect(environment.getRoots()).toEqual([{ rootPath: realpathSync(root), referenceCount: 2 }])
    expect(getWatcherRuntimeStatus()?.roots[0]?.referenceCount).toBe(1)

    await releaseFirst()
    expect(environment.getRoots()[0]?.referenceCount).toBe(1)
    expect(getWatcherRuntimeStatus()?.rootCount).toBe(1)

    await releaseSecond()
    expect(environment.getRoots()).toEqual([])
    expect(getWatcherRuntimeStatus()).toBeNull()
  })

  it('shares one physical root watcher across runtime environments', async () => {
    const root = await createRoot()
    const firstEnvironment = new ReactiveObservationEnvironment()
    const secondEnvironment = new ReactiveObservationEnvironment()

    await firstEnvironment.acquireRoot(root)
    await secondEnvironment.acquireRoot(root)

    expect(getWatcherRuntimeStatus()?.roots).toEqual([
      expect.objectContaining({
        rootPath: realpathSync(root),
        referenceCount: 2,
      }),
    ])

    await firstEnvironment.dispose()
    expect(getWatcherRuntimeStatus()?.roots[0]?.referenceCount).toBe(1)

    await secondEnvironment.dispose()
    expect(getWatcherRuntimeStatus()).toBeNull()
  })

  it('releases every dynamic root during environment teardown', async () => {
    const firstRoot = await createRoot()
    const secondRoot = await createRoot()
    const environment = new ReactiveObservationEnvironment()

    await environment.acquireRoot(firstRoot)
    await environment.acquireRoot(secondRoot)
    expect(getWatcherRuntimeStatus()?.rootCount).toBe(2)

    await environment.dispose()
    expect(environment.getRoots()).toEqual([])
    expect(getWatcherRuntimeStatus()).toBeNull()
  })
})
