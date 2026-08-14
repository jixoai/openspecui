/**
 * Orthogonal intents (updated 2026-08-07 Asia/Shanghai):
 * 1. Own a reference-counted dynamic set of physical watcher roots, including missing logical roots
 *    through their nearest existing ancestor.
 * 2. Bind shared path subscriptions to the deepest active containing root.
 * 3. Rebind pending subscriptions when roots appear, disappear, or recover.
 * 4. Expose aggregate and per-root runtime status for server diagnostics.
 * 5. Keep missing-path ancestor settlement explicit in subscription identity and retire every
 *    physical subscription plus cached ProjectWatcher during full teardown.
 *
 * Original request (2026-07-15): "响应式内核要观察 data home、Store roots 和 connected project roots。"
 * Remote CI fixed point (2026-07-28): data-home Schema creation may arrive as an ancestor event on Linux.
 */
import { existsSync } from 'node:fs'
import { dirname, isAbsolute, relative } from 'node:path'
import { resolveRealPathThroughExistingAncestor } from './path-realpath.js'
import {
  closeAllProjectWatchers,
  getProjectWatcher,
  type ProjectWatcher,
  type ProjectWatcherRuntimeStatus,
  type ProjectWatcherRuntimeStatusListener,
} from './project-watcher.js'

const DEBOUNCE_MS = 100

function getRealPath(path: string): string {
  return resolveRealPathThroughExistingAncestor(path)
}

function getExistingWatcherRoot(rootPath: string): string {
  let currentPath = rootPath
  while (!existsSync(currentPath)) {
    const parentPath = dirname(currentPath)
    if (parentPath === currentPath) return currentPath
    currentPath = parentPath
  }
  return currentPath
}

function pathBelongsToRoot(path: string, rootPath: string): boolean {
  const relativePath = relative(rootPath, path)
  return relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath))
}

export type WatcherRootRelease = () => Promise<void>

interface WatcherRootRecord {
  rootPath: string
  physicalRootPath: string
  watcher: ProjectWatcher
  referenceCount: number
  ready: Promise<void>
  releaseRuntimeStatus: () => void
}

interface PathSubscription {
  path: string
  recursive: boolean
  watchAncestorsWhileMissing: boolean
  debounceMs: number
  callbacks: Set<() => void>
  rootPath: string | null
  unsubscribe: (() => void) | null
  onError?: () => void
}

const watcherRoots = new Map<string, WatcherRootRecord>()
const closingWatcherRoots = new Map<string, Promise<void>>()
const physicalWatcherReferences = new Map<
  string,
  { watcher: ProjectWatcher; referenceCount: number }
>()
const closingPhysicalWatchers = new Map<string, Promise<void>>()
const subscriptionCache = new Map<string, PathSubscription>()
const debounceTimers = new Map<string, NodeJS.Timeout>()
const watcherRuntimeStatusListeners = new Set<(status: WatcherRuntimeStatus | null) => void>()

export interface WatcherRootRuntimeStatus extends ProjectWatcherRuntimeStatus {
  rootPath: string
  referenceCount: number
  initialized: boolean
  subscriptionCount: number
}

/** Aggregate watcher state for the current process. */
export interface WatcherRuntimeStatus {
  initialized: boolean
  rootCount: number
  subscriptionCount: number
  roots: WatcherRootRuntimeStatus[]
}

function emitWatcherRuntimeStatus(): void {
  const status = getWatcherRuntimeStatus()
  for (const listener of watcherRuntimeStatusListeners) {
    listener(status)
  }
}

function findWatcherRoot(path: string): WatcherRootRecord | null {
  let selected: WatcherRootRecord | null = null
  for (const root of watcherRoots.values()) {
    if (
      root.referenceCount > 0 &&
      root.watcher.isInitialized &&
      pathBelongsToRoot(path, root.rootPath) &&
      (!selected || root.rootPath.length > selected.rootPath.length)
    ) {
      selected = root
    }
  }
  return selected
}

function dispatchSubscription(cacheKey: string, subscription: PathSubscription): void {
  const existingTimer = debounceTimers.get(cacheKey)
  if (existingTimer) {
    clearTimeout(existingTimer)
  }

  const timer = setTimeout(() => {
    debounceTimers.delete(cacheKey)
    const current = subscriptionCache.get(cacheKey)
    if (current !== subscription) return
    for (const callback of current.callbacks) {
      try {
        callback()
      } catch (error) {
        console.error(`[watcher-pool] Callback error for ${subscription.path}:`, error)
      }
    }
  }, subscription.debounceMs)
  debounceTimers.set(cacheKey, timer)
}

function rebindSubscription(cacheKey: string, subscription: PathSubscription): void {
  const root = findWatcherRoot(subscription.path)
  if (subscription.rootPath === root?.rootPath) return

  subscription.unsubscribe?.()
  subscription.unsubscribe = null
  subscription.rootPath = null

  if (!root) return

  try {
    subscription.unsubscribe = root.watcher.subscribeSync(
      subscription.path,
      () => dispatchSubscription(cacheKey, subscription),
      {
        watchChildren: subscription.recursive,
        watchAncestorsWhileMissing: subscription.watchAncestorsWhileMissing,
      }
    )
    subscription.rootPath = root.rootPath
  } catch (error) {
    subscription.onError?.()
    console.error(`[watcher-pool] Failed to bind ${subscription.path}:`, error)
  }
}

function rebindAllSubscriptions(): void {
  for (const [cacheKey, subscription] of subscriptionCache) {
    rebindSubscription(cacheKey, subscription)
  }
}

function createWatcherRoot(rootPath: string): WatcherRootRecord {
  const physicalRootPath = getExistingWatcherRoot(rootPath)
  const existingPhysical = physicalWatcherReferences.get(physicalRootPath)
  const watcher = existingPhysical?.watcher ?? getProjectWatcher(physicalRootPath)
  if (existingPhysical) {
    existingPhysical.referenceCount += 1
  } else {
    physicalWatcherReferences.set(physicalRootPath, { watcher, referenceCount: 1 })
  }
  const record: WatcherRootRecord = {
    rootPath,
    physicalRootPath,
    watcher,
    referenceCount: 0,
    ready: Promise.resolve(),
    releaseRuntimeStatus: () => {},
  }
  watcherRoots.set(rootPath, record)

  const forward: ProjectWatcherRuntimeStatusListener = () => {
    rebindAllSubscriptions()
    emitWatcherRuntimeStatus()
  }
  record.releaseRuntimeStatus = watcher.subscribeRuntimeStatus(forward, { emitCurrent: false })
  record.ready = watcher.init().then(() => {
    rebindAllSubscriptions()
    emitWatcherRuntimeStatus()
  })
  return record
}

async function releaseWatcherRootReference(record: WatcherRootRecord): Promise<void> {
  if (watcherRoots.get(record.rootPath) !== record || record.referenceCount === 0) return

  record.referenceCount -= 1
  if (record.referenceCount > 0) {
    emitWatcherRuntimeStatus()
    return
  }

  watcherRoots.delete(record.rootPath)
  record.releaseRuntimeStatus()
  rebindAllSubscriptions()

  const physical = physicalWatcherReferences.get(record.physicalRootPath)
  if (!physical || physical.referenceCount <= 0) {
    emitWatcherRuntimeStatus()
    return
  }
  physical.referenceCount -= 1
  if (physical.referenceCount > 0) {
    emitWatcherRuntimeStatus()
    return
  }
  physicalWatcherReferences.delete(record.physicalRootPath)

  const closing = record.watcher.close().finally(() => {
    if (closingWatcherRoots.get(record.rootPath) === closing) {
      closingWatcherRoots.delete(record.rootPath)
    }
    if (closingPhysicalWatchers.get(record.physicalRootPath) === closing) {
      closingPhysicalWatchers.delete(record.physicalRootPath)
    }
    emitWatcherRuntimeStatus()
  })
  closingWatcherRoots.set(record.rootPath, closing)
  closingPhysicalWatchers.set(record.physicalRootPath, closing)
  emitWatcherRuntimeStatus()
  await closing
}

/** Acquire one physical observation root and release it when the returned lease is no longer used. */
export async function acquireWatcherRoot(rootPath: string): Promise<WatcherRootRelease> {
  const normalizedRoot = getRealPath(rootPath)
  const physicalRootPath = getExistingWatcherRoot(normalizedRoot)
  await Promise.all([
    closingWatcherRoots.get(normalizedRoot),
    closingPhysicalWatchers.get(physicalRootPath),
  ])

  const record = watcherRoots.get(normalizedRoot) ?? createWatcherRoot(normalizedRoot)
  record.referenceCount += 1
  emitWatcherRuntimeStatus()

  try {
    await record.ready
  } catch (error) {
    await releaseWatcherRootReference(record)
    throw error
  }

  let released = false
  return async () => {
    if (released) return
    released = true
    await releaseWatcherRootReference(record)
  }
}

/**
 * Acquire a shared path subscription.
 *
 * The subscription remains pending when no active root contains the path and binds automatically
 * after a matching root is acquired. This keeps static reads inert without making later live reads
 * permanently lose observation.
 */
export function acquireWatcher(
  path: string,
  onChange: () => void,
  options: {
    recursive?: boolean
    debounceMs?: number
    onError?: () => void
    watchAncestorsWhileMissing?: boolean
  } = {}
): () => void {
  const normalizedPath = getRealPath(path)
  const recursive = options.recursive ?? false
  const watchAncestorsWhileMissing = options.watchAncestorsWhileMissing ?? false
  const cacheKey = `${normalizedPath}:${recursive}:${watchAncestorsWhileMissing}`
  let subscription = subscriptionCache.get(cacheKey)

  if (!subscription) {
    subscription = {
      path: normalizedPath,
      recursive,
      watchAncestorsWhileMissing,
      debounceMs: options.debounceMs ?? DEBOUNCE_MS,
      callbacks: new Set(),
      rootPath: null,
      unsubscribe: null,
      onError: options.onError,
    }
    subscriptionCache.set(cacheKey, subscription)
    rebindSubscription(cacheKey, subscription)
  }

  subscription.callbacks.add(onChange)
  let released = false
  return () => {
    if (released) return
    released = true
    const current = subscriptionCache.get(cacheKey)
    if (!current) return
    current.callbacks.delete(onChange)
    if (current.callbacks.size > 0) return

    current.unsubscribe?.()
    subscriptionCache.delete(cacheKey)
    const timer = debounceTimers.get(cacheKey)
    if (timer) {
      clearTimeout(timer)
      debounceTimers.delete(cacheKey)
    }
  }
}

export function getActiveWatcherCount(): number {
  return subscriptionCache.size
}

/** Close the entire process-level pool. Intended for runtime teardown and test isolation. */
export async function closeAllWatchers(): Promise<void> {
  for (const [cacheKey, subscription] of subscriptionCache) {
    subscription.unsubscribe?.()
    const timer = debounceTimers.get(cacheKey)
    if (timer) clearTimeout(timer)
  }
  subscriptionCache.clear()
  debounceTimers.clear()

  const records = [...watcherRoots.values()]
  watcherRoots.clear()
  for (const record of records) {
    record.referenceCount = 0
    record.releaseRuntimeStatus()
  }
  const physicalWatchers = [...physicalWatcherReferences.values()].map(({ watcher }) => watcher)
  physicalWatcherReferences.clear()
  await Promise.all([
    ...physicalWatchers.map((watcher) => watcher.close()),
    ...closingWatcherRoots.values(),
    ...closingPhysicalWatchers.values(),
  ])
  closingWatcherRoots.clear()
  closingPhysicalWatchers.clear()
  await closeAllProjectWatchers()
  emitWatcherRuntimeStatus()
}

export function isWatcherPoolInitialized(): boolean {
  return [...watcherRoots.values()].some((root) => root.watcher.isInitialized)
}

export function getWatcherRuntimeStatus(): WatcherRuntimeStatus | null {
  const roots = [...watcherRoots.values()]
    .filter((root) => root.referenceCount > 0)
    .map((root): WatcherRootRuntimeStatus => {
      const runtime = root.watcher.runtimeStatus
      return {
        rootPath: root.rootPath,
        referenceCount: root.referenceCount,
        initialized: root.watcher.isInitialized,
        subscriptionCount: root.watcher.subscriptionCount,
        generation: runtime.generation,
        reinitializeCount: runtime.reinitializeCount,
        lastReinitializeReason: runtime.lastReinitializeReason,
        reinitializeReasonCounts: runtime.reinitializeReasonCounts,
        projectResidency: runtime.projectResidency,
      }
    })
    .sort((left, right) => left.rootPath.localeCompare(right.rootPath))

  if (roots.length === 0) return null
  return {
    initialized: roots.some((root) => root.initialized),
    rootCount: roots.length,
    subscriptionCount: roots.reduce((count, root) => count + root.subscriptionCount, 0),
    roots,
  }
}

export function subscribeWatcherRuntimeStatus(
  listener: (status: WatcherRuntimeStatus | null) => void,
  options: { emitCurrent?: boolean } = {}
): () => void {
  watcherRuntimeStatusListeners.add(listener)
  if (options.emitCurrent !== false) {
    listener(getWatcherRuntimeStatus())
  }
  return () => {
    watcherRuntimeStatusListeners.delete(listener)
  }
}
