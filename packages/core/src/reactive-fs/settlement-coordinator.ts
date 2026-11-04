/**
 * Orthogonal intents (created 2026-11-04 Asia/Shanghai):
 * 1. Serialize settlement passes per normalized root, so arm, attach, pooled, and one-shot
 *    producers share one process-level scheduler instead of racing each other.
 * 2. Join a request that arrives before a pass begins reading, and derive exactly one trailing
 *    pass for a request that arrives during a read phase — never a join-and-discard, and never an
 *    unbounded `while (dirty)` chain.
 * 3. Resolve a request only after the pass that serves it has committed, including a trailing pass.
 * 4. Own no timer at all: the pooled cadence is a separate slice, and this module keeps the seam
 *    (`getSettlementDiagnostics`) it will publish through.
 * 5. Expose a test-only gate at every pass's read-phase entry, so read-phase interleavings are
 *    constructed deterministically instead of being slept into.
 *
 * Why a third module: `reactive-fs` owns the registrations and must not import a scheduler, and
 * `watcher-pool` must not import `reactive-fs` (that would close an import cycle). This module
 * therefore imports **nothing** from either: the pass body is injected once at wiring time
 * (`registerSettlementRunner`, called by `reactive-fs` after it defines the primitive), so the
 * dependency graph stays acyclic — both sides point here, this points nowhere.
 *
 * Original request (2026-11-04): "关于'已知缺口'和需要我决策的问题。请白话解释一下"
 * Owner decision (2026-11-04): "修肯定是要修的，只不过你手工打补丁的方式肯定不如社区成熟度高的方案"
 *   — fix-reactive-fs-settlement S1: the per-process settlement coordinator.
 */

/** Re-reads the registered reads under a normalized root and reports how many it re-read. */
export type SettlementRunner = (normalizedRootPath: string) => Promise<number>

let settlementRunner: SettlementRunner | null = null

/**
 * Wire the pass body. Called by `reactive-fs` once, so this module never imports it (a direct import
 * would close the `reactive-fs → watcher-pool → coordinator → reactive-fs` cycle).
 */
export function registerSettlementRunner(runner: SettlementRunner): void {
  settlementRunner = runner
}

/** One request waiting for the pass that will serve it. */
interface SettlementWaiter {
  resolve: () => void
}

interface SettlementPassState {
  /**
   * True from the read-phase entry until this pass has committed and released its waiters. A
   * request that observes `true` can no longer be satisfied by this pass's reads (its `prepare`
   * phase already began), so it must be served by a trailing pass.
   */
  reading: boolean
  /** Requests this pass promises to satisfy after its commit. */
  waiters: SettlementWaiter[]
}

interface RootSettlementState {
  /** The pass currently running (or created and about to begin reading). */
  activePass: SettlementPassState | null
  /** The single derived pass that will run after `activePass` completes. */
  queuedPass: SettlementPassState | null
  /** Passes started for this root since it last went idle; also the hook's 1-based `passIndex`. */
  passCount: number
}

/** Per-root coordinator state; deleted as soon as the root has nothing in flight. */
const rootSettlementStates = new Map<string, RootSettlementState>()

/**
 * Test-only gate, invoked at the entry of every pass's read phase (after the pass has committed to
 * reading and before any registered read runs). Awaiting the returned promise holds the pass inside
 * its read phase; `passIndex` identifies which pass of the burst is being held. `null` (the
 * default) costs one boolean test per pass.
 */
export type SettlementPassHook = (event: SettlementPassHookEvent) => void | Promise<void>

export interface SettlementPassHookEvent {
  /** Normalized root this pass settles — the same space `requestSettlement` accepts. */
  rootPath: string
  /** 1-based index of this pass within the root's current burst. */
  passIndex: number
  /** Resolves after this pass has committed and released its waiters. */
  completed: Promise<void>
}

let settlementPassHook: SettlementPassHook | null = null

/**
 * Install (or clear) the read-phase gate used by deterministic tests. Nothing in production
 * installs one; see `SettlementPassHook`.
 */
export function setSettlementPassHookForTests(hook: SettlementPassHook | null): void {
  settlementPassHook = hook
}

export interface SettlementDiagnostics {
  /**
   * Settlement timers owned by this coordinator. S1 owns none — the pooled periodic pass arrives
   * with S3, and this accessor stays the single seam that slice (and its checkpoint) asserts
   * through.
   */
  activeTimers: number
  /** Roots currently owing work (an in-flight or derived pass). Observation only. */
  busyRootCount: number
}

/** Read-only settlement scheduler state, for diagnostics and the pooled slice's assertions. */
export function getSettlementDiagnostics(): SettlementDiagnostics {
  return { activeTimers: 0, busyRootCount: rootSettlementStates.size }
}

function createPassState(): SettlementPassState {
  return { reading: false, waiters: [] }
}

function getOrCreateRootState(normalizedRootPath: string): RootSettlementState {
  const existing = rootSettlementStates.get(normalizedRootPath)
  if (existing) return existing
  const created: RootSettlementState = { activePass: null, queuedPass: null, passCount: 0 }
  rootSettlementStates.set(normalizedRootPath, created)
  return created
}

/**
 * Re-read every registered read under one **normalized** root, serialized per root.
 *
 * The returned promise resolves once the pass that serves this request has committed (a trailing
 * pass when this request arrived during another pass's read phase), and it never rejects: a
 * settlement pass is recovery work that every caller — three of them fire-and-forget — must be
 * able to ignore without an unhandled rejection.
 */
export function requestSettlement(normalizedRootPath: string): Promise<void> {
  const state = getOrCreateRootState(normalizedRootPath)
  return new Promise<void>((resolve) => {
    // Invariant (b): an existing pass that has not begun reading can still serve this request.
    // A derived trailing pass is a pass that has not begun reading either, so requests can join it.
    const joinable =
      state.queuedPass ??
      (state.activePass !== null && !state.activePass.reading ? state.activePass : null)
    if (joinable) {
      joinable.waiters.push({ resolve })
      return
    }

    // Invariant (c)/(d): the active pass is inside its read phase, so this request derives exactly
    // one trailing pass. A request arriving during that pass's read phase derives one more; each
    // request derives at most one pass and passes stay serialized, so there is no unbounded chain.
    if (state.activePass !== null) {
      const trailing = createPassState()
      state.queuedPass = trailing
      trailing.waiters.push({ resolve })
      return
    }

    const pass = createPassState()
    state.activePass = pass
    pass.waiters.push({ resolve })
    void runSettlementPass(normalizedRootPath, state, pass)
  })
}

async function runSettlementPass(
  rootPath: string,
  state: RootSettlementState,
  pass: SettlementPassState
): Promise<void> {
  // Yield one microtask before the read phase begins. Requests issued in the same turn as this
  // pass's creation must join it (invariant b) rather than derive a trailing pass that repeats the
  // reads this pass is about to perform. This is what makes "begins reading" an observable
  // boundary instead of "was created".
  await Promise.resolve()

  pass.reading = true
  state.passCount += 1
  const passIndex = state.passCount
  let markCompleted: (() => void) | null = null

  try {
    if (settlementPassHook) {
      let resolveCompleted!: () => void
      const completed = new Promise<void>((resolve) => {
        resolveCompleted = resolve
      })
      markCompleted = resolveCompleted
      await settlementPassHook({ rootPath, passIndex, completed })
    }
    if (!settlementRunner) throw new Error('settlement runner is not registered')
    await settlementRunner(rootPath)
  } catch (error) {
    // Recovery work: a failing registration (or a throwing gate) must not reject a promise that a
    // fire-and-forget caller never observes, and must not strand this root's queue.
    console.error(`[settlement-coordinator] Settlement pass failed for ${rootPath}:`, error)
  }

  finishSettlementPass(rootPath, state, pass, markCompleted)
}

function finishSettlementPass(
  rootPath: string,
  state: RootSettlementState,
  pass: SettlementPassState,
  markCompleted: (() => void) | null
): void {
  pass.reading = false
  // Invariant (e): every waiter is released only now — after the reads were committed above and
  // before the derived pass starts, so a continuation can never observe a partial state.
  const waiters = pass.waiters.splice(0)
  for (const waiter of waiters) waiter.resolve()
  markCompleted?.()

  const queued = state.queuedPass
  state.queuedPass = null
  if (queued) {
    state.activePass = queued
    void runSettlementPass(rootPath, state, queued)
    return
  }

  state.activePass = null
  if (rootSettlementStates.get(rootPath) === state) {
    rootSettlementStates.delete(rootPath)
  }
}
