/**
 * Orthogonal intents (created 2026-07-22 Asia/Shanghai):
 * 1. Own bounded, process-local phase samples for prepared route navigation.
 * 2. Retire superseded attempts within one route area without coupling areas.
 * 3. Expose typed read and clear boundaries for focused evidence and future diagnostics.
 *
 * Original request (2026-07-22): "整个过程中，几乎都在 Loading，切换个页面也等，做任何动作也在等，给我的感觉就是非常卡。"
 */
import type { VTArea } from './route-semantics'

const MAX_SAMPLE_AGE_MS = 30 * 60 * 1000
const MAX_SAMPLE_COUNT = 256

/** Preparation result recorded before a route update can be invoked. */
export type NavigationPrepareOutcome = 'ready' | 'cancelled' | 'skip-vt'

/** First phase of every measured navigation attempt. */
export interface NavigationRequestedPhase {
  readonly kind: 'requested'
  readonly at: number
  readonly elapsedMs: 0
}

/** Preparation phase that permits route execution. */
export interface NavigationPreparedPhase {
  readonly kind: 'prepare-settled'
  readonly outcome: 'ready' | 'skip-vt'
  readonly at: number
  readonly elapsedMs: number
}

/** Preparation phase that ends the attempt before any route update. */
export interface NavigationCancelledPhase {
  readonly kind: 'prepare-settled'
  readonly outcome: 'cancelled'
  readonly at: number
  readonly elapsedMs: number
}

/** Phase recorded immediately after the real route update callback returns. */
export interface NavigationRouteCommittedPhase {
  readonly kind: 'route-committed'
  readonly at: number
  readonly elapsedMs: number
}

/** Final phase recorded only after the View Transition promise settles. */
export interface NavigationTransitionSettledPhase {
  readonly kind: 'transition-settled'
  readonly at: number
  readonly elapsedMs: number
}

interface NavigationTimingSampleBase {
  readonly attemptId: string
  readonly area: VTArea
  readonly fromPath: string
  readonly toPath: string
}

/** Attempt that has not yet completed detail preparation. */
export interface NavigationRequestedSample extends NavigationTimingSampleBase {
  readonly state: 'requested'
  readonly phases: readonly [NavigationRequestedPhase]
}

/** Prepared attempt that may now invoke the real route update. */
export interface NavigationPreparedSample extends NavigationTimingSampleBase {
  readonly state: 'prepared'
  readonly outcome: 'ready' | 'skip-vt'
  readonly phases: readonly [NavigationRequestedPhase, NavigationPreparedPhase]
}

/** Cancelled attempt whose type excludes route-commit and transition-settlement facts. */
export interface NavigationCancelledSample extends NavigationTimingSampleBase {
  readonly state: 'cancelled'
  readonly outcome: 'cancelled'
  readonly phases: readonly [NavigationRequestedPhase, NavigationCancelledPhase]
}

/** Prepared attempt whose real route update has returned. */
export interface NavigationRouteCommittedSample extends NavigationTimingSampleBase {
  readonly state: 'route-committed'
  readonly outcome: 'ready' | 'skip-vt'
  readonly phases: readonly [
    NavigationRequestedPhase,
    NavigationPreparedPhase,
    NavigationRouteCommittedPhase,
  ]
}

/** Completed attempt whose View Transition promise has settled. */
export interface NavigationTransitionSettledSample extends NavigationTimingSampleBase {
  readonly state: 'transition-settled'
  readonly outcome: 'ready' | 'skip-vt'
  readonly phases: readonly [
    NavigationRequestedPhase,
    NavigationPreparedPhase,
    NavigationRouteCommittedPhase,
    NavigationTransitionSettledPhase,
  ]
}

/** A causally valid local navigation sample. Cancellation cannot expose commit or settlement phases. */
export type NavigationTimingSample =
  | NavigationRequestedSample
  | NavigationPreparedSample
  | NavigationCancelledSample
  | NavigationRouteCommittedSample
  | NavigationTransitionSettledSample

/** Imperative recorder held only by the production navigation coordinator for one attempt. */
export interface NavigationTimingAttempt {
  readonly attemptId: string
  recordPrepareSettled(outcome: NavigationPrepareOutcome): boolean
  recordRouteCommitted(): boolean
  recordTransitionSettled(): boolean
}

interface NavigationTimingStore {
  nextAttemptId: number
  samples: NavigationTimingSample[]
  currentAttemptIds: Map<VTArea, string>
}

const store: NavigationTimingStore = {
  nextAttemptId: 0,
  samples: [],
  currentAttemptIds: new Map(),
}

function trimSamples(now: number): void {
  const cutoff = now - MAX_SAMPLE_AGE_MS
  store.samples = store.samples
    .filter((sample) => sample.phases[0].at >= cutoff)
    .slice(-MAX_SAMPLE_COUNT)
}

function replaceSample(attemptId: string, sample: NavigationTimingSample): void {
  const index = store.samples.findIndex((candidate) => candidate.attemptId === attemptId)
  if (index >= 0) {
    store.samples[index] = sample
  }
}

function publishSample(area: VTArea, attemptId: string, sample: NavigationTimingSample): void {
  replaceSample(attemptId, sample)
  store.currentAttemptIds.set(area, attemptId)
}

function isCurrentAttempt(area: VTArea, attemptId: string): boolean {
  return store.currentAttemptIds.get(area) === attemptId
}

function now(): number {
  return performance.now()
}

/** Start one locally timed route navigation attempt and retire older attempts in the same area. */
export function startNavigationTimingAttempt(input: {
  area: VTArea
  fromPath: string
  toPath: string
}): NavigationTimingAttempt {
  const requestedAt = now()
  trimSamples(requestedAt)
  if (store.samples.length >= MAX_SAMPLE_COUNT) {
    store.samples = store.samples.slice(-(MAX_SAMPLE_COUNT - 1))
  }
  const attemptId = `navigation-${store.nextAttemptId + 1}`
  store.nextAttemptId += 1
  const requestedPhase: NavigationRequestedPhase = {
    kind: 'requested',
    at: requestedAt,
    elapsedMs: 0,
  }
  const requested: NavigationRequestedSample = {
    attemptId,
    area: input.area,
    fromPath: input.fromPath,
    toPath: input.toPath,
    state: 'requested',
    phases: [requestedPhase],
  }
  store.samples.push(requested)
  store.currentAttemptIds.set(input.area, attemptId)

  return {
    attemptId,
    recordPrepareSettled(outcome) {
      if (!isCurrentAttempt(input.area, attemptId)) return false
      const current = store.samples.find((sample) => sample.attemptId === attemptId)
      if (!current || current.state !== 'requested') return false
      const at = now()
      if (outcome === 'cancelled') {
        const settled: NavigationCancelledPhase = {
          kind: 'prepare-settled',
          outcome,
          at,
          elapsedMs: at - current.phases[0].at,
        }
        const cancelled: NavigationCancelledSample = {
          ...current,
          state: 'cancelled',
          outcome,
          phases: [current.phases[0], settled],
        }
        publishSample(input.area, attemptId, cancelled)
        return true
      }
      const settled: NavigationPreparedPhase = {
        kind: 'prepare-settled',
        outcome,
        at,
        elapsedMs: at - current.phases[0].at,
      }
      const prepared: NavigationPreparedSample = {
        ...current,
        state: 'prepared',
        outcome,
        phases: [current.phases[0], settled],
      }
      publishSample(input.area, attemptId, prepared)
      return true
    },
    recordRouteCommitted() {
      if (!isCurrentAttempt(input.area, attemptId)) return false
      const current = store.samples.find((sample) => sample.attemptId === attemptId)
      if (!current || current.state !== 'prepared') return false
      const at = now()
      const committed: NavigationRouteCommittedPhase = {
        kind: 'route-committed',
        at,
        elapsedMs: at - current.phases[0].at,
      }
      const routeCommitted: NavigationRouteCommittedSample = {
        ...current,
        state: 'route-committed',
        phases: [current.phases[0], current.phases[1], committed],
      }
      publishSample(input.area, attemptId, routeCommitted)
      return true
    },
    recordTransitionSettled() {
      if (!isCurrentAttempt(input.area, attemptId)) return false
      const current = store.samples.find((sample) => sample.attemptId === attemptId)
      if (!current || current.state !== 'route-committed') return false
      const at = now()
      const settled: NavigationTransitionSettledPhase = {
        kind: 'transition-settled',
        at,
        elapsedMs: at - current.phases[0].at,
      }
      const transitionSettled: NavigationTransitionSettledSample = {
        ...current,
        state: 'transition-settled',
        phases: [current.phases[0], current.phases[1], current.phases[2], settled],
      }
      publishSample(input.area, attemptId, transitionSettled)
      trimSamples(at)
      return true
    },
  }
}

/** Read bounded recent navigation timing samples without persisting or emitting diagnostics. */
export function readNavigationTimingSamples(
  input: { limit?: number } = {}
): readonly NavigationTimingSample[] {
  trimSamples(now())
  const limit = Math.max(1, input.limit ?? MAX_SAMPLE_COUNT)
  return store.samples.slice(-limit)
}

/** Read the current sample for one independent route area. */
export function readCurrentNavigationTimingSample(area: VTArea): NavigationTimingSample | null {
  trimSamples(now())
  const attemptId = store.currentAttemptIds.get(area)
  if (!attemptId) return null
  return store.samples.find((sample) => sample.attemptId === attemptId) ?? null
}

/** Clear process-local samples and current attempts for focused tests. */
export function clearNavigationTimingSamples(): void {
  store.nextAttemptId = 0
  store.samples = []
  store.currentAttemptIds.clear()
}
