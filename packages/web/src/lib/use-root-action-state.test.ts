import type { RootContext, RootContextState } from '@openspecui/core'
import { describe, expect, it } from 'vitest'
import { selectRootActionState } from './use-root-action-state'

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

function select(projection: RootContextState | undefined, isLoading = false) {
  return selectRootActionState({
    projection,
    isLoading,
    transportError: null,
    staticMode: false,
  })
}

describe('selectRootActionState', () => {
  it('locks actions during initial resolution and refresh even with stale data', () => {
    expect(select(undefined, true)).toMatchObject({ status: 'checking', disabled: true })
    expect(
      select({
        state: 'refreshing',
        data: context(),
        attempt: null,
        error: null,
        observedAt: 2,
      })
    ).toMatchObject({ status: 'checking', disabled: true, context: { storeId: 'shared' } })
  })

  it('unlocks actions only for a current ready Root Context', () => {
    expect(
      select({ state: 'ready', data: context(), attempt: null, error: null, observedAt: 3 })
    ).toMatchObject({ status: 'ready', disabled: false, context: { storeId: 'shared' } })
  })

  it('preserves failed Doctor and root diagnostics while stale data remains non-authoritative', () => {
    const attempt = context()
    attempt.diagnostics.root = [
      { severity: 'error', code: 'root_unhealthy', message: 'Store metadata is invalid.' },
    ]
    attempt.evidence.doctor = {
      success: false,
      stdout: '{"status":[]}',
      stderr: 'doctor failed',
      exitCode: 1,
      diagnostics: [
        { severity: 'error', code: 'store_invalid', message: 'Store identity mismatch.' },
      ],
    }

    const state = select({
      state: 'error',
      data: context(),
      attempt,
      error: { code: 'root-unhealthy', message: 'OpenSpec Doctor reported an unhealthy root.' },
      observedAt: 4,
    })

    expect(state).toMatchObject({ status: 'blocked', disabled: true })
    expect(state.evidence).toEqual(
      expect.arrayContaining([
        'Attempted root: /stores/shared (store, Store shared)',
        'root root_unhealthy: Store metadata is invalid.',
        'Doctor exit: 1',
        'Doctor stderr: doctor failed',
        'Doctor store_invalid: Store identity mismatch.',
      ])
    )
  })

  it('keeps static fallbacks available without fabricating backend context', () => {
    expect(
      selectRootActionState({
        projection: undefined,
        isLoading: true,
        transportError: null,
        staticMode: true,
      })
    ).toEqual({
      status: 'ready',
      disabled: false,
      context: null,
      observedAt: 0,
      title: null,
      message: null,
      evidence: [],
    })
  })
})
