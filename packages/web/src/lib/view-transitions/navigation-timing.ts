/**
 * Orthogonal intents (updated 2026-07-22 Asia/Shanghai):
 * 1. Own bounded, process-local phase samples for prepared route navigation.
 * 2. Preserve superseded attempt history without changing latest-request provenance.
 * 3. Expose typed sample, failure, read, and clear boundaries for focused evidence.
 *
 * Original request (2026-07-22): "整个过程中，几乎都在 Loading，切换个页面也等，做任何动作也在等，给我的感觉就是非常卡。"
 * Independent review (2026-07-22): A discarded Router Promise cannot prove route/DOM commit, and ignored late A timing cannot describe a real late A route update.
 */
import type { VTArea } from './route-semantics'

const MAX_SAMPLE_AGE_MS = 30 * 60 * 1000
const MAX_SAMPLE_COUNT = 256
const MAX_ERROR_TEXT_LENGTH = 240

/** Preparation result recorded before the synchronous route update callback can be issued. */
export type NavigationPrepareOutcome = 'ready' | 'cancelled' | 'skip-vt'

/** Named owner of a terminal navigation failure. */
export type NavigationFailureStage = 'prepare' | 'route-update' | 'transition'

/** Bounded, non-stack error facts retained in a failed timing sample. */
export interface NavigationTimingErrorSummary {
  readonly name: string
  readonly message: string
}

/** First phase of every measured navigation attempt. */
export interface NavigationRequestedPhase {
  readonly kind: 'requested'
  readonly at: number
  readonly elapsedMs: 0
}

/** Preparation phase that permits the synchronous route update callback. */
export interface NavigationPreparedPhase {
  readonly kind: 'prepare-settled'
  readonly outcome: 'ready' | 'skip-vt'
  readonly at: number
  readonly elapsedMs: number
}

/** Preparation phase that ends an attempt before any route update callback. */
export interface NavigationCancelledPhase {
  readonly kind: 'prepare-settled'
  readonly outcome: 'cancelled'
  readonly at: number
  readonly elapsedMs: number
}

/** Phase recorded after the real synchronous route update callback returns. */
export interface NavigationRouteUpdateIssuedPhase {
  readonly kind: 'route-update-issued'
  readonly at: number
  readonly elapsedMs: number
}

/** Final phase recorded only after the View Transition promise settles. */
export interface NavigationTransitionSettledPhase {
  readonly kind: 'transition-settled'
  readonly at: number
  readonly elapsedMs: number
}

interface NavigationFailedPhaseBase {
  readonly kind: 'failed'
  readonly error: NavigationTimingErrorSummary
  readonly at: number
  readonly elapsedMs: number
}

/** Terminal phase recorded when detail preparation rejects. */
export interface NavigationPrepareFailedPhase extends NavigationFailedPhaseBase {
  readonly stage: 'prepare'
}

/** Terminal phase recorded when the synchronous route update callback throws. */
export interface NavigationRouteUpdateFailedPhase extends NavigationFailedPhaseBase {
  readonly stage: 'route-update'
}

/** Terminal phase recorded when View Transition execution rejects. */
export interface NavigationTransitionFailedPhase extends NavigationFailedPhaseBase {
  readonly stage: 'transition'
}

/** Typed terminal failure facts retained by a failed navigation sample. */
export type NavigationFailedPhase =
  | NavigationPrepareFailedPhase
  | NavigationRouteUpdateFailedPhase
  | NavigationTransitionFailedPhase

interface NavigationSampleIdentity {
  readonly attemptId: string
  readonly area: VTArea
  readonly fromPath: string
  readonly toPath: string
}

interface NavigationLatestRequestProvenance {
  readonly latestRequest: true
  readonly supersededByAttemptId: null
}

interface NavigationSupersededProvenance {
  readonly latestRequest: false
  readonly supersededByAttemptId: string
}

type NavigationRequestProvenance =
  | NavigationLatestRequestProvenance
  | NavigationSupersededProvenance

type NavigationSampleBase = NavigationSampleIdentity & NavigationRequestProvenance

/** Attempt that has not yet completed detail preparation. */
export type NavigationRequestedSample = NavigationSampleBase & {
  readonly state: 'requested'
  readonly phases: readonly [NavigationRequestedPhase]
}

/** Prepared attempt that may now invoke the real synchronous route update callback. */
export type NavigationPreparedSample = NavigationSampleBase & {
  readonly state: 'prepared'
  readonly outcome: 'ready' | 'skip-vt'
  readonly phases: readonly [NavigationRequestedPhase, NavigationPreparedPhase]
}

/** Cancelled attempt whose type excludes update, settlement, and failure-after-success phases. */
export type NavigationCancelledSample = NavigationSampleBase & {
  readonly state: 'cancelled'
  readonly outcome: 'cancelled'
  readonly phases: readonly [NavigationRequestedPhase, NavigationCancelledPhase]
}

/** Prepared attempt whose real synchronous update callback has returned. */
export type NavigationRouteUpdateIssuedSample = NavigationSampleBase & {
  readonly state: 'route-update-issued'
  readonly outcome: 'ready' | 'skip-vt'
  readonly phases: readonly [
    NavigationRequestedPhase,
    NavigationPreparedPhase,
    NavigationRouteUpdateIssuedPhase,
  ]
}

/** Completed attempt whose View Transition promise has settled. */
export type NavigationTransitionSettledSample = NavigationSampleBase & {
  readonly state: 'transition-settled'
  readonly outcome: 'ready' | 'skip-vt'
  readonly phases: readonly [
    NavigationRequestedPhase,
    NavigationPreparedPhase,
    NavigationRouteUpdateIssuedPhase,
    NavigationTransitionSettledPhase,
  ]
}

/** Failed attempt before a preparation outcome exists. */
export type NavigationPrepareFailedSample = NavigationSampleBase & {
  readonly state: 'failed'
  readonly failure: NavigationPrepareFailedPhase
  readonly phases: readonly [NavigationRequestedPhase, NavigationPrepareFailedPhase]
}

/** Failed attempt after preparation but before the update-issued fact exists. */
export type NavigationRouteUpdateFailedSample = NavigationSampleBase & {
  readonly state: 'failed'
  readonly failure: NavigationRouteUpdateFailedPhase
  readonly phases: readonly [
    NavigationRequestedPhase,
    NavigationPreparedPhase,
    NavigationRouteUpdateFailedPhase,
  ]
}

/** Failed transition before it invokes the synchronous update callback. */
export type NavigationTransitionFailedBeforeUpdateSample = NavigationSampleBase & {
  readonly state: 'failed'
  readonly failure: NavigationTransitionFailedPhase
  readonly phases: readonly [
    NavigationRequestedPhase,
    NavigationPreparedPhase,
    NavigationTransitionFailedPhase,
  ]
}

/** Failed transition after the synchronous update callback has returned. */
export type NavigationTransitionFailedAfterUpdateSample = NavigationSampleBase & {
  readonly state: 'failed'
  readonly failure: NavigationTransitionFailedPhase
  readonly phases: readonly [
    NavigationRequestedPhase,
    NavigationPreparedPhase,
    NavigationRouteUpdateIssuedPhase,
    NavigationTransitionFailedPhase,
  ]
}

/** Terminal failed attempt. Its discriminant excludes any successful outcome. */
export type NavigationFailedSample =
  | NavigationPrepareFailedSample
  | NavigationRouteUpdateFailedSample
  | NavigationTransitionFailedBeforeUpdateSample
  | NavigationTransitionFailedAfterUpdateSample

/** Ordered phase facts retained by a navigation timing sample. */
export type NavigationTimingPhase =
  | NavigationRequestedPhase
  | NavigationPreparedPhase
  | NavigationCancelledPhase
  | NavigationRouteUpdateIssuedPhase
  | NavigationTransitionSettledPhase
  | NavigationFailedPhase

/** A causally valid local navigation sample with latest-request provenance. */
export type NavigationTimingSample =
  | NavigationRequestedSample
  | NavigationPreparedSample
  | NavigationCancelledSample
  | NavigationRouteUpdateIssuedSample
  | NavigationTransitionSettledSample
  | NavigationFailedSample

/** Imperative recorder held only by the production navigation coordinator for one attempt. */
export interface NavigationTimingAttempt {
  readonly attemptId: string
  recordPrepareSettled(outcome: NavigationPrepareOutcome): boolean
  recordRouteUpdateIssued(): boolean
  recordTransitionSettled(): boolean
  recordPrepareFailed(error: unknown): boolean
  recordRouteUpdateFailed(error: unknown): boolean
  recordTransitionFailed(error: unknown): boolean
}

interface NavigationTimingStore {
  nextAttemptId: number
  samples: NavigationTimingSample[]
  latestRequestAttemptIds: Map<VTArea, string>
}

const store: NavigationTimingStore = {
  nextAttemptId: 0,
  samples: [],
  latestRequestAttemptIds: new Map(),
}

function now(): number {
  return performance.now()
}

function trimSamples(timestamp: number): void {
  const cutoff = timestamp - MAX_SAMPLE_AGE_MS
  store.samples = store.samples
    .filter((sample) => sample.phases[0]?.at >= cutoff)
    .slice(-MAX_SAMPLE_COUNT)
}

function replaceHistoricalSample(attemptId: string, sample: NavigationTimingSample): void {
  const index = store.samples.findIndex((candidate) => candidate.attemptId === attemptId)
  if (index >= 0) {
    store.samples[index] = sample
  }
}

function getSample(attemptId: string): NavigationTimingSample | null {
  return store.samples.find((sample) => sample.attemptId === attemptId) ?? null
}

function supersedeSample(
  sample: NavigationTimingSample,
  supersededByAttemptId: string
): NavigationTimingSample {
  if (!sample.latestRequest) return sample
  return {
    ...sample,
    latestRequest: false,
    supersededByAttemptId,
  }
}

function createErrorSummary(error: unknown): NavigationTimingErrorSummary {
  if (error instanceof Error) {
    return {
      name: error.name.slice(0, MAX_ERROR_TEXT_LENGTH) || 'Error',
      message: error.message.slice(0, MAX_ERROR_TEXT_LENGTH) || 'Error thrown without a message.',
    }
  }

  return {
    name: 'NonErrorThrown',
    message: 'A non-Error value was thrown.',
  }
}

function recordFailure(attemptId: string, stage: NavigationFailureStage, error: unknown): boolean {
  const sample = getSample(attemptId)
  if (
    !sample ||
    sample.state === 'cancelled' ||
    sample.state === 'transition-settled' ||
    sample.state === 'failed'
  ) {
    return false
  }
  const at = now()
  const errorSummary = createErrorSummary(error)

  if (stage === 'prepare') {
    if (sample.state !== 'requested') return false
    const failure: NavigationPrepareFailedPhase = {
      kind: 'failed',
      stage,
      error: errorSummary,
      at,
      elapsedMs: at - sample.phases[0].at,
    }
    const failed: NavigationPrepareFailedSample = {
      ...sample,
      state: 'failed',
      failure,
      phases: [sample.phases[0], failure],
    }
    replaceHistoricalSample(attemptId, failed)
    trimSamples(at)
    return true
  }

  if (stage === 'route-update') {
    if (sample.state !== 'prepared') return false
    const failure: NavigationRouteUpdateFailedPhase = {
      kind: 'failed',
      stage,
      error: errorSummary,
      at,
      elapsedMs: at - sample.phases[0].at,
    }
    const failed: NavigationRouteUpdateFailedSample = {
      ...sample,
      state: 'failed',
      failure,
      phases: [sample.phases[0], sample.phases[1], failure],
    }
    replaceHistoricalSample(attemptId, failed)
    trimSamples(at)
    return true
  }

  if (sample.state === 'prepared') {
    const failure: NavigationTransitionFailedPhase = {
      kind: 'failed',
      stage,
      error: errorSummary,
      at,
      elapsedMs: at - sample.phases[0].at,
    }
    const failed: NavigationTransitionFailedBeforeUpdateSample = {
      ...sample,
      state: 'failed',
      failure,
      phases: [sample.phases[0], sample.phases[1], failure],
    }
    replaceHistoricalSample(attemptId, failed)
    trimSamples(at)
    return true
  }

  if (sample.state === 'route-update-issued') {
    const failure: NavigationTransitionFailedPhase = {
      kind: 'failed',
      stage,
      error: errorSummary,
      at,
      elapsedMs: at - sample.phases[0].at,
    }
    const failed: NavigationTransitionFailedAfterUpdateSample = {
      ...sample,
      state: 'failed',
      failure,
      phases: [sample.phases[0], sample.phases[1], sample.phases[2], failure],
    }
    replaceHistoricalSample(attemptId, failed)
    trimSamples(at)
    return true
  }

  return false
}

/** Start an attempt and make it the only latest-request identity for its route area. */
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

  const priorLatestAttemptId = store.latestRequestAttemptIds.get(input.area)
  if (priorLatestAttemptId) {
    const priorLatestSample = getSample(priorLatestAttemptId)
    if (priorLatestSample) {
      replaceHistoricalSample(priorLatestAttemptId, supersedeSample(priorLatestSample, attemptId))
    }
  }

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
    latestRequest: true,
    supersededByAttemptId: null,
    state: 'requested',
    phases: [requestedPhase],
  }
  store.samples.push(requested)
  store.latestRequestAttemptIds.set(input.area, attemptId)

  return {
    attemptId,
    recordPrepareSettled(outcome) {
      const sample = getSample(attemptId)
      if (!sample || sample.state !== 'requested') return false
      const at = now()
      if (outcome === 'cancelled') {
        const settled: NavigationCancelledPhase = {
          kind: 'prepare-settled',
          outcome,
          at,
          elapsedMs: at - sample.phases[0].at,
        }
        const cancelled: NavigationCancelledSample = {
          ...sample,
          state: 'cancelled',
          outcome,
          phases: [sample.phases[0], settled],
        }
        replaceHistoricalSample(attemptId, cancelled)
        return true
      }

      const settled: NavigationPreparedPhase = {
        kind: 'prepare-settled',
        outcome,
        at,
        elapsedMs: at - sample.phases[0].at,
      }
      const prepared: NavigationPreparedSample = {
        ...sample,
        state: 'prepared',
        outcome,
        phases: [sample.phases[0], settled],
      }
      replaceHistoricalSample(attemptId, prepared)
      return true
    },
    recordRouteUpdateIssued() {
      const sample = getSample(attemptId)
      if (!sample || sample.state !== 'prepared') return false
      const at = now()
      const issued: NavigationRouteUpdateIssuedPhase = {
        kind: 'route-update-issued',
        at,
        elapsedMs: at - sample.phases[0].at,
      }
      const routeUpdateIssued: NavigationRouteUpdateIssuedSample = {
        ...sample,
        state: 'route-update-issued',
        phases: [sample.phases[0], sample.phases[1], issued],
      }
      replaceHistoricalSample(attemptId, routeUpdateIssued)
      return true
    },
    recordTransitionSettled() {
      const sample = getSample(attemptId)
      if (!sample || sample.state !== 'route-update-issued') return false
      const at = now()
      const settled: NavigationTransitionSettledPhase = {
        kind: 'transition-settled',
        at,
        elapsedMs: at - sample.phases[0].at,
      }
      const transitionSettled: NavigationTransitionSettledSample = {
        ...sample,
        state: 'transition-settled',
        phases: [sample.phases[0], sample.phases[1], sample.phases[2], settled],
      }
      replaceHistoricalSample(attemptId, transitionSettled)
      trimSamples(at)
      return true
    },
    recordPrepareFailed(error) {
      return recordFailure(attemptId, 'prepare', error)
    },
    recordRouteUpdateFailed(error) {
      return recordFailure(attemptId, 'route-update', error)
    },
    recordTransitionFailed(error) {
      return recordFailure(attemptId, 'transition', error)
    },
  }
}

/** Read bounded recent navigation timing samples without persistence or diagnostic emission. */
export function readNavigationTimingSamples(
  input: { limit?: number } = {}
): readonly NavigationTimingSample[] {
  trimSamples(now())
  const limit = Math.max(1, input.limit ?? MAX_SAMPLE_COUNT)
  return store.samples.slice(-limit)
}

/** Read the latest-request sample for one independent route area. */
export function readLatestNavigationTimingSample(area: VTArea): NavigationTimingSample | null {
  trimSamples(now())
  const attemptId = store.latestRequestAttemptIds.get(area)
  if (!attemptId) return null
  return getSample(attemptId)
}

/** Clear process-local samples and latest-request identities for focused tests. */
export function clearNavigationTimingSamples(): void {
  store.nextAttemptId = 0
  store.samples = []
  store.latestRequestAttemptIds.clear()
}
