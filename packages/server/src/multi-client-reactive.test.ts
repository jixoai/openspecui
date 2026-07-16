/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Verify two clients observe external Store and registry invalidations from one environment.
 * 2. Verify concurrent mutation settlement coalesces and reconnect snapshots recover current identity.
 * 3. Verify Store-root disappearance reaches every connected client.
 * 4. Verify the complete multi-client environment tears down without watcher residue.
 *
 * Original request (2026-07-15): "正常情况下一个端操作成功，其他端在下一次操作前拿到最新数据。"
 */
import {
  closeAllWatchers,
  getActiveWatcherCount,
  getWatcherRuntimeStatus,
  OpenSpecDataHomeObserver,
  ReactiveObservationEnvironment,
  RuntimeInvalidationIndex,
  RuntimeRootInvalidationRegistry,
  type RuntimeInvalidationToken,
} from '@openspecui/core'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CliMutationInvalidator } from './cli-mutation-invalidator.js'
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

describe('multi-client reactive environment', () => {
  it('converges external edits, concurrent mutations, reconnect, and root disappearance', async () => {
    const dataHomeRoot = await createRoot('openspecui-multi-client-data-')
    const storeRoot = await createRoot('openspecui-multi-client-store-')
    const environment = new ReactiveObservationEnvironment()
    const invalidation = new RuntimeInvalidationIndex()
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
      intervalMs: 100,
    })
    fallback.start()

    const firstClient: RuntimeInvalidationToken[][] = []
    const secondClient: RuntimeInvalidationToken[][] = []
    const disconnectFirst = invalidation.subscribe(['stores', 'context'], (tokens) => {
      firstClient.push(tokens)
    })
    const disconnectSecond = invalidation.subscribe(['stores', 'context'], (tokens) => {
      secondClient.push(tokens)
    })

    await writeFile(join(storeRoot, 'external.md'), '# External Store edit\n', 'utf8')
    await vi.waitFor(
      () => {
        expect(firstClient.length).toBeGreaterThan(0)
        expect(secondClient.length).toBe(firstClient.length)
      },
      { timeout: 3_000, interval: 50 }
    )
    expect(firstClient.at(-1)).toEqual(secondClient.at(-1))
    expect(firstClient.at(-1)).toEqual(
      expect.arrayContaining([expect.objectContaining({ facet: 'stores' })])
    )

    await mkdir(join(dataHomeRoot, 'stores'), { recursive: true })
    await writeFile(
      join(dataHomeRoot, 'stores', 'registry.yaml'),
      'version: 1\nstores: {}\n',
      'utf8'
    )
    const contextAfterStoreEdit = invalidation.current('context')
    await vi.waitFor(
      () => expect(invalidation.current('context')).toBeGreaterThan(contextAfterStoreEdit),
      { timeout: 3_000, interval: 50 }
    )
    await vi.waitFor(() => expect(firstClient.at(-1)).toEqual(secondClient.at(-1)))

    const mutation = new CliMutationInvalidator(invalidation)
    const generationBeforeConcurrentMutations = invalidation.current('stores')
    await Promise.all([
      mutation.run(['stores', 'context'], async () => ({ success: true, exitCode: 0 })),
      mutation.run(['stores', 'context'], async () => ({ success: false, exitCode: 1 })),
    ])
    await vi.waitFor(() =>
      expect(firstClient.at(-1)).toEqual(
        expect.arrayContaining([
          {
            facet: 'stores',
            generation: generationBeforeConcurrentMutations + 2,
          },
        ])
      )
    )
    expect(firstClient.at(-1)).toEqual(secondClient.at(-1))

    const disconnectedCount = firstClient.length
    disconnectFirst()
    invalidation.invalidate(['stores'])
    await Promise.resolve()
    expect(firstClient).toHaveLength(disconnectedCount)
    const reconnectSnapshot = invalidation.track('stores', 'context')
    expect(reconnectSnapshot[0]?.generation).toBe(invalidation.current('stores'))
    const reconnectedClient: RuntimeInvalidationToken[][] = []
    const disconnectReconnected = invalidation.subscribe(['stores', 'context'], (tokens) => {
      reconnectedClient.push(tokens)
    })

    const generationBeforeRootRemoval = invalidation.current('stores')
    await rm(storeRoot, { recursive: true, force: true })
    await vi.waitFor(
      () => expect(invalidation.current('stores')).toBeGreaterThan(generationBeforeRootRemoval),
      { timeout: 4_000, interval: 50 }
    )
    await vi.waitFor(() => {
      expect(reconnectedClient.length).toBeGreaterThan(0)
      expect(reconnectedClient.at(-1)).toEqual(secondClient.at(-1))
    })

    disconnectReconnected()
    disconnectSecond()
    await fallback.dispose()
    await stores.dispose()
    await dataHome.dispose()
    storeInvalidation.dispose()
    await environment.dispose()
    expect(getActiveWatcherCount()).toBe(0)
    expect(getWatcherRuntimeStatus()).toBeNull()
  })
})
