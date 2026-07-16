/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Verify Store unregister releases its physical observation root.
 * 2. Verify invalidation subscriber disconnect releases pending notification delivery.
 * 3. Verify fallback, path subscriptions, and every environment root release on teardown.
 *
 * Original request (2026-07-15): "Watchers and fallback timers are released after unregister, root removal, disconnect, and environment teardown."
 */
import {
  closeAllWatchers,
  getActiveWatcherCount,
  getWatcherRuntimeStatus,
  OpenSpecDataHomeObserver,
  ReactiveObservationEnvironment,
  RuntimeInvalidationIndex,
  RuntimeRootInvalidationRegistry,
} from '@openspecui/core'
import { realpathSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StoreObservationFallbackService } from './store-observation-fallback.js'
import { StoreObservationService } from './store-observation-service.js'

const tempDirs: string[] = []

async function createRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), prefix))
  tempDirs.push(root)
  return root
}

afterEach(async () => {
  await closeAllWatchers()
  await Promise.all(tempDirs.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('runtime observation lifecycle', () => {
  it('releases Store, subscriber, Launch, data-home, and fallback ownership', async () => {
    const launchRoot = await createRoot('openspecui-lifecycle-launch-')
    const dataHomeRoot = await createRoot('openspecui-lifecycle-data-')
    const storeRoot = await createRoot('openspecui-lifecycle-store-')
    const environment = new ReactiveObservationEnvironment()
    const invalidation = new RuntimeInvalidationIndex()
    const projectInvalidation = new RuntimeRootInvalidationRegistry(invalidation, [
      'project',
      'context',
    ])
    projectInvalidation.acquireRoot(launchRoot)
    await environment.acquireRoot(launchRoot)
    const dataHome = new OpenSpecDataHomeObserver({
      dataHomePath: dataHomeRoot,
      environment,
      invalidation,
    })
    await dataHome.start()
    const storeInvalidation = new RuntimeRootInvalidationRegistry(invalidation, [
      'stores',
      'context',
    ])
    const stores = new StoreObservationService(environment, storeInvalidation)
    await stores.reconcile([{ id: 'shared', root: storeRoot }])
    const fallback = new StoreObservationFallbackService({
      invalidation,
      dataHomeObservation: dataHome,
      storeObservation: stores,
      observationEnvironment: environment,
      intervalMs: 60_000,
    })
    fallback.start()

    expect(getWatcherRuntimeStatus()?.roots.map((root) => root.rootPath)).toEqual(
      [realpathSync(launchRoot), realpathSync(dataHomeRoot), realpathSync(storeRoot)].sort()
    )

    await stores.reconcile([])
    expect(getWatcherRuntimeStatus()?.roots.map((root) => root.rootPath)).not.toContain(
      realpathSync(storeRoot)
    )

    const disconnectedListener = vi.fn()
    const disconnect = invalidation.subscribe(['stores'], disconnectedListener)
    invalidation.invalidate(['stores'])
    disconnect()
    await Promise.resolve()
    expect(disconnectedListener).not.toHaveBeenCalled()

    await fallback.dispose()
    await stores.dispose()
    await dataHome.dispose()
    storeInvalidation.dispose()
    projectInvalidation.dispose()
    await environment.dispose()

    expect(getActiveWatcherCount()).toBe(0)
    expect(getWatcherRuntimeStatus()).toBeNull()
  })
})
