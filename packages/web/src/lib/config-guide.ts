/**
 * Orthogonal intents (created 2026-08-02 Asia/Shanghai):
 * 1. Define the adaptive Config Guide stage order, semantic routes, and anchors.
 * 2. Reduce projection-owned stage signals into active, paused, failed, cancelled, or complete lifecycle.
 * 3. Permit progression only from objective ready facts while presentation events remain non-authoritative.
 *
 * Original request (2026-08-01): add a Config Guide that leads users through OpenSpec project configuration.
 */
export const CONFIG_GUIDE_STAGES = [
  'project-binding',
  'active-root',
  'agent-delivery',
  'resolved-context',
] as const

export type ConfigGuideStageId = (typeof CONFIG_GUIDE_STAGES)[number]
export type ConfigGuideStageStatus =
  | 'ready'
  | 'required'
  | 'warning'
  | 'stale'
  | 'blocked'
  | 'failed'
  | 'active-edit'

export interface ConfigGuideStageSignal {
  status: ConfigGuideStageStatus
  title: string
  detail: string
}

export const CONFIG_GUIDE_STAGE_META: Record<
  ConfigGuideStageId,
  { route: string; anchor: string; label: string }
> = {
  'project-binding': {
    route: '/config/project',
    anchor: 'config-guide-project-binding',
    label: 'Project Binding',
  },
  'active-root': {
    route: '/config/root',
    anchor: 'config-guide-active-root',
    label: 'Active Root',
  },
  'agent-delivery': {
    route: '/config/agents',
    anchor: 'config-guide-agent-delivery',
    label: 'Agent Delivery',
  },
  'resolved-context': {
    route: '/config/context',
    anchor: 'config-guide-resolved-context',
    label: 'Resolved Context',
  },
}

export type ConfigGuideLifecycle = 'idle' | 'active' | 'target-failed' | 'cancelled' | 'complete'

export interface ConfigGuideState {
  lifecycle: ConfigGuideLifecycle
  stage: ConfigGuideStageId | null
  signals: Partial<Record<ConfigGuideStageId, ConfigGuideStageSignal>>
  reviewing: boolean
  failure: string | null
}

export type ConfigGuideAction =
  | { type: 'start' | 'restart' }
  | { type: 'observe'; stage: ConfigGuideStageId; signal: ConfigGuideStageSignal }
  | { type: 'next' }
  | { type: 'previous' }
  | { type: 'target-missing'; stage: ConfigGuideStageId }
  | { type: 'retry-target' }
  | { type: 'cancel' }
  | { type: 'dismiss' }
  | { type: 'presentation-done' }

export const INITIAL_CONFIG_GUIDE_STATE: ConfigGuideState = {
  lifecycle: 'idle',
  stage: null,
  signals: {},
  reviewing: false,
  failure: null,
}

function stageIndex(stage: ConfigGuideStageId): number {
  return CONFIG_GUIDE_STAGES.indexOf(stage)
}

function advance(fromIndex: number, signals: ConfigGuideState['signals']): ConfigGuideState {
  for (let index = fromIndex; index < CONFIG_GUIDE_STAGES.length; index += 1) {
    const stage = CONFIG_GUIDE_STAGES[index]
    if (signals[stage]?.status !== 'ready') {
      return {
        lifecycle: 'active',
        stage,
        signals,
        reviewing: false,
        failure: null,
      }
    }
  }
  return { lifecycle: 'complete', stage: null, signals, reviewing: false, failure: null }
}

/** Pure Guide authority; Driver callbacks may request actions but cannot create readiness. */
export function reduceConfigGuide(
  state: ConfigGuideState,
  action: ConfigGuideAction
): ConfigGuideState {
  if (action.type === 'start' || action.type === 'restart') {
    return advance(0, {})
  }
  if (action.type === 'dismiss') return INITIAL_CONFIG_GUIDE_STATE
  if (action.type === 'cancel') return { ...state, lifecycle: 'cancelled', failure: null }
  if (action.type === 'presentation-done') return state
  if (action.type === 'target-missing') {
    return {
      ...state,
      lifecycle: 'target-failed',
      stage: action.stage,
      failure: `Guide target ${CONFIG_GUIDE_STAGE_META[action.stage].anchor} is unavailable.`,
    }
  }
  if (action.type === 'retry-target') {
    return state.stage
      ? { ...state, lifecycle: 'active', failure: null }
      : reduceConfigGuide(state, { type: 'restart' })
  }
  if (action.type === 'observe') {
    const signals = { ...state.signals, [action.stage]: action.signal }
    if (
      state.lifecycle === 'active' &&
      state.stage === action.stage &&
      action.signal.status === 'ready' &&
      !state.reviewing
    ) {
      return advance(stageIndex(action.stage) + 1, signals)
    }
    return { ...state, signals }
  }
  if (state.lifecycle !== 'active' || !state.stage) return state
  if (action.type === 'previous') {
    const previousIndex = stageIndex(state.stage) - 1
    return previousIndex < 0
      ? state
      : {
          ...state,
          stage: CONFIG_GUIDE_STAGES[previousIndex],
          reviewing: true,
          failure: null,
        }
  }
  if (action.type === 'next') {
    if (state.signals[state.stage]?.status !== 'ready') return state
    return advance(stageIndex(state.stage) + 1, state.signals)
  }
  return state
}
