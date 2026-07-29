/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Verify launch-project terminal cwd is always selectable and same-root topology is explicit.
 * 2. Verify planning-root terminal cwd requires a current ready Root Context.
 * 3. Verify displayed paths come from Root Context observations.
 *
 * Original request (2026-07-16): "Terminal exposes explicit launch-project cwd and planning-root cwd."
 * Owner same-root direction (2026-07-29): omit cwd switching only for canonical same-root identity.
 */
import type { RootContext, RootContextState } from '@openspecui/core'
import { describe, expect, it } from 'vitest'
import { selectTerminalCwdTargetState } from './use-terminal-cwd-target'

function context(): RootContext {
  return {
    launchProject: { path: '/launch' },
    planningRoot: {
      path: '/stores/shared',
      source: 'store',
      store_id: 'shared',
      healthy: true,
      status: [],
    },
    storeId: 'shared',
    cli: { available: true, version: '1.6.0' },
    references: [],
    contextMembers: [],
    dataScope: {
      path: '/runtime/openspec',
      source: 'xdg-data-home',
      environmentVariable: 'XDG_DATA_HOME',
    },
    diagnostics: { root: [], doctor: [], context: [] },
    evidence: { doctor: null, context: null },
    observedAt: 1,
  }
}

function select(
  projection: RootContextState | undefined,
  options: { isLoading?: boolean; transportError?: Error | null } = {}
) {
  return selectTerminalCwdTargetState({
    projection,
    isLoading: options.isLoading ?? false,
    transportError: options.transportError ?? null,
  })
}

describe('selectTerminalCwdTargetState', () => {
  it('keeps launch-project available before Root Context resolves', () => {
    const state = select(undefined, { isLoading: true })

    expect(state.launchProject).toMatchObject({
      target: 'launch-project',
      path: null,
      available: true,
    })
    expect(state.planningRoot).toMatchObject({
      target: 'planning-root',
      path: null,
      available: false,
    })
  })

  it('uses observed paths and unlocks planning-root only for current ready data', () => {
    const rootContext = context()
    const state = select({
      state: 'ready',
      data: rootContext,
      attempt: null,
      error: null,
      observedAt: 2,
    })

    expect(state.launchProject).toMatchObject({ path: '/launch', available: true })
    expect(state.planningRoot).toMatchObject({ path: '/stores/shared', available: true })
    expect(state.topology).toBe('distinct')
  })

  it('reports collapsed topology from the physical Launch identity', () => {
    const rootContext = context()
    rootContext.launchProject = { path: '/launch-link', physicalPath: '/stores/shared' }
    const state = select({
      state: 'ready',
      data: rootContext,
      attempt: null,
      error: null,
      observedAt: 2,
    })

    expect(state.topology).toBe('collapsed')
  })

  it('locks planning-root during refresh even when stale paths exist', () => {
    const state = select({
      state: 'refreshing',
      data: context(),
      attempt: null,
      error: null,
      observedAt: 3,
    })

    expect(state.launchProject.path).toBe('/launch')
    expect(state.topology).toBe('distinct')
    expect(state.planningRoot).toMatchObject({ path: null, available: false })
    expect(state.planningRoot.unavailableReason).toContain('refreshing')
  })

  it('locks planning-root on CLI and transport errors without hiding launch identity', () => {
    const failed = context()
    const errorState = select({
      state: 'error',
      data: context(),
      attempt: failed,
      error: { code: 'root-unhealthy', message: 'Store root is unhealthy.' },
      observedAt: 4,
    })
    const transportState = select(undefined, {
      transportError: new Error('websocket unavailable'),
    })

    expect(errorState.launchProject.path).toBe('/launch')
    expect(errorState.topology).toBe('unresolved')
    expect(errorState.planningRoot).toMatchObject({ available: false, path: null })
    expect(errorState.planningRoot.unavailableReason).toContain('Store root is unhealthy.')
    expect(transportState.launchProject.available).toBe(true)
    expect(transportState.planningRoot.unavailableReason).toContain('websocket unavailable')
  })
})
