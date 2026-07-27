/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Verify Launch and Planning roots invalidate project/context facets on external changes.
 * 2. Verify repeated ownership of one normalized root shares one invalidation subscription.
 * 3. Verify the final release stops root-driven invalidation.
 *
 * Original request (2026-07-15): "Launch-project and connected planning-root changes invalidate their project/context facets."
 */
import { realpathSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanupTempDir, createTempDir, waitFor } from './__tests__/test-utils.js'
import { ReactiveObservationEnvironment } from './reactive-fs/observation-environment.js'
import { closeAllWatchers } from './reactive-fs/watcher-pool.js'
import { RuntimeInvalidationIndex } from './runtime-invalidation.js'
import { RuntimeRootInvalidationRegistry } from './runtime-root-invalidation.js'

const tempDirs: string[] = []

afterEach(async () => {
  await closeAllWatchers()
  await Promise.all(tempDirs.splice(0).map((dir) => cleanupTempDir(dir)))
})

describe('RuntimeRootInvalidationRegistry', () => {
  it('invalidates two roots and deduplicates repeated ownership of one root', async () => {
    const launchRoot = await createTempDir()
    const planningRoot = await createTempDir()
    tempDirs.push(launchRoot, planningRoot)
    const environment = new ReactiveObservationEnvironment()
    await environment.acquireRoot(launchRoot)
    await environment.acquireRoot(planningRoot)
    const invalidation = new RuntimeInvalidationIndex()
    const registry = new RuntimeRootInvalidationRegistry(invalidation, ['project', 'context'])
    const listener = vi.fn()
    invalidation.subscribe(['project', 'context'], listener)

    const releaseLaunch = registry.acquireRoot(launchRoot)
    const releaseLaunchDuplicate = registry.acquireRoot(launchRoot)
    const releasePlanning = registry.acquireRoot(planningRoot)
    expect(registry.getRoots()).toEqual(
      [
        { rootPath: realpathSync(launchRoot), referenceCount: 2 },
        { rootPath: realpathSync(planningRoot), referenceCount: 1 },
      ].sort((left, right) => left.rootPath.localeCompare(right.rootPath))
    )

    await writeFile(join(launchRoot, 'launch.txt'), 'launch\n', 'utf8')
    await waitFor(() => listener.mock.calls.length === 1, { timeout: 2500, interval: 50 })
    expect(listener).toHaveBeenLastCalledWith([
      { facet: 'project', generation: 1 },
      { facet: 'context', generation: 1 },
    ])

    await writeFile(join(planningRoot, 'planning.txt'), 'planning\n', 'utf8')
    await waitFor(() => listener.mock.calls.length === 2, { timeout: 2500, interval: 50 })

    releaseLaunch()
    releaseLaunchDuplicate()
    releasePlanning()
    expect(registry.getRoots()).toEqual([])
    registry.dispose()
    await environment.dispose()
  })
})
