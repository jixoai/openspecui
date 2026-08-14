/**
 * Orthogonal intents (updated 2026-08-08 Asia/Shanghai):
 * 1. Settle process-level watcher pools after one Server test fixture.
 * 2. Remove owned temporary directories with bounded Windows lock-release retries.
 * 3. Preserve POSIX immediacy while bounding native Windows watcher startup and change settlement.
 * 4. Dispose createServer fixtures in the same service-owner order as production shutdown.
 *
 * Original request (2026-08-04): "这个项目之前都是在macOS上做到开发，现在我们在Windows，所以开始一系列的适配。"
 * Original request (2026-08-04): "Adapt macOS-first development and runtime paths to Windows."
 * Original request (2026-08-05): Continue the Windows adaptation and fix equivalent failures together.
 * Original request (2026-08-06): "Windows compatibility and adaptation, including the core and peripheral scripts."
 */
import { closeAllProjectWatchers, closeAllWatchers } from '@openspecui/core'
import { rm } from 'node:fs/promises'
import type { createServer } from './server.js'

export const SERVER_FIXTURE_TEST_TIMEOUT_MS = process.platform === 'win32' ? 15_000 : 5_000
const WINDOWS_NATIVE_WATCHER_SETTLEMENT_MS = 100

type ServerTestFixture = ReturnType<typeof createServer>

/** Let a newly acquired Windows native watcher receive the next external fixture mutation. */
export async function waitForServerWatcherSettlement(): Promise<void> {
  if (process.platform !== 'win32') return
  await new Promise<void>((resolve) => setTimeout(resolve, WINDOWS_NATIVE_WATCHER_SETTLEMENT_MS))
}

async function settleCleanupPhase(
  failures: unknown[],
  tasks: ReadonlyArray<() => void | Promise<void>>
): Promise<void> {
  const results = await Promise.allSettled(tasks.map((task) => Promise.resolve().then(task)))
  for (const result of results) {
    if (result.status === 'rejected') failures.push(result.reason)
  }
}

/** Dispose a createServer fixture through the production service-owner sequence. */
export async function disposeServerTestFixture(server: ServerTestFixture): Promise<void> {
  const failures: unknown[] = []
  await settleCleanupPhase(failures, [() => server.storeObservationFallback.dispose()])
  await settleCleanupPhase(failures, [() => server.storeMutationService.dispose()])
  await settleCleanupPhase(failures, [() => server.rootContextNotificationBridge.dispose()])
  await settleCleanupPhase(failures, [() => server.storeProjectionService.dispose()])
  await settleCleanupPhase(failures, [() => server.storeContentProjectionService.dispose()])
  await settleCleanupPhase(failures, [() => server.agentDeliveryProjectionService.dispose()])
  await settleCleanupPhase(failures, [() => server.environmentGlobalProjectionService.dispose()])
  await settleCleanupPhase(failures, [() => server.cliExecutor.dispose()])
  await settleCleanupPhase(failures, [() => server.planningRootServices.dispose()])
  await settleCleanupPhase(failures, [() => server.projectionWorkRuntime.clear()])
  await settleCleanupPhase(failures, [() => server.storeObservation.dispose()])
  await settleCleanupPhase(failures, [() => server.dataHomeObserver.dispose()])
  await settleCleanupPhase(failures, [() => server.projectInvalidation.dispose()])
  await settleCleanupPhase(failures, [() => server.observationEnvironment.dispose()])
  await settleCleanupPhase(failures, [
    () => server.projectRecoveryService.dispose(),
    () => server.translationCacheService.close(),
  ])
  if (failures.length > 0) {
    throw new AggregateError(failures, 'Server test fixture teardown failed.')
  }
}

/** Settle shared watcher owners, then remove the supplied test-owned directories. */
export async function removeServerTestDirectories(paths: readonly string[]): Promise<void> {
  await closeAllWatchers()
  await closeAllProjectWatchers()
  await Promise.all(
    paths.map((path) =>
      rm(path, {
        recursive: true,
        force: true,
        maxRetries: process.platform === 'win32' ? 20 : 0,
        retryDelay: 50,
      })
    )
  )
}
