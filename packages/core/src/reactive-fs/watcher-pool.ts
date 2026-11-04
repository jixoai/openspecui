/**
 * Orthogonal intents (updated 2026-11-04 Asia/Shanghai):
 * 1. Own a reference-counted dynamic set of physical watcher roots, including missing logical roots
 *    through their nearest existing ancestor.
 * 2. Bind shared path subscriptions to the deepest active containing root.
 * 3. Rebind pending subscriptions when roots appear, disappear, or recover.
 * 4. Expose aggregate and per-root runtime status for server diagnostics.
 * 5. Keep missing-path ancestor settlement explicit in subscription identity and retire every
 *    physical subscription plus cached ProjectWatcher during full teardown.
 * 6. Settle registered reads after a 0 -> 1 arm and after a completed rebuild, so a projection
 *    whose events went missing converges without waiting for an unrelated subtree change.
 * 7. Own the single process-level settlement interval that re-reads leased roots on a cadence:
 *    it exists only while a lease does, its delay is the exact cadence (jitter lands in per-tick
 *    scheduling), and it is stopped by the last release and by full teardown alike.
 *
 * Original request (2026-07-15): "响应式内核要观察 data home、Store roots 和 connected project roots。"
 * Remote CI fixed point (2026-07-28): data-home Schema creation may arrive as an ancestor event on Linux.
 * Original request (2026-11-04): "关于'已知缺口'和需要我决策的问题。请白话解释一下"
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
import {
  isSettlementInFlight,
  registerSettlementTimerCountProvider,
  requestSettlement,
} from './settlement-coordinator.js'

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
/** One completed-rebuild listener per physical watcher, released with its physical reference. */
const physicalReinitializedReleases = new Map<string, () => void>()
const closingPhysicalWatchers = new Map<string, Promise<void>>()
const subscriptionCache = new Map<string, PathSubscription>()
const debounceTimers = new Map<string, NodeJS.Timeout>()
const watcherRuntimeStatusListeners = new Set<(status: WatcherRuntimeStatus | null) => void>()

/** Cadence seam: tests must never wait on the production period. Read when the interval starts. */
const SETTLEMENT_INTERVAL_ENV = 'OPENSPECUI_SETTLEMENT_INTERVAL_MS'
const DEFAULT_SETTLEMENT_INTERVAL_MS = 45_000

/**
 * Upper bound for one tick's jitter. Jitter is applied to the scheduling of each tick's pass —
 * never to the interval's own delay — so the pooled interval keeps one fixed, assertable cadence
 * while passes still spread out across processes that start at the same phase. The bound is capped
 * by the cadence so a deferred pass cannot outlive the next tick.
 */
const SETTLEMENT_JITTER_MAX_MS = 5_000

/** The one process-level settlement interval; it exists only while at least one root lease does. */
let settlementInterval: NodeJS.Timeout | null = null
/** A tick's jittered pass dispatch; cancelled with the interval, so no net work outlives a lease. */
let settlementTickTimer: NodeJS.Timeout | null = null
/** Cadence captured when the interval starts, so a later env change cannot retune a live timer. */
let settlementCadenceMs = DEFAULT_SETTLEMENT_INTERVAL_MS
/**
 * 0 or 1, published to the coordinator's diagnostics. It is an observation of the interval above,
 * never a second scheduling authority: `start/stopSettlementInterval` are the only writers.
 */
let activeSettlementTimers = 0

// The pooled interval lives here (S3); the coordinator only reports it. Read-only accessor, so the
// diagnostics entry point cannot become a source of truth of its own.
registerSettlementTimerCountProvider(() => activeSettlementTimers)

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

/**
 * Request one settlement pass for a leased logical root.
 *
 * Fire-and-forget by design (triggers 1 and 3 of fix-reactive-fs-settlement S1): these are recovery
 * passes traced to no caller, so folding them into `record.ready` would lengthen every lease
 * acquisition and would turn a pass failure into a lease failure. The rejection guard is still
 * required — a caller with nobody to await it must not leak an unhandled rejection.
 */
function requestSettlementForRoot(rootPath: string): void {
  void requestSettlement(rootPath).catch((error) => {
    console.error(`[watcher-pool] Settlement failed for ${rootPath}:`, error)
  })
}

/** Settle every logical root currently bound to one physical watcher (trigger 3). */
function settleLogicalRootsOfWatcher(watcher: ProjectWatcher): void {
  for (const [rootPath, record] of watcherRoots) {
    if (record.watcher !== watcher) continue
    requestSettlementForRoot(rootPath)
  }
}

function readSettlementCadenceMs(): number {
  const raw = process.env[SETTLEMENT_INTERVAL_ENV]
  const parsed = raw === undefined || raw.trim() === '' ? Number.NaN : Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SETTLEMENT_INTERVAL_MS
}

function hasLeasedRoot(): boolean {
  for (const record of watcherRoots.values()) {
    if (record.referenceCount > 0) return true
  }
  return false
}

/**
 * One pooled settlement tick (S3): for every currently leased logical root, request a pass — and
 * skip a root that already owes one, because `requestSettlement` there would only derive a
 * redundant trailing pass for reads the in-flight pass is re-reading anyway. Roots are visited
 * sequentially; each request is fire-and-forget exactly like the arm and rebuild triggers.
 */
function runSettlementTick(): void {
  for (const [rootPath, record] of watcherRoots) {
    if (record.referenceCount <= 0) continue
    if (isSettlementInFlight(rootPath)) continue
    requestSettlementForRoot(rootPath)
  }
}

/** Per-tick jitter: the pass is scheduled a little later, the interval itself never changes delay. */
function scheduleSettlementTick(): void {
  const jitterMs = Math.floor(
    Math.random() * Math.min(settlementCadenceMs, SETTLEMENT_JITTER_MAX_MS)
  )
  settlementTickTimer = setTimeout(() => {
    settlementTickTimer = null
    runSettlementTick()
  }, jitterMs)
  settlementTickTimer.unref?.()
}

function startSettlementIntervalIfNeeded(): void {
  if (settlementInterval) return
  // Read at interval start (never at module load), so a test or operator that sets the seam before
  // the first lease controls this process's cadence.
  settlementCadenceMs = readSettlementCadenceMs()
  settlementInterval = setInterval(scheduleSettlementTick, settlementCadenceMs)
  settlementInterval.unref?.()
  activeSettlementTimers = 1
}

function stopSettlementInterval(): void {
  if (settlementTickTimer) {
    clearTimeout(settlementTickTimer)
    settlementTickTimer = null
  }
  if (!settlementInterval) return
  clearInterval(settlementInterval)
  settlementInterval = null
  activeSettlementTimers = 0
}

/** First lease starts the pooled interval, the last release stops it. Idempotent both ways. */
function syncSettlementIntervalWithLeases(): void {
  if (hasLeasedRoot()) startSettlementIntervalIfNeeded()
  else stopSettlementInterval()
}

function createWatcherRoot(rootPath: string): WatcherRootRecord {
  const physicalRootPath = getExistingWatcherRoot(rootPath)
  const existingPhysical = physicalWatcherReferences.get(physicalRootPath)
  const watcher = existingPhysical?.watcher ?? getProjectWatcher(physicalRootPath)
  if (existingPhysical) {
    existingPhysical.referenceCount += 1
  } else {
    physicalWatcherReferences.set(physicalRootPath, { watcher, referenceCount: 1 })
    // Trigger 3 of fix-reactive-fs-settlement S1: a *completed* rebuild means the native watcher
    // is armed again but has no backlog, so everything it missed must be re-read through the
    // settlement net. One listener per physical watcher settles every logical root bound to it,
    // and it hangs off the physical reference so it cannot outlive the watcher's last user.
    physicalReinitializedReleases.set(
      physicalRootPath,
      watcher.subscribeReinitialized(() => {
        settleLogicalRootsOfWatcher(watcher)
      })
    )
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
  try {
    await releaseWatcherRootReferenceInternal(record)
  } finally {
    // Every exit — early returns included — must leave the pooled interval matching the real lease
    // count, so a released last lease always stops it.
    syncSettlementIntervalWithLeases()
  }
}

async function releaseWatcherRootReferenceInternal(record: WatcherRootRecord): Promise<void> {
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
  physicalReinitializedReleases.get(record.physicalRootPath)?.()
  physicalReinitializedReleases.delete(record.physicalRootPath)

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

  const existingRecord = watcherRoots.get(normalizedRoot)
  const record = existingRecord ?? createWatcherRoot(normalizedRoot)
  record.referenceCount += 1
  // The lease exists from this increment on, so the pooled settlement interval is the first lease's
  // responsibility (`referenceCount` 0 -> 1) and only this increment can start it.
  syncSettlementIntervalWithLeases()
  emitWatcherRuntimeStatus()

  try {
    await record.ready
  } catch (error) {
    await releaseWatcherRootReference(record)
    throw error
  }

  if (!existingRecord) {
    // Trigger 1 of fix-reactive-fs-settlement S1: the first lease on a root (0 -> 1) settles the
    // registered reads that root now covers. It is issued after `record.ready` resolves and before
    // this lease returns, but it is not awaited — see `requestSettlementForRoot`.
    requestSettlementForRoot(normalizedRoot)
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
  // This path clears the registry instead of releasing leases, so it bypasses
  // `releaseWatcherRootReference` and must stop the pooled interval explicitly.
  stopSettlementInterval()

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
  for (const releaseReinitialized of physicalReinitializedReleases.values()) {
    releaseReinitialized()
  }
  physicalReinitializedReleases.clear()
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
