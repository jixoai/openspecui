/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Project terminal cwd choices from the shared CLI-owned Root Context.
 * 2. Keep launch-project creation available while planning-root creation requires current ready data.
 * 3. Expose only server-observed paths and objective unavailability reasons.
 *
 * Original request (2026-07-16): "Terminal exposes explicit launch-project cwd and planning-root cwd."
 */
import type { RootContextState, TerminalCwdTarget } from '@openspecui/core'
import { useContextSubscription } from './use-context-subscription'

export interface TerminalCwdTargetOption {
  target: TerminalCwdTarget
  label: string
  path: string | null
  available: boolean
  unavailableReason: string | null
}

export interface TerminalCwdTargetState {
  launchProject: TerminalCwdTargetOption
  planningRoot: TerminalCwdTargetOption
}

interface SelectTerminalCwdTargetStateInput {
  projection: RootContextState | undefined
  isLoading: boolean
  transportError: Error | null
}

function selectObservedLaunchPath(projection: RootContextState | undefined): string | null {
  if (!projection || projection.state === 'loading') return null
  if (projection.state === 'error') {
    return projection.attempt.launchProject.path
  }
  return projection.data.launchProject.path
}

function getPlanningUnavailableReason(input: SelectTerminalCwdTargetStateInput): string {
  if (input.transportError) return `Root Context transport failed: ${input.transportError.message}`
  if (input.isLoading || !input.projection || input.projection.state === 'loading') {
    return 'Planning root is still being resolved.'
  }
  if (input.projection.state === 'refreshing') {
    return 'Planning root is refreshing; wait for a current CLI observation.'
  }
  if (input.projection.state === 'error') {
    return `Planning root is unavailable: ${input.projection.error.message}`
  }
  return 'OpenSpec did not resolve a planning root.'
}

/** Keep planning-root availability tied to a current ready Root Context only. */
export function selectTerminalCwdTargetState(
  input: SelectTerminalCwdTargetStateInput
): TerminalCwdTargetState {
  const readyPlanningRoot =
    !input.isLoading &&
    !input.transportError &&
    input.projection?.state === 'ready' &&
    input.projection.data.planningRoot
      ? input.projection.data.planningRoot
      : null

  return {
    launchProject: {
      target: 'launch-project',
      label: 'Launch project',
      path: selectObservedLaunchPath(input.projection),
      available: true,
      unavailableReason: null,
    },
    planningRoot: {
      target: 'planning-root',
      label: 'Planning root',
      path: readyPlanningRoot?.path ?? null,
      available: readyPlanningRoot !== null,
      unavailableReason: readyPlanningRoot ? null : getPlanningUnavailableReason(input),
    },
  }
}

export function useTerminalCwdTargetState(): TerminalCwdTargetState {
  const subscription = useContextSubscription()
  return selectTerminalCwdTargetState({
    projection: subscription.data,
    isLoading: subscription.isLoading,
    transportError: subscription.error,
  })
}

export function getTerminalCwdTargetOption(
  state: TerminalCwdTargetState,
  target: TerminalCwdTarget
): TerminalCwdTargetOption {
  return target === 'planning-root' ? state.planningRoot : state.launchProject
}
