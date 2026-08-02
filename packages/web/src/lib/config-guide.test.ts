/**
 * Orthogonal intents (created 2026-08-02 Asia/Shanghai):
 * 1. Prove every adaptive Guide stage status remains distinct in the reducer.
 * 2. Prove only objective ready facts may skip or advance.
 * 3. Prove target failures and presentation callbacks cannot fabricate completion.
 *
 * Original request (2026-08-01): the Config Guide must adapt to current project configuration.
 */
import { describe, expect, it } from 'vitest'
import {
  CONFIG_GUIDE_STAGES,
  INITIAL_CONFIG_GUIDE_STATE,
  reduceConfigGuide,
  type ConfigGuideStageSignal,
  type ConfigGuideStageStatus,
} from './config-guide'

function signal(status: ConfigGuideStageStatus): ConfigGuideStageSignal {
  return { status, title: status, detail: `${status} detail` }
}

describe('Config Guide reducer', () => {
  it.each(['required', 'warning', 'stale', 'blocked', 'failed', 'active-edit'] as const)(
    'does not skip %s stage facts',
    (status) => {
      let state = reduceConfigGuide(INITIAL_CONFIG_GUIDE_STATE, { type: 'start' })
      state = reduceConfigGuide(state, {
        type: 'observe',
        stage: 'project-binding',
        signal: signal(status),
      })

      expect(state).toMatchObject({ lifecycle: 'active', stage: 'project-binding' })
      expect(reduceConfigGuide(state, { type: 'next' })).toEqual(state)
    }
  )

  it('skips only ready stages and completes only after ready Resolved Context', () => {
    let state = reduceConfigGuide(INITIAL_CONFIG_GUIDE_STATE, { type: 'start' })
    for (const stage of CONFIG_GUIDE_STAGES) {
      state = reduceConfigGuide(state, { type: 'observe', stage, signal: signal('ready') })
    }
    expect(state).toMatchObject({ lifecycle: 'complete', stage: null })
  })

  it('keeps presentation completion non-authoritative', () => {
    const active = reduceConfigGuide(INITIAL_CONFIG_GUIDE_STATE, { type: 'start' })
    expect(reduceConfigGuide(active, { type: 'presentation-done' })).toEqual(active)
  })

  it('projects a missing semantic target as retryable failure', () => {
    const active = reduceConfigGuide(INITIAL_CONFIG_GUIDE_STATE, { type: 'start' })
    const failed = reduceConfigGuide(active, {
      type: 'target-missing',
      stage: 'project-binding',
    })
    expect(failed).toMatchObject({ lifecycle: 'target-failed', stage: 'project-binding' })
    expect(reduceConfigGuide(failed, { type: 'retry-target' })).toMatchObject({
      lifecycle: 'active',
      stage: 'project-binding',
    })
  })

  it('allows explicit back review without reclassifying a ready stage', () => {
    let state = reduceConfigGuide(INITIAL_CONFIG_GUIDE_STATE, { type: 'start' })
    state = reduceConfigGuide(state, {
      type: 'observe',
      stage: 'project-binding',
      signal: signal('ready'),
    })
    expect(state.stage).toBe('active-root')
    state = reduceConfigGuide(state, { type: 'previous' })
    expect(state).toMatchObject({ stage: 'project-binding', reviewing: true })
    state = reduceConfigGuide(state, {
      type: 'observe',
      stage: 'project-binding',
      signal: signal('ready'),
    })
    expect(state.stage).toBe('project-binding')
    expect(reduceConfigGuide(state, { type: 'next' }).stage).toBe('active-root')
  })

  it('restarts from fresh owner observations instead of retained ready signals', () => {
    let state = reduceConfigGuide(INITIAL_CONFIG_GUIDE_STATE, { type: 'start' })
    state = reduceConfigGuide(state, {
      type: 'observe',
      stage: 'project-binding',
      signal: signal('ready'),
    })
    expect(state.stage).toBe('active-root')

    state = reduceConfigGuide(state, { type: 'restart' })
    expect(state).toMatchObject({ lifecycle: 'active', stage: 'project-binding', signals: {} })
  })
})
