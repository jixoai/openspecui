/**
 * Orthogonal intents (created 2026-07-26 Asia/Shanghai):
 * 1. Translate Root Context route fixtures into the public CLI Projection Pull lifecycle.
 * 2. Build data-free lifecycle notices without bypassing the production hook's typed decoder.
 *
 * Original request (2026-07-26): "展开全面的接口升级和内核升级和测试升级。"
 */
import type { RootContextState } from '@openspecui/core'
import type {
  HostedCliProjectionNotice,
  HostedRootContextProjectionState,
  HostedRootContextResolvedState,
} from '@openspecui/core/hosted-contract'
import { HostedRootContextResolvedStateSchema } from '@openspecui/core/hosted-contract'

/** tRPC callback shape consumed by the production Root Projection subscription hook. */
export interface RootProjectionFixtureCallbacks {
  onData(data: HostedCliProjectionNotice): void
  onError(error: Error): void
  onConnectionStateChange?(state: {
    state: 'idle' | 'connecting' | 'pending'
    error: Error | null
  }): void
  onStopped?(): void
  onComplete?(): void
}

const IDENTITY = 'root-context:web-route-fixture'

function settledState(state: RootContextState): HostedRootContextResolvedState {
  if (state.state === 'ready' || state.state === 'error') {
    return HostedRootContextResolvedStateSchema.parse(state)
  }
  if (state.state === 'refreshing') {
    return HostedRootContextResolvedStateSchema.parse({
      state: 'ready',
      data: state.data,
      attempt: null,
      error: null,
      observedAt: state.observedAt,
    })
  }
  throw new Error('A loading Root Context has no settled projection snapshot.')
}

/** Build the immediate typed Pull result for one legacy Root route fixture state. */
export function createRootProjectionFixture(
  state: RootContextState,
  workGeneration = 1
): HostedRootContextProjectionState {
  if (state.state === 'loading') {
    return {
      state: 'loading',
      identity: IDENTITY,
      workGeneration,
      invalidationCause: 'initial',
      data: null,
      freshness: null,
      snapshotGeneration: null,
      error: null,
    }
  }
  if (state.state === 'refreshing') {
    return {
      state: 'revalidating',
      identity: IDENTITY,
      workGeneration,
      invalidationCause: 'dependency',
      data: settledState(state),
      freshness: 'stale-display-only',
      snapshotGeneration: Math.max(0, workGeneration - 1),
      error: null,
    }
  }
  if (state.state === 'error') {
    return state.data
      ? {
          state: 'refresh-error',
          identity: IDENTITY,
          workGeneration,
          invalidationCause: 'dependency',
          data: settledState(state),
          freshness: 'stale-display-only',
          snapshotGeneration: Math.max(0, workGeneration - 1),
          error: {
            name: 'RootContextError',
            message: state.error.message,
            cliEvidence: null,
          },
        }
      : {
          state: 'error',
          identity: IDENTITY,
          workGeneration,
          invalidationCause: 'initial',
          data: null,
          freshness: null,
          snapshotGeneration: null,
          error: {
            name: 'RootContextError',
            message: state.error.message,
            cliEvidence: null,
          },
        }
  }
  return {
    state: 'ready',
    identity: IDENTITY,
    workGeneration,
    invalidationCause: 'initial',
    data: settledState(state),
    freshness: 'current',
    snapshotGeneration: workGeneration,
    error: null,
  }
}

/** Build the lifecycle-only wake corresponding to a fixture's typed Pull state. */
export function createRootProjectionNoticeFixture(
  state: RootContextState,
  workGeneration = 1
): HostedCliProjectionNotice {
  const projection = createRootProjectionFixture(state, workGeneration)
  return {
    identity: projection.identity,
    workGeneration: projection.workGeneration,
    snapshotGeneration: projection.snapshotGeneration,
    state: projection.state,
    invalidationCause: projection.invalidationCause,
  }
}
